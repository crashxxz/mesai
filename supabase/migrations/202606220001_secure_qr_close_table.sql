-- Aplicar em projetos que ja executaram as migrations anteriores.
create extension if not exists pgcrypto;

create or replace function public.rotate_table_qr_token(p_table_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_restaurant_id uuid;
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  select restaurant_id into v_restaurant_id from public.tables where id = p_table_id and active = true;
  if v_restaurant_id is null or v_restaurant_id <> public.current_restaurant_id() then raise exception 'Mesa nao encontrada'; end if;
  if public.current_role() not in ('owner', 'manager') then raise exception 'Sem permissao para gerar QR'; end if;
  insert into public.table_qr_tokens (restaurant_id, table_id, token_hash, active, rotated_at, created_by)
  values (v_restaurant_id, p_table_id, digest(v_token, 'sha256'), true, now(), (select id from public.profiles where user_id = auth.uid() and active limit 1))
  on conflict (table_id) do update set token_hash = excluded.token_hash, active = true, expires_at = null, rotated_at = now(), created_by = excluded.created_by;
  update public.qr_sessions set active = false where table_id = p_table_id and active;
  return v_token;
end;
$$;

alter function public.get_public_menu(text) set search_path = public, extensions;
alter function public.request_table_service(text, text) set search_path = public, extensions;
alter function public.create_qr_order(text, text, jsonb) set search_path = public, extensions;
alter function public.get_qr_order(text, uuid) set search_path = public, extensions;

create or replace function public.deduct_stock_on_order_item_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_product public.products%rowtype;
begin
  if new.status = 'cancelled' then return new; end if;
  select * into v_product from public.products where id = new.product_id for update;
  if v_product.id is null or not coalesce(v_product.has_stock_control, false) then return new; end if;
  update public.products set stock_quantity = greatest(coalesce(stock_quantity, 0) - greatest(new.quantity, 1), 0), updated_at = now() where id = new.product_id;
  insert into public.stock_movements (restaurant_id, product_id, type, quantity, reason, created_by)
  values (new.restaurant_id, new.product_id, 'exit', greatest(new.quantity, 1), 'Baixa automática por venda', new.created_by);
  return new;
end;
$$;
drop trigger if exists trg_deduct_stock_on_order_item_insert on public.order_items;
create trigger trg_deduct_stock_on_order_item_insert after insert on public.order_items
for each row execute function public.deduct_stock_on_order_item_insert();

revoke all on function public.get_public_restaurant_tables(text) from public, anon, authenticated;
revoke all on function public.open_public_table(text, text) from public, anon, authenticated;

create or replace function public.start_qr_session(p_table_token text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token public.table_qr_tokens%rowtype;
  v_session text := replace(gen_random_uuid()::text, '-', '');
begin
  select * into v_token from public.table_qr_tokens
  where token_hash = digest(p_table_token, 'sha256') and active and (expires_at is null or expires_at > now());
  if v_token.id is null then raise exception 'QR invalido ou expirado'; end if;
  if not exists (select 1 from public.orders where table_id = v_token.table_id and restaurant_id = v_token.restaurant_id and status not in ('closed', 'cancelled')) then
    raise exception 'Mesa aguardando abertura';
  end if;
  insert into public.qr_sessions (restaurant_id, table_id, session_hash, active, expires_at)
  values (v_token.restaurant_id, v_token.table_id, digest(v_session, 'sha256'), true, now() + interval '12 hours');
  return v_session;
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
  select coalesce(sum(amount), 0) into v_paid from public.payments where order_id = p_order_id;
  if v_paid < v_order.total then raise exception 'Pagamento incompleto'; end if;
  update public.orders set status = 'closed', closed_by = v_profile.id, closed_at = now() where id = p_order_id;
  if v_order.tab_id is not null and not exists (select 1 from public.orders where tab_id = v_order.tab_id and status not in ('closed', 'cancelled')) then
    update public.tabs set status = 'closed', closed_by = v_profile.id, closed_at = now() where id = v_order.tab_id;
  end if;
  if v_order.table_id is not null and not exists (select 1 from public.orders where table_id = v_order.table_id and status not in ('closed', 'cancelled')) then
    update public.tables set status = 'free' where id = v_order.table_id;
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
  if exists (select 1 from public.orders o where o.table_id = p_table_id and o.restaurant_id = v_profile.restaurant_id and o.status not in ('closed', 'cancelled') and coalesce((select sum(p.amount) from public.payments p where p.order_id = o.id), 0) < o.total) then raise exception 'Existem comandas com pagamento pendente'; end if;
  select coalesce(sum(total), 0) into v_total from public.orders where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status not in ('closed', 'cancelled');
  insert into public.financial_entries (restaurant_id, type, category, description, amount, date, paid, order_id, created_by)
  select v_profile.restaurant_id, 'income', 'sale', 'Venda ' || o.id::text, o.total, current_date, true, o.id, v_profile.id from public.orders o
  where o.table_id = p_table_id and o.restaurant_id = v_profile.restaurant_id and o.status not in ('closed', 'cancelled')
  on conflict (order_id) where type = 'income' and category = 'sale' and order_id is not null do nothing;
  update public.orders set status = 'closed', closed_by = v_profile.id, closed_at = now() where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status not in ('closed', 'cancelled');
  update public.tabs set status = 'closed', closed_by = v_profile.id, closed_at = now() where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status = 'open';
  update public.tables set status = 'free' where id = p_table_id;
  update public.qr_sessions set active = false where table_id = p_table_id and active;
  update public.table_alerts set active = false, resolved_at = now() where table_id = p_table_id and active;
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'table_closed', 'tables', p_table_id, jsonb_build_object('total', v_total));
  return p_table_id;
end;
$$;

revoke all on function public.close_table(uuid) from public, anon;
grant execute on function public.close_table(uuid) to authenticated;
