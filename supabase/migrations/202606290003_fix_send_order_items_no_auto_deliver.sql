-- Fix: send_order_items must NOT auto-deliver items without preparation.
-- Items with preparation_sector = 'none' stay pending until waiter clicks "Entregar".
-- Only items with preparation_sector != 'none' are sent to preparation queue.

create or replace function public.send_order_items(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_has_prep boolean;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active and deleted_at is null limit 1;
  if v_profile.id is null or not (public.current_roles() && array['owner','manager','waiter']::public.profile_role[]) then
    raise exception 'Sem permissão';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and restaurant_id = v_profile.restaurant_id and status not in ('closed','cancelled')
  for update;
  if v_order.id is null then raise exception 'Pedido não encontrado'; end if;

  select exists(
    select 1 from public.order_items
    where order_id = v_order.id and status = 'pending' and preparation_sector <> 'none'
  ) into v_has_prep;

  -- Only send items that need preparation; items without prep stay pending
  update public.order_items
  set status = 'sent',
      sent_at = now(),
      updated_at = now()
  where order_id = v_order.id
    and status = 'pending'
    and preparation_sector <> 'none';

  -- Update order status only if there are prep items
  if v_has_prep then
    update public.orders set status = 'sent', updated_at = now() where id = v_order.id;
  end if;

  return v_order.id;
end;
$$;

revoke all on function public.send_order_items(uuid) from public, anon;
grant execute on function public.send_order_items(uuid) to authenticated;
