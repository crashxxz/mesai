create extension if not exists pgcrypto;

alter table public.restaurants add column if not exists city text;
alter table public.restaurants add column if not exists whatsapp_url text;
alter table public.restaurants add column if not exists maps_url text;
alter table public.profiles add column if not exists email text;
alter table public.products add column if not exists stock_unit text;
alter table public.financial_entries add column if not exists notes text;

create table if not exists public.business_profiles (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  preset text not null default 'boteco_popular',
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.table_alerts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  type text not null check (type in ('waiter_call', 'bill_request')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  type text not null check (type in ('entry', 'exit', 'adjustment')),
  quantity numeric(12,3) not null check (quantity > 0),
  reason text not null,
  unit_cost numeric(12,2),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.table_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  token_hash bytea not null unique,
  active boolean not null default true,
  expires_at timestamptz,
  rotated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  unique (table_id)
);

create table if not exists public.qr_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  session_hash bytea not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours'),
  last_action_at timestamptz
);

create index if not exists idx_table_alerts_active on public.table_alerts(restaurant_id, active, created_at desc);
create index if not exists idx_stock_movements_product on public.stock_movements(product_id, created_at desc);
create index if not exists idx_qr_sessions_expiry on public.qr_sessions(expires_at) where active;
create index if not exists idx_qr_tokens_table on public.table_qr_tokens(table_id) where active;
create unique index if not exists uq_categories_restaurant_name on public.categories(restaurant_id, name);
create unique index if not exists uq_products_restaurant_name on public.products(restaurant_id, name);

alter table public.business_profiles enable row level security;
alter table public.table_alerts enable row level security;
alter table public.stock_movements enable row level security;
alter table public.table_qr_tokens enable row level security;
alter table public.qr_sessions enable row level security;

drop policy if exists "business profile same restaurant" on public.business_profiles;
create policy "business profile same restaurant" on public.business_profiles
  for select to authenticated using (restaurant_id = public.current_restaurant_id());

drop policy if exists "owner manage business profile" on public.business_profiles;
create policy "owner manage business profile" on public.business_profiles
  for all to authenticated
  using (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'manager'))
  with check (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'manager'));

drop policy if exists "staff manage table alerts" on public.table_alerts;
create policy "staff manage table alerts" on public.table_alerts
  for all to authenticated
  using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

drop policy if exists "manager stock movements" on public.stock_movements;
create policy "manager stock movements" on public.stock_movements
  for all to authenticated
  using (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'manager'))
  with check (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'manager'));

drop policy if exists "owner manage qr tokens" on public.table_qr_tokens;
create policy "owner manage qr tokens" on public.table_qr_tokens
  for all to authenticated
  using (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'manager'))
  with check (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'manager'));

drop policy if exists "owner read qr sessions" on public.qr_sessions;
create policy "owner read qr sessions" on public.qr_sessions
  for select to authenticated
  using (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'manager'));

drop policy if exists "public read restaurants" on public.restaurants;
drop policy if exists "public read settings" on public.restaurant_settings;
drop policy if exists "public read active tables" on public.tables;
drop policy if exists "public read active categories" on public.categories;
drop policy if exists "public read available products" on public.products;
drop policy if exists "public read active variations" on public.product_variations;
drop policy if exists "public read active addons" on public.product_addons;
drop policy if exists "public read allowed addons" on public.product_allowed_addons;
drop policy if exists "public insert qr orders" on public.orders;
drop policy if exists "public read own qr order by table" on public.orders;
drop policy if exists "public insert qr order items" on public.order_items;
drop policy if exists "public read qr order items" on public.order_items;
drop policy if exists "public qr item addons" on public.order_item_addons;

create or replace function public.rotate_table_qr_token(p_table_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_token text := encode(gen_random_bytes(24), 'hex');
begin
  select restaurant_id into v_restaurant_id
  from public.tables
  where id = p_table_id and active = true;

  if v_restaurant_id is null or v_restaurant_id <> public.current_restaurant_id() then
    raise exception 'Mesa não encontrada';
  end if;
  if public.current_role() not in ('owner', 'manager') then
    raise exception 'Sem permissão para gerar QR';
  end if;

  insert into public.table_qr_tokens (restaurant_id, table_id, token_hash, active, rotated_at, created_by)
  values (
    v_restaurant_id,
    p_table_id,
    digest(v_token, 'sha256'),
    true,
    now(),
    (select id from public.profiles where user_id = auth.uid() and active limit 1)
  )
  on conflict (table_id) do update
    set token_hash = excluded.token_hash,
        active = true,
        expires_at = null,
        rotated_at = now(),
        created_by = excluded.created_by;

  update public.qr_sessions set active = false where table_id = p_table_id and active;
  return v_token;
end;
$$;

create or replace function public.get_public_menu(p_table_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.table_qr_tokens%rowtype;
begin
  select * into v_token
  from public.table_qr_tokens
  where token_hash = digest(p_table_token, 'sha256')
    and active
    and (expires_at is null or expires_at > now());

  if v_token.id is null then raise exception 'QR inválido ou expirado'; end if;

  return jsonb_build_object(
    'restaurant', (select jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug, 'logo_url', r.logo_url, 'phone', r.phone, 'whatsapp_url', r.whatsapp_url, 'maps_url', r.maps_url, 'address', r.address, 'city', r.city) from public.restaurants r where r.id = v_token.restaurant_id),
    'settings', (select to_jsonb(s) from public.restaurant_settings s where s.restaurant_id = v_token.restaurant_id),
    'table', (select jsonb_build_object('id', t.id, 'number', t.number, 'name', t.name) from public.tables t where t.id = v_token.table_id and t.active),
    'categories', (select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order), '[]'::jsonb) from public.categories c where c.restaurant_id = v_token.restaurant_id and c.active),
    'products', (select coalesce(jsonb_agg(to_jsonb(p) order by p.name), '[]'::jsonb) from public.products p where p.restaurant_id = v_token.restaurant_id and p.active and p.available and p.price > 0),
    'variations', (select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb) from public.product_variations v join public.products p on p.id = v.product_id where p.restaurant_id = v_token.restaurant_id and p.active and p.available and v.active),
    'addons', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.product_addons a where a.restaurant_id = v_token.restaurant_id and a.active),
    'allowed_addons', (select coalesce(jsonb_agg(to_jsonb(pa)), '[]'::jsonb) from public.product_allowed_addons pa join public.products p on p.id = pa.product_id where p.restaurant_id = v_token.restaurant_id and p.active and p.available)
  );
end;
$$;

create or replace function public.start_qr_session(p_table_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.table_qr_tokens%rowtype;
  v_session text := encode(gen_random_bytes(24), 'hex');
begin
  select * into v_token
  from public.table_qr_tokens
  where token_hash = digest(p_table_token, 'sha256')
    and active
    and (expires_at is null or expires_at > now());

  if v_token.id is null then raise exception 'QR inválido ou expirado'; end if;

  insert into public.qr_sessions (restaurant_id, table_id, session_hash)
  values (v_token.restaurant_id, v_token.table_id, digest(v_session, 'sha256'));
  return v_session;
end;
$$;

create or replace function public.request_table_service(p_session_token text, p_type text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.qr_sessions%rowtype;
  v_alert_id uuid;
begin
  if p_type not in ('waiter_call', 'bill_request') then raise exception 'Tipo inválido'; end if;
  select * into v_session from public.qr_sessions
  where session_hash = digest(p_session_token, 'sha256') and active and expires_at > now();
  if v_session.id is null then raise exception 'Sessão inválida ou expirada'; end if;
  if exists (select 1 from public.table_alerts where table_id = v_session.table_id and type = p_type and active and created_at > now() - interval '2 minutes') then
    raise exception 'Aguarde antes de repetir a solicitação';
  end if;
  insert into public.table_alerts (restaurant_id, table_id, type)
  values (v_session.restaurant_id, v_session.table_id, p_type)
  returning id into v_alert_id;
  update public.qr_sessions set last_action_at = now() where id = v_session.id;
  return v_alert_id;
end;
$$;

revoke all on function public.rotate_table_qr_token(uuid) from public, anon;
grant execute on function public.rotate_table_qr_token(uuid) to authenticated;
revoke all on function public.get_public_menu(text) from public;
grant execute on function public.get_public_menu(text) to anon, authenticated;
revoke all on function public.start_qr_session(text) from public;
grant execute on function public.start_qr_session(text) to anon, authenticated;
revoke all on function public.request_table_service(text, text) from public;
grant execute on function public.request_table_service(text, text) to anon, authenticated;
