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
