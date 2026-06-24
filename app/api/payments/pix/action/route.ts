import { NextRequest, NextResponse } from "next/server";
import { cancelProviderCharge, lookupProviderPayment, PixProviderError, providerConfigured } from "@/lib/server/pix-provider";
import { authenticatePaymentActor, canEmergencyConfirmPix, canOperatePayments, jsonError } from "@/lib/server/payment-auth";
import type { PixProvider } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticatePaymentActor(request);
    if ("error" in auth) return auth.error;
    if (!canOperatePayments(auth.actor)) return jsonError("Sem permissao para consultar Pix.", 403);
    const body = await request.json() as Record<string, unknown>;
    const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
    const action = body.action === "check" || body.action === "cancel" || body.action === "confirm" ? body.action : "";
    if (!paymentId || !action) return jsonError("Acao Pix invalida.", 400);

    const paymentResult = await auth.admin.from("payments")
      .select("id,restaurant_id,order_id,method,amount,provider,provider_environment,external_payment_id,txid,payment_status,pix_copy_paste,expires_at")
      .eq("id", paymentId).eq("restaurant_id", auth.actor.restaurantId).eq("method", "pix").single();
    if (paymentResult.error || !paymentResult.data) return jsonError("Cobranca Pix nao encontrada.", 404);
    const payment = paymentResult.data;
    const provider = payment.provider as PixProvider;
    if (provider === "manual") return jsonError("Esta cobranca Pix e manual.", 400);
    const environment = payment.provider_environment === "production" ? "production" : "test";

    if (action === "confirm") {
      if (!canEmergencyConfirmPix(auth.actor)) return jsonError("Somente admin ou caixa pode confirmar manualmente.", 403);
      const confirmed = await auth.admin.rpc("confirm_external_pix_payment", {
        p_payment_id: payment.id,
        p_provider: provider,
        p_external_payment_id: payment.external_payment_id,
        p_txid: payment.txid,
        p_amount: payment.amount,
        p_payload: { manual_confirmation: true, actor_id: auth.actor.id },
        p_event_id: `manual:${payment.id}`,
        p_manual_override: true
      });
      if (confirmed.error) return jsonError("Nao foi possivel confirmar o Pix manualmente.", 500);
      return NextResponse.json({ paymentId: payment.id, status: "paid" });
    }
    if (!providerConfigured(provider)) return jsonError("Credenciais do provedor Pix nao configuradas no servidor.", 422);
    if (!payment.external_payment_id) return jsonError("Identificador externo da cobranca ausente.", 409);

    if (action === "cancel") {
      if (!canEmergencyConfirmPix(auth.actor)) return jsonError("Somente admin ou caixa pode cancelar a cobranca.", 403);
      await cancelProviderCharge(provider, environment, payment.external_payment_id);
      const cancelled = await auth.admin.rpc("cancel_external_pix_payment", { p_payment_id: payment.id, p_reason: "Cancelada pelo caixa" });
      if (cancelled.error) return jsonError("Nao foi possivel registrar o cancelamento.", 500);
      return NextResponse.json({ paymentId: payment.id, status: "cancelled" });
    }

    const remote = await lookupProviderPayment(provider, environment, payment.external_payment_id);
    if (remote.paid) {
      const confirmed = await auth.admin.rpc("confirm_external_pix_payment", {
        p_payment_id: payment.id,
        p_provider: provider,
        p_external_payment_id: remote.externalPaymentId,
        p_txid: remote.txid ?? null,
        p_amount: remote.amount,
        p_payload: remote.payload,
        p_event_id: `check:${payment.id}:${remote.externalPaymentId}`,
        p_manual_override: false
      });
      if (confirmed.error) return jsonError("Nao foi possivel confirmar o Pix.", 500);
      return NextResponse.json({ paymentId: payment.id, status: "paid" });
    }
    if (remote.expired) {
      await auth.admin.from("payments").update({ payment_status: "expired", webhook_payload: remote.payload, updated_at: new Date().toISOString() }).eq("id", payment.id);
      return NextResponse.json({ paymentId: payment.id, status: "expired" });
    }
    return NextResponse.json({ paymentId: payment.id, status: "pending" });
  } catch (error) {
    return jsonError(error instanceof PixProviderError ? error.message : "Nao foi possivel consultar a cobranca Pix.", 500);
  }
}
