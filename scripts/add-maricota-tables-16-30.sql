-- Adicionar mesas 16 a 30 para Boteco da Maricota
-- Rodar manualmente no Supabase SQL Editor
-- Não duplica se já existir (usa ON CONFLICT)

do $$
declare
  v_restaurant_id uuid;
begin
  select id into v_restaurant_id from public.restaurants where slug = 'boteco-da-maricota' limit 1;
  if v_restaurant_id is null then
    raise exception 'Restaurante boteco-da-maricota não encontrado';
  end if;

  insert into public.tables (restaurant_id, number, name, status, active)
  values
    (v_restaurant_id, 16, 'Mesa 16', 'free', true),
    (v_restaurant_id, 17, 'Mesa 17', 'free', true),
    (v_restaurant_id, 18, 'Mesa 18', 'free', true),
    (v_restaurant_id, 19, 'Mesa 19', 'free', true),
    (v_restaurant_id, 20, 'Mesa 20', 'free', true),
    (v_restaurant_id, 21, 'Mesa 21', 'free', true),
    (v_restaurant_id, 22, 'Mesa 22', 'free', true),
    (v_restaurant_id, 23, 'Mesa 23', 'free', true),
    (v_restaurant_id, 24, 'Mesa 24', 'free', true),
    (v_restaurant_id, 25, 'Mesa 25', 'free', true),
    (v_restaurant_id, 26, 'Mesa 26', 'free', true),
    (v_restaurant_id, 27, 'Mesa 27', 'free', true),
    (v_restaurant_id, 28, 'Mesa 28', 'free', true),
    (v_restaurant_id, 29, 'Mesa 29', 'free', true),
    (v_restaurant_id, 30, 'Mesa 30', 'free', true)
  on conflict (restaurant_id, number) do nothing;

  raise notice 'Mesas 16-30 criadas com sucesso para %', v_restaurant_id;
end;
$$;
