import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("push valida restaurante/cargo no servidor e não aceita restaurante arbitrário do cliente", () => {
  const subscribe = readFileSync("app/api/push/subscribe/route.ts", "utf8");
  const server = readFileSync("lib/push-server.ts", "utf8");

  assert.match(subscribe, /getAuthenticatedProfile/);
  assert.doesNotMatch(subscribe, /restaurantId: body\.restaurantId/);
  assert.doesNotMatch(subscribe, /role: body\.role/);
  assert.match(subscribe, /last_seen_at/);
  assert.match(server, /eq\("restaurant_id", message\.restaurantId\)/);
  assert.match(server, /statusCode === 404 \|\| statusCode === 410/);
  assert.equal(existsSync("app/api/push/send/route.ts"), false);
});

test("eventos reais de push cobrem QR, chamados, preparo, pronto e recusa com contexto", () => {
  const store = readFileSync("lib/store.tsx", "utf8");
  const publicPage = readFileSync("app/r/[restaurantSlug]/mesa/[tableId]/page.tsx", "utf8");
  const eventRoute = readFileSync("app/api/push/event/route.ts", "utf8");
  const publicEventRoute = readFileSync("app/api/push/public-event/route.ts", "utf8");

  assert.match(store, /notifyPushEvent\("items_sent"/);
  assert.match(store, /notifyPushEvent\("item_ready"/);
  assert.match(store, /notifyPushEvent\("item_rejected"/);
  assert.match(publicPage, /notifyPublicPushEvent\("qr_order"/);
  assert.match(publicPage, /notifyPublicPushEvent\(type/);
  assert.match(eventRoute, /product_name_snapshot,quantity/);
  assert.match(eventRoute, /Motivo:/);
  assert.match(publicEventRoute, /Novo pedido/);
  assert.match(publicEventRoute, /Atendimento solicitado/);
  assert.match(publicEventRoute, /Pedido de conta/);
});

test("ativação push fica no sino, sincroniza troca de usuário e permite limpar", () => {
  const notificationCenter = readFileSync("components/notification-center.tsx", "utf8");
  const subscribe = readFileSync("app/api/push/subscribe/route.ts", "utf8");
  const push = readFileSync("lib/push.ts", "utf8");
  const sw = readFileSync("public/sw.js", "utf8");

  assert.match(notificationCenter, /import \{ PushButton \}/);
  assert.match(notificationCenter, /<PushButton \/>/);
  assert.match(notificationCenter, /syncExistingPushSubscription/);
  assert.match(notificationCenter, /Limpar notificações/);
  assert.match(push, /syncExistingPushSubscription/);
  assert.match(push, /disableCurrentPushSubscription/);
  assert.match(subscribe, /role: profile\.role/);
  assert.match(subscribe, /roles: profile\.roles/);
  assert.doesNotMatch(subscribe, /restaurantId: body\.restaurantId/);
  assert.match(sw, /safeAppUrl/);
  assert.match(sw, /navigate\(targetUrl\)/);
});
