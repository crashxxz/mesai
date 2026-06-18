"use client";

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Clock, Flame, Inbox } from "lucide-react";
import { KitchenOrderCard } from "@/components/kitchen-order-card";
import type { Order, OrderItem, OrderItemAddon, Product, Profile, RestaurantTable } from "@/lib/types";
import { minutesSince } from "@/lib/utils";

type PrepTone = "kitchen" | "bar";

interface PrepColumn {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  items: OrderItem[];
  tone: string;
}

export function PreparationBoard({
  title,
  subtitle,
  icon: Icon,
  tone,
  items,
  orders,
  tables,
  waiters,
  addons,
  products,
  onStatus
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: PrepTone;
  items: OrderItem[];
  orders: Order[];
  tables: RestaurantTable[];
  waiters: Profile[];
  addons: OrderItemAddon[];
  products: Product[];
  onStatus: (itemId: string, status: "received" | "preparing" | "ready") => void;
}) {
  const newItems = items.filter((item) => item.status === "sent" || item.status === "received");
  const preparingItems = items.filter((item) => item.status === "preparing");
  const readyItems = items.filter((item) => item.status === "ready");
  const delayedCount = items.filter((item) => isDelayed(item, products)).length;
  const accent = tone === "bar" ? "text-emerald-700 bg-emerald-50" : "text-orange-700 bg-orange-50";
  const columns: PrepColumn[] = [
    {
      title: "Novos",
      subtitle: "Entrou agora",
      icon: Inbox,
      items: newItems,
      tone: "border-amber-200 bg-amber-50/60"
    },
    {
      title: "Preparando",
      subtitle: "Mão na massa",
      icon: Flame,
      items: preparingItems,
      tone: "border-sky-200 bg-sky-50/60"
    },
    {
      title: "Prontos",
      subtitle: "Chamar entrega",
      icon: CheckCircle2,
      items: readyItems,
      tone: "border-emerald-200 bg-emerald-50/60"
    }
  ];

  return (
    <section className="grid gap-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`grid h-12 w-12 place-items-center rounded-2xl ${accent}`}>
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-950">{title}</h1>
              <p className="text-sm font-semibold text-slate-500">{subtitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <QueueCounter label="Novos" value={newItems.length} tone="bg-amber-50 text-amber-800" />
            <QueueCounter label="Fazendo" value={preparingItems.length} tone="bg-sky-50 text-sky-800" />
            <QueueCounter label="Prontos" value={readyItems.length} tone="bg-emerald-50 text-emerald-800" />
            <QueueCounter label="Atrasos" value={delayedCount} tone="bg-red-50 text-red-700" />
          </div>
        </div>
      </header>

      {items.length ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {columns.map((column) => {
            const ColumnIcon = column.icon;
            return (
              <section key={column.title} className={`min-h-72 rounded-2xl border p-3 ${column.tone}`}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ColumnIcon className="h-5 w-5 text-slate-700" aria-hidden="true" />
                    <div>
                      <h2 className="text-base font-black text-slate-950">{column.title}</h2>
                      <p className="text-xs font-bold text-slate-500">{column.subtitle}</p>
                    </div>
                  </div>
                  <span className="grid h-8 min-w-8 place-items-center rounded-xl bg-white px-2 text-sm font-black text-slate-900 shadow-soft">
                    {column.items.length}
                  </span>
                </div>

                <div className="grid gap-3">
                  {groupOrderIds(column.items).map((orderId) => {
                    const order = orders.find((item) => item.id === orderId);
                    if (!order) return null;
                    return (
                      <KitchenOrderCard
                        key={orderId}
                        order={order}
                        table={tables.find((table) => table.id === order.tableId)}
                        waiter={waiters.find((waiter) => waiter.id === order.createdBy)}
                        items={column.items.filter((item) => item.orderId === orderId)}
                        addons={addons}
                        products={products}
                        onStatus={onStatus}
                      />
                    );
                  })}

                  {!column.items.length ? (
                    <div className="grid min-h-36 place-items-center rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-center">
                      <div>
                        <Clock className="mx-auto mb-2 h-6 w-6 text-slate-300" aria-hidden="true" />
                        <p className="text-sm font-black text-slate-500">Nada aqui</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-400">A fila anda quando chega pedido.</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-soft">
          <Icon className="mx-auto mb-3 h-12 w-12 text-slate-200" aria-hidden="true" />
          <p className="text-base font-black text-slate-600">Fila limpa</p>
          <p className="mt-1 text-sm font-semibold text-slate-400">Pedido novo aparece aqui com som e botão de próxima etapa.</p>
        </div>
      )}

      {delayedCount ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          {delayedCount} {delayedCount === 1 ? "item passou" : "itens passaram"} do tempo esperado.
        </div>
      ) : null}
    </section>
  );
}

function QueueCounter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-2xl px-3 py-2 ${tone}`}>
      <div className="text-xl font-black leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase leading-none">{label}</div>
    </div>
  );
}

function groupOrderIds(items: OrderItem[]) {
  return Array.from(new Set(items.map((item) => item.orderId)));
}

function isDelayed(item: OrderItem, products: Product[]) {
  const product = products.find((entry) => entry.id === item.productId);
  const startedAt = item.sentAt ?? item.createdAt;
  const limit = Math.max(product?.estimatedTimeMinutes ?? 20, 20);
  return item.status !== "ready" && minutesSince(startedAt) > limit;
}
