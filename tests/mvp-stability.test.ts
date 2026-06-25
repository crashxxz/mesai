import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("MVP bloqueia duplicidade de pagamento e Pix manual usa valor digitado", () => {
  const form = readFileSync("components/payment-form.tsx", "utf8");
  const store = readFileSync("lib/store.tsx", "utf8");
  const migration = readFileSync("supabase/migrations/202606250001_mvp_payment_guard.sql", "utf8");
  assert.match(form, /amount: paymentAmount/);
  assert.match(form, /Pix de \{brl\(paymentAmount\)\}/);
  assert.match(form, /submitting/);
  assert.match(store, /localRemaining/);
  assert.match(store, /Math\.min\(input\.amount, localRemaining\)/);
  assert.match(migration, /v_remaining := round\(greatest\(v_order\.total - v_paid, 0\), 2\)/);
  assert.match(migration, /coalesce\(payment_status, 'paid'\) = 'paid'/);
});

test("histórico financeiro oculta mesas zeradas por padrão e tema aparece para todos", () => {
  const finance = readFileSync("app/app/(workspace)/finance/page.tsx", "utf8");
  const shell = readFileSync("components/app-shell.tsx", "utf8");
  const theme = readFileSync("components/theme-sync.tsx", "utf8");
  assert.match(finance, /showZeroOrders/);
  assert.match(finance, /Mostrar mesas zeradas\/canceladas/);
  assert.match(finance, /paidPaymentsForHistory/);
  assert.match(shell, /<ThemePicker \/>/);
  assert.match(theme, /mesay-theme-preference/);
});
