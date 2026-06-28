-- Estorno completo de venda: cancela financial_entry, payments e cash_movements vinculados.
-- Apenas owner/manager podem estornar.

create or replace function public.cancel_sale(p_order_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_entry public.financial_entries%rowtype;
  v_payment record;
  v_movement record;
  v_cash_session public.cash_sessions%rowtype;
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

  -- Cancelar/estornar payments vinculados
  update public.payments
  set payment_status = 'cancelled'
  where order_id = p_order_id
    and coalesce(payment_status, 'paid') = 'paid';

  -- Criar cash_movements reversos para cada movement de venda dessa order
  for v_movement in
    select cm.* from public.cash_movements cm
    where cm.description like '%' || p_order_id::text || '%'
      and cm.type = 'sale'
      and cm.restaurant_id = v_profile.restaurant_id
  loop
    -- Verificar se já foi estornado (evitar duplicidade)
    if not exists (
      select 1 from public.cash_movements
      where description = 'Estorno: ' || v_movement.description
        and cash_session_id = v_movement.cash_session_id
    ) then
      insert into public.cash_movements (restaurant_id, cash_session_id, type, amount, description, created_by)
      values (v_profile.restaurant_id, v_movement.cash_session_id, 'adjustment', -v_movement.amount, 'Estorno: ' || v_movement.description, v_profile.id);

      -- Ajustar expected_amount da sessão
      update public.cash_sessions
      set expected_amount = expected_amount - v_movement.amount
      where id = v_movement.cash_session_id;
    end if;
  end loop;

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
