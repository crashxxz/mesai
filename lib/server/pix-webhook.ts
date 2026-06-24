import type { PixProvider } from "@/lib/types";
import { lookupProviderPayment } from "@/lib/server/pix-provider";
import { paymentAdminClient } from "@/lib/server/payment-auth";

type Admin = ReturnType<typeof paymentAdminClient>;

export async function reconcilePixWebhook(input: {
  admin: Admin;
  provider: Exclude<PixProvider, "manual">;
  externalPaymentId: string;
  eventId: string;
  payload: Record<string, unknown>;
}) {
  const paymentResult = await input.admin.from("payments")
    .select("id,provider,provider_environment,external_payment_id,txid,amount,payment_status")
    .eq("provider", input.provider).eq("external_payment_id", input.externalPaymentId).maybeSingle();
  const payment = paymentResult.data;
  if (paymentResult.error || !payment) return { ignored: true as const, status: "not_found" };
  if (payment.payment_status === "paid") return { ignored: true as const, status: "paid" };
  const environment = payment.provider_environment === "production" ? "production" : "test";
  const remote = await lookupProviderPayment(input.provider, environment, input.externalPaymentId);
  if (remote.paid) {
    const result = await input.admin.rpc("confirm_external_pix_payment", {
      p_payment_id: payment.id,
      p_provider: input.provider,
      p_external_payment_id: remote.externalPaymentId,
      p_txid: remote.txid ?? null,
      p_amount: remote.amount,
      p_payload: { webhook: input.payload, provider_payment: remote.payload },
      p_event_id: input.eventId,
      p_manual_override: false
    });
    if (result.error) throw new Error("Falha ao confirmar Pix no banco.");
    return { ignored: false as const, status: "paid" };
  }
  if (remote.expired) {
    await input.admin.from("payments").update({ payment_status: "expired", webhook_payload: { webhook: input.payload, provider_payment: remote.payload }, updated_at: new Date().toISOString() }).eq("id", payment.id);
    return { ignored: false as const, status: "expired" };
  }
  return { ignored: false as const, status: "pending" };
}
