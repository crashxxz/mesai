alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists technical_email text;
alter table public.profiles add column if not exists roles public.profile_role[] not null default '{}';
alter table public.profiles add column if not exists deleted_at timestamptz;

update public.profiles
set roles = array[role]::public.profile_role[]
where cardinality(roles) = 0;

create unique index if not exists uq_profiles_restaurant_username
  on public.profiles (restaurant_id, lower(username))
  where username is not null and deleted_at is null;

create or replace function public.current_roles()
returns public.profile_role[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when role = 'owner' then array['owner','manager','waiter','kitchen','bar','cashier']::public.profile_role[]
    when cardinality(roles) > 0 then roles
    else array[role]::public.profile_role[]
  end
  from public.profiles
  where user_id = auth.uid() and active and deleted_at is null
  limit 1;
$$;

create or replace function public.get_public_restaurant_tables(p_slug text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'restaurant', jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'number', t.number, 'name', t.name) order by t.number)
      from public.tables t where t.restaurant_id = r.id and t.active
    ), '[]'::jsonb)
  )
  from public.restaurants r
  where r.slug = p_slug
  limit 1;
$$;

grant execute on function public.get_public_restaurant_tables(text) to anon, authenticated;

drop policy if exists "owner manage profiles" on public.profiles;
create policy "owner manager manage profiles" on public.profiles
  for all to authenticated
  using (restaurant_id = public.current_restaurant_id() and public.current_roles() && array['owner','manager']::public.profile_role[])
  with check (restaurant_id = public.current_restaurant_id() and public.current_roles() && array['owner','manager']::public.profile_role[]);

drop policy if exists "owner manage products" on public.products;
create policy "owner manager manage products" on public.products
  for all to authenticated
  using (restaurant_id = public.current_restaurant_id() and public.current_roles() && array['owner','manager']::public.profile_role[])
  with check (restaurant_id = public.current_restaurant_id() and public.current_roles() && array['owner','manager']::public.profile_role[]);

create or replace function public.update_preparation_status(p_item_id uuid, p_status public.order_item_status)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_item public.order_items%rowtype;
  v_roles public.profile_role[];
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active and deleted_at is null limit 1;
  v_roles := public.current_roles();
  select * into v_item from public.order_items where id = p_item_id for update;
  if v_item.id is null or v_item.restaurant_id <> v_profile.restaurant_id then raise exception 'Item não encontrado'; end if;
  if not (
    v_roles && array['owner','manager']::public.profile_role[]
    or ('kitchen' = any(v_roles) and v_item.preparation_sector in ('kitchen','both'))
    or ('bar' = any(v_roles) and v_item.preparation_sector in ('bar','both'))
    or ('waiter' = any(v_roles) and p_status = 'delivered')
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
