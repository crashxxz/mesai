import assert from "node:assert/strict";
import test from "node:test";
import { createMaricotaCatalog, createSeedState } from "../lib/seed";

test("cardápio real da Maricota mantém o contrato do demo", () => {
  const catalog = createMaricotaCatalog();
  assert.equal(catalog.categories.length, 13);
  assert.equal(catalog.products.length, 104);
  assert.equal(new Set(catalog.products.map((product) => product.id)).size, 104);
  assert.equal(catalog.products.filter((product) => product.available && product.active).length, 103);
  assert.deepEqual(
    catalog.products.filter((product) => product.price <= 0).map((product) => product.name),
    ["Espeto de coração"]
  );
});

test("cozinha e bar recebem apenas seus grupos", () => {
  const catalog = createMaricotaCatalog();
  const categoryName = new Map(catalog.categories.map((category) => [category.id, category.name]));
  const kitchenCategories = new Set(["Petiscos", "Churrasco", "Pratos"]);

  for (const product of catalog.products) {
    const shouldUseKitchen = kitchenCategories.has(categoryName.get(product.categoryId) ?? "");
    assert.equal(product.preparationSector === "kitchen", shouldUseKitchen, product.name);
  }
  assert.equal(catalog.products.filter((product) => product.preparationSector === "kitchen").length, 27);
  assert.equal(catalog.products.filter((product) => product.preparationSector === "bar").length, 77);
});

test("reset do demo recria o cardápio real", () => {
  const state = createSeedState();
  assert.equal(state.restaurants[0].name, "Boteco da Maricota");
  assert.equal(state.products.length, 104);
  assert.equal(state.categories.length, 13);
});
