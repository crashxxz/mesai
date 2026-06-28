-- Redefinir cancel_sale para incluir restauração de estoque no estorno.
-- Idempotente: não restaura duplicado se já existe stock_movement "Estorno - Pedido X".

create or replace function public.cancel_sale(p_order_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_movement record;
  v_stock_mov record;
begin
  if nullif(trim(p_reason), '') is null then
    raise exception 'Motivo obrigatório';
  end if;

  select * into v_profile from public.profiles
  where user_id = auth.uid() and active limit 1;

  if v_profile.id is null or v_profile.role not in ('owner', 'manager') then
    raise exception 'Sem permissão para estornar venda';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and restaurant_id = v_profile.restaurant_id;

  if v_order.id is null then
    raise exception 'Pedido não encontrado';
  end if;

  -- Cancelar financial_entry vinculada
  update public.financial_entries
  set paid = false,
      cancelled_at = now(),
      cancel_reason = trim(p_reason),
      updated_at = now()
  where order_id = p_order_id
    and type = 'income'
    and category = 'sale'
    and paid = true
    and cancelled_at is null;

  -- Cancelar payments vinculados
  update public.payments
  set payment_status = 'cancelled'
  where order_id = p_order_id
    and coalesce(payment_status, 'paid') = 'paid';

  -- Criar cash_movements reversos
  for v_movement in
    select cm.* from public.cash_movements cm
    where cm.description like '%' || p_order_id::text || '%'
      and cm.type = 'sale'
      and cm.restaurant_id = v_profile.restaurant_id
  loop
    if not exists (
      select 1 from public.cash_movements
      where description = 'Estorno: ' || v_movement.description
        and cash_session_id = v_movement.cash_session_id
    ) then
      insert into public.cash_movements (restaurant_id, cash_session_id, type, amount, description, created_by)
      values (v_profile.restaurant_id, v_movement.cash_session_id, 'adjustment', -v_movement.amount, 'Estorno: ' || v_movement.description, v_profile.id);

      update public.cash_sessions
      set expected_amount = expected_amount - v_movement.amount
      where id = v_movement.cash_session_id;
    end if;
  end loop;

  -- Restaurar estoque (idempotente)
  if not exists (
    select 1 from public.stock_movements
    where reason = 'Estorno - Pedido ' || p_order_id::text
    limit 1
  ) then
    for v_stock_mov in
      select sm.product_id, sm.quantity
      from public.stock_movements sm
      where sm.reason = 'Venda - Pedido ' || p_order_id::text
        and sm.type = 'exit'
    loop
      update public.products
      set stock_quantity = coalesce(stock_quantity, 0) + v_stock_mov.quantity,
          updated_at = now()
      where id = v_stock_mov.product_id and has_stock_control = true;

      insert into public.stock_movements (restaurant_id, product_id, type, quantity, reason, created_by)
      values (v_profile.restaurant_id, v_stock_mov.product_id, 'entry', v_stock_mov.quantity, 'Estorno - Pedido ' || p_order_id::text, v_profile.id);
    end loop;
  end if;

  -- Marcar order como cancelada
  update public.orders
  set status = 'cancelled',
      cancel_reason = trim(p_reason),
      updated_at = now()
  where id = p_order_id;

  -- Auditoria
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'sale_cancelled', 'orders', p_order_id,
    jsonb_build_object('reason', trim(p_reason), 'total', v_order.total));

  return p_order_id;
end;
$$;

revoke all on function public.cancel_sale(uuid, text) from public, anon;
grant execute on function public.cancel_sale(uuid, text) to authenticated;
