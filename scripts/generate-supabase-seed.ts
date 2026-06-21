import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMaricotaCatalog } from "../lib/seed";

const catalog = createMaricotaCatalog();
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const nullable = (value: string | number | undefined) => value === undefined ? "null" : typeof value === "number" ? String(value) : quote(value);

const categoryRows = catalog.categories
  .map((category) => `    (v_restaurant_id, ${quote(category.name)}, ${category.sortOrder}, ${category.active})`)
  .join(",\n");

const productRows = catalog.products
  .map((product) => {
    const category = catalog.categories.find((item) => item.id === product.categoryId);
    if (!category) throw new Error(`Categoria ausente para ${product.name}`);
    return `    (v_restaurant_id, (select id from public.categories where restaurant_id = v_restaurant_id and name = ${quote(category.name)}), ${quote(product.name)}, ${nullable(product.description)}, ${product.price}, ${quote(product.preparationSector)}, ${nullable(product.estimatedTimeMinutes)}, ${product.available}, ${product.hasStockControl}, ${nullable(product.stockQuantity)}, ${nullable(product.stockMinimum)}, ${nullable(product.stockUnit)}, ${nullable(product.imageUrl)}, ${product.active})`;
  })
  .join(",\n");

const sql = `-- Gerado por npm run seed:generate. Não editar manualmente.
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
${categoryRows}
  on conflict (restaurant_id, name) do update set sort_order = excluded.sort_order, active = excluded.active;

  insert into public.products (
    restaurant_id, category_id, name, description, price, preparation_sector,
    estimated_time_minutes, available, has_stock_control, stock_quantity,
    stock_minimum, stock_unit, image_url, active
  ) values
${productRows}
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
`;

async function main() {
  await writeFile(resolve("supabase/seed.sql"), sql, "utf8");
  console.log(`Seed gerado: ${catalog.categories.length} categorias e ${catalog.products.length} produtos.`);
}

void main();
