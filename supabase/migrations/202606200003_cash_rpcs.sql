create unique index if not exists uq_open_cash_session_per_restaurant
  on public.cash_sessions(restaurant_id)
  where status = 'open';

create or replace function public.open_cash_session(p_opening_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_session_id uuid;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  if v_profile.role not in ('owner', 'manager', 'cashier') then raise exception 'Sem permissão para abrir caixa'; end if;
  if p_opening_amount < 0 then raise exception 'Valor inicial inválido'; end if;
  if exists (select 1 from public.cash_sessions where restaurant_id = v_profile.restaurant_id and status = 'open') then raise exception 'Já existe caixa aberto'; end if;
  insert into public.cash_sessions (restaurant_id, opened_by, opening_amount, expected_amount)
  values (v_profile.restaurant_id, v_profile.id, p_opening_amount, p_opening_amount)
  returning id into v_session_id;
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'cash_opened', 'cash_sessions', v_session_id, jsonb_build_object('opening_amount', p_opening_amount));
  return v_session_id;
end;
$$;

create or replace function public.add_cash_movement(p_type public.cash_movement_type, p_amount numeric, p_description text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_session public.cash_sessions%rowtype;
  v_movement_id uuid;
  v_delta numeric(12,2);
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  if v_profile.role not in ('owner', 'manager', 'cashier') then raise exception 'Sem permissão para movimentar caixa'; end if;
  if p_type not in ('withdrawal', 'supply', 'adjustment') or p_amount <= 0 then raise exception 'Movimento inválido'; end if;
  select * into v_session from public.cash_sessions
    where restaurant_id = v_profile.restaurant_id and status = 'open' for update;
  if v_session.id is null then raise exception 'Caixa fechado'; end if;
  v_delta := case when p_type = 'withdrawal' then -p_amount else p_amount end;
  insert into public.cash_movements (restaurant_id, cash_session_id, type, amount, description, created_by)
  values (v_profile.restaurant_id, v_session.id, p_type, p_amount, nullif(trim(p_description), ''), v_profile.id)
  returning id into v_movement_id;
  update public.cash_sessions set expected_amount = expected_amount + v_delta where id = v_session.id;
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'cash_movement_created', 'cash_movements', v_movement_id, jsonb_build_object('type', p_type, 'amount', p_amount));
  return v_movement_id;
end;
$$;

create or replace function public.close_cash_session(p_counted_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_session public.cash_sessions%rowtype;
  v_cash_sales numeric(12,2);
  v_expected numeric(12,2);
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  if v_profile.role not in ('owner', 'manager', 'cashier') then raise exception 'Sem permissão para fechar caixa'; end if;
  if p_counted_amount < 0 then raise exception 'Valor contado inválido'; end if;
  select * into v_session from public.cash_sessions
    where restaurant_id = v_profile.restaurant_id and status = 'open' for update;
  if v_session.id is null then raise exception 'Caixa fechado'; end if;
  select coalesce(sum(amount - coalesce(change_amount, 0)), 0) into v_cash_sales
  from public.payments
  where restaurant_id = v_profile.restaurant_id and method = 'cash' and created_at >= v_session.opened_at;
  v_expected := v_session.expected_amount + v_cash_sales;
  update public.cash_sessions set
    expected_amount = v_expected,
    counted_amount = p_counted_amount,
    difference_amount = p_counted_amount - v_expected,
    status = 'closed',
    closed_by = v_profile.id,
    closed_at = now()
  where id = v_session.id;
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'cash_closed', 'cash_sessions', v_session.id, jsonb_build_object('expected', v_expected, 'counted', p_counted_amount, 'difference', p_counted_amount - v_expected));
  return v_session.id;
end;
$$;

revoke all on function public.open_cash_session(numeric) from public, anon;
grant execute on function public.open_cash_session(numeric) to authenticated;
revoke all on function public.add_cash_movement(public.cash_movement_type, numeric, text) from public, anon;
grant execute on function public.add_cash_movement(public.cash_movement_type, numeric, text) to authenticated;
revoke all on function public.close_cash_session(numeric) from public, anon;
grant execute on function public.close_cash_session(numeric) to authenticated;
