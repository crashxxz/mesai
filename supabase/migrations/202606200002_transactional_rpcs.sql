create unique index if not exists uq_financial_sale_order
  on public.financial_entries(order_id)
  where type = 'income' and category = 'sale' and order_id is not null;

drop policy if exists "orders same restaurant" on public.orders;
create policy "orders read same restaurant" on public.orders
  for select to authenticated using (restaurant_id = public.current_restaurant_id());

drop policy if exists "order items same restaurant" on public.order_items;
create policy "order items read same restaurant" on public.order_items
  for select to authenticated using (restaurant_id = public.current_restaurant_id());

drop policy if exists "tabs same restaurant" on public.tabs;
create policy "tabs read same restaurant" on public.tabs
  for select to authenticated using (restaurant_id = public.current_restaurant_id());

drop policy if exists "payments owner waiter insert" on public.payments;
drop policy if exists "payments owner read" on public.payments;
create policy "payments operational read" on public.payments
  for select to authenticated
  using (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'manager', 'cashier'));

drop policy if exists "cash owner" on public.cash_sessions;
drop policy if exists "cash movements owner" on public.cash_movements;
create policy "cash operational read" on public.cash_sessions
  for select to authenticated
  using (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'manager', 'cashier'));
create policy "cash movements operational read" on public.cash_movements
  for select to authenticated
  using (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'manager', 'cashier'));

create or replace function public.create_order_with_items(
  p_table_id uuid,
  p_customer_name text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_tab_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_item_id uuid;
  v_quantity numeric(12,3);
  v_subtotal numeric(12,2) := 0;
  v_service numeric(12,2) := 0;
  v_addon_id uuid;
  v_addon public.product_addons%rowtype;
  v_addon_total numeric(12,2);
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  if v_profile.id is null or v_profile.role not in ('owner', 'manager', 'waiter', 'cashier') then
    raise exception 'Sem permissão para criar pedido';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Pedido sem itens'; end if;

  if p_table_id is not null then
    perform 1 from public.tables where id = p_table_id and restaurant_id = v_profile.restaurant_id and active for update;
    if not found then raise exception 'Mesa não encontrada'; end if;
    select id into v_tab_id from public.tabs
      where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status = 'open'
      order by opened_at desc limit 1;
  end if;

  if v_tab_id is null then
    insert into public.tabs (restaurant_id, table_id, customer_name, opened_by)
    values (v_profile.restaurant_id, p_table_id, nullif(trim(p_customer_name), ''), v_profile.id)
    returning id into v_tab_id;
  end if;

  insert into public.orders (restaurant_id, table_id, tab_id, customer_name, source, status, created_by, notes)
  values (v_profile.restaurant_id, p_table_id, v_tab_id, nullif(trim(p_customer_name), ''), case when p_table_id is null then 'counter' else 'waiter' end, 'open', v_profile.id, nullif(trim(p_notes), ''))
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(coalesce((v_item->>'quantity')::numeric, 1), 1);
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid
        and restaurant_id = v_profile.restaurant_id and active and available and price > 0;
    if v_product.id is null then raise exception 'Produto inválido ou indisponível'; end if;

    v_addon_total := 0;
    for v_addon_id in select value::text::uuid from jsonb_array_elements_text(coalesce(v_item->'addon_ids', '[]'::jsonb))
    loop
      select a.* into v_addon from public.product_addons a
      join public.product_allowed_addons pa on pa.addon_id = a.id
      where pa.product_id = v_product.id and a.id = v_addon_id and a.active;
      if v_addon.id is null then raise exception 'Adicional inválido'; end if;
      v_addon_total := v_addon_total + v_addon.price;
    end loop;

    insert into public.order_items (
      order_id, restaurant_id, product_id, product_name_snapshot, unit_price_snapshot,
      quantity, notes, preparation_sector, status, created_by
    ) values (
      v_order_id, v_profile.restaurant_id, v_product.id, v_product.name, v_product.price,
      v_quantity, nullif(trim(v_item->>'notes'), ''), v_product.preparation_sector, 'pending', v_profile.id
    ) returning id into v_item_id;

    for v_addon_id in select value::text::uuid from jsonb_array_elements_text(coalesce(v_item->'addon_ids', '[]'::jsonb))
    loop
      select a.* into v_addon from public.product_addons a where a.id = v_addon_id;
      insert into public.order_item_addons (order_item_id, addon_name_snapshot, addon_price_snapshot)
      values (v_item_id, v_addon.name, v_addon.price);
    end loop;
    v_subtotal := v_subtotal + ((v_product.price + v_addon_total) * v_quantity);
  end loop;

  select round(v_subtotal * (service_fee_percent / 100), 2) into v_service
  from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  v_service := coalesce(v_service, 0);
  update public.orders set subtotal = v_subtotal, service_fee = v_service, total = v_subtotal + v_service where id = v_order_id;
  if p_table_id is not null then update public.tables set status = 'occupied' where id = p_table_id; end if;
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'order_created', 'orders', v_order_id, jsonb_build_object('subtotal', v_subtotal, 'total', v_subtotal + v_service));
  return v_order_id;
end;
$$;

create or replace function public.create_qr_order(
  p_session_token text,
  p_customer_name text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.qr_sessions%rowtype;
  v_tab_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity numeric(12,3);
  v_subtotal numeric(12,2) := 0;
  v_service numeric(12,2) := 0;
  v_needs_approval boolean;
begin
  select * into v_session from public.qr_sessions
  where session_hash = digest(p_session_token, 'sha256') and active and expires_at > now()
  for update;
  if v_session.id is null then raise exception 'Sessão inválida ou expirada'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Pedido sem itens'; end if;
  select qr_orders_need_approval into v_needs_approval from public.restaurant_settings where restaurant_id = v_session.restaurant_id;

  select id into v_tab_id from public.tabs
    where table_id = v_session.table_id and restaurant_id = v_session.restaurant_id and status = 'open'
    order by opened_at desc limit 1;
  if v_tab_id is null then
    insert into public.tabs (restaurant_id, table_id, customer_name)
    values (v_session.restaurant_id, v_session.table_id, nullif(trim(p_customer_name), '')) returning id into v_tab_id;
  end if;

  insert into public.orders (restaurant_id, table_id, tab_id, customer_name, source, status)
  values (v_session.restaurant_id, v_session.table_id, v_tab_id, nullif(trim(p_customer_name), ''), 'qr_code', case when v_needs_approval then 'open' else 'sent' end)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(coalesce((v_item->>'quantity')::numeric, 1), 1);
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid
        and restaurant_id = v_session.restaurant_id and active and available and price > 0;
    if v_product.id is null then raise exception 'Produto inválido ou indisponível'; end if;
    insert into public.order_items (
      order_id, restaurant_id, product_id, product_name_snapshot, unit_price_snapshot,
      quantity, notes, preparation_sector, status, sent_at
    ) values (
      v_order_id, v_session.restaurant_id, v_product.id, v_product.name, v_product.price,
      v_quantity, nullif(trim(v_item->>'notes'), ''), v_product.preparation_sector,
      case when v_needs_approval then 'pending' else 'sent' end,
      case when v_needs_approval then null else now() end
    );
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  select round(v_subtotal * (service_fee_percent / 100), 2) into v_service
  from public.restaurant_settings where restaurant_id = v_session.restaurant_id;
  v_service := coalesce(v_service, 0);
  update public.orders set subtotal = v_subtotal, service_fee = v_service, total = v_subtotal + v_service where id = v_order_id;
  update public.tables set status = 'occupied' where id = v_session.table_id;
  update public.qr_sessions set last_action_at = now() where id = v_session.id;
  return v_order_id;
end;
$$;

create or replace function public.get_qr_order(p_session_token text, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session public.qr_sessions%rowtype;
begin
  select * into v_session from public.qr_sessions
  where session_hash = digest(p_session_token, 'sha256') and active and expires_at > now();
  if v_session.id is null then raise exception 'Sessão inválida ou expirada'; end if;
  if not exists (select 1 from public.orders where id = p_order_id and table_id = v_session.table_id and restaurant_id = v_session.restaurant_id and source = 'qr_code') then
    raise exception 'Pedido não encontrado';
  end if;
  return jsonb_build_object(
    'order', (select to_jsonb(o) from public.orders o where o.id = p_order_id),
    'items', (select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]'::jsonb) from public.order_items i where i.order_id = p_order_id)
  );
end;
$$;

create or replace function public.update_preparation_status(p_item_id uuid, p_status public.order_item_status)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_item public.order_items%rowtype;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  select * into v_item from public.order_items where id = p_item_id for update;
  if v_item.id is null or v_item.restaurant_id <> v_profile.restaurant_id then raise exception 'Item não encontrado'; end if;
  if not (
    v_profile.role in ('owner', 'manager')
    or (v_profile.role = 'kitchen' and v_item.preparation_sector = 'kitchen')
    or (v_profile.role = 'bar' and v_item.preparation_sector = 'bar')
    or (v_profile.role = 'waiter' and p_status = 'delivered')
  ) then raise exception 'Sem permissão para atualizar o item'; end if;
  if not (
    (v_item.status = 'sent' and p_status = 'received')
    or (v_item.status = 'received' and p_status = 'preparing')
    or (v_item.status = 'preparing' and p_status = 'ready')
    or (v_item.status = 'ready' and p_status = 'delivered')
  ) then raise exception 'Transição de status inválida'; end if;
  update public.order_items set
    status = p_status,
    preparing_at = case when p_status = 'preparing' then now() else preparing_at end,
    ready_at = case when p_status = 'ready' then now() else ready_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end
  where id = p_item_id;
  return p_item_id;
end;
$$;

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
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.restaurant_id <> v_profile.restaurant_id or v_order.status in ('closed', 'cancelled') then raise exception 'Pedido inválido'; end if;
  select waiter_can_close_account into v_waiter_allowed from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  if v_profile.role not in ('owner', 'manager', 'cashier') and not (v_profile.role = 'waiter' and v_waiter_allowed) then raise exception 'Sem permissão para receber'; end if;
  if p_amount <= 0 then raise exception 'Valor inválido'; end if;
  insert into public.payments (restaurant_id, order_id, method, amount, card_brand, change_amount, created_by)
  values (v_profile.restaurant_id, p_order_id, p_method, p_amount, nullif(trim(p_card_brand), ''), p_change_amount, v_profile.id)
  returning id into v_payment_id;
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'payment_registered', 'payments', v_payment_id, jsonb_build_object('order_id', p_order_id, 'method', p_method, 'amount', p_amount));
  return v_payment_id;
end;
$$;

create or replace function public.close_paid_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_paid numeric(12,2);
  v_waiter_allowed boolean;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.restaurant_id <> v_profile.restaurant_id or v_order.status in ('closed', 'cancelled') then raise exception 'Pedido inválido'; end if;
  select waiter_can_close_account into v_waiter_allowed from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  if v_profile.role not in ('owner', 'manager', 'cashier') and not (v_profile.role = 'waiter' and v_waiter_allowed) then raise exception 'Sem permissão para fechar'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments where order_id = p_order_id;
  if v_paid < v_order.total then raise exception 'Pagamento incompleto'; end if;
  update public.orders set status = 'closed', closed_by = v_profile.id, closed_at = now() where id = p_order_id;
  update public.tabs set status = 'closed', closed_by = v_profile.id, closed_at = now() where id = v_order.tab_id;
  if v_order.table_id is not null then update public.tables set status = 'free' where id = v_order.table_id; end if;
  insert into public.financial_entries (restaurant_id, type, category, description, amount, date, paid, order_id, created_by)
  values (v_profile.restaurant_id, 'income', 'sale', 'Venda ' || p_order_id::text, v_order.total, current_date, true, p_order_id, v_profile.id)
  on conflict (order_id) where type = 'income' and category = 'sale' and order_id is not null do nothing;
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'order_closed', 'orders', p_order_id, jsonb_build_object('total', v_order.total, 'paid', v_paid));
  return p_order_id;
end;
$$;

create or replace function public.record_stock_movement(p_product_id uuid, p_type text, p_quantity numeric, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_product public.products%rowtype;
  v_id uuid;
  v_next numeric(12,3);
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  if v_profile.role not in ('owner', 'manager') then raise exception 'Sem permissão para estoque'; end if;
  select * into v_product from public.products where id = p_product_id and restaurant_id = v_profile.restaurant_id for update;
  if v_product.id is null or not v_product.has_stock_control then raise exception 'Produto sem controle de estoque'; end if;
  if p_type not in ('entry', 'exit', 'adjustment') or p_quantity <= 0 then raise exception 'Movimento inválido'; end if;
  v_next := case when p_type = 'exit' then coalesce(v_product.stock_quantity, 0) - p_quantity else coalesce(v_product.stock_quantity, 0) + p_quantity end;
  if v_next < 0 then raise exception 'Estoque insuficiente'; end if;
  update public.products set stock_quantity = v_next where id = p_product_id;
  insert into public.stock_movements (restaurant_id, product_id, type, quantity, reason, created_by)
  values (v_profile.restaurant_id, p_product_id, p_type, p_quantity, nullif(trim(p_reason), ''), v_profile.id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_order_with_items(uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_order_with_items(uuid, text, text, jsonb) to authenticated;
revoke all on function public.create_qr_order(text, text, jsonb) from public;
grant execute on function public.create_qr_order(text, text, jsonb) to anon, authenticated;
revoke all on function public.get_qr_order(text, uuid) from public;
grant execute on function public.get_qr_order(text, uuid) to anon, authenticated;
revoke all on function public.update_preparation_status(uuid, public.order_item_status) from public, anon;
grant execute on function public.update_preparation_status(uuid, public.order_item_status) to authenticated;
revoke all on function public.register_order_payment(uuid, public.payment_method, numeric, text, numeric) from public, anon;
grant execute on function public.register_order_payment(uuid, public.payment_method, numeric, text, numeric) to authenticated;
revoke all on function public.close_paid_order(uuid) from public, anon;
grant execute on function public.close_paid_order(uuid) to authenticated;
revoke all on function public.record_stock_movement(uuid, text, numeric, text) from public, anon;
grant execute on function public.record_stock_movement(uuid, text, numeric, text) to authenticated;
