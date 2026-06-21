import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationRoot = new URL("../supabase/migrations/", import.meta.url);

test("migrações removem leitura QR anônima ampla e usam tokens", async () => {
  const foundation = await readFile(new URL("202606200001_production_foundation.sql", migrationRoot), "utf8");
  assert.match(foundation, /drop policy if exists "public read own qr order by table"/);
  assert.match(foundation, /create table if not exists public\.table_qr_tokens/);
  assert.match(foundation, /digest\(p_table_token, 'sha256'\)/);
  assert.match(foundation, /create or replace function public\.start_qr_session/);
});

test("operações críticas possuem RPC transacional", async () => {
  const rpc = await readFile(new URL("202606200002_transactional_rpcs.sql", migrationRoot), "utf8");
  for (const name of [
    "create_order_with_items",
    "create_qr_order",
    "update_preparation_status",
    "register_order_payment",
    "close_paid_order",
    "record_stock_movement"
  ]) {
    assert.match(rpc, new RegExp(`function public\\.${name}`));
  }

  const cash = await readFile(new URL("202606200003_cash_rpcs.sql", migrationRoot), "utf8");
  assert.match(cash, /function public\.open_cash_session/);
  assert.match(cash, /function public\.close_cash_session/);
});
