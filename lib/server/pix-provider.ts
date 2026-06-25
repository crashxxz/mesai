import { createHmac, timingSafeEqual } from "node:crypto";
import type { PixProvider } from "@/lib/types";

export interface ProviderChargeInput {
  provider: Exclude<PixProvider, "manual">;
  environment: "test" | "production";
  orderId: string;
  restaurantId: string;
  amount: number;
  description: string;
}

export interface ProviderCharge {
  externalPaymentId: string;
  txid?: string;
  copyPaste: string;
  expiresAt?: string;
}

export interface ProviderPaymentLookup {
  externalPaymentId: string;
  txid?: string;
  amount: number;
  paid: boolean;
  expired: boolean;
  payload: Record<string, unknown>;
}

export class PixProviderError extends Error {}

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function openPixToken() {
  return env("OPENPIX_API_KEY") || env("OPENPIX_APP_ID");
}

function mercadoPagoToken() {
  return env("MERCADO_PAGO_ACCESS_TOKEN") || env("MERCADOPAGO_ACCESS_TOKEN");
}

export function providerConfigured(provider: Exclude<PixProvider, "manual">) {
  return provider === "openpix"
    ? Boolean(openPixToken())
    : Boolean(mercadoPagoToken());
}

function baseUrl(provider: Exclude<PixProvider, "manual">, environment: "test" | "production") {
  if (provider === "openpix") return env(environment === "test" ? "OPENPIX_API_URL_TEST" : "OPENPIX_API_URL") || "https://api.openpix.com.br/api/v1";
  return env(environment === "test" ? "MERCADO_PAGO_API_URL_TEST" : "MERCADO_PAGO_API_URL")
    || env(environment === "test" ? "MERCADOPAGO_API_URL_TEST" : "MERCADOPAGO_API_URL")
    || "https://api.mercadopago.com";
}

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new PixProviderError(typeof body.message === "string" ? body.message : "O provedor Pix recusou a solicitacao.");
  return body;
}

export async function createProviderCharge(input: ProviderChargeInput): Promise<ProviderCharge> {
  if (!providerConfigured(input.provider)) throw new PixProviderError("Credenciais do provedor Pix nao configuradas no servidor.");
  if (input.provider === "openpix") {
    const correlationID = `mesay-${input.orderId}`;
    const body = await jsonRequest(`${baseUrl("openpix", input.environment)}/charge`, {
      method: "POST",
      headers: { Authorization: openPixToken(), "Content-Type": "application/json" },
      body: JSON.stringify({ correlationID, value: Math.round(input.amount * 100), comment: input.description, expiresIn: 3600 })
    });
    const charge = (body.charge ?? body) as Record<string, unknown>;
    const externalPaymentId = stringValue(charge.correlationID) || correlationID;
    const copyPaste = stringValue(charge.brCode);
    if (!copyPaste) throw new PixProviderError("OpenPix nao retornou o codigo Pix.");
    return { externalPaymentId, txid: stringValue(charge.transactionID), copyPaste, expiresAt: stringValue(charge.expiresDate) };
  }

  const body = await jsonRequest(`${baseUrl("mercado_pago", input.environment)}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mercadoPagoToken()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `mesay-${input.orderId}`
    },
    body: JSON.stringify({
      transaction_amount: Number(input.amount.toFixed(2)),
      description: input.description,
      payment_method_id: "pix",
      external_reference: input.orderId,
      metadata: { restaurant_id: input.restaurantId, order_id: input.orderId }
    })
  });
  const point = (body.point_of_interaction ?? {}) as Record<string, unknown>;
  const transaction = (point.transaction_data ?? {}) as Record<string, unknown>;
  const externalPaymentId = stringValue(body.id);
  const copyPaste = stringValue(transaction.qr_code);
  if (!externalPaymentId || !copyPaste) throw new PixProviderError("Mercado Pago nao retornou a cobranca Pix.");
  return { externalPaymentId, txid: externalPaymentId, copyPaste, expiresAt: stringValue(body.date_of_expiration) };
}

export async function lookupProviderPayment(provider: Exclude<PixProvider, "manual">, environment: "test" | "production", externalPaymentId: string): Promise<ProviderPaymentLookup> {
  if (!providerConfigured(provider)) throw new PixProviderError("Credenciais do provedor Pix nao configuradas no servidor.");
  if (provider === "openpix") {
    const body = await jsonRequest(`${baseUrl("openpix", environment)}/charge/${encodeURIComponent(externalPaymentId)}`, { headers: { Authorization: openPixToken() } });
    const charge = (body.charge ?? body) as Record<string, unknown>;
    const status = stringValue(charge.status).toUpperCase();
    return { externalPaymentId: stringValue(charge.correlationID) || externalPaymentId, txid: stringValue(charge.transactionID), amount: Number(charge.value ?? 0) / 100, paid: status === "COMPLETED", expired: status === "EXPIRED", payload: body };
  }
  const body = await jsonRequest(`${baseUrl("mercado_pago", environment)}/v1/payments/${encodeURIComponent(externalPaymentId)}`, { headers: { Authorization: `Bearer ${mercadoPagoToken()}` } });
  const status = stringValue(body.status).toLowerCase();
  return { externalPaymentId: stringValue(body.id) || externalPaymentId, txid: stringValue(body.transaction_id), amount: Number(body.transaction_amount ?? 0), paid: status === "approved", expired: status === "cancelled" || status === "rejected", payload: body };
}

export async function cancelProviderCharge(provider: Exclude<PixProvider, "manual">, environment: "test" | "production", externalPaymentId: string) {
  if (!providerConfigured(provider)) throw new PixProviderError("Credenciais do provedor Pix nao configuradas no servidor.");
  if (provider === "openpix") {
    await jsonRequest(`${baseUrl("openpix", environment)}/charge/${encodeURIComponent(externalPaymentId)}`, { method: "DELETE", headers: { Authorization: openPixToken() } });
    return;
  }
  await jsonRequest(`${baseUrl("mercado_pago", environment)}/v1/payments/${encodeURIComponent(externalPaymentId)}`, { method: "PUT", headers: { Authorization: `Bearer ${mercadoPagoToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
}

export function verifyOpenPixWebhook(providedToken: string | null) {
  const expected = env("OPENPIX_WEBHOOK_TOKEN") || env("PAYMENT_WEBHOOK_SECRET");
  return Boolean(expected && providedToken && safeEqual(expected, providedToken.replace(/^Bearer\s+/i, "")));
}

export function verifyMercadoPagoWebhook(signature: string | null, requestId: string | null, paymentId: string) {
  const secret = env("MERCADO_PAGO_WEBHOOK_SECRET") || env("MERCADOPAGO_WEBHOOK_SECRET") || env("PAYMENT_WEBHOOK_SECRET");
  if (!secret || !signature || !paymentId) return false;
  const values = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=")).filter(([key, value]) => key && value));
  const timestamp = values.ts;
  const received = values.v1;
  if (!timestamp || !received) return false;
  const manifest = `id:${paymentId};request-id:${requestId ?? ""};ts:${timestamp};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return safeEqual(expected, received);
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
