-- APPLY_MESAI_PROD.sql
-- Aplicar uma unica vez em um projeto Supabase vazio.
-- Consolida schema/RLS, migrations/RPCs e seed de producao.

-- ===== 1. SCHEMA E RLS =====
create extension if not exists pgcrypto;

create type public.profile_role as enum ('owner', 'waiter', 'kitchen', 'bar');
create type public.table_status as enum ('free', 'occupied', 'closing', 'reserved');
create type public.tab_status as enum ('open', 'closed', 'cancelled');
create type public.preparation_sector as enum ('kitchen', 'bar', 'none');
create type public.order_source as enum ('waiter', 'qr_code', 'counter', 'delivery', 'takeaway');
create type public.order_status as enum ('open', 'sent', 'preparing', 'ready', 'delivered', 'closed', 'cancelled');
create type public.order_item_status as enum ('pending', 'sent', 'received', 'preparing', 'ready', 'delivered', 'cancelled');
create type public.payment_method as enum ('pix', 'cash', 'credit_card', 'debit_card', 'voucher', 'internal_consumption');
create type public.cash_session_status as enum ('open', 'closed');
create type public.cash_movement_type as enum ('sale', 'withdrawal', 'supply', 'adjustment');
create type public.financial_entry_type as enum ('income', 'expense');
create type public.customer_debt_status as enum ('open', 'partially_paid', 'paid', 'cancelled');

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.restaurant_settings (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  qr_orders_enabled boolean not null default true,
  qr_orders_need_approval boolean not null default false,
  waiter_can_close_account boolean not null default true,
  service_fee_percent numeric(5,2) not null default 10
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  role public.profile_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  number integer not null,
  name text,
  status public.table_status not null default 'free',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, number)
);

create table public.tabs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null,
  customer_name text,
  status public.tab_status not null default 'open',
  opened_by uuid references public.profiles(id),
  closed_by uuid references public.profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  preparation_sector public.preparation_sector not null default 'none',
  estimated_time_minutes integer,
  available boolean not null default true,
  has_stock_control boolean not null default false,
  stock_quantity numeric(12,3),
  stock_minimum numeric(12,3),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  price_delta numeric(12,2) not null default 0,
  active boolean not null default true
);

create table public.product_addons (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0,
  active boolean not null default true
);

create table public.product_allowed_addons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  addon_id uuid not null references public.product_addons(id) on delete cascade,
  unique (product_id, addon_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid references public.tables(id) on delete set null,
  tab_id uuid references public.tabs(id) on delete set null,
  customer_name text,
  source public.order_source not null default 'waiter',
  status public.order_status not null default 'open',
  created_by uuid references public.profiles(id),
  closed_by uuid references public.profiles(id),
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  service_fee numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_name_snapshot text not null,
  unit_price_snapshot numeric(12,2) not null,
  quantity numeric(12,3) not null check (quantity > 0),
  variation_name text,
  variation_price_delta numeric(12,2),
  notes text,
  preparation_sector public.preparation_sector not null default 'none',
  status public.order_item_status not null default 'pending',
  cancel_reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz
);

create table public.order_item_addons (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  addon_name_snapshot text not null,
  addon_price_snapshot numeric(12,2) not null,
  quantity numeric(12,3) not null default 1
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  method public.payment_method not null,
  amount numeric(12,2) not null check (amount > 0),
  card_brand text,
  change_amount numeric(12,2),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  opened_by uuid not null references public.profiles(id),
  closed_by uuid references public.profiles(id),
  opening_amount numeric(12,2) not null default 0,
  expected_amount numeric(12,2) not null default 0,
  counted_amount numeric(12,2),
  difference_amount numeric(12,2),
  status public.cash_session_status not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  cash_session_id uuid not null references public.cash_sessions(id) on delete cascade,
  type public.cash_movement_type not null,
  amount numeric(12,2) not null,
  description text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type public.financial_entry_type not null,
  category text not null,
  description text not null,
  amount numeric(12,2) not null,
  date date not null,
  paid boolean not null default false,
  payment_method public.payment_method,
  order_id uuid references public.orders(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  phone text,
  cpf text,
  address text,
  notes text,
  credit_limit numeric(12,2),
  active boolean not null default true
);

create table public.customer_debts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  amount numeric(12,2) not null,
  paid_amount numeric(12,2) not null default 0,
  due_date date,
  status public.customer_debt_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index idx_profiles_restaurant on public.profiles(restaurant_id);
create index idx_tables_restaurant on public.tables(restaurant_id);
create index idx_orders_restaurant_status on public.orders(restaurant_id, status);
create index idx_orders_table on public.orders(table_id);
create index idx_order_items_restaurant_sector_status on public.order_items(restaurant_id, preparation_sector, status);
create index idx_payments_restaurant_created on public.payments(restaurant_id, created_at);
create index idx_financial_entries_restaurant_date on public.financial_entries(restaurant_id, date);
create index idx_audit_logs_restaurant_created on public.audit_logs(restaurant_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_restaurants_updated_at before update on public.restaurants for each row execute function public.set_updated_at();
create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_tables_updated_at before update on public.tables for each row execute function public.set_updated_at();
create trigger set_categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger set_products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger set_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger set_order_items_updated_at before update on public.order_items for each row execute function public.set_updated_at();
create trigger set_financial_entries_updated_at before update on public.financial_entries for each row execute function public.set_updated_at();
create trigger set_customer_debts_updated_at before update on public.customer_debts for each row execute function public.set_updated_at();

create or replace function public.current_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.profiles where user_id = auth.uid() and active = true limit 1;
$$;

create or replace function public.current_role()
returns public.profile_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid() and active = true limit 1;
$$;

create or replace function public.same_restaurant(target uuid)
returns boolean
language sql
stable
as $$
  select target = public.current_restaurant_id();
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select public.current_role() = 'owner';
$$;

alter table public.restaurants enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.tables enable row level security;
alter table public.tabs enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variations enable row level security;
alter table public.product_addons enable row level security;
alter table public.product_allowed_addons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_addons enable row level security;
alter table public.payments enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;
alter table public.financial_entries enable row level security;
alter table public.customers enable row level security;
alter table public.customer_debts enable row level security;
alter table public.audit_logs enable row level security;

create policy "authenticated own restaurant read restaurants" on public.restaurants
  for select to authenticated using (id = public.current_restaurant_id());
create policy "public read restaurants" on public.restaurants
  for select to anon using (true);
create policy "owner update restaurants" on public.restaurants
  for update to authenticated using (id = public.current_restaurant_id() and public.is_owner());

create policy "same restaurant settings" on public.restaurant_settings
  for select to authenticated using (restaurant_id = public.current_restaurant_id());
create policy "public read settings" on public.restaurant_settings
  for select to anon using (true);
create policy "owner update settings" on public.restaurant_settings
  for update to authenticated using (restaurant_id = public.current_restaurant_id() and public.is_owner());

create policy "profile read same restaurant" on public.profiles
  for select to authenticated using (restaurant_id = public.current_restaurant_id());
create policy "owner manage profiles" on public.profiles
  for all to authenticated using (restaurant_id = public.current_restaurant_id() and public.is_owner())
  with check (restaurant_id = public.current_restaurant_id() and public.is_owner());

create policy "tables same restaurant" on public.tables
  for all to authenticated using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());
create policy "public read active tables" on public.tables
  for select to anon using (active = true);

create policy "categories same restaurant" on public.categories
  for all to authenticated using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());
create policy "public read active categories" on public.categories
  for select to anon using (active = true);

create policy "products same restaurant read" on public.products
  for select to authenticated using (restaurant_id = public.current_restaurant_id());
create policy "owner manage products" on public.products
  for all to authenticated using (restaurant_id = public.current_restaurant_id() and public.is_owner())
  with check (restaurant_id = public.current_restaurant_id() and public.is_owner());
create policy "public read available products" on public.products
  for select to anon using (active = true and available = true);

create policy "variations same restaurant" on public.product_variations
  for all to authenticated using (exists (select 1 from public.products p where p.id = product_id and p.restaurant_id = public.current_restaurant_id()))
  with check (exists (select 1 from public.products p where p.id = product_id and p.restaurant_id = public.current_restaurant_id()));
create policy "public read active variations" on public.product_variations
  for select to anon using (active = true);

create policy "addons same restaurant" on public.product_addons
  for all to authenticated using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());
create policy "public read active addons" on public.product_addons
  for select to anon using (active = true);

create policy "allowed addons authenticated" on public.product_allowed_addons
  for all to authenticated using (exists (select 1 from public.products p where p.id = product_id and p.restaurant_id = public.current_restaurant_id()))
  with check (exists (select 1 from public.products p where p.id = product_id and p.restaurant_id = public.current_restaurant_id()));
create policy "public read allowed addons" on public.product_allowed_addons
  for select to anon using (true);

create policy "tabs same restaurant" on public.tabs
  for all to authenticated using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy "orders same restaurant" on public.orders
  for all to authenticated using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());
create policy "public insert qr orders" on public.orders
  for insert to anon with check (source = 'qr_code');
create policy "public read own qr order by table" on public.orders
  for select to anon using (source = 'qr_code');

create policy "order items same restaurant" on public.order_items
  for all to authenticated using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());
create policy "public insert qr order items" on public.order_items
  for insert to anon with check (exists (select 1 from public.orders o where o.id = order_id and o.source = 'qr_code'));
create policy "public read qr order items" on public.order_items
  for select to anon using (exists (select 1 from public.orders o where o.id = order_id and o.source = 'qr_code'));

create policy "order item addons authenticated" on public.order_item_addons
  for all to authenticated using (exists (select 1 from public.order_items oi where oi.id = order_item_id and oi.restaurant_id = public.current_restaurant_id()))
  with check (exists (select 1 from public.order_items oi where oi.id = order_item_id and oi.restaurant_id = public.current_restaurant_id()));
create policy "public qr item addons" on public.order_item_addons
  for all to anon using (exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id where oi.id = order_item_id and o.source = 'qr_code'))
  with check (exists (select 1 from public.order_items oi join public.orders o on o.id = oi.order_id where oi.id = order_item_id and o.source = 'qr_code'));

create policy "payments owner waiter insert" on public.payments
  for insert to authenticated with check (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'waiter'));
create policy "payments owner read" on public.payments
  for select to authenticated using (restaurant_id = public.current_restaurant_id() and public.is_owner());

create policy "cash owner" on public.cash_sessions
  for all to authenticated using (restaurant_id = public.current_restaurant_id() and public.is_owner())
  with check (restaurant_id = public.current_restaurant_id() and public.is_owner());
create policy "cash movements owner" on public.cash_movements
  for all to authenticated using (restaurant_id = public.current_restaurant_id() and public.is_owner())
  with check (restaurant_id = public.current_restaurant_id() and public.is_owner());

create policy "financial owner" on public.financial_entries
  for all to authenticated using (restaurant_id = public.current_restaurant_id() and public.is_owner())
  with check (restaurant_id = public.current_restaurant_id() and public.is_owner());

create policy "customers same restaurant" on public.customers
  for all to authenticated using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());
create policy "customer debts owner waiter" on public.customer_debts
  for all to authenticated using (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'waiter'))
  with check (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'waiter'));

create policy "audit same restaurant read" on public.audit_logs
  for select to authenticated using (restaurant_id = public.current_restaurant_id());
create policy "audit same restaurant insert" on public.audit_logs
  for insert to authenticated with check (restaurant_id = public.current_restaurant_id());

create or replace view public.preparation_queue as
select
  oi.id,
  oi.order_id,
  oi.restaurant_id,
  oi.product_name_snapshot,
  oi.quantity,
  oi.variation_name,
  oi.notes,
  oi.preparation_sector,
  oi.status,
  oi.created_at,
  oi.sent_at,
  oi.preparing_at,
  oi.ready_at,
  o.table_id,
  o.tab_id,
  o.customer_name,
  o.created_by
from public.order_items oi
join public.orders o on o.id = oi.order_id
where oi.preparation_sector in ('kitchen', 'bar');

-- ===== 2. MIGRATION: 202606200000_roles.sql =====
alter type public.profile_role add value if not exists 'manager';
alter type public.profile_role add value if not exists 'cashier';

-- ===== 3. MIGRATION: 202606200001_production_foundation.sql =====
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

-- ===== 4. MIGRATION: 202606200002_transactional_rpcs.sql =====
create unique index if not exists uq_financial_sale_order
  on public.financial_entries(order_id)
  where type = 'income' and category = 'sale' and order_id is not null;

drop policy if exists "orders same restaurant" on public.orders;
create policy "orders read same restaurant" on public.orders
  for select to authenticated using (restaurant_id = public.current_restaurant_id());

drop policy if exists "order items same restaurant" on public.order_items;
create policy "order items read same restaurant" on public.order_items
  for select to authenticated using (restaurant_id = public.current_restaurant_id());

drop policy if exists "tabs same restaurant" on public.tabs;
create policy "tabs read same restaurant" on public.tabs
  for select to authenticated using (restaurant_id = public.current_restaurant_id());

drop policy if exists "payments owner waiter insert" on public.payments;
drop policy if exists "payments owner read" on public.payments;
create policy "payments operational read" on public.payments
  for select to authenticated
  using (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'manager', 'cashier'));

drop policy if exists "cash owner" on public.cash_sessions;
drop policy if exists "cash movements owner" on public.cash_movements;
create policy "cash operational read" on public.cash_sessions
  for select to authenticated
  using (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'manager', 'cashier'));
create policy "cash movements operational read" on public.cash_movements
  for select to authenticated
  using (restaurant_id = public.current_restaurant_id() and public.current_role() in ('owner', 'manager', 'cashier'));

create or replace function public.create_order_with_items(
  p_table_id uuid,
  p_customer_name text,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_tab_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_item_id uuid;
  v_quantity numeric(12,3);
  v_subtotal numeric(12,2) := 0;
  v_service numeric(12,2) := 0;
  v_addon_id uuid;
  v_addon public.product_addons%rowtype;
  v_addon_total numeric(12,2);
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  if v_profile.id is null or v_profile.role not in ('owner', 'manager', 'waiter', 'cashier') then
    raise exception 'Sem permissão para criar pedido';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Pedido sem itens'; end if;

  if p_table_id is not null then
    perform 1 from public.tables where id = p_table_id and restaurant_id = v_profile.restaurant_id and active for update;
    if not found then raise exception 'Mesa não encontrada'; end if;
    select id into v_tab_id from public.tabs
      where table_id = p_table_id and restaurant_id = v_profile.restaurant_id and status = 'open'
      order by opened_at desc limit 1;
  end if;

  if v_tab_id is null then
    insert into public.tabs (restaurant_id, table_id, customer_name, opened_by)
    values (v_profile.restaurant_id, p_table_id, nullif(trim(p_customer_name), ''), v_profile.id)
    returning id into v_tab_id;
  end if;

  insert into public.orders (restaurant_id, table_id, tab_id, customer_name, source, status, created_by, notes)
  values (v_profile.restaurant_id, p_table_id, v_tab_id, nullif(trim(p_customer_name), ''), case when p_table_id is null then 'counter' else 'waiter' end, 'open', v_profile.id, nullif(trim(p_notes), ''))
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(coalesce((v_item->>'quantity')::numeric, 1), 1);
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid
        and restaurant_id = v_profile.restaurant_id and active and available and price > 0;
    if v_product.id is null then raise exception 'Produto inválido ou indisponível'; end if;

    v_addon_total := 0;
    for v_addon_id in select value::text::uuid from jsonb_array_elements_text(coalesce(v_item->'addon_ids', '[]'::jsonb))
    loop
      select a.* into v_addon from public.product_addons a
      join public.product_allowed_addons pa on pa.addon_id = a.id
      where pa.product_id = v_product.id and a.id = v_addon_id and a.active;
      if v_addon.id is null then raise exception 'Adicional inválido'; end if;
      v_addon_total := v_addon_total + v_addon.price;
    end loop;

    insert into public.order_items (
      order_id, restaurant_id, product_id, product_name_snapshot, unit_price_snapshot,
      quantity, notes, preparation_sector, status, created_by
    ) values (
      v_order_id, v_profile.restaurant_id, v_product.id, v_product.name, v_product.price,
      v_quantity, nullif(trim(v_item->>'notes'), ''), v_product.preparation_sector, 'pending', v_profile.id
    ) returning id into v_item_id;

    for v_addon_id in select value::text::uuid from jsonb_array_elements_text(coalesce(v_item->'addon_ids', '[]'::jsonb))
    loop
      select a.* into v_addon from public.product_addons a where a.id = v_addon_id;
      insert into public.order_item_addons (order_item_id, addon_name_snapshot, addon_price_snapshot)
      values (v_item_id, v_addon.name, v_addon.price);
    end loop;
    v_subtotal := v_subtotal + ((v_product.price + v_addon_total) * v_quantity);
  end loop;

  select round(v_subtotal * (service_fee_percent / 100), 2) into v_service
  from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  v_service := coalesce(v_service, 0);
  update public.orders set subtotal = v_subtotal, service_fee = v_service, total = v_subtotal + v_service where id = v_order_id;
  if p_table_id is not null then update public.tables set status = 'occupied' where id = p_table_id; end if;
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'order_created', 'orders', v_order_id, jsonb_build_object('subtotal', v_subtotal, 'total', v_subtotal + v_service));
  return v_order_id;
end;
$$;

create or replace function public.create_qr_order(
  p_session_token text,
  p_customer_name text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.qr_sessions%rowtype;
  v_tab_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity numeric(12,3);
  v_subtotal numeric(12,2) := 0;
  v_service numeric(12,2) := 0;
  v_needs_approval boolean;
begin
  select * into v_session from public.qr_sessions
  where session_hash = digest(p_session_token, 'sha256') and active and expires_at > now()
  for update;
  if v_session.id is null then raise exception 'Sessão inválida ou expirada'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'Pedido sem itens'; end if;
  select qr_orders_need_approval into v_needs_approval from public.restaurant_settings where restaurant_id = v_session.restaurant_id;

  select id into v_tab_id from public.tabs
    where table_id = v_session.table_id and restaurant_id = v_session.restaurant_id and status = 'open'
    order by opened_at desc limit 1;
  if v_tab_id is null then
    insert into public.tabs (restaurant_id, table_id, customer_name)
    values (v_session.restaurant_id, v_session.table_id, nullif(trim(p_customer_name), '')) returning id into v_tab_id;
  end if;

  insert into public.orders (restaurant_id, table_id, tab_id, customer_name, source, status)
  values (v_session.restaurant_id, v_session.table_id, v_tab_id, nullif(trim(p_customer_name), ''), 'qr_code', case when v_needs_approval then 'open' else 'sent' end)
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(coalesce((v_item->>'quantity')::numeric, 1), 1);
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid
        and restaurant_id = v_session.restaurant_id and active and available and price > 0;
    if v_product.id is null then raise exception 'Produto inválido ou indisponível'; end if;
    insert into public.order_items (
      order_id, restaurant_id, product_id, product_name_snapshot, unit_price_snapshot,
      quantity, notes, preparation_sector, status, sent_at
    ) values (
      v_order_id, v_session.restaurant_id, v_product.id, v_product.name, v_product.price,
      v_quantity, nullif(trim(v_item->>'notes'), ''), v_product.preparation_sector,
      case when v_needs_approval then 'pending' else 'sent' end,
      case when v_needs_approval then null else now() end
    );
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  select round(v_subtotal * (service_fee_percent / 100), 2) into v_service
  from public.restaurant_settings where restaurant_id = v_session.restaurant_id;
  v_service := coalesce(v_service, 0);
  update public.orders set subtotal = v_subtotal, service_fee = v_service, total = v_subtotal + v_service where id = v_order_id;
  update public.tables set status = 'occupied' where id = v_session.table_id;
  update public.qr_sessions set last_action_at = now() where id = v_session.id;
  return v_order_id;
end;
$$;

create or replace function public.get_qr_order(p_session_token text, p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.qr_sessions%rowtype;
begin
  select * into v_session from public.qr_sessions
  where session_hash = digest(p_session_token, 'sha256') and active and expires_at > now();
  if v_session.id is null then raise exception 'Sessão inválida ou expirada'; end if;
  if not exists (select 1 from public.orders where id = p_order_id and table_id = v_session.table_id and restaurant_id = v_session.restaurant_id and source = 'qr_code') then
    raise exception 'Pedido não encontrado';
  end if;
  return jsonb_build_object(
    'order', (select to_jsonb(o) from public.orders o where o.id = p_order_id),
    'items', (select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at), '[]'::jsonb) from public.order_items i where i.order_id = p_order_id)
  );
end;
$$;

create or replace function public.update_preparation_status(p_item_id uuid, p_status public.order_item_status)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_item public.order_items%rowtype;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  select * into v_item from public.order_items where id = p_item_id for update;
  if v_item.id is null or v_item.restaurant_id <> v_profile.restaurant_id then raise exception 'Item não encontrado'; end if;
  if not (
    v_profile.role in ('owner', 'manager')
    or (v_profile.role = 'kitchen' and v_item.preparation_sector = 'kitchen')
    or (v_profile.role = 'bar' and v_item.preparation_sector = 'bar')
    or (v_profile.role = 'waiter' and p_status = 'delivered')
  ) then raise exception 'Sem permissão para atualizar o item'; end if;
  if not (
    (v_item.status = 'sent' and p_status = 'received')
    or (v_item.status = 'received' and p_status = 'preparing')
    or (v_item.status = 'preparing' and p_status = 'ready')
    or (v_item.status = 'ready' and p_status = 'delivered')
  ) then raise exception 'Transição de status inválida'; end if;
  update public.order_items set
    status = p_status,
    preparing_at = case when p_status = 'preparing' then now() else preparing_at end,
    ready_at = case when p_status = 'ready' then now() else ready_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end
  where id = p_item_id;
  return p_item_id;
end;
$$;

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
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_payment_id uuid;
  v_waiter_allowed boolean;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.restaurant_id <> v_profile.restaurant_id or v_order.status in ('closed', 'cancelled') then raise exception 'Pedido inválido'; end if;
  select waiter_can_close_account into v_waiter_allowed from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  if v_profile.role not in ('owner', 'manager', 'cashier') and not (v_profile.role = 'waiter' and v_waiter_allowed) then raise exception 'Sem permissão para receber'; end if;
  if p_amount <= 0 then raise exception 'Valor inválido'; end if;
  insert into public.payments (restaurant_id, order_id, method, amount, card_brand, change_amount, created_by)
  values (v_profile.restaurant_id, p_order_id, p_method, p_amount, nullif(trim(p_card_brand), ''), p_change_amount, v_profile.id)
  returning id into v_payment_id;
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'payment_registered', 'payments', v_payment_id, jsonb_build_object('order_id', p_order_id, 'method', p_method, 'amount', p_amount));
  return v_payment_id;
end;
$$;

create or replace function public.close_paid_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_paid numeric(12,2);
  v_waiter_allowed boolean;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.restaurant_id <> v_profile.restaurant_id or v_order.status in ('closed', 'cancelled') then raise exception 'Pedido inválido'; end if;
  select waiter_can_close_account into v_waiter_allowed from public.restaurant_settings where restaurant_id = v_profile.restaurant_id;
  if v_profile.role not in ('owner', 'manager', 'cashier') and not (v_profile.role = 'waiter' and v_waiter_allowed) then raise exception 'Sem permissão para fechar'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments where order_id = p_order_id;
  if v_paid < v_order.total then raise exception 'Pagamento incompleto'; end if;
  update public.orders set status = 'closed', closed_by = v_profile.id, closed_at = now() where id = p_order_id;
  update public.tabs set status = 'closed', closed_by = v_profile.id, closed_at = now() where id = v_order.tab_id;
  if v_order.table_id is not null then update public.tables set status = 'free' where id = v_order.table_id; end if;
  insert into public.financial_entries (restaurant_id, type, category, description, amount, date, paid, order_id, created_by)
  values (v_profile.restaurant_id, 'income', 'sale', 'Venda ' || p_order_id::text, v_order.total, current_date, true, p_order_id, v_profile.id)
  on conflict (order_id) where type = 'income' and category = 'sale' and order_id is not null do nothing;
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
  values (v_profile.restaurant_id, v_profile.id, 'order_closed', 'orders', p_order_id, jsonb_build_object('total', v_order.total, 'paid', v_paid));
  return p_order_id;
end;
$$;

create or replace function public.record_stock_movement(p_product_id uuid, p_type text, p_quantity numeric, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_product public.products%rowtype;
  v_id uuid;
  v_next numeric(12,3);
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  if v_profile.role not in ('owner', 'manager') then raise exception 'Sem permissão para estoque'; end if;
  select * into v_product from public.products where id = p_product_id and restaurant_id = v_profile.restaurant_id for update;
  if v_product.id is null or not v_product.has_stock_control then raise exception 'Produto sem controle de estoque'; end if;
  if p_type not in ('entry', 'exit', 'adjustment') or p_quantity <= 0 then raise exception 'Movimento inválido'; end if;
  v_next := case when p_type = 'exit' then coalesce(v_product.stock_quantity, 0) - p_quantity else coalesce(v_product.stock_quantity, 0) + p_quantity end;
  if v_next < 0 then raise exception 'Estoque insuficiente'; end if;
  update public.products set stock_quantity = v_next where id = p_product_id;
  insert into public.stock_movements (restaurant_id, product_id, type, quantity, reason, created_by)
  values (v_profile.restaurant_id, p_product_id, p_type, p_quantity, nullif(trim(p_reason), ''), v_profile.id)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_order_with_items(uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_order_with_items(uuid, text, text, jsonb) to authenticated;
revoke all on function public.create_qr_order(text, text, jsonb) from public;
grant execute on function public.create_qr_order(text, text, jsonb) to anon, authenticated;
revoke all on function public.get_qr_order(text, uuid) from public;
grant execute on function public.get_qr_order(text, uuid) to anon, authenticated;
revoke all on function public.update_preparation_status(uuid, public.order_item_status) from public, anon;
grant execute on function public.update_preparation_status(uuid, public.order_item_status) to authenticated;
revoke all on function public.register_order_payment(uuid, public.payment_method, numeric, text, numeric) from public, anon;
grant execute on function public.register_order_payment(uuid, public.payment_method, numeric, text, numeric) to authenticated;
revoke all on function public.close_paid_order(uuid) from public, anon;
grant execute on function public.close_paid_order(uuid) to authenticated;
revoke all on function public.record_stock_movement(uuid, text, numeric, text) from public, anon;
grant execute on function public.record_stock_movement(uuid, text, numeric, text) to authenticated;

-- ===== 5. MIGRATION: 202606200003_cash_rpcs.sql =====
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

-- ===== 6. MIGRATION: 202606200004_remove_legacy_demo.sql =====
delete from public.restaurants where slug = 'hyoc-boteco-demo';
delete from auth.users where email in ('dono@hyoc.demo', 'garcom@hyoc.demo', 'cozinha@hyoc.demo', 'bar@hyoc.demo');

-- ===== 7. SEED DE PRODUCAO =====
-- Gerado por npm run seed:generate. Não editar manualmente.
do $$
declare
  v_restaurant_id uuid;
begin
  insert into public.restaurants (name, slug, city, phone, whatsapp_url, address)
  values ('Boteco da Maricota', 'boteco-da-maricota', 'Iguatu-CE', '+55 88 9629-8276', 'https://wa.me/558896298276', 'Iguatu-CE')
  on conflict (slug) do update set
    name = excluded.name,
    city = excluded.city,
    phone = excluded.phone,
    whatsapp_url = excluded.whatsapp_url,
    address = excluded.address
  returning id into v_restaurant_id;

  insert into public.restaurant_settings (restaurant_id, qr_orders_enabled, qr_orders_need_approval, waiter_can_close_account, service_fee_percent)
  values (v_restaurant_id, true, false, true, 10)
  on conflict (restaurant_id) do update set
    qr_orders_enabled = excluded.qr_orders_enabled,
    qr_orders_need_approval = excluded.qr_orders_need_approval,
    waiter_can_close_account = excluded.waiter_can_close_account,
    service_fee_percent = excluded.service_fee_percent;

  insert into public.business_profiles (restaurant_id, preset, version)
  values (v_restaurant_id, 'boteco_popular', 1)
  on conflict (restaurant_id) do update set preset = excluded.preset, version = excluded.version, updated_at = now();

  insert into public.tables (restaurant_id, number, name)
  select v_restaurant_id, number, 'Mesa ' || number from generate_series(1, 15) as number
  on conflict (restaurant_id, number) do update set name = excluded.name, active = true;

  insert into public.categories (restaurant_id, name, sort_order, active) values
    (v_restaurant_id, 'Petiscos', 1, true),
    (v_restaurant_id, 'Churrasco', 2, true),
    (v_restaurant_id, 'Pratos', 3, true),
    (v_restaurant_id, 'Água', 4, true),
    (v_restaurant_id, 'Sucos', 5, true),
    (v_restaurant_id, 'Refrigerantes 1 litro', 6, true),
    (v_restaurant_id, 'Refrigerantes lata', 7, true),
    (v_restaurant_id, 'Refrigerantes 600ml', 8, true),
    (v_restaurant_id, 'Long neck', 9, true),
    (v_restaurant_id, 'Long neck zero', 10, true),
    (v_restaurant_id, 'Energético', 11, true),
    (v_restaurant_id, 'Cervejas', 12, true),
    (v_restaurant_id, 'Bebidas quentes', 13, true)
  on conflict (restaurant_id, name) do update set sort_order = excluded.sort_order, active = excluded.active;

  insert into public.products (
    restaurant_id, category_id, name, description, price, preparation_sector,
    estimated_time_minutes, available, has_stock_control, stock_quantity,
    stock_minimum, stock_unit, image_url, active
  ) values
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Petiscos'), 'Pastelzinho', null, 15, 'kitchen', 9, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Petiscos'), 'Macaxeira', null, 15, 'kitchen', 10, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Petiscos'), 'Batatinha', null, 15, 'kitchen', 10, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Petiscos'), 'Batata rústica', null, 15, 'kitchen', 12, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Petiscos'), 'Feijão verde', null, 15, 'kitchen', 10, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Petiscos'), 'Feijão verde especial', null, 25, 'kitchen', 12, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Petiscos'), 'Tripa', null, 15, 'kitchen', 12, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Petiscos'), 'Torresmo', null, 12, 'kitchen', 10, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Petiscos'), 'Mungunzá', null, 15, 'kitchen', 9, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Petiscos'), 'Pão de alho', null, 6, 'kitchen', 7, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Petiscos'), 'Bolinha de queijo', null, 15, 'kitchen', 8, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Petiscos'), 'Bolinha mista', null, 15, 'kitchen', 8, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Churrasco'), 'Linguiça Toscana', null, 5, 'kitchen', 10, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Churrasco'), 'Espeto de coração', 'Preço pendente', 0, 'kitchen', 10, false, false, 0, 0, null, null, false),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Churrasco'), 'Espeto de queijo', null, 10, 'kitchen', 10, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Churrasco'), 'Espeto de boi', null, 12, 'kitchen', 12, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Churrasco'), 'Espeto de porco', null, 12, 'kitchen', 12, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Churrasco'), 'Espeto de frango', null, 12, 'kitchen', 12, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Churrasco'), 'Espeto de frango com bacon', null, 14, 'kitchen', 12, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Churrasco'), 'Boi 300g', null, 30, 'kitchen', 15, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Churrasco'), 'Porco 300g', null, 25, 'kitchen', 15, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Churrasco'), 'Mistão', null, 35, 'kitchen', 15, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Pratos'), 'Arroz branco', null, 10, 'kitchen', 8, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Pratos'), 'Arroz à grega', null, 14, 'kitchen', 10, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Pratos'), 'Arroz carreteiro', null, 15, 'kitchen', 10, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Pratos'), 'Baião comum', null, 12, 'kitchen', 9, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Pratos'), 'Baião mole', null, 14, 'kitchen', 10, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Água'), 'Água sem gás', null, 3, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Água'), 'Água com gás', null, 4, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Água'), 'Água de coco', null, 6, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Água'), 'H2O', null, 8, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de goiaba copo', null, 8, 'bar', 5, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de acerola copo', null, 8, 'bar', 5, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de cajarana copo', null, 8, 'bar', 5, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de manga copo', null, 8, 'bar', 5, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de cajá copo', null, 8, 'bar', 5, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de maracujá copo', null, 10, 'bar', 5, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de laranja copo', null, 10, 'bar', 5, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de abacaxi com limão copo', null, 10, 'bar', 5, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de goiaba jarra', null, 15, 'bar', 7, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de acerola jarra', null, 15, 'bar', 7, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de cajarana jarra', null, 15, 'bar', 7, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de manga jarra', null, 15, 'bar', 7, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de cajá jarra', null, 15, 'bar', 7, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de maracujá jarra', null, 20, 'bar', 7, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de laranja jarra', null, 20, 'bar', 7, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Sucos'), 'Suco de abacaxi com limão jarra', null, 20, 'bar', 7, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Refrigerantes 1 litro'), 'Guaraná 1L', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Refrigerantes 1 litro'), 'Pepsi 1L', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Refrigerantes 1 litro'), 'Coca-Cola 1L', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Refrigerantes lata'), 'Pepsi lata', null, 6, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Refrigerantes lata'), 'Coca-Cola lata', null, 6, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Refrigerantes lata'), 'Guaraná lata', null, 6, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Refrigerantes 600ml'), 'Coca-Cola 600ml', null, 8, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Long neck'), 'Corona long neck', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Long neck'), 'Heineken long neck', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Long neck'), 'Cabaré long neck', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Long neck'), 'Budweiser long neck', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Long neck'), 'Spaten long neck', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Long neck zero'), 'Budweiser zero long neck', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Long neck zero'), 'Heineken zero long neck', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Energético'), 'Red Bull', null, 14, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Energético'), 'Monster pequeno', null, 12, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Energético'), 'Monster grande', null, 15, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Cervejas'), 'Litrinho', null, 4, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Cervejas'), 'Latinha', null, 6, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Cervejas'), 'Brahma 600ml', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Cervejas'), 'Skol 600ml', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Cervejas'), 'Devassa 600ml', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Cervejas'), 'Budweiser 600ml', null, 12, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Cervejas'), 'Amstel 600ml', null, 12, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Cervejas'), 'Bohemia 600ml', null, 12, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Cervejas'), 'Original 600ml', null, 12, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Cervejas'), 'Spaten 600ml', null, 13, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Cervejas'), 'Stella 600ml', null, 13, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Cervejas'), 'Heineken 600ml', null, 15, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Black & White dose', null, 9, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Red Label dose', null, 13, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Old Parr dose', null, 15, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'White Horse dose', null, 13, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Campari dose', null, 9, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Martini dose', null, 8, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Vinho dose', null, 13, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Taça de vinho', null, 13, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Vodka Absolut dose', null, 6, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Vodka Absolut copo', null, 15, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Vodka Smirnoff dose', null, 7, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Vodka Smirnoff copo', null, 15, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Vodka Orloff dose', null, 5, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Vodka Orloff copo', null, 12, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Ypióca dose', null, 3, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Ypióca copo', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Cachaça 51 dose', null, 3, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Cachaça 51 copo', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Pitú dose', null, 3, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Pitú copo', null, 8, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Ypióca 150 dose', null, 7, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Ypióca 150 copo', null, 15, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Dreher dose', null, 3, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Dreher copo', null, 10, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Rum Montilla dose', null, 5, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Rum Montilla copo', null, 12, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Rum Bacardi dose', null, 7, 'bar', 2, true, false, 0, 0, null, null, true),
    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = 'Bebidas quentes'), 'Rum Bacardi copo', null, 15, 'bar', 2, true, false, 0, 0, null, null, true)
  on conflict (restaurant_id, name) do update set
    category_id = excluded.category_id,
    description = excluded.description,
    price = excluded.price,
    preparation_sector = excluded.preparation_sector,
    estimated_time_minutes = excluded.estimated_time_minutes,
    available = excluded.available,
    has_stock_control = excluded.has_stock_control,
    stock_quantity = excluded.stock_quantity,
    stock_minimum = excluded.stock_minimum,
    stock_unit = excluded.stock_unit,
    image_url = excluded.image_url,
    active = excluded.active;
end $$;
