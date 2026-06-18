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

do $$
declare
  demo_restaurant uuid;
  owner_user uuid := gen_random_uuid();
  waiter_user uuid := gen_random_uuid();
  kitchen_user uuid := gen_random_uuid();
  bar_user uuid := gen_random_uuid();
  cat_bebidas uuid;
  cat_cervejas uuid;
  cat_porcoes uuid;
  cat_espetinhos uuid;
  cat_pratos uuid;
  cat_sobremesas uuid;
begin
  insert into public.restaurants (name, slug, phone, address)
  values ('HYOC Boteco Demo', 'hyoc-boteco-demo', '(11) 99999-0000', 'Rua Demo, 123')
  returning id into demo_restaurant;

  insert into public.restaurant_settings (restaurant_id)
  values (demo_restaurant);

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (owner_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dono@hyoc.demo', crypt('demo123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (waiter_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'garcom@hyoc.demo', crypt('demo123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (kitchen_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cozinha@hyoc.demo', crypt('demo123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    (bar_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bar@hyoc.demo', crypt('demo123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
  on conflict (email) do nothing;

  insert into public.profiles (user_id, restaurant_id, name, role)
  select id, demo_restaurant, 'Dono HYOC', 'owner'::public.profile_role from auth.users where email = 'dono@hyoc.demo'
  union all select id, demo_restaurant, 'Garçom HYOC', 'waiter'::public.profile_role from auth.users where email = 'garcom@hyoc.demo'
  union all select id, demo_restaurant, 'Cozinha HYOC', 'kitchen'::public.profile_role from auth.users where email = 'cozinha@hyoc.demo'
  union all select id, demo_restaurant, 'Bar HYOC', 'bar'::public.profile_role from auth.users where email = 'bar@hyoc.demo'
  on conflict (user_id) do nothing;

  insert into public.tables (restaurant_id, number, name)
  select demo_restaurant, number, 'Mesa ' || number
  from generate_series(1, 15) as number;

  insert into public.categories (restaurant_id, name, sort_order) values
    (demo_restaurant, 'Bebidas', 1),
    (demo_restaurant, 'Cervejas', 2),
    (demo_restaurant, 'Porções', 3),
    (demo_restaurant, 'Espetinhos', 4),
    (demo_restaurant, 'Pratos', 5),
    (demo_restaurant, 'Sobremesas', 6);

  select id into cat_bebidas from public.categories where restaurant_id = demo_restaurant and name = 'Bebidas';
  select id into cat_cervejas from public.categories where restaurant_id = demo_restaurant and name = 'Cervejas';
  select id into cat_porcoes from public.categories where restaurant_id = demo_restaurant and name = 'Porções';
  select id into cat_espetinhos from public.categories where restaurant_id = demo_restaurant and name = 'Espetinhos';
  select id into cat_pratos from public.categories where restaurant_id = demo_restaurant and name = 'Pratos';
  select id into cat_sobremesas from public.categories where restaurant_id = demo_restaurant and name = 'Sobremesas';

  insert into public.products (restaurant_id, category_id, name, price, preparation_sector, estimated_time_minutes) values
    (demo_restaurant, cat_cervejas, 'Cerveja 600ml', 14.90, 'bar', 6),
    (demo_restaurant, cat_bebidas, 'Refrigerante lata', 6.50, 'bar', 3),
    (demo_restaurant, cat_bebidas, 'Água', 4.00, 'none', null),
    (demo_restaurant, cat_porcoes, 'Batata frita', 28.00, 'kitchen', 18),
    (demo_restaurant, cat_espetinhos, 'Espetinho de carne', 9.50, 'kitchen', 12),
    (demo_restaurant, cat_espetinhos, 'Espetinho de frango', 8.50, 'kitchen', 12),
    (demo_restaurant, cat_porcoes, 'Porção de calabresa', 32.00, 'kitchen', 20),
    (demo_restaurant, cat_pratos, 'Prato feito', 24.90, 'kitchen', 22),
    (demo_restaurant, cat_sobremesas, 'Sobremesa simples', 10.00, 'kitchen', 8);
end $$;
