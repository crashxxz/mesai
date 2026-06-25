create or replace function public.register_order_payment(
  p_order_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_card_brand text,
  p_change_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_payment_id uuid;
  v_waiter_allowed boolean;
  v_paid numeric(12,2);
  v_remaining numeric(12,2);
  v_amount numeric(12,2);
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.restaurant_id <> v_profile.restaurant_id or v_order.status in ('closed', 'cancelled') then raise exception 'Pedido invalido'; end if;
  select waiter_can_close_account into v_waiter_allowed from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  if v_profile.role not in ('owner', 'manager', 'cashier') and not (v_profile.role = 'waiter' and v_waiter_allowed) then raise exception 'Sem permissao para receber'; end if;
  if p_amount <= 0 then raise exception 'Valor invalido'; end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where order_id = p_order_id and coalesce(payment_status, 'paid') = 'paid';

  v_remaining := round(greatest(v_order.total - v_paid, 0), 2);
  if v_remaining <= 0 then raise exception 'Pedido ja pago'; end if;
  v_amount := round(least(p_amount, v_remaining), 2);
  if v_amount <= 0 then raise exception 'Valor invalido'; end if;

  insert into public.payments (restaurant_id, order_id, method, amount, card_brand, change_amount, provider, payment_status, paid_at, created_by)
  values (v_profile.restaurant_id, p_order_id, p_method, v_amount, nullif(trim(p_card_brand), ''), p_change_amount, 'manual', 'paid', now(), v_profile.id)
  returning id into v_payment_id;

  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'payment_registered', 'payments', v_payment_id, jsonb_build_object('order_id', p_order_id, 'method', p_method, 'amount', v_amount));
  return v_payment_id;
end;
$$;

create or replace function public.close_paid_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_profile public.profiles%rowtype; v_order public.orders%rowtype; v_paid numeric(12,2); v_waiter_allowed boolean;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.restaurant_id <> v_profile.restaurant_id or v_order.status in ('closed', 'cancelled') then raise exception 'Pedido invalido'; end if;
  select waiter_can_close_account into v_waiter_allowed from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  if v_profile.role not in ('owner', 'manager', 'cashier') and not (v_profile.role = 'waiter' and v_waiter_allowed) then raise exception 'Sem permissao para fechar'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments where order_id = p_order_id and coalesce(payment_status, 'paid') = 'paid';
  if v_paid + 0.001 < v_order.total then raise exception 'Pagamento incompleto'; end if;
  update public.orders set status = 'closed', closed_by = v_profile.id, closed_at = now(), updated_at = now() where id = p_order_id;
  if v_order.tab_id is not null and not exists (select 1 from public.orders where tab_id = v_order.tab_id and status not in ('closed', 'cancelled')) then
    update public.tabs set status = 'closed', closed_by = v_profile.id, closed_at = now() where id = v_order.tab_id;
  end if;
  if v_order.table_id is not null and not exists (select 1 from public.orders where table_id = v_order.table_id and status not in ('closed', 'cancelled')) then
    update public.tables set status = 'free', updated_at = now() where id = v_order.table_id;
    update public.qr_sessions set active = false where table_id = v_order.table_id and active;
    update public.table_alerts set active = false, resolved_at = now() where table_id = v_order.table_id and active;
  end if;
  insert into public.financial_entries (restaurant_id, type, category, description, amount, date, paid, order_id, created_by)
  values (v_profile.restaurant_id, 'income', 'sale', 'Venda ' || p_order_id::text, v_order.total, current_date, true, p_order_id, v_profile.id)
  on conflict (order_id) where type = 'income' and category = 'sale' and order_id is not null do nothing;
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'order_closed', 'orders', p_order_id, jsonb_build_object('total', v_order.total, 'paid', v_paid));
  return p_order_id;
end;
$$;

create or replace function public.close_table(p_table_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_profile public.profiles%rowtype; v_table public.tables%rowtype; v_waiter_allowed boolean; v_total numeric(12,2);
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  select * into v_table from public.tables where id = p_table_id and restaurant_id = v_profile.restaurant_id for update;
  if v_table.id is null then raise exception 'Mesa nao encontrada'; end if;
  select waiter_can_close_account into v_waiter_allowed from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  if v_profile.role not in ('owner', 'manager', 'cashier') and not (v_profile.role = 'waiter' and v_waiter_allowed) then raise exception 'Sem permissao para fechar'; end if;
  if exists (
    select 1 from public.orders o
    where o.table_id = p_table_id
      and o.restaurant_id = v_profile.restaurant_id
      and o.status not in ('closed', 'cancelled')
      and coalesce((select sum(p.amount) from public.payments p where p.order_id = o.id and coalesce(p.payment_status, 'paid') = 'paid'), 0) + 0.001 < o.total
  ) then raise exception 'Existem comandas com pagamento pendente'; end if;
  select coalesce(sum(total), 0) into v_total from public.orders where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status not in ('closed', 'cancelled');
  insert into public.financial_entries (restaurant_id, type, category, description, amount, date, paid, order_id, created_by)
  select v_profile.restaurant_id, 'income', 'sale', 'Venda ' || o.id::text, o.total, current_date, true, o.id, v_profile.id from public.orders o
  where o.table_id = p_table_id and o.restaurant_id = v_profile.restaurant_id and o.status not in ('closed', 'cancelled') and o.total > 0
  on conflict (order_id) where type = 'income' and category = 'sale' and order_id is not null do nothing;
  update public.orders set status = 'closed', closed_by = v_profile.id, closed_at = now(), updated_at = now() where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status not in ('closed', 'cancelled');
  update public.tabs set status = 'closed', closed_by = v_profile.id, closed_at = now() where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status = 'open';
  update public.tables set status = 'free', updated_at = now() where id = p_table_id;
  update public.qr_sessions set active = false where table_id = p_table_id and active;
  update public.table_alerts set active = false, resolved_at = now() where table_id = p_table_id and active;
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'table_closed', 'tables', p_table_id, jsonb_build_object('total', v_total));
  return p_table_id;
end;
$$;

revoke all on function public.register_order_payment(uuid, public.payment_method, numeric, text, numeric) from public, anon;
grant execute on function public.register_order_payment(uuid, public.payment_method, numeric, text, numeric) to authenticated;
revoke all on function public.close_paid_order(uuid) from public, anon;
grant execute on function public.close_paid_order(uuid) to authenticated;
revoke all on function public.close_table(uuid) from public, anon;
grant execute on function public.close_table(uuid) to authenticated;
