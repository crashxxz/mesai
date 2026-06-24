"use client";

import { CheckCircle2, MessageSquareText, Timer, Utensils, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReasonDialog } from "@/components/reason-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { minutesSince } from "@/lib/utils";
import { orderItemStatusLabel } from "@/lib/services";
import type { Order, OrderItem, OrderItemAddon, Product, Profile, RestaurantTable } from "@/lib/types";

export function KitchenOrderCard({
  order,
  table,
  waiter,
  items,
  addons,
  products,
  onStatus,
  onReceiveOrder,
  onReject
}: {
  order: Order;
  table?: RestaurantTable;
  waiter?: Profile;
  items: OrderItem[];
  addons: OrderItemAddon[];
  products: Product[];
  onStatus: (itemId: string, status: "preparing" | "ready") => void;
  onReceiveOrder: (orderId: string) => void;
  onReject: (itemId: string, reason: string) => void;
}) {
  const [rejectItemId, setRejectItemId] = useState<string>();
  const firstTime = items[0]?.sentAt ?? items[0]?.createdAt ?? order.createdAt;
  const elapsed = minutesSince(firstTime);
  const delayed = items.some((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    const limit = Math.max(product?.estimatedTimeMinutes ?? 20, 20);
    return elapsed > limit;
  });

  return (
    <article className={`card-lift rounded-2xl border-2 bg-white p-4 shadow-soft ${delayed ? "border-red-300 bg-red-50/40" : "border-white"}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black leading-tight text-slate-950">{table?.name ?? order.customerName ?? "Comanda"}</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {waiter?.name ?? "Atendimento"} · entrou {new Date(firstTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-black ${delayed ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
          <Timer className="h-4 w-4" aria-hidden="true" />
          {elapsed} min
        </div>
      </div>

      <div className="grid gap-2">
        {items.some((item) => item.status === "sent" || item.status === "received") ? (
          <Button size="sm" variant="amber" className="rounded-xl" onClick={() => onReceiveOrder(order.id)}>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Receber pedido completo
          </Button>
        ) : null}
        {items.map((item) => {
          const itemAddons = addons.filter((addon) => addon.orderItemId === item.id);
          return (
            <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-950 text-xs font-black text-white">
                      {item.quantity}x
                    </span>
                    <span className="line-clamp-2 text-base font-black leading-tight text-slate-950">
                      {item.productNameSnapshot}
                    </span>
                  </div>
                  {item.notes ? (
                    <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
                      <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.notes}</span>
                    </div>
                  ) : null}
                  {itemAddons.length ? (
                    <div className="mt-1.5 text-xs font-medium text-slate-500">
                      + {itemAddons.map((addon) => addon.addonNameSnapshot).join(", ")}
                    </div>
                  ) : null}
                </div>
                <StatusBadge
                  tone={item.status === "preparing" ? "blue" : item.status === "ready" ? "green" : "amber"}
                >
                  {orderItemStatusLabel(item.status)}
                </StatusBadge>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {item.status === "sent" || item.status === "received" ? (
                  <Button size="sm" variant="amber" className="rounded-xl" onClick={() => onStatus(item.id, "preparing")}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Receber
                  </Button>
                ) : null}
                {item.status === "preparing" ? (
                  <Button size="sm" variant="green" className="rounded-xl font-black" onClick={() => onStatus(item.id, "ready")}>
                    <Utensils className="h-4 w-4" aria-hidden="true" />
                    Pronto!
                  </Button>
                ) : null}
                {item.status !== "ready" ? (
                  <Button size="sm" variant="outline" className="rounded-xl text-red-700" onClick={() => setRejectItemId(item.id)}>
                    <XCircle className="h-4 w-4" aria-hidden="true" />Recusar
                  </Button>
                ) : null}
                {item.status === "ready" ? (
                  <div className="flex min-h-9 items-center justify-center rounded-xl bg-emerald-100 px-3 text-xs font-black text-emerald-800 sm:col-span-2">
                    Pronto para entregar
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <ReasonDialog open={Boolean(rejectItemId)} title="Recusar item" label="Motivo obrigatório" confirmLabel="Recusar" suggestions={["Item em falta", "Acabou no estoque", "Cozinha indisponível", "Outro motivo"]} onCancel={() => setRejectItemId(undefined)} onConfirm={(reason) => { if (rejectItemId) onReject(rejectItemId, reason); setRejectItemId(undefined); }} />
    </article>
  );
}
