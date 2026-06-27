"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { AlertCircle, Banknote, CreditCard, Landmark, Receipt, RefreshCcw, Split, WalletCards, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pixProviderLabel, pixStatusLabel, type PixCharge, type PixProvider } from "@/lib/pix-payment";
import { runtimeConfig } from "@/lib/runtime-config";
import { paymentMethodLabel } from "@/lib/services";
import { supabase } from "@/lib/supabase";
import type { Order, OrderItem, Payment, PaymentMethod } from "@/lib/types";
import { brl, cn } from "@/lib/utils";
import { createPixCopyPaste } from "@/lib/pix";

const methods: Array<{ method: PaymentMethod; icon: typeof WalletCards }> = [
  { method: "pix", icon: Landmark },
  { method: "cash", icon: Banknote },
  { method: "credit_card", icon: CreditCard },
  { method: "debit_card", icon: CreditCard },
  { method: "voucher", icon: Receipt },
  { method: "internal_consumption", icon: WalletCards }
];

export function PaymentForm({
  order,
  items,
  payments,
  accountName,
  cashOpen = true,
  onDiscount,
  onSetServiceFeeEnabled,
  pix,
  onPay,
  onClose,
  onReopen
}: {
  order: Order;
  items: OrderItem[];
  payments: Payment[];
  accountName: string;
  cashOpen?: boolean;
  onDiscount: (value: number) => void;
  onSetServiceFeeEnabled: (enabled: boolean) => void;
  pix?: { key?: string; recipient?: string; city?: string; provider?: PixProvider; providerEnvironment?: "test" | "production" };
  onPay: (input: { method: PaymentMethod; amount: number; cardBrand?: string; changeAmount?: number }) => void | Promise<void>;
  onClose: () => void;
  onReopen: () => void;
}) {
  const paid = payments
    .filter((payment) => (payment.paymentStatus ?? "paid") === "paid")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = Math.max(0, order.total - paid);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [cardBrand, setCardBrand] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [splitMode, setSplitMode] = useState<"equal" | "value" | "items">("value");
  const [peopleStr, setPeopleStr] = useState("2");
  const [splitValue, setSplitValue] = useState(remaining.toFixed(2));
  const [confirmClose, setConfirmClose] = useState(false);
  const [pixImage, setPixImage] = useState("");
  const [pixCharge, setPixCharge] = useState<PixCharge>();
  const [pixLoading, setPixLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pixError, setPixError] = useState("");
  const [discountType, setDiscountType] = useState<"value" | "percent">("value");
  const [discountInput, setDiscountInput] = useState(String(order.discount || 0));
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const people = Math.max(1, Number(peopleStr) || 1);

  const numericAmount = Number(amount) || 0;
  const paymentAmount = Math.min(Math.max(0, numericAmount), remaining);
  const change = method === "cash" ? Math.max(0, (Number(cashReceived) || 0) - paymentAmount) : 0;

  const itemSplitTotal = useMemo(
    () => {
      const activeItems = items.filter((item) => item.status !== "cancelled");
      if (selectedItemIds.length === 0) return activeItems.reduce((sum, item) => sum + item.unitPriceSnapshot * item.quantity, 0);
      return activeItems.filter((item) => selectedItemIds.includes(item.id)).reduce((sum, item) => sum + item.unitPriceSnapshot * item.quantity, 0);
    },
    [items, selectedItemIds]
  );
  const pixProvider = pix?.provider ?? "manual";
  const onlinePix = method === "pix" && runtimeConfig.dataMode === "supabase" && (pixProvider === "openpix" || pixProvider === "mercado_pago");
  const manualPixCode = useMemo(() => method === "pix" && !onlinePix && pix?.key && paymentAmount > 0 ? createPixCopyPaste({ key: pix.key, recipient: pix.recipient ?? "", city: pix.city ?? "", amount: paymentAmount }) : "", [method, onlinePix, paymentAmount, pix?.city, pix?.key, pix?.recipient]);
  const pixCode = onlinePix ? pixCharge?.copyPaste ?? "" : manualPixCode;

  useEffect(() => {
    if (!pixCode) { setPixImage(""); return; }
    void QRCode.toDataURL(pixCode, { width: 220, margin: 1 }).then(setPixImage).catch(() => setPixImage(""));
  }, [pixCode]);

  useEffect(() => {
    setAmount(remaining.toFixed(2));
    setSplitValue(remaining.toFixed(2));
  }, [remaining]);

  useEffect(() => {
    if (splitMode === "equal") {
      setAmount((order.total / people).toFixed(2));
    } else if (splitMode === "items" && selectedItemIds.length > 0) {
      const selected = Math.min(itemSplitTotal, remaining);
      setAmount(selected.toFixed(2));
    } else if (splitMode === "items" && selectedItemIds.length === 0) {
      setAmount(remaining.toFixed(2));
    }
    // splitMode "value" syncs amount via splitValue onChange, not here
  }, [splitMode, people, order.total, selectedItemIds, itemSplitTotal, remaining]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (onlinePix) {
      void generateOnlinePix();
      return;
    }
    if (paymentAmount <= 0) return;
    setSubmitting(true);
    try {
      await onPay({
        method,
        amount: paymentAmount,
        cardBrand: cardBrand || undefined,
        changeAmount: change || undefined
      });
      const nextRemaining = Math.max(0, remaining - paymentAmount);
      setAmount(nextRemaining.toFixed(2));
      setCashReceived("");
    } finally {
      setSubmitting(false);
    }
  }

  async function sessionHeaders() {
    const session = await supabase?.auth.getSession();
    const token = session?.data.session?.access_token;
    if (!token) throw new Error("Sessao nao encontrada.");
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  async function generateOnlinePix() {
    setPixLoading(true);
    setPixError("");
    try {
      const response = await fetch("/api/payments/pix/create", {
        method: "POST",
        headers: await sessionHeaders(),
        body: JSON.stringify({ orderId: order.id })
      });
      const data = await response.json() as PixCharge & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Nao foi possivel gerar o Pix.");
      setPixCharge(data);
    } catch (error) {
      setPixError(error instanceof Error ? error.message : "Nao foi possivel gerar o Pix.");
    } finally {
      setPixLoading(false);
    }
  }

  async function runPixAction(action: "check" | "cancel" | "confirm") {
    if (!pixCharge?.paymentId) return;
    setPixLoading(true);
    setPixError("");
    try {
      const response = await fetch("/api/payments/pix/action", {
        method: "POST",
        headers: await sessionHeaders(),
        body: JSON.stringify({ paymentId: pixCharge.paymentId, action })
      });
      const data = await response.json() as { status?: PixCharge["status"]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Nao foi possivel atualizar o Pix.");
      setPixCharge((current) => current ? { ...current, status: data.status ?? current.status } : current);
      if (data.status === "paid") window.location.reload();
    } catch (error) {
      setPixError(error instanceof Error ? error.message : "Nao foi possivel atualizar o Pix.");
    } finally {
      setPixLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">Conta</h2>
            <p className="text-sm font-bold text-slate-500">Pedido {order.id.slice(-6)}</p>
          </div>
          <div className="text-right">
            <div className="text-xs font-black text-slate-500">Falta</div>
            <div className="text-2xl font-black text-red-600">{brl(remaining)}</div>
          </div>
        </div>

        <div className="grid gap-2 text-sm font-bold text-slate-700">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <strong>{brl(order.subtotal)}</strong>
          </div>
          <div className="grid gap-1 text-sm font-bold text-slate-700">
            <span>Desconto</span>
            <div className="flex gap-2">
              <button type="button" className={cn("h-8 rounded-lg border px-3 text-xs font-black", discountType === "value" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200")} onClick={() => { setDiscountType("value"); const val = Number(discountInput) || 0; onDiscount(Math.min(val, order.subtotal)); }}>R$</button>
              <button type="button" className={cn("h-8 rounded-lg border px-3 text-xs font-black", discountType === "percent" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200")} onClick={() => { setDiscountType("percent"); const pct = Number(discountInput) || 0; const val = Number((order.subtotal * Math.min(pct, 100) / 100).toFixed(2)); onDiscount(val); }}>%</button>
              <input
                className="h-8 w-28 rounded-lg border border-slate-200 px-3 text-right"
                type="number"
                min={0}
                step="0.01"
                max={discountType === "percent" ? 100 : order.subtotal}
                value={discountInput}
                onChange={(event) => {
                  const raw = event.target.value;
                  setDiscountInput(raw);
                  const num = Number(raw) || 0;
                  if (discountType === "percent") {
                    const clamped = Math.min(num, 100);
                    onDiscount(Number((order.subtotal * clamped / 100).toFixed(2)));
                  } else {
                    onDiscount(Math.min(num, order.subtotal));
                  }
                }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Taxa de serviço</span>
            <div className="flex items-center gap-2">
              <strong>{brl(order.serviceFee)}</strong>
              <Button type="button" size="sm" variant="outline" onClick={() => onSetServiceFeeEnabled(!(order.serviceFeeEnabled ?? order.serviceFee > 0))}>
                {order.serviceFeeEnabled ?? order.serviceFee > 0 ? "Remover" : "Aplicar"}
              </Button>
            </div>
          </div>
          <div className="flex justify-between text-lg text-slate-950">
            <span>Total</span>
            <strong>{brl(order.total)}</strong>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span>Pago</span>
            <strong>{brl(paid)}</strong>
          </div>
        </div>
      </article>

      <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-950">
          <Split className="h-5 w-5 text-amber-600" aria-hidden="true" />
          Dividir
        </h2>
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["equal", "Igual"],
              ["value", "Valor"],
              ["items", "Item"]
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={cn(
                  "h-10 rounded-lg border border-slate-200 text-sm font-black",
                  splitMode === key && "border-slate-900 bg-slate-900 text-white"
                )}
                onClick={() => setSplitMode(key as "equal" | "value" | "items")}
              >
                {label}
              </button>
            ))}
          </div>
          {splitMode === "equal" ? (
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Pessoas
              <input
                className="h-11 rounded-lg border border-slate-200 px-3"
                type="number"
                inputMode="numeric"
                min={1}
                value={peopleStr}
                onChange={(event) => setPeopleStr(event.target.value)}
                onBlur={() => { if (!peopleStr || Number(peopleStr) < 1) setPeopleStr("1"); }}
              />
              <span className="text-lg font-black text-slate-950">{brl(order.total / people)}</span>
            </label>
          ) : null}
          {splitMode === "value" ? (
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Valor
              <input
                className="h-11 rounded-lg border border-slate-200 px-3"
                type="number"
                min={0}
                step="0.01"
                value={splitValue}
                onChange={(event) => { setSplitValue(event.target.value); setAmount(event.target.value); }}
              />
            </label>
          ) : null}
          {splitMode === "items" ? (
            <div className="grid gap-2">
              {items
                .filter((item) => item.status !== "cancelled")
                .map((item) => {
                  const selected = selectedItemIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn("flex justify-between rounded-lg p-3 text-sm font-bold text-left", selected ? "bg-amber-100 ring-2 ring-amber-500" : "bg-slate-50")}
                      onClick={() => setSelectedItemIds((prev) => selected ? prev.filter((id) => id !== item.id) : [...prev, item.id])}
                    >
                      <span>{item.quantity}x {item.productNameSnapshot}</span>
                      <strong>{brl(item.unitPriceSnapshot * item.quantity)}</strong>
                    </button>
                  );
                })}
              <div className="flex justify-between rounded-lg bg-amber-50 p-3 text-sm font-black text-amber-900">
                <span>Itens{selectedItemIds.length > 0 ? ` (${selectedItemIds.length})` : ""}</span>
                <strong>{brl(itemSplitTotal)}</strong>
              </div>
            </div>
          ) : null}
        </div>
      </article>

      <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft" onSubmit={submit}>
        <h2 className="mb-3 text-lg font-black text-slate-950">Pagamento</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {methods.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.method}
                type="button"
                className={cn(
                  "flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 px-2 text-sm font-black",
                  method === entry.method && "border-amber-500 bg-amber-100 text-amber-900"
                )}
                onClick={() => setMethod(entry.method)}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {paymentMethodLabel(entry.method)}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Valor
            <input
              className="h-12 rounded-lg border border-slate-200 px-3"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          {method === "cash" ? (
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Recebido
              <input
                className="h-12 rounded-lg border border-slate-200 px-3"
                type="number"
                min={0}
                step="0.01"
                value={cashReceived}
                onChange={(event) => setCashReceived(event.target.value)}
              />
              <span className="text-lg font-black text-emerald-700">Troco {brl(change)}</span>
            </label>
          ) : null}
          {method === "credit_card" || method === "debit_card" ? (
            <p className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-600">Registrar pagamento feito na maquininha. O sistema não tenta cobrar online.</p>
          ) : null}
          {method === "credit_card" || method === "debit_card" ? (
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Bandeira
              <input
                className="h-12 rounded-lg border border-slate-200 px-3"
                value={cardBrand}
                onChange={(event) => setCardBrand(event.target.value)}
              />
            </label>
          ) : null}
          {method === "pix" && onlinePix ? (
            <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-2 text-sm font-bold text-emerald-900">
                <Landmark className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{pixProviderLabel[pixProvider]} cria a cobranca no servidor. O webhook confirma automaticamente.</span>
              </div>
              {pixCharge ? (
                <div className="grid place-items-center gap-3">
                  <strong className="text-emerald-900">Pix de {brl(pixCharge.amount)} · {pixStatusLabel[pixCharge.status]}</strong>
                  {pixImage ? <Image src={pixImage} alt="QR Code Pix" width={220} height={220} unoptimized /> : null}
                  {pixCode ? <textarea className="h-24 w-full rounded-lg border border-emerald-200 bg-white p-2 text-xs font-bold" readOnly value={pixCode} /> : null}
                  <div className="grid w-full gap-2 sm:grid-cols-2">
                    <Button type="button" variant="outline" onClick={() => pixCode && void navigator.clipboard.writeText(pixCode)}>Copiar Pix copia e cola</Button>
                    <Button type="button" variant="outline" disabled={pixLoading} onClick={() => void runPixAction("check")}><RefreshCcw className="h-4 w-4" />Consultar pagamento</Button>
                    <Button type="button" variant="outline" disabled={pixLoading} onClick={() => void runPixAction("confirm")}>Confirmar manualmente</Button>
                    <Button type="button" variant="outline" disabled={pixLoading} onClick={() => void runPixAction("cancel")}><XCircle className="h-4 w-4" />Cancelar cobranca</Button>
                  </div>
                </div>
              ) : null}
              {pixError ? <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{pixError}</p> : null}
            </div>
          ) : null}
          {method === "pix" && !onlinePix && !pix?.key ? <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">Cadastre a chave Pix em Ajustes para gerar o QR Code.</p> : null}
          {method === "pix" && !onlinePix && pix?.key && !pixCode ? <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">Pix manual: confirme o pagamento no banco/app e clique em &quot;Marcar como pago&quot;.</p> : null}
          {method === "pix" && !onlinePix && pixCode ? <div className="grid place-items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><strong className="text-emerald-900">Pix de {brl(paymentAmount)}</strong>{pixImage ? <Image src={pixImage} alt="QR Code Pix" width={220} height={220} unoptimized /> : null}<p className="text-xs font-bold text-emerald-700">Confirme no banco/app e clique abaixo.</p><Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(pixCode)}>Copiar código Pix</Button></div> : null}
          {!cashOpen && remaining > 0 ? <p className="rounded-lg bg-red-50 p-3 text-sm font-black text-red-800">Abra o caixa antes de registrar pagamentos.</p> : null}
          <Button variant="amber" size="lg" type="submit" disabled={!cashOpen || remaining <= 0 || paymentAmount <= 0 || submitting || pixLoading}>
            {onlinePix ? pixLoading ? "Gerando Pix..." : pixCharge ? "Gerar novo Pix" : "Gerar Pix" : method === "pix" ? submitting ? "Registrando..." : "Marcar como pago" : method === "credit_card" || method === "debit_card" ? "Registrar pagamento manual" : "Registrar"}
          </Button>
        </div>
      </form>

      <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <h2 className="mb-3 text-lg font-black text-slate-950">Pagamentos</h2>
        <div className="grid gap-2">
          {payments.length ? (
            payments.map((payment) => (
              <div key={payment.id} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm font-bold">
                <span>{paymentMethodLabel(payment.method)}{payment.method === "pix" ? ` · ${pixProviderLabel[payment.provider ?? "manual"]} · ${pixStatusLabel[payment.paymentStatus ?? "paid"]}` : null}</span>
                <strong className={(payment.paymentStatus ?? "paid") === "paid" ? "text-emerald-700" : "text-amber-700"}>{brl(payment.amount)}</strong>
              </div>
            ))
          ) : (
            <div className="rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-500">Nenhum pagamento registrado</div>
          )}
        </div>
        {remaining <= 0 && order.status !== "closed" ? (
          <Button className="mt-4 w-full" variant="green" onClick={() => setConfirmClose(true)}>
            Fechar conta
          </Button>
        ) : null}
        {order.status === "closed" ? (
          <Button className="mt-4 w-full" variant="outline" onClick={onReopen}>
            Reabrir
          </Button>
        ) : null}
      </article>

      {confirmClose ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/45 p-0 sm:place-items-center sm:p-4">
          <section
            className="w-full max-w-md rounded-t-lg bg-white p-4 shadow-soft sm:rounded-lg"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar fechamento"
          >
            <h2 className="text-lg font-black text-slate-950">Confirmar fechamento</h2>
            <p className="mt-2 text-sm font-bold text-slate-600">
              Confirmar fechamento de {accountName} no valor de {brl(order.total)}?
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" type="button" onClick={() => setConfirmClose(false)}>
                Voltar
              </Button>
              <Button
                variant="green"
                type="button"
                onClick={() => {
                  setConfirmClose(false);
                  onClose();
                }}
              >
                Fechar conta
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
