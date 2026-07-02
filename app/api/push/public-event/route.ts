import { NextRequest, NextResponse } from "next/server";
import { getPushAdmin, rolesForPreparationSector, sendPushToRoles } from "@/lib/push-server";
import type { PreparationSector } from "@/lib/types";

type PublicEventType = "qr_order" | "waiter_call" | "bill_request";

interface PublicEventBody {
  type?: PublicEventType;
  tableToken?: string;
  orderId?: string;
}

export async function POST(request: NextRequest) {
  const supabase = getPushAdmin();
  if (!supabase) return NextResponse.json({ error: "Push não configurado" }, { status: 500 });

  const body = await request.json() as PublicEventBody;
  if (!body.type || !body.tableToken) return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });

  const { data: menu, error } = await supabase.rpc("get_public_menu", { p_table_token: body.tableToken });
  if (error || !menu) return NextResponse.json({ error: "QR inválido" }, { status: 401 });

  const publicMenu = menu as Record<string, unknown>;
  const restaurant = publicMenu.restaurant as Record<string, unknown> | undefined;
  const table = publicMenu.table as Record<string, unknown> | undefined;
  const restaurantId = String(restaurant?.id ?? "");
  const tableId = String(table?.id ?? "");
  const tableLabel = table?.name ? String(table.name) : table?.number ? `Mesa ${table.number}` : "Mesa";
  const tableUrl = tableId ? `/app/tables/${tableId}` : "/app/tables";
  if (!restaurantId || !tableId) return NextResponse.json({ error: "QR inválido" }, { status: 401 });

  if (body.type === "waiter_call" || body.type === "bill_request") {
    const result = await sendPushToRoles(supabase, {
      restaurantId,
      roles: body.type === "bill_request" ? ["owner", "manager", "waiter", "cashier"] : ["owner", "manager", "waiter"],
      title: body.type === "bill_request" ? "Pedido de conta" : "Atendimento solicitado",
      body: body.type === "bill_request" ? `${tableLabel} pediu a conta.` : `${tableLabel} chamou o atendimento.`,
      url: tableUrl,
      tag: `${body.type}-${tableId}`
    });
    return NextResponse.json(result);
  }

  if (!body.orderId) return NextResponse.json({ error: "Pedido ausente" }, { status: 400 });
  const { data: order } = await supabase
    .from("orders")
    .select("id,restaurant_id,table_id,source")
    .eq("id", body.orderId)
    .eq("restaurant_id", restaurantId)
    .eq("table_id", tableId)
    .eq("source", "qr_code")
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Pedido inválido" }, { status: 404 });

  const { data: items } = await supabase
    .from("order_items")
    .select("product_name_snapshot,quantity,preparation_sector,status")
    .eq("order_id", body.orderId)
    .eq("restaurant_id", restaurantId);

  const prepRoles = [...new Set((items ?? []).flatMap((item) => rolesForPreparationSector(String(item.preparation_sector) as PreparationSector)))];
  const staff = await sendPushToRoles(supabase, {
    restaurantId,
    roles: ["owner", "manager", "waiter"],
    title: "Novo pedido",
    body: `${tableLabel} enviou ${itemCount(items ?? [])}: ${summarizeItems(items ?? [])}.`,
    url: tableUrl,
    tag: `qr-order-${body.orderId}`
  });
  let sent = staff.sent;
  let expired = staff.expired;
  let configured = staff.configured;
  if (prepRoles.includes("kitchen")) {
    const result = await sendPushToRoles(supabase, { restaurantId, roles: ["kitchen"], title: "Pedido QR na cozinha", body: `${tableLabel}: ${summarizeItems(items ?? [])} para preparo.`, url: "/app/kitchen", tag: `qr-order-kitchen-${body.orderId}` });
    sent += result.sent; expired += result.expired; configured = configured && result.configured;
  }
  if (prepRoles.includes("bar")) {
    const result = await sendPushToRoles(supabase, { restaurantId, roles: ["bar"], title: "Pedido QR no bar", body: `${tableLabel}: ${summarizeItems(items ?? [])} para o bar.`, url: "/app/bar", tag: `qr-order-bar-${body.orderId}` });
    sent += result.sent; expired += result.expired; configured = configured && result.configured;
  }
  return NextResponse.json({ sent, expired, configured });
}

function summarizeItems(items: Array<Record<string, unknown>>) {
  if (!items.length) return "item";
  const names = items.slice(0, 2).map((item) => String(item.product_name_snapshot ?? "item"));
  const extra = items.length > 2 ? ` +${items.length - 2} itens` : "";
  return `${names.join(", ")}${extra}`;
}

function itemCount(items: Array<Record<string, unknown>>) {
  const count = items.reduce((sum, item) => sum + Number(item.quantity ?? 1), 0);
  return count === 1 ? "1 item" : `${count} itens`;
}
