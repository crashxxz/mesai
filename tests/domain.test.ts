import assert from "node:assert/strict";
import test from "node:test";
import { canCloseAccount, canManageProducts, canSeeFinance, roleLabel } from "../lib/permissions";
import { calculateOrderTotals, getBarItems, getFinancialSummary, getKitchenItems } from "../lib/services";
import { createSeedState } from "../lib/seed";
import type { Profile, UserRole } from "../lib/types";

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
  assert.equal(getKitchenItems(state, "rest_maricota_demo").every((item) => item.preparationSector === "kitchen"), true);
  assert.equal(getBarItems(state, "rest_maricota_demo").every((item) => item.preparationSector === "bar"), true);
});
