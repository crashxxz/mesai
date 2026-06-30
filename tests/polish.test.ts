import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { resolveProductImage } from "../lib/product-image";

test("QR válido abre a mesa ocupada e aguarda a mesa livre", () => {
  const migration = readFileSync("supabase/migrations/202606220002_qr_open_table_status.sql", "utf8");
  assert.match(migration, /v_table\.status not in \('occupied', 'closing'\)/);
  assert.match(migration, /Mesa aguardando abertura/);
  assert.match(migration, /insert into public\.qr_sessions/);
});

test("item é incluído no consumo sem recarregar", () => {
  const store = readFileSync("lib/store.tsx", "utf8");
  const grid = readFileSync("components/product-grid.tsx", "utf8");
  assert.match(store, /const optimisticId = `pending_\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(store, /return withTotals\(next, orderId\)/);
  assert.match(grid, /await onAdd\(selected\.id/);
});

test("gerente acessa ajustes e taxa pode ser removida por comanda", () => {
  const settings = readFileSync("app/app/(workspace)/settings/page.tsx", "utf8");
  const shell = readFileSync("components/app-shell.tsx", "utf8");
  const summary = readFileSync("components/order-summary.tsx", "utf8");
  const migration = readFileSync("supabase/migrations/202606230004_automatic_service_fee.sql", "utf8");
  assert.match(settings, /allowed=\{\["owner", "manager"\]\}/);
  assert.match(shell, /key: "settings".*roles: \["owner", "manager"\]/);
  assert.match(summary, /Remover taxa de serviço/);
  assert.match(migration, /function public\.set_order_service_fee_enabled/);
  assert.match(migration, /service_fee_enabled boolean/);
});

test("marca visual usa MesaY sem alterar identificadores técnicos", () => {
  const brand = readFileSync("lib/brand.ts", "utf8");
  const manifest = readFileSync("public/manifest.webmanifest", "utf8");
  assert.match(brand, /name: "MesaY"/);
  assert.match(manifest, /"short_name": "MesaY"/);
});

test("imagem cadastrada é reutilizada no card e no modal", () => {
  const grid = readFileSync("components/product-grid.tsx", "utf8");
  const store = readFileSync("lib/store.tsx", "utf8");
  assert.match(grid, /resolveProductImage\(product, category\?\.name\)/);
  assert.match(grid, /resolveProductImage\(selected, categoryById/);
  assert.match(grid, /setFailed\(false\), \[url\]/);
  assert.match(store, /resolveProductImage\(item/);
});

test("biblioteca local resolve imagens por produto, categoria e fallback", () => {
  assert.equal(resolveProductImage({ name: "Pastelzinho" }), "/menu-images/petiscos/pastelzinho.webp");
  assert.equal(resolveProductImage({ name: "Cerveja gelada" }), null); // no trustworthy real image
  assert.equal(resolveProductImage({ name: "Item novo" }, "Pizzas"), "/menu-images/pizzas/default-pizza.webp");
  assert.equal(resolveProductImage({ name: "Item novo" }), null); // unknown product, no fake image
  assert.equal(existsSync("public/menu-images/petiscos/pastelzinho.webp"), true);
});

test("Supabase mantém UUIDs e não envia IDs do seed às RPCs", () => {
  const schema = readFileSync("supabase/schema.sql", "utf8");
  const gateway = readFileSync("lib/supabase-gateway.ts", "utf8");
  const store = readFileSync("lib/store.tsx", "utf8");
  assert.match(schema, /product_id uuid not null references public\.products\(id\)/);
  assert.match(gateway, /requireDatabaseUuid\(productId, "O produto"\)/);
  assert.match(store, /runtimeConfig\.dataMode === "supabase" \? createSupabaseState\(\) : loadState\(\)/);
});

test("abrir mesa restaura status ocupado antes da sessão QR", () => {
  const migration = readFileSync("supabase/migrations/202606230001_qr_open_table_repair.sql", "utf8");
  assert.match(migration, /if v_order_id is not null then\s+update public\.tables set status = 'occupied'/);
  assert.match(migration, /Mesa aguardando abertura/);
  assert.match(migration, /update public\.qr_sessions set active = false/);
});

test("QR geral não permite escolher mesa", () => {
  const page = readFileSync("app/r/[restaurantSlug]/page.tsx", "utf8");
  assert.match(page, /Use o QR da sua mesa/);
  assert.doesNotMatch(page, /Escolher mesa/);
});

test("QR real exige token, sessão ativa e acompanha pedido", () => {
  const page = readFileSync("app/r/[restaurantSlug]/mesa/[tableId]/page.tsx", "utf8");
  const migration = readFileSync("supabase/migrations/202606210002_critical_flows.sql", "utf8");
  assert.match(page, /getPublicMenu\(tableToken\)/);
  assert.match(page, /startQrSession\(tableToken\)/);
  assert.match(page, /QR inválido\. Chame um atendente/);
  assert.match(page, /createQrOrder\(sessionToken/);
  assert.match(page, /getQrOrder/);
  assert.match(migration, /revoke all on function public\.open_public_table/);
  assert.match(migration, /Mesa aguardando abertura/);
  assert.match(migration, /create or replace function public\.ensure_open_table_order/);
});

test("mesa fecha a comanda, libera a mesa e invalida sessão QR", () => {
  const migration = readFileSync("supabase/migrations/202606210002_critical_flows.sql", "utf8");
  const tablePage = readFileSync("app/app/(workspace)/tables/[id]/page.tsx", "utf8");
  assert.match(migration, /create or replace function public\.close_table/);
  assert.match(migration, /update public\.tables set status = 'free'/);
  assert.match(migration, /update public\.qr_sessions set active = false/);
  assert.match(tablePage, /Fechar mesa/);
});

test("lançamento rápido de bebida mantém a mesa certa", () => {
  const tablesPage = readFileSync("app/app/(workspace)/tables/page.tsx", "utf8");
  const orderPage = readFileSync("app/app/(workspace)/orders/[id]/page.tsx", "utf8");
  assert.match(tablesPage, /quick=drinks/);
  assert.match(tablesPage, /occupiedTables\.length !== 1/);
  assert.match(orderPage, /quickDrinks/);
  assert.match(orderPage, /drinkCategoryIds/);
});

test("PWA possui ícones PNG para Android e iOS", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as { icons: Array<{ sizes: string }> };
  assert.equal(manifest.icons.some((icon) => icon.sizes === "192x192"), true);
  assert.equal(manifest.icons.some((icon) => icon.sizes === "512x512"), true);
  assert.equal(existsSync("public/icons/apple-touch-icon.png"), true);
  assert.equal(existsSync("public/apple-touch-icon.png"), true);
});

test("produto sem imagem recebe placeholder e indisponível some do QR", () => {
  const grid = readFileSync("components/product-grid.tsx", "utf8");
  assert.match(grid, /resolveProductImage\(product, category\?\.name\)/);
  assert.match(grid, /url && !failed/);
  assert.match(grid, /!product\.active \|\| !product\.available/);
});

test("login de produção inicia vazio e aceita apelido", () => {
  const login = readFileSync("app/app/(auth)/login/page.tsx", "utf8");
  assert.match(login, /Email ou login/);
  assert.match(login, /resolve-login/);
});
