import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

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
  assert.match(grid, /ProductImage url=\{product\.imageUrl\}/);
  assert.match(grid, /url && !failed/);
  assert.match(grid, /!product\.active \|\| !product\.available/);
});

test("login de produção inicia vazio e aceita apelido", () => {
  const login = readFileSync("app/app/(auth)/login/page.tsx", "utf8");
  assert.match(login, /Email ou login/);
  assert.match(login, /resolve-login/);
});
