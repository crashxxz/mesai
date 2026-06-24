import { NextRequest, NextResponse } from "next/server";
import { paymentAdminClient } from "@/lib/server/payment-auth";
import { verifyMercadoPagoWebhook } from "@/lib/server/pix-provider";
import { reconcilePixWebhook } from "@/lib/server/pix-webhook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const paymentId = stringValue(data.id) || stringValue(payload.id);
    if (!paymentId) return NextResponse.json({ error: "Evento sem pagamento." }, { status: 400 });
    if (!verifyMercadoPagoWebhook(request.headers.get("x-signature"), request.headers.get("x-request-id"), paymentId)) {
      return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 });
    }
    const eventId = stringValue(payload.id) || `mercadopago:${paymentId}:${stringValue(payload.action)}`;
    const result = await reconcilePixWebhook({ admin: paymentAdminClient(), provider: "mercado_pago", externalPaymentId: paymentId, eventId, payload });
    console.info("pix-webhook", { provider: "mercado_pago", externalPaymentId: paymentId, status: result.status, ignored: result.ignored });
    return NextResponse.json({ ok: true, status: result.status });
  } catch {
    return NextResponse.json({ error: "Webhook Mercado Pago invalido." }, { status: 500 });
  }
}

function stringValue(value: unknown) { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
