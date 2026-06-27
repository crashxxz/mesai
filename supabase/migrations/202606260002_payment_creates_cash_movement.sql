-- Fix: register_order_payment should create a cash_movement when there's an open
-- cash session and payment method is cash. This keeps the "expected amount" accurate.
-- Also creates cash_movement for all methods so the cash register tracks ALL receipts.

create or replace function public.register_order_payment(
  p_order_id uuid,
  p_method public.payment_method,
  p_amount numeric,
  p_card_brand text,
  p_change_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_payment_id uuid;
  v_waiter_allowed boolean;
  v_paid numeric(12,2);
  v_remaining numeric(12,2);
  v_amount numeric(12,2);
  v_cash_session public.cash_sessions%rowtype;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.restaurant_id <> v_profile.restaurant_id or v_order.status in ('closed', 'cancelled') then raise exception 'Pedido inválido'; end if;
  select waiter_can_close_account into v_waiter_allowed from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  if v_profile.role not in ('owner', 'manager', 'cashier') and not (v_profile.role = 'waiter' and v_waiter_allowed) then raise exception 'Sem permissão para receber'; end if;
  if p_amount <= 0 then raise exception 'Valor inválido'; end if;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments
  where order_id = p_order_id and coalesce(payment_status, 'paid') = 'paid';

  v_remaining := round(greatest(v_order.total - v_paid, 0), 2);
  if v_remaining <= 0 then raise exception 'Pedido já pago'; end if;
  v_amount := round(least(p_amount, v_remaining), 2);
  if v_amount <= 0 then raise exception 'Valor inválido'; end if;

  insert into public.payments (restaurant_id, order_id, method, amount, card_brand, change_amount, provider, payment_status, paid_at, created_by)
  values (v_profile.restaurant_id, p_order_id, p_method, v_amount, nullif(trim(p_card_brand), ''), p_change_amount, 'manual', 'paid', now(), v_profile.id)
  returning id into v_payment_id;

  -- Register cash movement if there's an open cash session
  select * into v_cash_session from public.cash_sessions
  where restaurant_id = v_profile.restaurant_id and status = 'open'
  limit 1;

  if v_cash_session.id is not null then
    insert into public.cash_movements (restaurant_id, cash_session_id, type, amount, description, created_by)
    values (v_profile.restaurant_id, v_cash_session.id, 'sale', v_amount, 'Pedido ' || p_order_id::text, v_profile.id);

    update public.cash_sessions
    set expected_amount = expected_amount + v_amount
    where id = v_cash_session.id;
  end if;

  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'payment_registered', 'payments', v_payment_id, jsonb_build_object('order_id', p_order_id, 'method', p_method, 'amount', v_amount));
  return v_payment_id;
end;
$$;
