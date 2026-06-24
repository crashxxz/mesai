-- Provider selection is tenant scoped. Secrets remain only in Vercel/Supabase server environment variables.
alter table public.restaurant_settings
  add column if not exists pix_provider text not null default 'manual'
    check (pix_provider in ('manual', 'openpix', 'mercado_pago')),
  add column if not exists pix_provider_environment text not null default 'test'
    check (pix_provider_environment in ('test', 'production'));

alter table public.payments
  add column if not exists provider text not null default 'manual'
    check (provider in ('manual', 'openpix', 'mercado_pago')),
  add column if not exists provider_environment text not null default 'test'
    check (provider_environment in ('test', 'production')),
  add column if not exists external_payment_id text,
  add column if not exists txid text,
  add column if not exists payment_status text not null default 'paid'
    check (payment_status in ('pending', 'paid', 'expired', 'cancelled', 'error')),
  add column if not exists pix_copy_paste text,
  add column if not exists expires_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists webhook_payload jsonb,
  add column if not exists updated_at timestamptz not null default now();

update public.payments set provider = coalesce(provider, 'manual'), payment_status = coalesce(payment_status, 'paid') where provider is null or payment_status is null;

create unique index if not exists uq_payments_provider_external_id
  on public.payments(provider, external_payment_id)
  where external_payment_id is not null;
create index if not exists idx_payments_pending_pix
  on public.payments(restaurant_id, order_id, payment_status)
  where method = 'pix';

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  provider text not null check (provider in ('openpix', 'mercado_pago', 'manual')),
  event_id text not null,
  external_payment_id text,
  event_type text not null default 'payment_update',
  payload jsonb,
  created_at timestamptz not null default now(),
  unique(provider, event_id)
);
alter table public.payment_events enable row level security;

create or replace function public.confirm_external_pix_payment(
  p_payment_id uuid,
  p_provider text,
  p_external_payment_id text,
  p_txid text,
  p_amount numeric,
  p_payload jsonb default '{}'::jsonb,
  p_event_id text default null,
  p_manual_override boolean default false
)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_paid numeric(12,2);
  v_event_key text;
  v_event_id uuid;
begin
  if p_provider not in ('openpix', 'mercado_pago', 'manual') then raise exception 'Provedor Pix invalido'; end if;
  select * into v_payment from public.payments where id = p_payment_id and method = 'pix' for update;
  if v_payment.id is null then raise exception 'Cobranca Pix nao encontrada'; end if;
  if v_payment.payment_status = 'paid' then return v_payment.id; end if;
  if v_payment.provider <> p_provider then raise exception 'Provedor divergente'; end if;
  if not p_manual_override and (v_payment.external_payment_id is distinct from p_external_payment_id or abs(coalesce(p_amount, 0) - v_payment.amount) > 0.01) then
    raise exception 'Confirmacao Pix divergente';
  end if;

  v_event_key := coalesce(nullif(trim(p_event_id), ''), encode(digest(coalesce(p_payload::text, ''), 'sha256'), 'hex'));
  insert into public.payment_events (restaurant_id, payment_id, provider, event_id, external_payment_id, event_type, payload)
  values (v_payment.restaurant_id, v_payment.id, p_provider, v_event_key, coalesce(p_external_payment_id, v_payment.external_payment_id), case when p_manual_override then 'manual_confirmation' else 'provider_confirmation' end, p_payload)
  on conflict (provider, event_id) do nothing
  returning id into v_event_id;
  if v_event_id is null then return v_payment.id; end if;

  update public.payments
  set payment_status = 'paid', paid_at = now(), txid = coalesce(nullif(p_txid, ''), txid),
      webhook_payload = p_payload, updated_at = now()
  where id = v_payment.id;

  select * into v_order from public.orders where id = v_payment.order_id for update;
  if v_order.id is null then raise exception 'Pedido da cobranca nao encontrado'; end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments where order_id = v_order.id and payment_status = 'paid';
  if v_paid + 0.001 < v_order.total then return v_payment.id; end if;

  if v_order.status not in ('closed', 'cancelled') then
    update public.orders set status = 'closed', closed_at = now(), updated_at = now() where id = v_order.id;
    if v_order.tab_id is not null and not exists (select 1 from public.orders where tab_id = v_order.tab_id and status not in ('closed', 'cancelled')) then
      update public.tabs set status = 'closed', closed_at = now() where id = v_order.tab_id;
    end if;
    if v_order.table_id is not null and not exists (select 1 from public.orders where table_id = v_order.table_id and status not in ('closed', 'cancelled')) then
      update public.tables set status = 'free', updated_at = now() where id = v_order.table_id;
      update public.qr_sessions set active = false where table_id = v_order.table_id and active;
      update public.table_alerts set active = false, resolved_at = now() where table_id = v_order.table_id and active;
    end if;
  end if;
  insert into public.financial_entries (restaurant_id, type, category, description, amount, date, paid, payment_method, order_id)
  values (v_payment.restaurant_id, 'income', 'sale', 'Venda ' || v_order.id::text, v_order.total, current_date, true, 'pix', v_order.id)
  on conflict (order_id) where type = 'income' and category = 'sale' and order_id is not null do nothing;
  insert into public.audit_logs (restaurant_id, action, entity, entity_id, new_data)
  values (v_payment.restaurant_id, 'pix_payment_confirmed', 'payments', v_payment.id, jsonb_build_object('provider', p_provider, 'order_id', v_order.id, 'amount', v_payment.amount));
  return v_payment.id;
end;
$$;

create or replace function public.cancel_external_pix_payment(p_payment_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_payment public.payments%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id and method = 'pix' for update;
  if v_payment.id is null then raise exception 'Cobranca Pix nao encontrada'; end if;
  if v_payment.payment_status <> 'pending' then return v_payment.id; end if;
  update public.payments set payment_status = 'cancelled', webhook_payload = jsonb_build_object('cancel_reason', coalesce(nullif(trim(p_reason), ''), 'Cancelada manualmente')), updated_at = now() where id = v_payment.id;
  insert into public.payment_events (restaurant_id, payment_id, provider, event_id, external_payment_id, event_type, payload)
  values (v_payment.restaurant_id, v_payment.id, v_payment.provider, 'cancel:' || v_payment.id::text, v_payment.external_payment_id, 'cancelled', jsonb_build_object('reason', coalesce(nullif(trim(p_reason), ''), 'Cancelada manualmente')))
  on conflict (provider, event_id) do nothing;
  return v_payment.id;
end;
$$;

-- Never return menu data for a closed table. This preserves the distinction between a bad token and a closed table.
create or replace function public.get_public_menu(p_table_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_token public.table_qr_tokens%rowtype; v_table public.tables%rowtype;
begin
  select * into v_token from public.table_qr_tokens
  where token_hash = digest(p_table_token, 'sha256') and active and (expires_at is null or expires_at > now());
  if v_token.id is null then raise exception 'QR invalido ou expirado'; end if;
  select * into v_table from public.tables where id = v_token.table_id and restaurant_id = v_token.restaurant_id and active;
  if v_table.id is null or v_table.status not in ('occupied', 'closing') then raise exception 'Mesa aguardando abertura'; end if;
  return jsonb_build_object(
    'restaurant', (select jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug, 'logo_url', r.logo_url, 'phone', r.phone, 'whatsapp_url', r.whatsapp_url, 'maps_url', r.maps_url, 'address', r.address, 'city', r.city) from public.restaurants r where r.id = v_token.restaurant_id),
    'settings', (select to_jsonb(s) from public.restaurant_settings s where s.restaurant_id = v_token.restaurant_id),
    'table', jsonb_build_object('id', v_table.id, 'number', v_table.number, 'name', v_table.name),
    'categories', (select coalesce(jsonb_agg(to_jsonb(c) order by c.sort_order), '[]'::jsonb) from public.categories c where c.restaurant_id = v_token.restaurant_id and c.active),
    'products', (select coalesce(jsonb_agg(to_jsonb(p) order by p.name), '[]'::jsonb) from public.products p where p.restaurant_id = v_token.restaurant_id and p.active and p.available and p.price > 0),
    'variations', (select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb) from public.product_variations v join public.products p on p.id = v.product_id where p.restaurant_id = v_token.restaurant_id and p.active and p.available and v.active),
    'addons', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.product_addons a where a.restaurant_id = v_token.restaurant_id and a.active),
    'allowed_addons', (select coalesce(jsonb_agg(to_jsonb(pa)), '[]'::jsonb) from public.product_allowed_addons pa join public.products p on p.id = pa.product_id where p.restaurant_id = v_token.restaurant_id and p.active and p.available)
  );
end;
$$;

revoke all on function public.confirm_external_pix_payment(uuid,text,text,text,numeric,jsonb,text,boolean) from public, anon, authenticated;
grant execute on function public.confirm_external_pix_payment(uuid,text,text,text,numeric,jsonb,text,boolean) to service_role;
revoke all on function public.cancel_external_pix_payment(uuid,text) from public, anon, authenticated;
grant execute on function public.cancel_external_pix_payment(uuid,text) to service_role;
