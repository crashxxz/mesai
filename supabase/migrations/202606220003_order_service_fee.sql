create or replace function public.apply_order_service_fee(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_percent numeric(5,2);
  v_fee numeric(12,2);
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  if v_profile.id is null or not (public.current_roles() && array['owner','manager','waiter']::public.profile_role[]) then raise exception 'Sem permissao'; end if;
  select * into v_order from public.orders where id = p_order_id and restaurant_id = v_profile.restaurant_id and status not in ('closed', 'cancelled') for update;
  if v_order.id is null then raise exception 'Pedido nao encontrado'; end if;
  select service_fee_percent into v_percent from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  v_fee := round(greatest(v_order.subtotal - v_order.discount, 0) * (coalesce(v_percent, 0) / 100), 2);
  update public.orders
  set service_fee = v_fee,
      total = greatest(v_order.subtotal - v_order.discount, 0) + v_fee + coalesce(v_order.delivery_fee, 0),
      updated_at = now()
  where id = p_order_id;
  return p_order_id;
end;
$$;

revoke all on function public.apply_order_service_fee(uuid) from public, anon;
grant execute on function public.apply_order_service_fee(uuid) to authenticated;

-- A taxa é opt-in: itens posteriores mantêm a taxa quando ela já foi aplicada,
-- sem incluí-la automaticamente nem duplicá-la.
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
  v_subtotal numeric;
  v_service numeric := 0;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active and deleted_at is null limit 1;
  if v_profile.id is null or not (public.current_roles() && array['owner','manager','waiter']::public.profile_role[]) then raise exception 'Sem permissao'; end if;
  select * into v_order from public.orders where id = p_order_id and restaurant_id = v_profile.restaurant_id and status not in ('closed','cancelled') for update;
  if v_order.id is null then raise exception 'Pedido nao encontrado'; end if;
  select * into v_product from public.products where id = p_product_id and restaurant_id = v_profile.restaurant_id and active and available and price > 0;
  if v_product.id is null then raise exception 'Produto indisponivel'; end if;
  insert into public.order_items (order_id, restaurant_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, notes, preparation_sector, status, created_by)
  values (v_order.id, v_profile.restaurant_id, v_product.id, v_product.name, v_product.price, greatest(p_quantity,1), nullif(trim(p_notes),''), v_product.preparation_sector, 'pending', v_profile.id)
  returning id into v_item_id;
  select coalesce(sum((unit_price_snapshot + coalesce(variation_price_delta,0)) * quantity),0) into v_subtotal from public.order_items where order_id = v_order.id and status <> 'cancelled';
  if coalesce(v_order.service_fee, 0) > 0 then
    select round(v_subtotal * (service_fee_percent / 100), 2) into v_service from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  end if;
  update public.orders
  set subtotal = v_subtotal,
      service_fee = coalesce(v_service, 0),
      total = greatest(v_subtotal - discount, 0) + coalesce(v_service, 0) + coalesce(delivery_fee, 0),
      updated_at = now()
  where id = v_order.id;
  return v_item_id;
end;
$$;

grant execute on function public.add_order_item(uuid, uuid, numeric, text) to authenticated;
