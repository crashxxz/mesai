alter table public.restaurant_settings
  drop column if exists strong_font,
  add column if not exists system_theme text not null default 'system'
    check (system_theme in ('light', 'dark', 'system'));

alter table public.products
  add column if not exists generated_image_url text;

create or replace function public.reset_test_table(p_table_id uuid, p_reason text default 'Mesa de teste resetada')
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_profile public.profiles%rowtype; v_table public.tables%rowtype; v_order record;
begin
  select * into v_profile from public.profiles where user_id = auth.uid() and active limit 1;
  if v_profile.id is null or not (public.current_roles() && array['owner','manager']::public.profile_role[]) then
    raise exception 'Sem permissao';
  end if;
  select * into v_table from public.tables where id = p_table_id and restaurant_id = v_profile.restaurant_id for update;
  if v_table.id is null then raise exception 'Mesa nao encontrada'; end if;

  for v_order in select id from public.orders where table_id = p_table_id and status not in ('closed','cancelled') for update loop
    update public.order_items set status = 'cancelled', cancel_reason = coalesce(nullif(trim(p_reason), ''), 'Mesa de teste resetada'), updated_at = now()
      where order_id = v_order.id and status <> 'cancelled';
    update public.orders set status = 'closed', subtotal = 0, discount = 0, service_fee = 0, service_fee_enabled = false,
      delivery_fee = 0, total = 0, closed_at = now(), closed_by = v_profile.id, updated_at = now()
      where id = v_order.id;
  end loop;

  update public.tabs set status = 'closed', closed_at = now(), closed_by = v_profile.id
    where table_id = p_table_id and status = 'open';
  update public.tables set status = 'free', updated_at = now() where id = p_table_id;
  update public.table_qr_tokens set active = false, rotated_at = now() where table_id = p_table_id and active;
  update public.qr_sessions set active = false where table_id = p_table_id and active;
  update public.table_alerts set active = false, resolved_at = now() where table_id = p_table_id and active;
  insert into public.audit_logs (restaurant_id, user_id, action, entity, entity_id, new_data)
    values (v_profile.restaurant_id, v_profile.id, 'table_test_reset', 'tables', p_table_id, jsonb_build_object('reason', coalesce(nullif(trim(p_reason), ''), 'Mesa de teste resetada')));
  return p_table_id;
end;
$$;
revoke all on function public.reset_test_table(uuid,text) from public, anon;
grant execute on function public.reset_test_table(uuid,text) to authenticated;
