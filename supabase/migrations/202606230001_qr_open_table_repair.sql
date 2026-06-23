-- Repara mesas que possuem comanda aberta, mas ficaram marcadas como livres.
create or replace function public.ensure_open_table_order(p_table_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile public.profiles%rowtype;
  v_order_id uuid;
  v_tab_id uuid;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active and deleted_at is null limit 1;
  if v_profile.id is null or not (public.current_roles() && array['owner','manager','waiter']::public.profile_role[]) then raise exception 'Sem permissao'; end if;
  perform 1 from public.tables where id = p_table_id and restaurant_id = v_profile.restaurant_id and active;
  if not found then raise exception 'Mesa nao encontrada'; end if;

  select id into v_order_id from public.orders
  where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status not in ('closed','cancelled')
  order by created_at desc limit 1;
  if v_order_id is not null then
    update public.tables set status = 'occupied', updated_at = now() where id = p_table_id;
    return v_order_id;
  end if;

  update public.qr_sessions set active = false where table_id = p_table_id and active;
  select id into v_tab_id from public.tabs where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status = 'open' order by opened_at desc limit 1;
  if v_tab_id is null then
    insert into public.tabs (restaurant_id, table_id, opened_by) values (v_profile.restaurant_id, p_table_id, v_profile.id) returning id into v_tab_id;
  end if;
  insert into public.orders (restaurant_id, table_id, tab_id, source, status, created_by)
  values (v_profile.restaurant_id, p_table_id, v_tab_id, 'waiter', 'open', v_profile.id)
  returning id into v_order_id;
  update public.tables set status = 'occupied', updated_at = now() where id = p_table_id;
  return v_order_id;
end;
$$;

-- Mantém a separação correta: token inválido, mesa fechada e sessão ativa.
create or replace function public.start_qr_session(p_table_token text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token public.table_qr_tokens%rowtype;
  v_table public.tables%rowtype;
  v_session text := replace(gen_random_uuid()::text, '-', '');
begin
  select * into v_token from public.table_qr_tokens
  where token_hash = digest(p_table_token, 'sha256') and active and (expires_at is null or expires_at > now());
  if v_token.id is null then raise exception 'QR invalido ou expirado'; end if;

  select * into v_table from public.tables
  where id = v_token.table_id and restaurant_id = v_token.restaurant_id and active;
  if v_table.id is null or v_table.status not in ('occupied', 'closing') then raise exception 'Mesa aguardando abertura'; end if;

  update public.qr_sessions set active = false where table_id = v_token.table_id and active;
  insert into public.qr_sessions (restaurant_id, table_id, session_hash, active, expires_at)
  values (v_token.restaurant_id, v_token.table_id, digest(v_session, 'sha256'), true, now() + interval '12 hours');
  return v_session;
end;
$$;

grant execute on function public.ensure_open_table_order(uuid) to authenticated;
revoke all on function public.start_qr_session(text) from public;
grant execute on function public.start_qr_session(text) to anon, authenticated;
