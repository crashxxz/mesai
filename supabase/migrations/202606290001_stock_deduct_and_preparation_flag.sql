-- 1. Add preparation_required flag to products
-- Default: based on existing preparation_sector (if not 'none', assume needs prep)
alter table public.products
  add column if not exists preparation_required boolean not null default true;

-- Set existing "none" items as not needing prep
update public.products set preparation_required = false where preparation_sector = 'none';

-- 2. Add allow_negative_stock setting
alter table public.restaurant_settings
  add column if not exists allow_negative_stock boolean not null default false;

-- 3. Fix add_order_item RPC to respect preparation_required
create or replace function public.add_order_item(p_order_id uuid, p_product_id uuid, p_quantity numeric, p_notes text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_item_id uuid;
  v_subtotal numeric(12,2);
  v_service numeric(12,2);
  v_effective_sector public.preparation_sector;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  select * into v_order from public.orders where id = p_order_id and restaurant_id = v_profile.restaurant_id for update;
  if v_order.id is null or v_order.status in ('closed', 'cancelled') then raise exception 'Pedido inválido'; end if;
  select * into v_product from public.products where id = p_product_id and restaurant_id = v_profile.restaurant_id and active and available and price > 0;
  if v_product.id is null then raise exception 'Produto indisponível'; end if;

  -- Respect preparation_required flag
  v_effective_sector := case when v_product.preparation_required = false then 'none'::public.preparation_sector else v_product.preparation_sector end;

  insert into public.order_items (order_id, restaurant_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, preparation_sector, status, created_by)
  values (v_order.id, v_profile.restaurant_id, v_product.id, v_product.name, v_product.price, greatest(p_quantity,1), nullif(trim(p_notes),''), v_effective_sector, 'pending', v_profile.id) returning id into v_item_id;

  select coalesce(sum((unit_price_snapshot + coalesce(variation_price_delta,0)) * quantity),0) into v_subtotal from public.order_items where order_id = v_order.id and status <> 'cancelled';
  if coalesce(v_order.service_fee_enabled, true) then
    select round(v_subtotal * (service_fee_percent / 100), 2) into v_service from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  end if;
  update public.orders set subtotal = v_subtotal, service_fee = coalesce(v_service, 0), total = round(greatest(0, v_subtotal - discount + coalesce(v_service, 0) + delivery_fee), 2), updated_at = now() where id = v_order.id;
  return v_item_id;
end;
$$;

revoke all on function public.add_order_item(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.add_order_item(uuid, uuid, numeric, text) to authenticated;

-- 3. Create stock deduction function called on order close
-- Idempotent: checks if already deducted via stock_movements description
create or replace function public.deduct_stock_on_close(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_item record;
  v_product public.products%rowtype;
  v_allow_negative boolean;
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then return; end if;

  select coalesce(allow_negative_stock, false) into v_allow_negative
  from public.restaurant_settings where restaurant_id = v_order.restaurant_id;

  for v_item in
    select oi.product_id, sum(oi.quantity) as total_qty
    from public.order_items oi
    where oi.order_id = p_order_id and oi.status <> 'cancelled'
    group by oi.product_id
  loop
    select * into v_product from public.products
    where id = v_item.product_id and has_stock_control = true
    for update;

    -- Skip products without stock control
    if v_product.id is null then continue; end if;

    -- Skip if already deducted for this order (idempotency)
    if exists (
      select 1 from public.stock_movements
      where product_id = v_item.product_id
        and reason = 'Venda - Pedido ' || p_order_id::text
    ) then continue; end if;

    -- Check negative stock
    if not v_allow_negative and coalesce(v_product.stock_quantity, 0) < v_item.total_qty then
      raise exception 'Estoque insuficiente para %. Disponível: %, necessário: %',
        v_product.name, coalesce(v_product.stock_quantity, 0), v_item.total_qty;
    end if;

    -- Deduct
    update public.products
    set stock_quantity = coalesce(stock_quantity, 0) - v_item.total_qty,
        updated_at = now()
    where id = v_item.product_id;

    -- Record movement
    insert into public.stock_movements (restaurant_id, product_id, type, quantity, reason)
    values (v_order.restaurant_id, v_item.product_id, 'exit', v_item.total_qty, 'Venda - Pedido ' || p_order_id::text);
  end loop;
end;
$$;

-- 4. Update close_paid_order to call stock deduction
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
  select * into v_profile from public.profiles
  where user_id = auth.uid() and active limit 1;
  if v_profile.id is null then raise exception 'Perfil não encontrado'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.restaurant_id <> v_profile.restaurant_id then
    raise exception 'Pedido não encontrado';
  end if;
  if v_order.status in ('closed', 'cancelled') then
    raise exception 'Pedido já fechado ou cancelado';
  end if;

  select coalesce(waiter_can_close_account, true) into v_waiter_allowed
  from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  if v_waiter_allowed is null then v_waiter_allowed := true; end if;

  if v_profile.role not in ('owner', 'manager', 'cashier')
     and not (v_profile.role = 'waiter' and v_waiter_allowed) then
    raise exception 'Sem permissão para fechar conta';
  end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments where order_id = p_order_id and coalesce(payment_status, 'paid') = 'paid';
  if v_paid + 0.001 < v_order.total then
    raise exception 'Pagamento incompleto. Falta R$ ' || round(v_order.total - v_paid, 2)::text;
  end if;

  -- Deduct stock (idempotent, skips products without control)
  perform public.deduct_stock_on_close(p_order_id);

  update public.orders set status = 'closed', closed_by = v_profile.id, closed_at = now(), updated_at = now()
  where id = p_order_id;

  if v_order.tab_id is not null
     and not exists (select 1 from public.orders where tab_id = v_order.tab_id and id <> p_order_id and status not in ('closed', 'cancelled'))
  then
    update public.tabs set status = 'closed', closed_by = v_profile.id, closed_at = now() where id = v_order.tab_id;
  end if;

  if v_order.table_id is not null
     and not exists (select 1 from public.orders where table_id = v_order.table_id and id <> p_order_id and status not in ('closed', 'cancelled'))
  then
    update public.tables set status = 'free', updated_at = now() where id = v_order.table_id;
    update public.qr_sessions set active = false where table_id = v_order.table_id and active;
    update public.table_alerts set active = false, resolved_at = now() where table_id = v_order.table_id and active;
  end if;

  insert into public.financial_entries (restaurant_id, type, category, description, amount, date, paid, payment_method, order_id, created_by)
  values (v_profile.restaurant_id, 'income', 'sale', 'Venda ' || p_order_id::text, v_order.total, current_date, true, null, p_order_id, v_profile.id)
  on conflict (order_id) where type = 'income' and category = 'sale' and order_id is not null do nothing;

  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'order_closed', 'orders', p_order_id,
    jsonb_build_object('total', v_order.total, 'paid', v_paid, 'closed_by_role', v_profile.role));

  return p_order_id;
end;
$$;

revoke all on function public.close_paid_order(uuid) from public, anon;
grant execute on function public.close_paid_order(uuid) to authenticated;
revoke all on function public.deduct_stock_on_close(uuid) from public, anon;
grant execute on function public.deduct_stock_on_close(uuid) to authenticated;

-- 5. Trigger to enforce preparation_required on order_items INSERT
-- This covers ALL flows: create_order_with_items, create_qr_order, add_order_item
create or replace function public.enforce_preparation_required()
returns trigger
language plpgsql
as $$
declare
  v_required boolean;
begin
  select preparation_required into v_required
  from public.products where id = new.product_id;

  if v_required = false then
    new.preparation_sector := 'none';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_preparation_required on public.order_items;
create trigger trg_enforce_preparation_required
  before insert on public.order_items
  for each row execute function public.enforce_preparation_required();
