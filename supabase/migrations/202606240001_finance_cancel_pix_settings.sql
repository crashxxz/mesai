alter table public.restaurant_settings
  add column if not exists pix_key text,
  add column if not exists pix_recipient_name text,
  add column if not exists pix_city text,
  add column if not exists strong_font boolean not null default false;

alter table public.financial_entries
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text;

create or replace function public.cancel_financial_entry(p_entry_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_profile public.profiles%rowtype; v_entry public.financial_entries%rowtype;
begin
  if nullif(trim(p_reason),'') is null then raise exception 'Motivo obrigatorio'; end if;
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  if v_profile.id is null or not (public.current_roles() && array['owner','manager']::public.profile_role[]) then raise exception 'Sem permissao'; end if;
  select * into v_entry from public.financial_entries where id = p_entry_id and restaurant_id = v_profile.restaurant_id and paid for update;
  if v_entry.id is null then raise exception 'Lancamento nao encontrado'; end if;
  update public.financial_entries set paid = false, cancelled_at = now(), cancel_reason = trim(p_reason), updated_at = now() where id = p_entry_id;
  insert into public.audit_logs (restaurant_id,user_id,action,entity,entity_id,new_data) values (v_profile.restaurant_id,v_profile.id,'financial_entry_cancelled','financial_entries',p_entry_id,jsonb_build_object('reason',p_reason));
  return p_entry_id;
end;
$$;
revoke all on function public.cancel_financial_entry(uuid,text) from public, anon;
grant execute on function public.cancel_financial_entry(uuid,text) to authenticated;

create or replace function public.cancel_order_item(p_item_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_profile public.profiles%rowtype; v_item public.order_items%rowtype; v_order public.orders%rowtype; v_subtotal numeric; v_fee numeric := 0;
begin
  if nullif(trim(p_reason),'') is null then raise exception 'Motivo obrigatorio'; end if;
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  if v_profile.id is null or not (public.current_roles() && array['owner','manager','waiter','kitchen','bar']::public.profile_role[]) then raise exception 'Sem permissao'; end if;
  select * into v_item from public.order_items where id = p_item_id and restaurant_id = v_profile.restaurant_id for update;
  if v_item.id is null or v_item.status in ('delivered','cancelled') then raise exception 'Item nao pode ser cancelado'; end if;
  update public.order_items set status = 'cancelled', cancel_reason = trim(p_reason), updated_at = now() where id = p_item_id;
  select * into v_order from public.orders where id = v_item.order_id for update;
  select coalesce(sum((unit_price_snapshot + coalesce(variation_price_delta,0))*quantity),0) into v_subtotal from public.order_items where order_id = v_order.id and status <> 'cancelled';
  if coalesce(v_order.service_fee_enabled,true) then select round(greatest(v_subtotal-v_order.discount,0)*(service_fee_percent/100),2) into v_fee from public.restaurant_settings where restaurant_id=v_order.restaurant_id; end if;
  update public.orders set subtotal=v_subtotal, service_fee=coalesce(v_fee,0), total=greatest(v_subtotal-discount,0)+coalesce(v_fee,0)+coalesce(delivery_fee,0), updated_at=now() where id=v_order.id;
  return p_item_id;
end;
$$;
grant execute on function public.cancel_order_item(uuid,text) to authenticated;

create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_profile public.profiles%rowtype; v_order public.orders%rowtype;
begin
  if nullif(trim(p_reason),'') is null then raise exception 'Motivo obrigatorio'; end if;
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  if v_profile.id is null or not (public.current_roles() && array['owner','manager','waiter']::public.profile_role[]) then raise exception 'Sem permissao'; end if;
  select * into v_order from public.orders where id=p_order_id and restaurant_id=v_profile.restaurant_id and status not in ('closed','cancelled') for update;
  if v_order.id is null then raise exception 'Pedido nao encontrado'; end if;
  if exists(select 1 from public.order_items where order_id=p_order_id and status='delivered') then raise exception 'Itens entregues nao podem ser cancelados em lote'; end if;
  update public.order_items set status='cancelled',cancel_reason=trim(p_reason),updated_at=now() where order_id=p_order_id and status <> 'cancelled';
  update public.orders set subtotal=0,service_fee=0,total=0,cancel_reason=trim(p_reason),updated_at=now() where id=p_order_id;
  return p_order_id;
end;
$$;
grant execute on function public.cancel_order(uuid,text) to authenticated;
