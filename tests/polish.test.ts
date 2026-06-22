import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("QR geral exige escolha de mesa", () => {
  const page = readFileSync("app/r/[restaurantSlug]/page.tsx", "utf8");
  assert.match(page, /Informe sua mesa/);
  assert.match(page, /Escolher mesa/);
  assert.match(page, /\/mesa\/\$\{tableId\}/);
});

test("QR real usa sessão Supabase e acompanha pedido", () => {
  const page = readFileSync("app/r/[restaurantSlug]/mesa/[tableId]/page.tsx", "utf8");
  const migration = readFileSync("supabase/migrations/202606210002_critical_flows.sql", "utf8");
  assert.match(page, /openPublicTable/);
  assert.match(page, /createQrOrder\(sessionToken/);
  assert.match(page, /getQrOrder/);
  assert.match(migration, /create or replace function public\.open_public_table/);
  assert.match(migration, /create or replace function public\.ensure_open_table_order/);
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
