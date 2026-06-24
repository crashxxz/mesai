"use client";

import { FormEvent, useMemo, useState } from "react";
import { Banknote, CreditCard, Landmark, Receipt, Split, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { paymentMethodLabel } from "@/lib/services";
import type { Order, OrderItem, Payment, PaymentMethod } from "@/lib/types";
import { brl, cn } from "@/lib/utils";

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
  onDiscount,
  onPay,
  onClose,
  onReopen
}: {
  order: Order;
  items: OrderItem[];
  payments: Payment[];
  accountName: string;
  onDiscount: (value: number) => void;
  onPay: (input: { method: PaymentMethod; amount: number; cardBrand?: string; changeAmount?: number }) => void;
  onClose: () => void;
  onReopen: () => void;
}) {
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = Math.max(0, order.total - paid);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const [cardBrand, setCardBrand] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [splitMode, setSplitMode] = useState<"equal" | "value" | "items">("value");
  const [people, setPeople] = useState(2);
  const [splitValue, setSplitValue] = useState(remaining.toFixed(2));
  const [confirmClose, setConfirmClose] = useState(false);

  const numericAmount = Number(amount) || 0;
  const change = method === "cash" ? Math.max(0, (Number(cashReceived) || 0) - numericAmount) : 0;

  const itemSplitTotal = useMemo(
    () => items.filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + item.unitPriceSnapshot * item.quantity, 0),
    [items]
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (numericAmount <= 0) return;
    onPay({
      method,
      amount: Math.min(numericAmount, remaining || numericAmount),
      cardBrand: cardBrand || undefined,
      changeAmount: change || undefined
    });
    const nextRemaining = Math.max(0, remaining - numericAmount);
    setAmount(nextRemaining.toFixed(2));
    setCashReceived("");
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
          <label className="flex items-center justify-between gap-3">
            <span>Desconto</span>
            <input
              className="h-10 w-32 rounded-lg border border-slate-200 px-3 text-right"
              type="number"
              min={0}
              step="0.01"
              value={order.discount}
              onChange={(event) => onDiscount(Number(event.target.value) || 0)}
            />
          </label>
          <div className="flex justify-between">
            <span>Taxa de serviço</span>
            <strong>{brl(order.serviceFee)}</strong>
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
                min={1}
                value={people}
                onChange={(event) => setPeople(Math.max(1, Number(event.target.value)))}
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
                onChange={(event) => setSplitValue(event.target.value)}
              />
            </label>
          ) : null}
          {splitMode === "items" ? (
            <div className="grid gap-2">
              {items
                .filter((item) => item.status !== "cancelled")
                .map((item) => (
                  <div key={item.id} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm font-bold">
                    <span>{item.quantity}x {item.productNameSnapshot}</span>
                    <strong>{brl(item.unitPriceSnapshot * item.quantity)}</strong>
                  </div>
                ))}
              <div className="flex justify-between rounded-lg bg-amber-50 p-3 text-sm font-black text-amber-900">
                <span>Itens</span>
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
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Bandeira
              <input
                className="h-12 rounded-lg border border-slate-200 px-3"
                value={cardBrand}
                onChange={(event) => setCardBrand(event.target.value)}
              />
            </label>
          ) : null}
          <Button variant="amber" size="lg" type="submit" disabled={remaining <= 0}>
            Registrar
          </Button>
        </div>
      </form>

      <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <h2 className="mb-3 text-lg font-black text-slate-950">Pagamentos</h2>
        <div className="grid gap-2">
          {payments.length ? (
            payments.map((payment) => (
              <div key={payment.id} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm font-bold">
                <span>{paymentMethodLabel(payment.method)}</span>
                <strong>{brl(payment.amount)}</strong>
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
