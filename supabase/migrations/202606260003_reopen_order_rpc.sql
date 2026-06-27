-- RPC: reopen_order
-- Allows owner/manager to reopen a closed or cancelled order for correction.
-- Does NOT touch payments or financial_entries (estorno is a separate action).

create or replace function public.reopen_order(p_order_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_order public.orders%rowtype;
begin
  if nullif(trim(p_reason), '') is null then
    raise exception 'Motivo obrigatório';
  end if;

  select * into v_profile from public.profiles
  where user_id = auth.uid() and active limit 1;

  if v_profile.id is null then
    raise exception 'Perfil não encontrado';
  end if;

  if v_profile.role not in ('owner', 'manager') then
    raise exception 'Sem permissão para reabrir pedido';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and restaurant_id = v_profile.restaurant_id
  for update;

  if v_order.id is null then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.status not in ('closed', 'cancelled') then
    raise exception 'Pedido já está aberto';
  end if;

  -- Reopen the order
  update public.orders
  set status = 'open',
      closed_at = null,
      closed_by = null,
      cancel_reason = null,
      updated_at = now()
  where id = p_order_id;

  -- Reopen the tab if it was closed with this order
  if v_order.tab_id is not null then
    update public.tabs
    set status = 'open',
        closed_at = null,
        closed_by = null
    where id = v_order.tab_id
      and status in ('closed', 'cancelled');
  end if;

  -- Re-occupy the table if it was freed
  if v_order.table_id is not null then
    update public.tables
    set status = 'occupied',
        updated_at = now()
    where id = v_order.table_id
      and status = 'free';
  end if;

  -- Audit log
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, old_data, new_data)
  values (
    v_profile.restaurant_id,
    v_profile.id,
    'order_reopened',
    'orders',
    p_order_id,
    jsonb_build_object('status', v_order.status, 'closed_at', v_order.closed_at),
    jsonb_build_object('reason', trim(p_reason))
  );

  return p_order_id;
end;
$$;

revoke all on function public.reopen_order(uuid, text) from public, anon;
grant execute on function public.reopen_order(uuid, text) to authenticated;
