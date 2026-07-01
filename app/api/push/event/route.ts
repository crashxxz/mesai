import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile, getPushAdmin, rolesForPreparationSector, sendPushToRoles } from "@/lib/push-server";
import type { PreparationSector, UserRole } from "@/lib/types";

type PushEventType = "items_sent" | "item_ready" | "item_rejected";

interface EventBody {
  type?: PushEventType;
  orderId?: string;
  itemId?: string;
}

export async function POST(request: NextRequest) {
  const supabase = getPushAdmin();
  if (!supabase) return NextResponse.json({ error: "Push não configurado" }, { status: 500 });

  const profile = await getAuthenticatedProfile(request, supabase);
  if (!profile) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const body = await request.json() as EventBody;
  if (!body.type) return NextResponse.json({ error: "Evento ausente" }, { status: 400 });

  if (body.type === "items_sent") {
    if (!body.orderId) return NextResponse.json({ error: "Pedido ausente" }, { status: 400 });
    const { data: order } = await supabase
      .from("orders")
      .select("id,restaurant_id,table_id")
      .eq("id", body.orderId)
      .eq("restaurant_id", profile.restaurantId)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: "Pedido inválido" }, { status: 404 });

    const { data: items } = await supabase
      .from("order_items")
      .select("preparation_sector,status")
      .eq("order_id", body.orderId)
      .eq("restaurant_id", profile.restaurantId)
      .in("status", ["sent", "received", "preparing"]);

    const roles = [...new Set((items ?? []).flatMap((item) => rolesForPreparationSector(String(item.preparation_sector) as PreparationSector)))];
    const tableLabel = await getTableLabel(supabase, profile.restaurantId, String(order.table_id));
    let sent = 0;
    let expired = 0;
    let configured = true;
    if (roles.includes("kitchen")) {
      const result = await sendPushToRoles(supabase, { restaurantId: profile.restaurantId, roles: ["kitchen"], title: "Item enviado para cozinha", body: `${tableLabel}: item enviado para preparo.`, url: "/app/kitchen", tag: `order-sent-kitchen-${body.orderId}` });
      sent += result.sent; expired += result.expired; configured = configured && result.configured;
    }
    if (roles.includes("bar")) {
      const result = await sendPushToRoles(supabase, { restaurantId: profile.restaurantId, roles: ["bar"], title: "Item enviado para o bar", body: `${tableLabel}: bebida enviada para preparo.`, url: "/app/bar", tag: `order-sent-bar-${body.orderId}` });
      sent += result.sent; expired += result.expired; configured = configured && result.configured;
    }
    return NextResponse.json({ sent, expired, configured });
  }

  if (!body.itemId) return NextResponse.json({ error: "Item ausente" }, { status: 400 });
  const { data: item } = await supabase
    .from("order_items")
    .select("id,restaurant_id,order_id,product_name_snapshot,preparation_sector,status")
    .eq("id", body.itemId)
    .eq("restaurant_id", profile.restaurantId)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: "Item inválido" }, { status: 404 });

  const roles: UserRole[] = ["owner", "manager", "waiter"];
  const ready = body.type === "item_ready";
  const result = await sendPushToRoles(supabase, {
    restaurantId: profile.restaurantId,
    roles,
    title: ready ? "Item pronto" : "Item recusado",
    body: `${String(item.product_name_snapshot)} ${ready ? "ficou pronto." : "foi recusado."}`,
    url: "/app/tables",
    tag: `${body.type}-${body.itemId}`
  });
  return NextResponse.json(result);
}

async function getTableLabel(supabase: ReturnType<typeof getPushAdmin>, restaurantId: string, tableId?: string) {
  if (!supabase || !tableId) return "Mesa";
  const { data } = await supabase.from("tables").select("number,name").eq("id", tableId).eq("restaurant_id", restaurantId).maybeSingle();
  return data?.name ? String(data.name) : data?.number ? `Mesa ${data.number}` : "Mesa";
}
