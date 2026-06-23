-- QR válido abre o cardápio quando a mesa está aberta no painel.
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
  where token_hash = digest(p_table_token, 'sha256')
    and active
    and (expires_at is null or expires_at > now());
  if v_token.id is null then raise exception 'QR invalido ou expirado'; end if;

  select * into v_table from public.tables
  where id = v_token.table_id and restaurant_id = v_token.restaurant_id and active;
  if v_table.id is null or v_table.status not in ('occupied', 'closing') then
    raise exception 'Mesa aguardando abertura';
  end if;

  insert into public.qr_sessions (restaurant_id, table_id, session_hash, active, expires_at)
  values (v_token.restaurant_id, v_token.table_id, digest(v_session, 'sha256'), true, now() + interval '12 hours');
  return v_session;
end;
$$;

revoke all on function public.start_qr_session(text) from public;
grant execute on function public.start_qr_session(text) to anon, authenticated;
