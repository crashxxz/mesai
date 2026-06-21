"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Send, ShoppingBasket, WalletCards } from "lucide-react";
import { useState } from "react";
import { OrderSummary } from "@/components/order-summary";
import { ProductGrid } from "@/components/product-grid";
import { ReasonDialog } from "@/components/reason-dialog";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { getOrderItems } from "@/lib/services";
import { useStore } from "@/lib/store";
import { useBusinessPreset } from "@/lib/use-business-preset";
import { brl } from "@/lib/utils";

export default function OrderPage() {
  const params = useParams<{ id: string }>();
  const {
    state,
    addOrderItem,
    sendItemsToPreparation,
    cancelOrderItem,
    updateOrderItemStatus
  } = useStore();
  const { preset } = useBusinessPreset();
  const order = state.orders.find((item) => item.id === params.id);
  const table = state.tables.find((item) => item.id === order?.tableId);
  const items = order ? getOrderItems(state, order.id) : [];
  const [cancelItemId, setCancelItemId] = useState<string | undefined>();
  const pendingCount = items.filter((item) => item.status === "pending").length;

  if (!order) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-soft">
        <p className="font-bold text-slate-500">Pedido não encontrado</p>
      </div>
    );
  }

  return (
    <RoleGuard allowed={["owner", "manager", "waiter"]}>
      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-3">
          <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-amber-700">Lançamento rápido</p>
                <h1 className="mt-1 text-2xl font-black text-slate-950">
                  {table?.name ?? order.customerName ?? "Comanda"}
                </h1>
                <p className="text-sm font-bold text-slate-500">Pedido #{order.id.slice(-6)}</p>
              </div>
              <div className="flex gap-2">
                {table ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/app/tables/${table.id}`}>
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      Mesa
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="green" size="sm">
                  <Link href={`/app/checkout/${order.id}`}>
                      <WalletCards className="h-4 w-4" aria-hidden="true" />
                    {preset.quickActions.closeAccount}
                  </Link>
                </Button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xl font-black text-slate-950">{items.length}</div>
                <div className="text-[10px] font-black uppercase text-slate-500">Itens</div>
              </div>
              <div className="rounded-2xl bg-amber-50 p-3">
                <div className="text-xl font-black text-amber-800">{pendingCount}</div>
                <div className="text-[10px] font-black uppercase text-amber-700">Para enviar</div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3">
                <div className="text-xl font-black text-emerald-800">{brl(order.total)}</div>
                <div className="text-[10px] font-black uppercase text-emerald-700">Total</div>
              </div>
            </div>
          </header>

          <div className="flex items-center gap-2 text-sm font-black text-slate-500">
            <ShoppingBasket className="h-4 w-4" aria-hidden="true" />
            Adicione os itens e envie para preparo.
          </div>

          <ProductGrid
            categories={state.categories}
            products={state.products}
            variations={state.productVariations}
            addons={state.productAddons}
            allowedAddons={state.productAllowedAddons}
            onAdd={(productId, input) => addOrderItem(order.id, productId, input)}
          />
        </div>

        <aside className="grid content-start gap-3 xl:sticky xl:top-20">
          <OrderSummary
            order={order}
            items={items}
            addons={state.orderItemAddons}
            onSend={() => sendItemsToPreparation(order.id)}
            onCancel={setCancelItemId}
            onDeliver={(itemId) => updateOrderItemStatus(itemId, "delivered")}
          />
        </aside>

        {pendingCount > 0 ? (
          <div className="fixed inset-x-0 bottom-20 z-30 px-4 md:hidden">
            <Button
              className="w-full shadow-soft-lg text-base"
              variant="amber"
              size="lg"
              onClick={() => sendItemsToPreparation(order.id)}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {preset.quickActions.sendToPrep} · {pendingCount} {pendingCount === 1 ? "item" : "itens"} · {brl(order.total)}
            </Button>
          </div>
        ) : null}

        <ReasonDialog
          open={Boolean(cancelItemId)}
          title="Cancelar item"
          confirmLabel="Cancelar item"
          suggestions={["Cliente desistiu", "Lançado errado", "Produto acabou", "Cortesia", "Outro"]}
          onCancel={() => setCancelItemId(undefined)}
          onConfirm={(reason) => {
            if (cancelItemId) cancelOrderItem(cancelItemId, reason);
            setCancelItemId(undefined);
          }}
        />
      </section>
    </RoleGuard>
  );
}
