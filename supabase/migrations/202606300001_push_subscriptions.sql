-- Push notification subscriptions per authenticated user/device.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  roles text[] not null default '{}',
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  last_error text,
  disabled_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions add column if not exists roles text[] not null default '{}';
alter table public.push_subscriptions add column if not exists last_error text;
alter table public.push_subscriptions add column if not exists disabled_at timestamptz;
alter table public.push_subscriptions add column if not exists last_seen_at timestamptz;

create index if not exists idx_push_subs_restaurant_role on public.push_subscriptions(restaurant_id, role) where enabled;
create index if not exists idx_push_subs_restaurant_roles on public.push_subscriptions using gin (roles) where enabled;
create index if not exists idx_push_subs_user_enabled on public.push_subscriptions(user_id, enabled);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own" on public.push_subscriptions;
create policy "push_subscriptions_own" on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "push_subscriptions_own_delete" on public.push_subscriptions;
create policy "push_subscriptions_own_delete" on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());
