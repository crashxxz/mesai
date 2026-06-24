"use client";

import Link from "next/link";
import { BellRing, CheckCircle2, Clock3, Eye, Plus, ReceiptText, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getOrderOverallStatus, orderStatusLabel, tableStatusLabel } from "@/lib/services";
import type { Order, OrderItem, RestaurantTable, TableAlert } from "@/lib/types";
import { useBusinessPreset } from "@/lib/use-business-preset";
import { brl, cn, minutesSince } from "@/lib/utils";

const statusMeta = {
  free: { tone: "green" as const, accent: "border-emerald-200 bg-emerald-50/50" },
  occupied: { tone: "amber" as const, accent: "border-amber-200 bg-white" },
  closing: { tone: "blue" as const, accent: "border-sky-200 bg-sky-50/60" },
  reserved: { tone: "slate" as const, accent: "border-slate-200 bg-white" }
};

export function TableCard({
  table,
  order,
  orderItems,
  alerts,
  onOpen,
  onResolveAlert
}: {
  table: RestaurantTable;
  order?: Order;
  orderItems: OrderItem[];
  alerts: TableAlert[];
  onOpen: () => void;
  onResolveAlert?: (type: TableAlert["type"]) => void;
}) {
  const { preset } = useBusinessPreset();
  const meta = statusMeta[table.status];
  const activeAlerts = alerts.filter((alert) => alert.active && alert.tableId === table.id);
  const hasWaiterCall = activeAlerts.some((alert) => alert.type === "waiter_call");
  const hasBillRequest = table.status === "closing" || activeAlerts.some((alert) => alert.type === "bill_request");
  const readyCount = order
    ? orderItems.filter((item) => item.orderId === order.id && item.status === "ready").length
    : 0;
  const itemCount = order
    ? orderItems.filter((item) => item.orderId === order.id && item.status !== "cancelled").length
    : 0;
  const elapsed = order ? minutesSince(order.createdAt) : undefined;
  const overallStatus = order ? getOrderOverallStatus(order, orderItems.filter((item) => item.orderId === order.id)) : undefined;

  return (
    <article className={cn("card-lift rounded-2xl border-2 p-4 shadow-soft", meta.accent)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-slate-400">Mesa</p>
          <h2 className="text-5xl font-black leading-none tracking-normal text-slate-950">{table.number}</h2>
          <p className="mt-1 text-sm font-bold text-slate-500">{table.name ?? `Mesa ${table.number}`}</p>
        </div>
        <div className="grid justify-items-end gap-1.5">
          <StatusBadge tone={meta.tone}>{tableStatusLabel(table.status)}</StatusBadge>
          {overallStatus ? <span className="text-xs font-black text-slate-500">{orderStatusLabel(overallStatus)}</span> : null}
          {readyCount ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {readyCount} pronto{readyCount > 1 ? "s" : ""}
            </span>
          ) : null}
          {hasBillRequest ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-800">
              <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />
              Pediu conta
            </span>
          ) : null}
          {hasWaiterCall ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-black text-red-700">
              <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
              Chamou
            </span>
          ) : null}
        </div>
      </div>

      <div className="mb-4">
        {!order ? (
          <div className="rounded-2xl bg-white/80 px-3 py-4 text-sm font-black text-emerald-800">
            Mesa pronta para atender
          </div>
        ) : itemCount === 0 ? (
          <div className="rounded-2xl bg-amber-100 px-3 py-4 text-sm font-black text-amber-900">
            Mesa aberta, sem consumo ainda
            <span className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-800">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              Aberta há {elapsed} min
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/80 p-3">
              <span className="text-xs font-black text-slate-400">Total</span>
              <div className="text-xl font-black text-slate-950">{brl(order.total)}</div>
            </div>
            <div className="rounded-2xl bg-white/80 p-3">
              <span className="text-xs font-black text-slate-400">Tempo</span>
              <div className="flex items-center gap-1 text-xl font-black text-slate-950">
                <Clock3 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                {elapsed} min
              </div>
            </div>
            <div className="col-span-2 rounded-2xl bg-slate-950 px-3 py-2 text-sm font-black text-white">
              {itemCount} {itemCount === 1 ? "item na comanda" : "itens na comanda"}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {hasBillRequest && order ? (
          <Button asChild variant="green" className="rounded-xl">
            <Link href={`/app/checkout/${order.id}`} onClick={() => onResolveAlert?.("bill_request")}>
              <WalletCards className="h-4 w-4" aria-hidden="true" />
              {preset.quickActions.closeAccount}
            </Link>
          </Button>
        ) : readyCount && order ? (
          <Button asChild variant="green" className="rounded-xl">
            <Link href={`/app/tables/${table.id}`}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Entregar
            </Link>
          </Button>
        ) : hasWaiterCall ? (
          <Button asChild variant="danger" className="rounded-xl">
            <Link href={`/app/tables/${table.id}`} onClick={() => onResolveAlert?.("waiter_call")}>
              <BellRing className="h-4 w-4" aria-hidden="true" />
              Atender
            </Link>
          </Button>
        ) : (
          <Button variant={order ? "amber" : "green"} className="rounded-xl" onClick={onOpen}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {order ? "Adicionar" : preset.quickActions.openTable}
          </Button>
        )}
        <Button asChild variant="primary" className="rounded-xl">
          <Link href={`/app/tables/${table.id}`}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            Ver mesa
          </Link>
        </Button>
      </div>
    </article>
  );
}
