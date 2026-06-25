import assert from "node:assert/strict";
import test from "node:test";
import { canAccess, canCloseAccount, canManageProducts, canSeeFinance, roleLabel } from "../lib/permissions";
import { calculateOrderTotals, getBarItems, getFinancialSummary, getKitchenItems, itemAppearsInPreparationSector } from "../lib/services";
import { createSeedState } from "../lib/seed";
import type { Profile, UserRole } from "../lib/types";

test("taxa de serviço configurada entra automaticamente e pode ser removida", () => {
  const state = createSeedState();
  const base = state.orders.find((entry) => entry.id === "order_open_2");
  assert.ok(base);
  const automatic = calculateOrderTotals(state, { ...base, serviceFee: 0, serviceFeeEnabled: undefined });
  const withoutFee = calculateOrderTotals(state, { ...base, serviceFee: 0, serviceFeeEnabled: false });
  const withFee = calculateOrderTotals(state, { ...base, serviceFee: 0, serviceFeeEnabled: true });
  assert.equal(withoutFee.serviceFee, 0);
  assert.ok(automatic.serviceFee > 0);
  assert.ok(withFee.serviceFee > 0);
  assert.ok(withFee.total > withoutFee.total);
});

function profile(role: UserRole): Profile {
  return {
    id: `profile_${role}`,
    userId: `user_${role}`,
    restaurantId: "rest_maricota_demo",
    name: roleLabel(role),
    email: `${role}@mesai.demo`,
    role,
    active: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

test("gerente e caixa respeitam permissões operacionais", () => {
  assert.equal(canSeeFinance(profile("manager")), true);
  assert.equal(canManageProducts(profile("manager")), true);
  assert.equal(canCloseAccount(profile("cashier"), false), true);
  assert.equal(canSeeFinance(profile("cashier")), false);
  assert.equal(canManageProducts(profile("cashier")), false);
});

test("garçom, cozinha e bar ficam limitados às suas áreas", () => {
  assert.equal(canSeeFinance(profile("waiter")), false);
  assert.equal(canAccess(profile("kitchen"), ["owner", "manager", "kitchen"]), true);
  assert.equal(canAccess(profile("kitchen"), ["owner", "manager", "bar"]), false);
  assert.equal(canAccess(profile("bar"), ["owner", "manager", "bar"]), true);
  assert.equal(canAccess(profile("bar"), ["owner", "manager", "kitchen"]), false);
});

test("totais, financeiro e filas do seed permanecem válidos", () => {
  const state = createSeedState();
  const order = state.orders.find((entry) => entry.id === "order_open_2");
  assert.ok(order);
  const totals = calculateOrderTotals(state, order);
  assert.equal(Number.isFinite(totals.total), true);
  assert.equal(totals.total, 33.88);

  const summary = getFinancialSummary(state, "rest_maricota_demo", { key: "today" });
  assert.equal(summary.income, 72.6);
  assert.equal(summary.expenses, 18);
  assert.equal(summary.result, 54.6);

  const kitchenItems = getKitchenItems(state, "rest_maricota_demo");
  const barItems = getBarItems(state, "rest_maricota_demo");
  const mirroredDrink = state.orderItems.find((item) => item.id === "item_open_cerveja");
  assert.ok(mirroredDrink);
  assert.equal(itemAppearsInPreparationSector(mirroredDrink, "kitchen"), true);
  assert.equal(itemAppearsInPreparationSector(mirroredDrink, "bar"), true);
  assert.equal(kitchenItems.some((item) => item.id === "item_open_cerveja"), true);
  assert.equal(barItems.some((item) => item.id === "item_open_cerveja"), true);
  assert.equal(kitchenItems.filter((item) => item.id === "item_open_cerveja").length, 1);
  assert.equal(barItems.filter((item) => item.id === "item_open_cerveja").length, 1);
});
