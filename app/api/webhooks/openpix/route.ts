import { NextRequest, NextResponse } from "next/server";
import { paymentAdminClient } from "@/lib/server/payment-auth";
import { verifyOpenPixWebhook } from "@/lib/server/pix-provider";
import { reconcilePixWebhook } from "@/lib/server/pix-webhook";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-webhook-token") ?? request.headers.get("authorization");
    if (!verifyOpenPixWebhook(token)) return NextResponse.json({ error: "Webhook nao autorizado." }, { status: 401 });
    const payload = await request.json() as Record<string, unknown>;
    const charge = (payload.charge ?? payload) as Record<string, unknown>;
    const externalPaymentId = stringValue(charge.correlationID) || stringValue(payload.correlationID);
    if (!externalPaymentId) return NextResponse.json({ error: "Evento sem cobranca." }, { status: 400 });
    const eventId = stringValue(payload.eventId) || stringValue(payload.id) || stringValue(charge.transactionID) || `openpix:${externalPaymentId}:${stringValue(charge.status)}`;
    const result = await reconcilePixWebhook({ admin: paymentAdminClient(), provider: "openpix", externalPaymentId, eventId, payload });
    console.info("pix-webhook", { provider: "openpix", externalPaymentId, status: result.status, ignored: result.ignored });
    return NextResponse.json({ ok: true, status: result.status });
  } catch {
    return NextResponse.json({ error: "Webhook OpenPix invalido." }, { status: 500 });
  }
}

function stringValue(value: unknown) { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
