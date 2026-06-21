import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("QR geral exige escolha de mesa", () => {
  const page = readFileSync("app/r/[restaurantSlug]/page.tsx", "utf8");
  assert.match(page, /Informe sua mesa/);
  assert.match(page, /Escolher mesa/);
  assert.match(page, /\/mesa\/\$\{tableId\}/);
});

test("PWA possui ícones PNG para Android e iOS", () => {
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as { icons: Array<{ sizes: string }> };
  assert.equal(manifest.icons.some((icon) => icon.sizes === "192x192"), true);
  assert.equal(manifest.icons.some((icon) => icon.sizes === "512x512"), true);
  assert.equal(existsSync("public/icons/apple-touch-icon.png"), true);
});

test("produto sem imagem recebe placeholder e indisponível some do QR", () => {
  const grid = readFileSync("components/product-grid.tsx", "utf8");
  assert.match(grid, /!product\.imageUrl/);
  assert.match(grid, /!product\.active \|\| !product\.available/);
});

test("login de produção inicia vazio e aceita apelido", () => {
  const login = readFileSync("app/app/(auth)/login/page.tsx", "utf8");
  assert.match(login, /Email ou login/);
  assert.match(login, /resolve-login/);
});
