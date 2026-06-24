create or replace function public.reject_order_item(p_item_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_item public.order_items%rowtype;
  v_order public.orders%rowtype;
  v_subtotal numeric;
  v_service numeric;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Motivo obrigatorio'; end if;
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  select * into v_item from public.order_items where id = p_item_id for update;
  if v_item.id is null or v_item.restaurant_id <> v_profile.restaurant_id then raise exception 'Item nao encontrado'; end if;
  if not (public.current_roles() && array['owner','manager','kitchen','bar']::public.profile_role[]) then raise exception 'Sem permissao'; end if;
  if v_item.status in ('ready','delivered','cancelled') then raise exception 'Item nao pode ser recusado'; end if;
  update public.order_items set status = 'cancelled', cancel_reason = trim(p_reason), updated_at = now() where id = p_item_id;
  select * into v_order from public.orders where id = v_item.order_id for update;
  select coalesce(sum((unit_price_snapshot + coalesce(variation_price_delta,0)) * quantity),0) into v_subtotal from public.order_items where order_id = v_order.id and status <> 'cancelled';
  v_service := case when coalesce(v_order.service_fee,0) > 0 then round(greatest(v_subtotal - v_order.discount,0) * ((select service_fee_percent from public.restaurant_settings where restaurant_id = v_order.restaurant_id) / 100),2) else 0 end;
  update public.orders set subtotal = v_subtotal, service_fee = coalesce(v_service,0), total = greatest(v_subtotal - discount,0) + coalesce(v_service,0) + coalesce(delivery_fee,0), updated_at = now() where id = v_order.id;
  return p_item_id;
end;
$$;
grant execute on function public.reject_order_item(uuid, text) to authenticated;
