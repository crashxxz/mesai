-- Fix: Garçom deve conseguir fechar conta paga quando waiter_can_close_account = true.
-- Esta migration recria close_paid_order de forma robusta, tratando NULL como true.
-- Também garante que a RPC não depende de RLS de cash_sessions (usa security definer).

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
  -- Buscar perfil ativo do usuário
  select * into v_profile from public.profiles
  where user_id = auth.uid() and active limit 1;

  if v_profile.id is null then
    raise exception 'Perfil não encontrado';
  end if;

  -- Buscar e travar order
  select * into v_order from public.orders
  where id = p_order_id for update;

  if v_order.id is null or v_order.restaurant_id <> v_profile.restaurant_id then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.status in ('closed', 'cancelled') then
    raise exception 'Pedido já fechado ou cancelado';
  end if;

  -- Verificar permissão: owner/manager/cashier sempre pode; waiter se configuração permitir
  select coalesce(waiter_can_close_account, true) into v_waiter_allowed
  from public.restaurant_settings
  where restaurant_id = v_profile.restaurant_id;

  -- Se não existir configuração, tratar como true
  if v_waiter_allowed is null then
    v_waiter_allowed := true;
  end if;

  if v_profile.role not in ('owner', 'manager', 'cashier')
     and not (v_profile.role = 'waiter' and v_waiter_allowed) then
    raise exception 'Sem permissão para fechar conta';
  end if;

  -- Verificar se pagamento está completo
  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where order_id = p_order_id and coalesce(payment_status, 'paid') = 'paid';

  if v_paid + 0.001 < v_order.total then
    raise exception 'Pagamento incompleto. Falta R$ ' || round(v_order.total - v_paid, 2)::text;
  end if;

  -- Fechar order
  update public.orders
  set status = 'closed', closed_by = v_profile.id, closed_at = now(), updated_at = now()
  where id = p_order_id;

  -- Fechar tab se todas as orders dela estiverem fechadas
  if v_order.tab_id is not null
     and not exists (
       select 1 from public.orders
       where tab_id = v_order.tab_id and id <> p_order_id and status not in ('closed', 'cancelled')
     ) then
    update public.tabs set status = 'closed', closed_by = v_profile.id, closed_at = now()
    where id = v_order.tab_id;
  end if;

  -- Liberar mesa se não há outras orders abertas nela
  if v_order.table_id is not null
     and not exists (
       select 1 from public.orders
       where table_id = v_order.table_id and id <> p_order_id and status not in ('closed', 'cancelled')
     ) then
    update public.tables set status = 'free', updated_at = now()
    where id = v_order.table_id;

    -- Invalidar sessões QR da mesa
    update public.qr_sessions set active = false
    where table_id = v_order.table_id and active;

    -- Resolver alertas da mesa
    update public.table_alerts set active = false, resolved_at = now()
    where table_id = v_order.table_id and active;
  end if;

  -- Criar financial_entry de venda (sem duplicar)
  insert into public.financial_entries (restaurant_id, type, category, description, amount, date, paid, payment_method, order_id, created_by)
  values (v_profile.restaurant_id, 'income', 'sale', 'Venda ' || p_order_id::text, v_order.total, current_date, true, null, p_order_id, v_profile.id)
  on conflict (order_id) where type = 'income' and category = 'sale' and order_id is not null do nothing;

  -- Auditoria
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'order_closed', 'orders', p_order_id,
    jsonb_build_object('total', v_order.total, 'paid', v_paid, 'closed_by_role', v_profile.role));

  return p_order_id;
end;
$$;

-- Garantir permissões
revoke all on function public.close_paid_order(uuid) from public, anon;
grant execute on function public.close_paid_order(uuid) to authenticated;
