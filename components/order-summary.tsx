"use client";

import { Ban, CheckCircle2, MessageSquareText, Send, ShoppingBasket, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { orderItemStatusLabel, orderStatusLabel } from "@/lib/services";
import type { Order, OrderItem, OrderItemAddon } from "@/lib/types";
import { useBusinessPreset } from "@/lib/use-business-preset";
import { brl } from "@/lib/utils";

export function OrderSummary({
  order,
  items,
  addons,
  onSend,
  onCancel,
  onDeliver,
  onApplyServiceFee,
  onSetServiceFeeEnabled,
  onCancelOrder
}: {
  order: Order;
  items: OrderItem[];
  addons: OrderItemAddon[];
  onSend: () => void;
  onCancel: (itemId: string) => void;
  onDeliver: (itemId: string) => void;
  onApplyServiceFee?: () => void;
  onSetServiceFeeEnabled?: (enabled: boolean) => void;
  onCancelOrder?: () => void;
}) {
  const { preset } = useBusinessPreset();
  const hasPending = items.some((item) => item.status === "pending");
  const pendingCount = items.filter((item) => item.status === "pending").length;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-base font-black text-slate-950">Consumo da mesa</h2>
          <span className="text-sm font-bold text-slate-500">{items.length} itens</span>
        </div>
        <StatusBadge tone={order.status === "closed" ? "green" : "amber"}>{orderStatusLabel(order.status)}</StatusBadge>
      </div>

      <div className="max-h-[45vh] overflow-y-auto p-3">
        <div className="grid gap-1.5">
          {items.length ? (
            items.map((item) => {
              const itemAddons = addons.filter((addon) => addon.orderItemId === item.id);
              return (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-950 text-[10px] font-black text-white">
                          {item.quantity}x
                        </span>
                        <span className="line-clamp-2 text-sm font-black leading-tight text-slate-900">
                          {item.productNameSnapshot}
                        </span>
                      </div>
                      {item.notes ? (
                        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800">
                          <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{item.notes}</span>
                        </p>
                      ) : null}
                      {item.variationName ? (
                        <p className="mt-0.5 text-xs text-slate-500">{item.variationName}</p>
                      ) : null}
                      {itemAddons.length ? (
                        <p className="mt-0.5 text-xs text-slate-400">
                          + {itemAddons.map((addon) => addon.addonNameSnapshot).join(", ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-black text-slate-900">
                        {brl((item.unitPriceSnapshot + (item.variationPriceDelta ?? 0)) * item.quantity)}
                      </div>
                      <StatusBadge
                        className="mt-1"
                        tone={
                          item.status === "ready"
                            ? "green"
                            : item.status === "cancelled"
                              ? "red"
                              : item.status === "preparing"
                                ? "blue"
                                : "amber"
                        }
                      >
                        {orderItemStatusLabel(item.status)}
                      </StatusBadge>
                    </div>
                  </div>
                  {(item.status === "ready" || !["cancelled", "delivered", "preparing"].includes(item.status)) ? (
                    <div className="mt-2 flex gap-1.5">
                      {item.status === "ready" ? (
                        <Button size="sm" variant="green" onClick={() => onDeliver(item.id)}>
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Entregar
                        </Button>
                      ) : null}
                      {!["cancelled", "delivered", "preparing"].includes(item.status) ? (
                        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => onCancel(item.id)}>
                          <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <ShoppingBasket className="mb-2 h-8 w-8 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-400">Comanda vazia</p>
              <p className="mt-0.5 text-xs text-slate-400">Adicione os itens e envie para preparo.</p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        <div className="grid gap-1 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span className="font-semibold">{brl(order.subtotal)}</span>
          </div>
          {order.discount > 0 ? (
            <div className="flex justify-between text-slate-500">
              <span>Desconto</span>
              <span className="font-semibold text-red-600">-{brl(order.discount)}</span>
            </div>
          ) : null}
          {order.serviceFee > 0 ? (
            <div className="flex justify-between text-slate-500">
              <span>Taxa de serviço</span>
              <span className="font-semibold">{brl(order.serviceFee)}</span>
            </div>
          ) : null}
          {items.length && onSetServiceFeeEnabled ? (
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => onSetServiceFeeEnabled(!(order.serviceFeeEnabled ?? order.serviceFee > 0))}>
              {order.serviceFeeEnabled ?? order.serviceFee > 0 ? "Remover taxa de serviço" : "Aplicar taxa de serviço"}
            </Button>
          ) : null}
          {order.serviceFee <= 0 && items.length && onApplyServiceFee && !onSetServiceFeeEnabled ? (
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={onApplyServiceFee}>
              Adicionar taxa de serviço
            </Button>
          ) : null}
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-2.5">
          <span className="text-sm font-bold text-slate-300">Total</span>
          <strong className="text-xl font-black text-white">{brl(order.total)}</strong>
        </div>
      </div>

      {hasPending ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <Button className="w-full text-base" variant="amber" size="lg" onClick={onSend}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {preset.quickActions.sendToPrep} · {pendingCount} {pendingCount === 1 ? "item" : "itens"}
          </Button>
        </div>
      ) : null}
      {items.some((item) => !["cancelled", "delivered"].includes(item.status)) && onCancelOrder ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <Button className="w-full" variant="outline" onClick={onCancelOrder}>
            <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
            Cancelar pedido completo
          </Button>
        </div>
      ) : null}
    </article>
  );
}
