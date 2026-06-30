"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRightLeft, BellRing, CheckCircle2, GitMerge, Plus, ReceiptText, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { OrderSummary } from "@/components/order-summary";
import { ReasonDialog } from "@/components/reason-dialog";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getOpenOrderForTable, getOrderItems, tableStatusLabel } from "@/lib/services";
import { useStore } from "@/lib/store";
import { useBusinessPreset } from "@/lib/use-business-preset";

export default function TableDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    state,
    profile,
    ensureOpenOrderForTable,
    sendItemsToPreparation,
    cancelOrderItem,
    cancelOrder,
    updateOrderItemStatus,
    applyOrderServiceFee,
    setOrderServiceFeeEnabled,
    transferOrderTable,
    mergeOrders,
    closeTable,
    resetTestTable,
    resolveTableAlerts
  } = useStore();
  const { preset } = useBusinessPreset();
  const table = state.tables.find((item) => item.id === params.id);
  const order = table ? getOpenOrderForTable(state, table.id) : undefined;
  const items = order ? getOrderItems(state, order.id) : [];
  const activeAlerts = table ? state.tableAlerts.filter((alert) => alert.tableId === table.id && alert.active) : [];
  const hasWaiterCall = activeAlerts.some((alert) => alert.type === "waiter_call");
  const hasBillRequest = activeAlerts.some((alert) => alert.type === "bill_request") || table?.status === "closing";
  const readyCount = items.filter((item) => item.status === "ready").length;
  const [targetTableId, setTargetTableId] = useState("");
  const [mergeOrderId, setMergeOrderId] = useState("");
  const [cancelItemId, setCancelItemId] = useState<string | undefined>();
  const [cancelOrderOpen, setCancelOrderOpen] = useState(false);
  const [closeError, setCloseError] = useState("");

  const otherTables = useMemo(
    () => state.tables.filter((item) => item.id !== table?.id && item.active).sort((a, b) => a.number - b.number),
    [state.tables, table?.id]
  );
  const mergeTargets = state.orders.filter(
    (item) => item.id !== order?.id && !["closed", "cancelled"].includes(item.status) && item.tableId
  );

  if (!table) {
    return <div className="rounded-lg bg-white p-5 font-black text-slate-700">Mesa não encontrada</div>;
  }

  return (
    <RoleGuard allowed={["owner", "manager", "waiter"]}>
      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs font-black uppercase text-slate-400">Mesa</p>
                  <h1 className="text-6xl font-black leading-none text-slate-950">{table.number}</h1>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-950">{table.name ?? `Mesa ${table.number}`}</h2>
                  <p className="text-sm font-bold text-slate-500">{items.length} itens · comanda {order ? "aberta" : "livre"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {readyCount ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {readyCount} pronto{readyCount > 1 ? "s" : ""}
                      </span>
                    ) : null}
                    {hasWaiterCall ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-black text-red-700">
                        <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
                        Chamou garçom
                      </span>
                    ) : null}
                    {hasBillRequest ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-800">
                        <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />
                        Pediu conta
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <StatusBadge tone={table.status === "free" ? "green" : "amber"}>
                {tableStatusLabel(table.status)}
              </StatusBadge>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {order ? (
                <>
                  <Button asChild variant="amber">
                    <Link href={`/app/orders/${order.id}`}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      {preset.quickActions.addOrder}
                    </Link>
                  </Button>
                  <Button asChild variant="green">
                    <Link href={`/app/checkout/${order.id}`} onClick={() => resolveTableAlerts(table.id, "bill_request")}>
                      <WalletCards className="h-4 w-4" aria-hidden="true" />
                      {preset.quickActions.closeAccount}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!window.confirm("Fechar esta mesa? Todas as comandas precisam estar pagas.")) return;
                      setCloseError("");
                      void closeTable(table.id).catch((error) => setCloseError(error instanceof Error ? error.message : "Não foi possível fechar a mesa."));
                    }}
                  >
                    <ReceiptText className="h-4 w-4" aria-hidden="true" />
                    Fechar mesa
                  </Button>
                  {profile && ["owner", "manager"].includes(profile.role) && process.env.NODE_ENV === "development" ? (
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (!window.confirm("Resetar esta mesa de teste? A comanda aberta sera zerada, fechada e a mesa sera liberada.")) return;
                        void resetTestTable(table.id).catch((error) => setCloseError(error instanceof Error ? error.message : "Nao foi possivel resetar a mesa."));
                      }}
                    >
                      Resetar mesa de teste
                    </Button>
                  ) : null}
                  {hasWaiterCall ? (
                    <Button variant="outline" onClick={() => resolveTableAlerts(table.id, "waiter_call")}>
                      <BellRing className="h-4 w-4" aria-hidden="true" />
                      Atendido
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button
                  variant="amber"
                  onClick={async () => {
                    const orderId = await ensureOpenOrderForTable(table.id);
                    router.push(`/app/orders/${orderId}`);
                  }}
                >
                  <ReceiptText className="h-4 w-4" aria-hidden="true" />
                  {preset.quickActions.openTable}
                </Button>
              )}
            </div>
            {closeError ? <p className="mt-3 text-sm font-bold text-red-600">{closeError}</p> : null}
          </div>

          {order ? (
            <OrderSummary
              order={order}
              items={items}
              addons={state.orderItemAddons}
              onSend={() => sendItemsToPreparation(order.id)}
              onCancel={setCancelItemId}
              onDeliver={(itemId) => updateOrderItemStatus(itemId, "delivered")}
              onApplyServiceFee={() => void applyOrderServiceFee(order.id)}
              onSetServiceFeeEnabled={(enabled) => void setOrderServiceFeeEnabled(order.id, enabled)}
              onCancelOrder={() => setCancelOrderOpen(true)}
            />
          ) : null}
        </div>

        {order ? (
          <aside className="grid content-start gap-3">
            <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <summary className="cursor-pointer text-base font-black text-slate-950">Mais opções da mesa</summary>
              <div className="mt-4 grid gap-3">
                <section className="rounded-2xl bg-slate-50 p-3">
                  <h2 className="mb-3 text-sm font-black text-slate-700">Transferir mesa</h2>
                  <div className="grid gap-2">
                    <select
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold"
                      value={targetTableId}
                      onChange={(event) => setTargetTableId(event.target.value)}
                    >
                      <option value="">Mesa</option>
                      {otherTables.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name ?? `Mesa ${item.number}`}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      disabled={!targetTableId}
                      onClick={() => {
                        transferOrderTable(order.id, targetTableId);
                        router.push(`/app/tables/${targetTableId}`);
                      }}
                    >
                      <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                      Transferir
                    </Button>
                  </div>
                </section>

                <section className="rounded-2xl bg-slate-50 p-3">
                  <h2 className="mb-3 text-sm font-black text-slate-700">Juntar comandas</h2>
                  <div className="grid gap-2">
                    <select
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold"
                      value={mergeOrderId}
                      onChange={(event) => setMergeOrderId(event.target.value)}
                    >
                      <option value="">Comanda</option>
                      {mergeTargets.map((item) => {
                        const targetTable = state.tables.find((tableItem) => tableItem.id === item.tableId);
                        return (
                          <option key={item.id} value={item.id}>
                            {targetTable?.name ?? item.id}
                          </option>
                        );
                      })}
                    </select>
                    <Button
                      variant="outline"
                      disabled={!mergeOrderId}
                      onClick={() => {
                        mergeOrders(mergeOrderId, order.id);
                        setMergeOrderId("");
                      }}
                    >
                      <GitMerge className="h-4 w-4" aria-hidden="true" />
                      Juntar
                    </Button>
                  </div>
                </section>
              </div>
            </details>
          </aside>
        ) : null}
        <ReasonDialog
          open={Boolean(cancelItemId)}
          title="Cancelar item"
          confirmLabel="Cancelar item"
          suggestions={["Cliente desistiu", "Lançado errado", "Produto acabou", "Cortesia", "Outro"]}
          onCancel={() => setCancelItemId(undefined)}
          onConfirm={(reason) => {
            if (cancelItemId) void cancelOrderItem(cancelItemId, reason);
            setCancelItemId(undefined);
          }}
        />
        {order ? <ReasonDialog open={cancelOrderOpen} title="Cancelar pedido completo" label="Motivo obrigatório" confirmLabel="Cancelar pedido" suggestions={["Cliente desistiu", "Pedido lançado errado", "Itens indisponíveis", "Outro motivo"]} onCancel={() => setCancelOrderOpen(false)} onConfirm={(reason) => { void cancelOrder(order.id, reason); setCancelOrderOpen(false); }} /> : null}
      </section>
    </RoleGuard>
  );
}
