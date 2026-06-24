-- Cozinha e bar recebem o item diretamente em preparo, sem uma etapa intermediária.
create or replace function public.update_preparation_status(p_item_id uuid, p_status public.order_item_status)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_item public.order_items%rowtype;
  v_roles public.profile_role[];
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active and deleted_at is null limit 1;
  v_roles := public.current_roles();
  select * into v_item from public.order_items where id = p_item_id for update;
  if v_item.id is null or v_item.restaurant_id <> v_profile.restaurant_id then raise exception 'Item nao encontrado'; end if;
  if not (v_roles && array['owner','manager']::public.profile_role[] or ('kitchen' = any(v_roles) and v_item.preparation_sector in ('kitchen','both')) or ('bar' = any(v_roles) and v_item.preparation_sector in ('bar','both')) or ('waiter' = any(v_roles) and p_status = 'delivered')) then raise exception 'Sem permissao'; end if;
  if not ((v_item.status in ('sent','received') and p_status = 'preparing') or (v_item.status = 'preparing' and p_status = 'ready') or (v_item.status = 'ready' and p_status = 'delivered')) then raise exception 'Transicao de status invalida'; end if;
  update public.order_items set status = p_status, preparing_at = case when p_status = 'preparing' then now() else preparing_at end, ready_at = case when p_status = 'ready' then now() else ready_at end, delivered_at = case when p_status = 'delivered' then now() else delivered_at end, updated_at = now() where id = p_item_id;
  return p_item_id;
end;
$$;
grant execute on function public.update_preparation_status(uuid, public.order_item_status) to authenticated;
