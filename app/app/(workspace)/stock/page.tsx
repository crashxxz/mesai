"use client";

import { useMemo, useState } from "react";
import { Minus, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/role-guard";
import { getStockStatus, stockStatusLabel } from "@/lib/services";
import { useStore } from "@/lib/store";

import type { Product } from "@/lib/types";

export default function StockPage() {
  const { state, restaurant, recordStockMovement } = useStore();
  const [filter, setFilter] = useState<"all" | "low" | "empty">("all");
  const products = useMemo(
    () => state.products.filter((p) => p.restaurantId === restaurant?.id && p.hasStockControl),
    [state.products, restaurant?.id]
  );
  const categories = state.categories.filter((c) => c.restaurantId === restaurant?.id);
  const movements = state.stockMovements.filter((m) => m.restaurantId === restaurant?.id).slice(0, 20);

  const filtered = products.filter((p) => {
    if (filter === "low") return getStockStatus(p) === "low";
    if (filter === "empty") return getStockStatus(p) === "empty";
    return true;
  });

  const lowCount = products.filter((p) => getStockStatus(p) === "low").length;
  const emptyCount = products.filter((p) => getStockStatus(p) === "empty").length;

  return (
    <RoleGuard allowed={["owner", "manager", "cashier"]}>
      <section className="grid gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <p className="text-xs font-black uppercase tracking-wide text-amber-700">Controle de estoque</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">Estoque</h1>
          <p className="text-sm font-bold text-slate-500">{products.length} produtos controlados · {lowCount} baixo · {emptyCount} zerado</p>
        </header>

        <div className="grid grid-cols-3 gap-2 sm:w-96">
          {([["all", "Todos"], ["low", "Baixo"], ["empty", "Zerado"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`h-10 rounded-lg border text-sm font-black ${filter === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          {filtered.length ? filtered.map((product) => (
            <StockRow
              key={product.id}
              product={product}
              categoryName={categories.find((c) => c.id === product.categoryId)?.name ?? ""}
              onEntry={() => void recordStockMovement(product.id, "entry", 1, "Entrada manual").catch((e) => alert(e instanceof Error ? e.message : "Erro"))}
              onExit={() => void recordStockMovement(product.id, "exit", 1, "Saída manual").catch((e) => alert(e instanceof Error ? e.message : "Erro"))}
            />
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400">
              {products.length ? "Nenhum produto nesse filtro." : "Ative o controle de estoque em um produto no Cardápio."}
            </div>
          )}
        </div>

        {movements.length ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="mb-3 text-lg font-black text-slate-950">Movimentações recentes</h2>
            <div className="grid gap-2">
              {movements.map((m) => {
                const product = state.products.find((p) => p.id === m.productId);
                return (
                  <div key={m.id} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm font-bold">
                    <span>{product?.name ?? "Produto"} · {m.reason}</span>
                    <strong className={m.type === "entry" ? "text-emerald-700" : "text-red-700"}>
                      {m.type === "entry" ? "+" : "-"}{m.quantity}
                    </strong>
                  </div>
                );
              })}
            </div>
          </article>
        ) : null}
      </section>
    </RoleGuard>
  );
}

function StockRow({ product, categoryName, onEntry, onExit }: { product: Product; categoryName: string; onEntry: () => void; onExit: () => void }) {
  const status = getStockStatus(product);
  const statusTone = status === "empty" ? "bg-red-100 text-red-700" : status === "low" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <strong className="truncate text-slate-950">{product.name}</strong>
        </div>
        <div className="mt-1 text-xs font-bold text-slate-500">{categoryName} · Mín: {product.stockMinimum ?? 0}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusTone}`}>{stockStatusLabel(status)}</span>
        <strong className="text-lg text-slate-950">{product.stockQuantity ?? 0}</strong>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" title="Retirar 1" disabled={(product.stockQuantity ?? 0) <= 0} onClick={onExit}>
            <Minus className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon" title="Adicionar 1" onClick={onEntry}>
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
