"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Martini,
  Package,
  ReceiptText,
  Settings,
  Table2,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { DashboardCards } from "@/components/dashboard-cards";
import { PeriodFilter } from "@/components/period-filter";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import type { PeriodFilterValue } from "@/lib/services";
import { getDashboardMetrics } from "@/lib/services";
import { useStore } from "@/lib/store";
import { useBusinessPreset } from "@/lib/use-business-preset";
import { brl } from "@/lib/utils";

export default function DashboardPage() {
  const { state, restaurant } = useStore();
  const { preset } = useBusinessPreset();
  const [period, setPeriod] = useState<PeriodFilterValue>({ key: "today" });
  const restaurantId = restaurant?.id ?? state.restaurants[0].id;
  const metrics = useMemo(
    () => getDashboardMetrics(state, restaurantId, period),
    [period, restaurantId, state]
  );
  const activeTables = state.tables.filter(
    (table) => table.restaurantId === restaurantId && table.active && ["occupied", "closing"].includes(table.status)
  );
  const activeAlerts = state.tableAlerts.filter((alert) => alert.restaurantId === restaurantId && alert.active);
  const readyItems = state.orderItems.filter((item) => item.restaurantId === restaurantId && item.status === "ready");
  const kitchenQueue = state.orderItems.filter(
    (item) => item.restaurantId === restaurantId && ["kitchen", "both"].includes(item.preparationSector) && ["sent", "received", "preparing"].includes(item.status)
  );
  const barQueue = state.orderItems.filter(
    (item) => item.restaurantId === restaurantId && ["bar", "both"].includes(item.preparationSector) && ["sent", "received", "preparing"].includes(item.status)
  );
  const billRequests = activeAlerts.filter((alert) => alert.type === "bill_request").length;
  const waiterCalls = activeAlerts.filter((alert) => alert.type === "waiter_call").length;
  const readyRows = readyItems.slice(0, 4).map((item) => {
    const order = state.orders.find((entry) => entry.id === item.orderId);
    const table = state.tables.find((entry) => entry.id === order?.tableId);
    return {
      id: item.id,
      title: item.productNameSnapshot,
      detail: table?.name ?? order?.customerName ?? "Comanda",
      href: table ? `/app/tables/${table.id}` : `/app/orders/${item.orderId}`
    };
  });
  const alertRows = activeAlerts.slice(0, 4).map((alert) => {
    const table = state.tables.find((entry) => entry.id === alert.tableId);
    return {
      id: alert.id,
      title: alert.type === "bill_request" ? "Pediu conta" : "Chamou garçom",
      detail: table?.name ?? `Mesa ${alert.tableId}`,
      href: table ? `/app/tables/${table.id}` : "/app/tables"
    };
  });

  return (
    <RoleGuard allowed={["owner", "manager"]}>
      <section className="grid gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-amber-700">{preset.dashboardTexts.heroEyebrow}</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">{preset.dashboardTexts.heroTitle}</h1>
              <p className="mt-1 text-sm font-bold text-slate-500">{preset.dashboardTexts.heroSubtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <QuickNumber label={preset.dashboardTexts.salesToday} value={brl(metrics.salesToday)} tone="bg-emerald-50 text-emerald-800" />
              <QuickNumber label={preset.dashboardTexts.activeTables} value={activeTables.length} tone="bg-amber-50 text-amber-900" />
              <QuickNumber label={preset.dashboardTexts.readyOrders} value={readyItems.length} tone="bg-lime-50 text-lime-800" />
              <QuickNumber label={preset.dashboardTexts.alerts} value={activeAlerts.length} tone="bg-red-50 text-red-700" />
            </div>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <OperationCard href="/app/tables" label={preset.dashboardTexts.activeTables} value={activeTables.length} icon={Table2} tone="border-amber-200 bg-amber-50 text-amber-900" />
          <OperationCard href="/app/tables" label={preset.dashboardTexts.readyOrders} value={readyItems.length} icon={CheckCircle2} tone="border-lime-200 bg-lime-50 text-lime-800" />
          <OperationCard href="/app/tables" label="Pediram conta" value={billRequests} icon={ReceiptText} tone="border-sky-200 bg-sky-50 text-sky-800" />
          <OperationCard href="/app/kitchen" label={preset.dashboardTexts.kitchenQueue} value={kitchenQueue.length} icon={ChefHat} tone="border-orange-200 bg-orange-50 text-orange-800" />
          <OperationCard href="/app/bar" label={preset.dashboardTexts.barQueue} value={barQueue.length} icon={Martini} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-slate-950">Atenção agora</h2>
              <Button asChild variant="outline" size="sm">
                <Link href="/app/tables">Ir para mesas</Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <AttentionPanel
                title="Pronto para entregar"
                empty="Nenhum prato ou bebida pronto."
                icon={CheckCircle2}
                rows={readyRows}
                tone="border-lime-200 bg-lime-50/70"
              />
              <AttentionPanel
                title="Chamados e contas"
                empty="Nenhuma mesa chamando."
                icon={BellRing}
                rows={alertRows}
                tone="border-red-200 bg-red-50/60"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-950">
              <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
              {preset.dashboardTexts.ownerFocus}
            </h2>
            <div className="grid gap-2">
              <OwnerSignal label="Mesas em atendimento" value={`${activeTables.length}`} />
              <OwnerSignal label="Garçom chamado" value={`${waiterCalls}`} />
              <OwnerSignal label="Conta pedida" value={`${billRequests}`} />
              <OwnerSignal label="Pedidos abertos" value={`${metrics.openOrders}`} />
            </div>
          </section>
        </div>

        <section className="grid gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">{preset.dashboardTexts.moneySummary}</h2>
              <p className="text-sm font-bold text-slate-500">Veja o que entrou no período escolhido.</p>
            </div>
            <div className="sm:min-w-80">
              <PeriodFilter value={period} onChange={setPeriod} />
            </div>
          </div>
          <DashboardCards metrics={metrics} />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="grid gap-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Operação</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/app/tables">
                  <Table2 className="h-4 w-4" aria-hidden="true" />
                  Mesas
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/app/kitchen">
                  <ChefHat className="h-4 w-4" aria-hidden="true" />
                  Cozinha
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/app/bar">
                  <Martini className="h-4 w-4" aria-hidden="true" />
                  Bar
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/app/cash">
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Caixa
                </Link>
              </Button>
            </div>
          </section>

          <section className="grid gap-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Administração</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/app/finance">
                  <WalletCards className="h-4 w-4" aria-hidden="true" />
                  {preset.menuLabels.finance}
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/app/products">
                  <Package className="h-4 w-4" aria-hidden="true" />
                  {preset.menuLabels.products}
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/app/settings">
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Ajustes
                </Link>
              </Button>
            </div>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="mb-4 text-base font-black text-slate-950">Mais vendidos do cardápio</h2>
            <div className="grid gap-2">
              {metrics.topProducts.length ? (
                metrics.topProducts.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-100 text-xs font-black text-amber-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.quantity} vendidos</div>
                    </div>
                    <div className="font-black text-slate-900">{brl(item.total)}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-slate-50 p-6 text-center text-sm font-medium text-slate-400">
                  Nenhuma venda no período
                </div>
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="mb-4 text-base font-black text-slate-950">Resumo financeiro</h2>
            <div className="grid gap-2 text-sm">
              <OwnerSignal label="Vendas do mês" value={brl(metrics.salesMonth)} />
              <OwnerSignal label="Descontos" value={brl(metrics.discounts)} />
              <OwnerSignal label="Consumo interno" value={brl(metrics.internalConsumption)} />
              <OwnerSignal label="Pedidos no período" value={`${metrics.orderCount}`} />
            </div>
          </article>
        </div>
      </section>
    </RoleGuard>
  );
}

function QuickNumber({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={`rounded-2xl px-3 py-2 ${tone}`}>
      <div className="text-xl font-black leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase leading-none">{label}</div>
    </div>
  );
}

function OperationCard({
  href,
  label,
  value,
  icon: Icon,
  tone
}: {
  href: string;
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Link href={href} className={`card-lift min-h-28 rounded-2xl border p-4 shadow-soft ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <Icon className="h-6 w-6" aria-hidden="true" />
        <span className="text-3xl font-black leading-none">{value}</span>
      </div>
      <div className="mt-4 text-sm font-black">{label}</div>
    </Link>
  );
}

function AttentionPanel({
  title,
  empty,
  icon: Icon,
  rows,
  tone
}: {
  title: string;
  empty: string;
  icon: LucideIcon;
  rows: Array<{ id: string; title: string; detail: string; href: string }>;
  tone: string;
}) {
  return (
    <article className={`rounded-2xl border p-4 shadow-soft ${tone}`}>
      <h3 className="mb-3 flex items-center gap-2 text-base font-black text-slate-950">
        <Icon className="h-5 w-5" aria-hidden="true" />
        {title}
      </h3>
      <div className="grid gap-2">
        {rows.length ? (
          rows.map((row) => (
            <Link key={row.id} href={row.href} className="rounded-xl bg-white px-3 py-2 shadow-soft">
              <div className="font-black text-slate-950">{row.title}</div>
              <div className="text-xs font-bold text-slate-500">{row.detail}</div>
            </Link>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 p-5 text-center text-sm font-bold text-slate-400">
            {empty}
          </div>
        )}
      </div>
    </article>
  );
}

function OwnerSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold">
      <span className="text-slate-600">{label}</span>
      <strong className="text-slate-950">{value}</strong>
    </div>
  );
}
