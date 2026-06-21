import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canAssignRole, canAssignRoles, canManageTeam, normalizeUsername } from "../lib/team-policy";

test("owner cria os cargos operacionais e manager apenas subordinados", () => {
  for (const role of ["waiter", "kitchen", "bar", "cashier"] as const) {
    assert.equal(canAssignRole("owner", role), true);
    assert.equal(canAssignRole("manager", role), true);
  }
  assert.equal(canAssignRole("owner", "owner"), true);
  assert.equal(canAssignRole("owner", "manager"), true);
  assert.equal(canAssignRole("manager", "owner"), false);
  assert.equal(canAssignRole("manager", "manager"), false);
  assert.equal(canManageTeam("waiter"), false);
});

test("múltiplas funções somam acesso e login é normalizado", () => {
  assert.equal(canAssignRoles(["owner"], ["waiter", "kitchen"]), true);
  assert.equal(canAssignRoles(["manager"], ["bar", "cashier"]), true);
  assert.equal(canAssignRoles(["manager"], ["owner"]), false);
  assert.equal(normalizeUsername(" João da Silva "), "joao-da-silva");
});

test("API cria Auth no servidor, vincula profile e desfaz Auth se o vínculo falhar", () => {
  const route = readFileSync("app/api/team/route.ts", "utf8");
  const page = readFileSync("app/app/(workspace)/settings/users/page.tsx", "utf8");
  assert.match(route, /process\.env\.SUPABASE_SECRET_KEY/);
  assert.match(route, /auth\.admin\.createUser/);
  assert.match(route, /\.from\("profiles"\)/);
  assert.match(route, /restaurant_id: auth\.actor\.restaurant_id/);
  assert.match(route, /auth\.admin\.deleteUser/);
  assert.match(route, /deleted_at/);
  assert.match(route, /technicalEmail/);
  assert.doesNotMatch(page, /SUPABASE_SECRET_KEY/);
});

test("env local permanece ignorado", () => {
  const gitignore = readFileSync(".gitignore", "utf8");
  assert.match(gitignore, /^\.env\.local$/m);
});
