"use client";

import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, ClipboardList, DoorOpen, Plus, ReceiptText, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/role-guard";
import { TableGrid } from "@/components/table-grid";
import { useStore } from "@/lib/store";
import { useBusinessPreset } from "@/lib/use-business-preset";

type TableFilter = "all" | "free" | "occupied" | "ready" | "calls" | "closing";

export default function TablesPage() {
  const router = useRouter();
  const { state, restaurant, ensureOpenOrderForTable, resolveTableAlerts } = useStore();
  const { preset } = useBusinessPreset();
  const [filter, setFilter] = useState<TableFilter>("all");
  const restaurantId = restaurant?.id ?? state.restaurants[0].id;
  const tables = state.tables
    .filter((table) => table.restaurantId === restaurantId && table.active)
    .sort((a, b) => a.number - b.number);
  const activeAlerts = state.tableAlerts.filter((alert) => alert.restaurantId === restaurantId && alert.active);
  const openOrders = state.orders.filter((order) => order.restaurantId === restaurantId && !["closed", "cancelled"].includes(order.status));
  const readyTableIds = useMemo(
    () =>
      new Set(
        state.orderItems
          .filter((item) => item.restaurantId === restaurantId && item.status === "ready")
          .map((item) => openOrders.find((order) => order.id === item.orderId)?.tableId)
          .filter(Boolean)
      ),
    [openOrders, restaurantId, state.orderItems]
  );
  const waiterCallIds = new Set(activeAlerts.filter((alert) => alert.type === "waiter_call").map((alert) => alert.tableId));
  const billRequestIds = new Set(activeAlerts.filter((alert) => alert.type === "bill_request").map((alert) => alert.tableId));
  const visibleTables = tables.filter((table) => {
    if (filter === "free") return table.status === "free";
    if (filter === "occupied") return table.status === "occupied";
    if (filter === "ready") return readyTableIds.has(table.id);
    if (filter === "calls") return waiterCallIds.has(table.id);
    if (filter === "closing") return table.status === "closing" || billRequestIds.has(table.id);
    return true;
  });

  async function openOrderFor(tableId: string) {
    const orderId = await ensureOpenOrderForTable(tableId);
    router.push(`/app/orders/${orderId}`);
  }

  function openFirstFreeTable() {
    const table = tables.find((item) => item.status === "free") ?? tables[0];
    if (!table) return;
    void openOrderFor(table.id);
  }

  function openFastOrder() {
    const table = tables.find((item) => item.status === "occupied") ?? tables.find((item) => item.status === "free") ?? tables[0];
    if (!table) return;
    void openOrderFor(table.id);
  }

  const actionCards = [
    { key: "free" as const, label: preset.quickActions.openTable, value: tables.filter((table) => table.status === "free").length, icon: DoorOpen, tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    { key: "occupied" as const, label: preset.quickActions.addOrder, value: tables.filter((table) => table.status === "occupied").length, icon: Plus, tone: "bg-amber-50 text-amber-900 border-amber-200" },
    { key: "ready" as const, label: "Prontos para entregar", value: readyTableIds.size, icon: CheckCircle2, tone: "bg-lime-50 text-lime-800 border-lime-200" },
    { key: "closing" as const, label: preset.quickActions.closeAccount, value: tables.filter((table) => table.status === "closing" || billRequestIds.has(table.id)).length, icon: ReceiptText, tone: "bg-sky-50 text-sky-800 border-sky-200" },
    { key: "calls" as const, label: "Chamaram garçom", value: waiterCallIds.size, icon: BellRing, tone: "bg-red-50 text-red-700 border-red-200" }
  ];

  return (
    <RoleGuard allowed={["owner", "manager", "waiter"]}>
      <section className="grid gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">Central de atendimento</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">O que precisa agora?</h1>
              <p className="mt-1 text-sm font-bold text-slate-500">{preset.emptyStates.tables}</p>
              <p className="text-sm font-bold text-slate-500">{tables.length} mesas ativas · {openOrders.length} comandas abertas</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex">
              <Button variant="green" size="lg" onClick={openFirstFreeTable}>
                <DoorOpen className="h-5 w-5" aria-hidden="true" />
                {preset.quickActions.openTable}
              </Button>
              <Button variant="amber" size="lg" onClick={openFastOrder}>
                <Plus className="h-5 w-5" aria-hidden="true" />
                {preset.quickActions.addOrder}
              </Button>
              <Button variant="outline" size="lg" onClick={openFastOrder}>
                <Plus className="h-5 w-5" aria-hidden="true" />
                {preset.quickActions.addDrink}
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {actionCards.map((card) => {
            const Icon = card.icon;
            const active = filter === card.key;
            return (
              <button
                key={card.key}
                type="button"
                className={`card-lift min-h-24 rounded-2xl border p-4 text-left shadow-soft transition ${card.tone} ${active ? "ring-2 ring-slate-950/10" : ""}`}
                onClick={() => setFilter(card.key === "occupied" ? "all" : active ? "all" : card.key)}
              >
                <div className="flex items-start justify-between gap-2">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  <span className="text-3xl font-black leading-none">{card.value}</span>
                </div>
                <div className="mt-3 text-sm font-black">{card.label}</div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
              <Table2 className="h-5 w-5 text-slate-400" aria-hidden="true" />
              {filter === "all" ? "Todas as mesas" : "Mesas filtradas"}
            </h2>
            <p className="text-sm font-bold text-slate-500">{visibleTables.length} aparecendo agora</p>
          </div>
          <Button variant="outline" onClick={() => setFilter("all")}>
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Ver tudo
          </Button>
        </div>

        {visibleTables.length ? (
          <TableGrid
            tables={visibleTables}
            orders={state.orders}
            orderItems={state.orderItems}
            alerts={activeAlerts}
            onOpen={(tableId) => void openOrderFor(tableId)}
            onResolveAlert={(tableId, type) => resolveTableAlerts(tableId, type)}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-soft">
            <p className="text-base font-black text-slate-600">Nada nesse filtro</p>
            <p className="mt-1 text-sm font-semibold text-slate-400">Volte para todas as mesas ou escolha outra ação.</p>
          </div>
        )}
      </section>
    </RoleGuard>
  );
}
