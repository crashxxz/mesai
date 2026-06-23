create extension if not exists pgcrypto;

create or replace function public.get_public_restaurant_tables(p_slug text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'restaurant', jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug),
    'tables', coalesce((select jsonb_agg(jsonb_build_object('id', 'table_' || t.number, 'number', t.number, 'name', t.name) order by t.number) from public.tables t where t.restaurant_id = r.id and t.active), '[]'::jsonb)
  ) from public.restaurants r where r.slug = p_slug limit 1;
$$;

create or replace function public.open_public_table(p_slug text, p_table_ref text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_table public.tables%rowtype;
  v_session text := replace(gen_random_uuid()::text, '-', '');
  v_enabled boolean;
begin
  select * into v_restaurant from public.restaurants where slug = p_slug;
  if v_restaurant.id is null then raise exception 'Estabelecimento não encontrado'; end if;
  select * into v_table from public.tables
    where restaurant_id = v_restaurant.id and active and (
      id::text = p_table_ref or ('table_' || number) = lower(p_table_ref)
    ) limit 1;
  if v_table.id is null then raise exception 'Mesa não encontrada'; end if;
  select qr_orders_enabled into v_enabled from public.restaurant_settings where restaurant_id = v_restaurant.id;
  if not coalesce(v_enabled, false) then raise exception 'Pedido por QR indisponível'; end if;
  insert into public.qr_sessions (restaurant_id, table_id, session_hash, active, expires_at)
  values (v_restaurant.id, v_table.id, digest(v_session, 'sha256'), true, now() + interval '12 hours');
  return jsonb_build_object(
    'session_token', v_session,
    'restaurant', jsonb_build_object('id', v_restaurant.id, 'name', v_restaurant.name, 'slug', v_restaurant.slug, 'phone', v_restaurant.phone, 'whatsapp_url', v_restaurant.whatsapp_url, 'maps_url', v_restaurant.maps_url),
    'settings', (select to_jsonb(s) from public.restaurant_settings s where s.restaurant_id = v_restaurant.id),
    'table', jsonb_build_object('id', v_table.id, 'number', v_table.number, 'name', v_table.name),
    'categories', (select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order), '[]'::jsonb) from public.categories c where c.restaurant_id = v_restaurant.id and c.active),
    'products', (select coalesce(jsonb_agg(to_jsonb(p) order by p.name), '[]'::jsonb) from public.products p where p.restaurant_id = v_restaurant.id and p.active and p.available and p.price > 0),
    'variations', (select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb) from public.product_variations v join public.products p on p.id = v.product_id where p.restaurant_id = v_restaurant.id and p.active and p.available and v.active),
    'addons', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.product_addons a where a.restaurant_id = v_restaurant.id and a.active),
    'allowed_addons', (select coalesce(jsonb_agg(to_jsonb(pa)), '[]'::jsonb) from public.product_allowed_addons pa join public.products p on p.id = pa.product_id where p.restaurant_id = v_restaurant.id and p.active and p.available)
  );
end;
$$;

grant execute on function public.get_public_restaurant_tables(text) to anon, authenticated;
grant execute on function public.open_public_table(text, text) to anon, authenticated;

create or replace function public.ensure_open_table_order(p_table_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles%rowtype; v_order_id uuid; v_tab_id uuid;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active and deleted_at is null limit 1;
  if v_profile.id is null or not (public.current_roles() && array['owner','manager','waiter']::public.profile_role[]) then raise exception 'Sem permissão'; end if;
  perform 1 from public.tables where id = p_table_id and restaurant_id = v_profile.restaurant_id and active;
  if not found then raise exception 'Mesa não encontrada'; end if;
  select id into v_order_id from public.orders where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status not in ('closed','cancelled') order by created_at desc limit 1;
  if v_order_id is not null then return v_order_id; end if;
  update public.qr_sessions set active = false where table_id = p_table_id and active;
  select id into v_tab_id from public.tabs where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status = 'open' order by opened_at desc limit 1;
  if v_tab_id is null then insert into public.tabs (restaurant_id, table_id, opened_by) values (v_profile.restaurant_id, p_table_id, v_profile.id) returning id into v_tab_id; end if;
  insert into public.orders (restaurant_id, table_id, tab_id, source, status, created_by) values (v_profile.restaurant_id, p_table_id, v_tab_id, 'waiter', 'open', v_profile.id) returning id into v_order_id;
  update public.tables set status = 'occupied' where id = p_table_id;
  return v_order_id;
end;
$$;

create or replace function public.add_order_item(p_order_id uuid, p_product_id uuid, p_quantity numeric, p_notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles%rowtype; v_order public.orders%rowtype; v_product public.products%rowtype; v_item_id uuid; v_subtotal numeric; v_service numeric;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active and deleted_at is null limit 1;
  if v_profile.id is null or not (public.current_roles() && array['owner','manager','waiter']::public.profile_role[]) then raise exception 'Sem permissão'; end if;
  select * into v_order from public.orders where id = p_order_id and restaurant_id = v_profile.restaurant_id and status not in ('closed','cancelled') for update;
  if v_order.id is null then raise exception 'Pedido não encontrado'; end if;
  select * into v_product from public.products where id = p_product_id and restaurant_id = v_profile.restaurant_id and active and available and price > 0;
  if v_product.id is null then raise exception 'Produto indisponível'; end if;
  insert into public.order_items (order_id, restaurant_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, preparation_sector, status, created_by)
  values (v_order.id, v_profile.restaurant_id, v_product.id, v_product.name, v_product.price, greatest(p_quantity,1), nullif(trim(p_notes),''), v_product.preparation_sector, 'pending', v_profile.id) returning id into v_item_id;
  select coalesce(sum((unit_price_snapshot + coalesce(variation_price_delta,0)) * quantity),0) into v_subtotal from public.order_items where order_id = v_order.id and status <> 'cancelled';
  select round(v_subtotal * (service_fee_percent / 100), 2) into v_service from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  update public.orders set subtotal = v_subtotal, service_fee = coalesce(v_service,0), total = v_subtotal + coalesce(v_service,0) where id = v_order.id;
  return v_item_id;
end;
$$;

create or replace function public.send_order_items(p_order_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles%rowtype; v_order public.orders%rowtype; v_has_prep boolean;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active and deleted_at is null limit 1;
  if v_profile.id is null or not (public.current_roles() && array['owner','manager','waiter']::public.profile_role[]) then raise exception 'Sem permissão'; end if;
  select * into v_order from public.orders where id = p_order_id and restaurant_id = v_profile.restaurant_id and status not in ('closed','cancelled') for update;
  if v_order.id is null then raise exception 'Pedido não encontrado'; end if;
  select exists(select 1 from public.order_items where order_id = v_order.id and status = 'pending' and preparation_sector <> 'none') into v_has_prep;
  update public.order_items set status = case when preparation_sector = 'none' then 'delivered'::public.order_item_status else 'sent'::public.order_item_status end, sent_at = now(), delivered_at = case when preparation_sector = 'none' then now() else delivered_at end where order_id = v_order.id and status = 'pending';
  update public.orders set status = case when v_has_prep then 'sent'::public.order_status else 'delivered'::public.order_status end where id = v_order.id;
  return v_order.id;
end;
$$;

grant execute on function public.ensure_open_table_order(uuid) to authenticated;
grant execute on function public.add_order_item(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.send_order_items(uuid) to authenticated;

create or replace function public.remove_product(p_product_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active and deleted_at is null limit 1;
  if v_profile.id is null or not (public.current_roles() && array['owner','manager']::public.profile_role[]) then raise exception 'Sem permissão'; end if;
  if exists(select 1 from public.order_items where product_id = p_product_id) then
    update public.products set active = false, available = false where id = p_product_id and restaurant_id = v_profile.restaurant_id;
    if not found then raise exception 'Produto não encontrado'; end if;
    return 'inactivated';
  end if;
  delete from public.products where id = p_product_id and restaurant_id = v_profile.restaurant_id;
  if not found then raise exception 'Produto não encontrado'; end if;
  return 'deleted';
end;
$$;
grant execute on function public.remove_product(uuid) to authenticated;

create or replace function public.deduct_stock_on_order_item_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_reason text := 'Baixa automática por venda';
begin
  if new.status = 'cancelled' then return new; end if;
  select * into v_product from public.products where id = new.product_id for update;
  if v_product.id is null or not coalesce(v_product.has_stock_control, false) then return new; end if;
  update public.products
    set stock_quantity = greatest(coalesce(stock_quantity, 0) - greatest(new.quantity, 1), 0),
        updated_at = now()
    where id = new.product_id;
  insert into public.stock_movements (restaurant_id, product_id, type, quantity, reason, created_by)
  values (new.restaurant_id, new.product_id, 'exit', greatest(new.quantity, 1), v_reason, new.created_by);
  return new;
end;
$$;

drop trigger if exists trg_deduct_stock_on_order_item_insert on public.order_items;
create trigger trg_deduct_stock_on_order_item_insert
after insert on public.order_items
for each row execute function public.deduct_stock_on_order_item_insert();

-- QR publico: somente token secreto, sem abertura por id ou numero de mesa.
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
  v_table public.tables%rowtype;
  v_session text := replace(gen_random_uuid()::text, '-', '');
begin
  select * into v_token
  from public.table_qr_tokens
  where token_hash = digest(p_table_token, 'sha256')
    and active
    and (expires_at is null or expires_at > now());

  if v_token.id is null then raise exception 'QR invalido ou expirado'; end if;
  select * into v_table from public.tables
  where id = v_token.table_id and restaurant_id = v_token.restaurant_id and active;
  if v_table.id is null or v_table.status not in ('occupied', 'closing') then
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
declare
  v_profile public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_paid numeric(12,2);
  v_waiter_allowed boolean;
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
declare
  v_profile public.profiles%rowtype;
  v_table public.tables%rowtype;
  v_waiter_allowed boolean;
  v_total numeric(12,2);
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  select * into v_table from public.tables where id = p_table_id and restaurant_id = v_profile.restaurant_id for update;
  if v_table.id is null then raise exception 'Mesa nao encontrada'; end if;
  select waiter_can_close_account into v_waiter_allowed from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  if v_profile.role not in ('owner', 'manager', 'cashier') and not (v_profile.role = 'waiter' and v_waiter_allowed) then raise exception 'Sem permissao para fechar'; end if;
  if exists (
    select 1 from public.orders o
    where o.table_id = p_table_id and o.restaurant_id = v_profile.restaurant_id and o.status not in ('closed', 'cancelled')
      and coalesce((select sum(p.amount) from public.payments p where p.order_id = o.id), 0) < o.total
  ) then raise exception 'Existem comandas com pagamento pendente'; end if;

  select coalesce(sum(total), 0) into v_total from public.orders
  where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status not in ('closed', 'cancelled');
  insert into public.financial_entries (restaurant_id, type, category, description, amount, date, paid, order_id, created_by)
  select v_profile.restaurant_id, 'income', 'sale', 'Venda ' || o.id::text, o.total, current_date, true, o.id, v_profile.id
  from public.orders o
  where o.table_id = p_table_id and o.restaurant_id = v_profile.restaurant_id and o.status not in ('closed', 'cancelled')
  on conflict (order_id) where type = 'income' and category = 'sale' and order_id is not null do nothing;
  update public.orders set status = 'closed', closed_by = v_profile.id, closed_at = now()
  where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status not in ('closed', 'cancelled');
  update public.tabs set status = 'closed', closed_by = v_profile.id, closed_at = now()
  where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status = 'open';
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
