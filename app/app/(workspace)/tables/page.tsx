"use client";

import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, ClipboardList, Clock3, DoorOpen, Plus, ReceiptText, Table2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/role-guard";
import { TableGrid } from "@/components/table-grid";
import type { Order, RestaurantTable } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useBusinessPreset } from "@/lib/use-business-preset";
import { brl, minutesSince } from "@/lib/utils";

type TableFilter = "all" | "free" | "occupied" | "ready" | "calls" | "closing";
type PickerMode = "open" | "order" | "drink";

export default function TablesPage() {
  const router = useRouter();
  const { state, restaurant, ensureOpenOrderForTable, resolveTableAlerts } = useStore();
  const { preset } = useBusinessPreset();
  const [filter, setFilter] = useState<TableFilter>("all");
  const [picker, setPicker] = useState<{ mode: PickerMode; message?: string }>();
  const restaurantId = restaurant?.id ?? state.restaurants[0].id;
  const tables = useMemo(
    () => state.tables.filter((table) => table.restaurantId === restaurantId && table.active).sort((a, b) => a.number - b.number),
    [restaurantId, state.tables]
  );
  const activeAlerts = useMemo(() => state.tableAlerts.filter((alert) => alert.restaurantId === restaurantId && alert.active), [restaurantId, state.tableAlerts]);
  const openOrders = useMemo(() => state.orders.filter((order) => order.restaurantId === restaurantId && !["closed", "cancelled"].includes(order.status)), [restaurantId, state.orders]);
  const freeTables = useMemo(() => tables.filter((item) => item.status === "free"), [tables]);
  const occupiedTables = useMemo(() => tables.filter((item) => item.status === "occupied"), [tables]);
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
  const waiterCallIds = useMemo(() => new Set(activeAlerts.filter((alert) => alert.type === "waiter_call").map((alert) => alert.tableId)), [activeAlerts]);
  const billRequestIds = useMemo(() => new Set(activeAlerts.filter((alert) => alert.type === "bill_request").map((alert) => alert.tableId)), [activeAlerts]);
  const visibleTables = useMemo(() => tables.filter((table) => {
    if (filter === "free") return table.status === "free";
    if (filter === "occupied") return table.status === "occupied";
    if (filter === "ready") return readyTableIds.has(table.id);
    if (filter === "calls") return waiterCallIds.has(table.id);
    if (filter === "closing") return table.status === "closing" || billRequestIds.has(table.id);
    return true;
  }), [billRequestIds, filter, readyTableIds, tables, waiterCallIds]);

  async function openOrderFor(tableId: string, drinksOnly = false) {
    const orderId = await ensureOpenOrderForTable(tableId);
    router.push(`/app/orders/${orderId}${drinksOnly ? "?quick=drinks" : ""}`);
  }

  function requestOpenTable() {
    if (!freeTables.length) {
      setPicker({ mode: "open", message: "Nenhuma mesa livre agora." });
      return;
    }
    setPicker({ mode: "open" });
  }

  function requestFastOrder(drinksOnly = false) {
    if (!occupiedTables.length) {
      setPicker({ mode: drinksOnly ? "drink" : "order", message: "Abra uma mesa antes de lançar pedido." });
      return;
    }
    if (occupiedTables.length === 1) {
      void openOrderFor(occupiedTables[0].id, drinksOnly);
      return;
    }
    setPicker({ mode: drinksOnly ? "drink" : "order" });
  }

  const actionCards = [
    { key: "free" as const, label: preset.quickActions.openTable, value: freeTables.length, icon: DoorOpen, tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    { key: "occupied" as const, label: preset.quickActions.addOrder, value: occupiedTables.length, icon: Plus, tone: "bg-amber-50 text-amber-900 border-amber-200" },
    { key: "ready" as const, label: "Prontos para entregar", value: readyTableIds.size, icon: CheckCircle2, tone: "bg-lime-50 text-lime-800 border-lime-200" },
    { key: "closing" as const, label: preset.quickActions.closeAccount, value: tables.filter((table) => table.status === "closing" || billRequestIds.has(table.id)).length, icon: ReceiptText, tone: "bg-sky-50 text-sky-800 border-sky-200" },
    { key: "calls" as const, label: "Chamaram garçom", value: waiterCallIds.size, icon: BellRing, tone: "bg-red-50 text-red-700 border-red-200" }
  ];

  return (
    <RoleGuard allowed={["owner", "manager", "waiter"]}>
      <section className="grid gap-4 sm:gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">Central de atendimento</p>
              <h1 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">O que precisa agora?</h1>
              <p className="mt-1 text-sm font-bold text-slate-500">{preset.emptyStates.tables}</p>
              <p className="text-sm font-bold text-slate-500">{tables.length} mesas ativas · {openOrders.length} comandas abertas</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:flex">
              <Button variant="green" size="lg" onClick={requestOpenTable}>
                <DoorOpen className="h-5 w-5" aria-hidden="true" />
                {preset.quickActions.openTable}
              </Button>
              <Button variant="amber" size="lg" onClick={() => requestFastOrder()}>
                <Plus className="h-5 w-5" aria-hidden="true" />
                {preset.quickActions.addOrder}
              </Button>
              <Button variant="outline" size="lg" onClick={() => requestFastOrder(true)}>
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
                className={`card-lift min-h-20 rounded-2xl border p-3 text-left shadow-soft transition sm:min-h-24 sm:p-4 ${card.tone} ${active ? "ring-2 ring-slate-950/10" : ""}`}
                onClick={() => setFilter(card.key === "occupied" ? "all" : active ? "all" : card.key)}
              >
                <div className="flex items-start justify-between gap-2">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  <span className="text-2xl font-black leading-none sm:text-3xl">{card.value}</span>
                </div>
                <div className="mt-2 text-sm font-black sm:mt-3">{card.label}</div>
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

        {picker ? (
          <TablePickerDialog
            mode={picker.mode}
            message={picker.message}
            tables={picker.mode === "open" ? freeTables : occupiedTables}
            orders={openOrders}
            onClose={() => setPicker(undefined)}
            onOpenFirstFree={() => setPicker({ mode: "open" })}
            onChoose={(tableId) => {
              const drinksOnly = picker.mode === "drink";
              setPicker(undefined);
              void openOrderFor(tableId, drinksOnly);
            }}
          />
        ) : null}
      </section>
    </RoleGuard>
  );
}

function TablePickerDialog({
  mode,
  message,
  tables,
  orders,
  onClose,
  onChoose,
  onOpenFirstFree
}: {
  mode: PickerMode;
  message?: string;
  tables: RestaurantTable[];
  orders: Order[];
  onClose: () => void;
  onChoose: (tableId: string) => void;
  onOpenFirstFree: () => void;
}) {
  const title =
    mode === "open" && tables.length === 1
      ? `Abrir Mesa ${tables[0].number}?`
      : mode === "open"
        ? "Escolha a mesa livre"
        : mode === "drink"
          ? "Escolha a mesa para a cerveja"
          : "Escolha a mesa";

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 p-3 sm:place-items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">{title}</h2>
            <p className="text-sm font-bold text-slate-500">
              {mode === "drink" ? "Depois de escolher, o cardápio abre filtrado em cervejas." : mode === "order" ? "Lance o pedido na mesa correta." : "Confirme antes de abrir a comanda."}
            </p>
          </div>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-slate-100" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-black text-amber-900">{message}</div>
        ) : null}

        <div className="mt-4 grid max-h-[60dvh] gap-2 overflow-y-auto">
          {tables.map((table) => {
            const order = orders.find((item) => item.tableId === table.id && !["closed", "cancelled"].includes(item.status));
            return (
              <button
                key={table.id}
                type="button"
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50"
                onClick={() => onChoose(table.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-base text-slate-950">{table.name ?? `Mesa ${table.number}`}</strong>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-slate-600">{table.status === "free" ? "Livre" : "Aberta"}</span>
                </div>
                {order ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                    <span>{brl(order.total)}</span>
                    <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{minutesSince(order.createdAt)} min</span>
                    <span>{order.status === "sent" ? "Enviado" : order.status === "ready" ? "Pronto" : "Aberto"}</span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs font-bold text-slate-500">Sem consumo ainda.</p>
                )}
              </button>
            );
          })}
        </div>

        {!tables.length && mode !== "open" ? (
          <Button variant="green" className="mt-4 w-full" onClick={onOpenFirstFree}>
            <DoorOpen className="h-4 w-4" />
            Escolher mesa livre
          </Button>
        ) : null}
      </div>
    </div>
  );
}
