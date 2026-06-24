import { NextRequest, NextResponse } from "next/server";
import { createPixCopyPaste } from "@/lib/pix";
import { createProviderCharge, PixProviderError, providerConfigured } from "@/lib/server/pix-provider";
import { authenticatePaymentActor, canOperatePayments, jsonError } from "@/lib/server/payment-auth";
import type { PixProvider } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticatePaymentActor(request);
    if ("error" in auth) return auth.error;
    if (!canOperatePayments(auth.actor)) return jsonError("Sem permissao para gerar Pix.", 403);
    const body = await request.json() as Record<string, unknown>;
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!orderId) return jsonError("Pedido invalido.", 400);

    const [orderResult, settingsResult] = await Promise.all([
      auth.admin.from("orders").select("id,restaurant_id,total,status").eq("id", orderId).eq("restaurant_id", auth.actor.restaurantId).single(),
      auth.admin.from("restaurant_settings").select("pix_provider,pix_provider_environment,pix_key,pix_recipient_name,pix_city").eq("restaurant_id", auth.actor.restaurantId).maybeSingle()
    ]);
    if (orderResult.error || !orderResult.data || ["closed", "cancelled"].includes(orderResult.data.status)) return jsonError("Pedido nao esta disponivel para pagamento.", 404);
    const settings = settingsResult.data;
    const provider = settings?.pix_provider === "openpix" || settings?.pix_provider === "mercado_pago" ? settings.pix_provider as Exclude<PixProvider, "manual"> : "manual";
    const environment = settings?.pix_provider_environment === "production" ? "production" : "test";
    const paidResult = await auth.admin.from("payments").select("amount").eq("order_id", orderId).eq("payment_status", "paid");
    const paid = (paidResult.data ?? []).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
    const remaining = Math.max(0, Number(orderResult.data.total) - paid);
    if (remaining <= 0.001) return jsonError("Este pedido ja esta pago.", 409);

    if (provider === "manual") {
      const key = settings?.pix_key?.trim();
      if (!key) return jsonError("Cadastre a chave Pix manual em Ajustes.", 422);
      return NextResponse.json({ provider, status: "manual", amount: remaining, copyPaste: createPixCopyPaste({ key, recipient: settings?.pix_recipient_name ?? "", city: settings?.pix_city ?? "", amount: remaining }) });
    }
    if (!providerConfigured(provider)) return jsonError(`Configure as credenciais ${provider === "openpix" ? "da OpenPix" : "do Mercado Pago"} no ambiente do servidor.`, 422);

    const pendingResult = await auth.admin.from("payments")
      .select("id,provider,payment_status,amount,pix_copy_paste,external_payment_id,txid,expires_at")
      .eq("order_id", orderId).eq("method", "pix").eq("provider", provider).eq("payment_status", "pending")
      .order("created_at", { ascending: false }).limit(1);
    const pending = pendingResult.data?.[0];
    if (pending?.pix_copy_paste) return NextResponse.json(toCharge(pending));

    const charge = await createProviderCharge({ provider, environment, orderId, restaurantId: auth.actor.restaurantId, amount: remaining, description: `MesaY pedido ${orderId.slice(-6)}` });
    const inserted = await auth.admin.from("payments").insert({
      restaurant_id: auth.actor.restaurantId,
      order_id: orderId,
      method: "pix",
      amount: Number(remaining.toFixed(2)),
      provider,
      provider_environment: environment,
      external_payment_id: charge.externalPaymentId,
      txid: charge.txid ?? null,
      payment_status: "pending",
      pix_copy_paste: charge.copyPaste,
      expires_at: charge.expiresAt ?? null,
      created_by: auth.actor.id
    }).select("id,provider,payment_status,amount,pix_copy_paste,external_payment_id,txid,expires_at").single();
    if (inserted.error || !inserted.data) return jsonError("Nao foi possivel salvar a cobranca Pix.", 500);
    return NextResponse.json(toCharge(inserted.data), { status: 201 });
  } catch (error) {
    return jsonError(error instanceof PixProviderError ? error.message : "Nao foi possivel gerar a cobranca Pix.", 500);
  }
}

function toCharge(payment: Record<string, unknown>) {
  return {
    paymentId: String(payment.id),
    provider: payment.provider,
    status: payment.payment_status,
    amount: Number(payment.amount ?? 0),
    copyPaste: typeof payment.pix_copy_paste === "string" ? payment.pix_copy_paste : undefined,
    externalPaymentId: typeof payment.external_payment_id === "string" ? payment.external_payment_id : undefined,
    txid: typeof payment.txid === "string" ? payment.txid : undefined,
    expiresAt: payment.expires_at ? String(payment.expires_at) : undefined
  };
}
