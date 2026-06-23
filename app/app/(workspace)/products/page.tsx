"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { CheckCircle2, EyeOff, Minus, PackageCheck, PackagePlus, Pencil, Plus, RefreshCcw, Tag, Trash2 } from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getStockStatus, sectorLabel, stockStatusLabel } from "@/lib/services";
import { runtimeConfig } from "@/lib/runtime-config";
import { resolveProductImage } from "@/lib/product-image";
import { useStore } from "@/lib/store";
import { useBusinessPreset } from "@/lib/use-business-preset";
import type { PreparationSector, StockUnit } from "@/lib/types";
import { brl } from "@/lib/utils";

const sectors: PreparationSector[] = ["kitchen", "bar", "both", "none"];
const stockUnits: StockUnit[] = ["unidade", "lata", "garrafa", "kg", "litro", "porcao"];

export default function ProductsPage() {
  const { state, restaurant, createCategory, createProduct, updateProduct, removeProduct, recordStockMovement, reloadMaricotaCatalog } = useStore();
  const { preset } = useBusinessPreset();
  const categories = useMemo(
    () =>
      state.categories
        .filter((category) => category.restaurantId === restaurant?.id && category.active)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [restaurant?.id, state.categories]
  );
  const products = state.products.filter((product) => product.restaurantId === restaurant?.id);
  const trackedProducts = products.filter((product) => product.hasStockControl);
  const lowStockProducts = trackedProducts.filter((product) => getStockStatus(product) !== "ok");
  const recentStockMovements = state.stockMovements.filter((movement) => movement.restaurantId === restaurant?.id).slice(-8).reverse();
  const pendingProducts = products.filter((product) => product.price <= 0);
  const [categoryName, setCategoryName] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const activeCategoryFilter = categoryFilter || categories[0]?.id || "all";
  const visibleProducts = products.filter(
    (product) => activeCategoryFilter === "all" || product.categoryId === activeCategoryFilter
  );
  const [form, setForm] = useState({
    name: "",
    price: "",
    categoryId: categories[0]?.id ?? "",
    preparationSector: "kitchen" as PreparationSector,
    available: true,
    description: "",
    estimatedTimeMinutes: "",
    imageUrl: "",
    hasStockControl: false,
    stockQuantity: "",
    stockMinimum: "",
    stockUnit: "unidade" as StockUnit
  });
  const [imageError, setImageError] = useState("");

  function handleImageFile(file: File | undefined, apply: (url: string) => void) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 900_000) {
      setImageError("Use uma imagem de até 900 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      apply(String(reader.result));
      setImageError("");
    };
    reader.readAsDataURL(file);
  }

  function submitCategory(event: FormEvent) {
    event.preventDefault();
    if (!categoryName.trim()) return;
    createCategory(categoryName.trim());
    setCategoryName("");
  }

  function submitProduct(event: FormEvent) {
    event.preventDefault();
    const categoryId = form.categoryId || categories[0]?.id;
    if (!form.name.trim() || !categoryId) return;
    createProduct({
      name: form.name.trim(),
      price: Number(form.price) || 0,
      categoryId,
      preparationSector: form.preparationSector,
      available: form.available,
      description: form.description.trim() || undefined,
      estimatedTimeMinutes: Number(form.estimatedTimeMinutes) || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      hasStockControl: form.hasStockControl,
      stockQuantity: Number(form.stockQuantity) || 0,
      stockMinimum: Number(form.stockMinimum) || 0,
      stockUnit: form.stockUnit
    });
    setForm((current) => ({
      ...current,
      name: "",
      price: "",
      description: "",
      estimatedTimeMinutes: "",
      imageUrl: "",
      hasStockControl: false,
      stockQuantity: "",
      stockMinimum: ""
    }));
  }

  return (
    <RoleGuard allowed={["owner", "manager"]}>
      <section className="grid gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <p className="text-xs font-black uppercase tracking-wide text-amber-700">Cardápio do boteco</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-950">{preset.menuLabels.products}</h1>
              <p className="text-sm font-bold text-slate-500">{products.length} itens · cadastro rápido primeiro</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center sm:flex">
              <Stat label="Disponíveis" value={products.filter((product) => product.available).length} tone="bg-emerald-50 text-emerald-800" />
              <Stat label="Categorias" value={categories.length} tone="bg-amber-50 text-amber-800" />
              <Stat label="Pendentes" value={pendingProducts.length} tone="bg-red-50 text-red-700" />
            </div>
          </div>
        </header>

        <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <summary className="flex cursor-pointer items-center gap-2 text-lg font-black text-slate-950">
            <PackageCheck className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Estoque simples · {trackedProducts.length} itens · {lowStockProducts.length} alerta{lowStockProducts.length === 1 ? "" : "s"}
          </summary>
          <p className="mt-2 text-sm font-bold text-slate-500">Entradas, saídas e baixa automática por venda.</p>
          <div className="mt-4 grid gap-2">
            {trackedProducts.length ? trackedProducts.map((product) => {
              const status = getStockStatus(product);
              const statusTone = status === "empty" ? "bg-red-100 text-red-700" : status === "low" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
              return (
                <div key={product.id} data-stock-product={product.id} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div>
                    <div className="font-black text-slate-950">{product.name}</div>
                    <div className="text-xs font-bold text-slate-500">Mínimo: {product.stockMinimum ?? 0} {stockUnitLabel(product.stockUnit, product.stockMinimum ?? 0)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <strong className="text-lg text-slate-950">{product.stockQuantity ?? 0} {stockUnitLabel(product.stockUnit, product.stockQuantity ?? 0)}</strong>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusTone}`}>{stockStatusLabel(status)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      title="Retirar 1"
                      disabled={(product.stockQuantity ?? 0) <= 0}
                      onClick={() => recordStockMovement(product.id, "exit", 1, "Ajuste manual")}
                    >
                      <Minus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      title="Adicionar 1"
                      onClick={() => recordStockMovement(product.id, "entry", 1, "Ajuste manual")}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-400">Ative o controle de estoque em um produto.</div>
            )}
          </div>
          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="text-sm font-black text-slate-700">Movimentações recentes</h3>
            <div className="mt-2 grid gap-1 text-xs font-bold text-slate-500">
              {recentStockMovements.length ? recentStockMovements.map((movement) => {
                const product = products.find((item) => item.id === movement.productId);
                return <div key={movement.id} className="flex justify-between gap-3"><span>{product?.name ?? "Produto"} · {movement.reason}</span><strong className={movement.type === "entry" ? "text-emerald-700" : "text-red-700"}>{movement.type === "entry" ? "+" : "-"}{movement.quantity}</strong></div>;
              }) : <span>Sem movimentações.</span>}
            </div>
          </section>
        </details>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-black text-slate-700">
            Mostrar categoria
            <select
              className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-amber-400"
              value={activeCategoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">Todos os produtos</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          {runtimeConfig.dataMode === "demo" ? <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:min-w-64">
            <summary className="cursor-pointer text-sm font-black text-slate-700">Mais opções</summary>
            <div className="mt-3 grid gap-2">
              <p className="text-xs font-bold text-slate-500">
                {visibleProducts.length} produtos exibidos. A recarga substitui apenas categorias e produtos do demo.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!window.confirm("Recarregar o cardápio real do Boteco da Maricota? Alterações feitas nos produtos serão substituídas.")) return;
                  reloadMaricotaCatalog();
                  setCategoryFilter("cat_petiscos");
                }}
              >
                <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                Recarregar cardápio da Maricota
              </Button>
            </div>
          </details> : null}
        </div>

        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <aside className="grid content-start gap-4">
            <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft" onSubmit={submitCategory}>
              <h2 className="mb-3 flex items-center gap-2 text-base font-black text-slate-950">
                <Tag className="h-4 w-4 text-slate-400" aria-hidden="true" />
                Nova categoria
              </h2>
              <div className="grid gap-2">
                <input
                  className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-base font-bold transition focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  placeholder="Ex: Cervejas"
                />
                <Button variant="outline" type="submit">Salvar categoria</Button>
              </div>
            </form>

            <form className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-soft" onSubmit={submitProduct}>
              <h2 className="mb-4 flex items-center gap-2 text-base font-black text-slate-950">
                <PackagePlus className="h-4 w-4 text-amber-700" aria-hidden="true" />
                Cadastro rápido
              </h2>
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm font-black text-slate-700">
                  Nome
                  <input
                    className="h-12 rounded-2xl border border-amber-200 bg-white px-3 text-base font-bold transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Ex: Cerveja 600ml"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-sm font-black text-slate-700">
                    Preço
                    <input
                      className="h-12 rounded-2xl border border-amber-200 bg-white px-3 text-base font-bold transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.price}
                      onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                      placeholder="0,00"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-black text-slate-700">
                    Categoria
                    <select
                      className="h-12 rounded-2xl border border-amber-200 bg-white px-3 text-sm font-bold"
                      value={form.categoryId || (categories[0]?.id ?? "")}
                      onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-sm font-black text-slate-700">
                    Vai para
                    <select
                      className="h-12 rounded-2xl border border-amber-200 bg-white px-3 text-sm font-bold"
                      value={form.preparationSector}
                      onChange={(event) => setForm((current) => ({ ...current, preparationSector: event.target.value as PreparationSector }))}
                    >
                      {sectors.map((sector) => (
                        <option key={sector} value={sector}>{sectorLabel(sector)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-6 flex h-12 items-center gap-2 rounded-2xl border border-amber-200 bg-white px-3 text-sm font-black text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded"
                      checked={form.available}
                      onChange={(event) => setForm((current) => ({ ...current, available: event.target.checked }))}
                    />
                    Disponível
                  </label>
                </div>

                <details className="rounded-2xl border border-amber-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-black text-slate-700">Mais opções</summary>
                  <div className="mt-3 grid gap-3">
                    <textarea
                      className="min-h-20 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm transition focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                      value={form.description}
                      onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Descrição"
                    />
                    <input
                      className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                      type="number"
                      min={0}
                      value={form.estimatedTimeMinutes}
                      onChange={(event) => setForm((current) => ({ ...current, estimatedTimeMinutes: event.target.value }))}
                      placeholder="Tempo estimado (min)"
                    />
                    <input
                      className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                      value={form.imageUrl}
                      onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
                      placeholder="URL da imagem"
                    />
                    <input
                      className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => handleImageFile(event.target.files?.[0], (imageUrl) => setForm((current) => ({ ...current, imageUrl })))}
                    />
                    {imageError ? <p className="text-xs font-bold text-red-600">{imageError}</p> : null}
                    <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded"
                        checked={form.hasStockControl}
                        onChange={(event) => setForm((current) => ({ ...current, hasStockControl: event.target.checked }))}
                      />
                      Controlar estoque
                    </label>
                    {form.hasStockControl ? (
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                          type="number"
                          min={0}
                          value={form.stockQuantity}
                          onChange={(event) => setForm((current) => ({ ...current, stockQuantity: event.target.value }))}
                          placeholder="Qtd atual"
                        />
                        <input
                          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                          type="number"
                          min={0}
                          value={form.stockMinimum}
                          onChange={(event) => setForm((current) => ({ ...current, stockMinimum: event.target.value }))}
                          placeholder="Qtd mínima"
                        />
                        <select
                          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-2 text-sm"
                          value={form.stockUnit}
                          onChange={(event) => setForm((current) => ({ ...current, stockUnit: event.target.value as StockUnit }))}
                        >
                          {stockUnits.map((unit) => <option key={unit} value={unit}>{unit === "porcao" ? "porção" : unit}</option>)}
                        </select>
                      </div>
                    ) : null}
                  </div>
                </details>

                <Button variant="amber" type="submit" size="lg">
                  <PackagePlus className="h-4 w-4" aria-hidden="true" />
                  Criar produto
                </Button>
                <div className="rounded-2xl bg-white/70 p-3 text-xs font-bold text-amber-900">
                  Sugestões: {preset.productSuggestions.join(", ")}.
                </div>
              </div>
            </form>
          </aside>

          <div className="grid content-start gap-3">
            {visibleProducts.map((product) => {
              const category = state.categories.find((item) => item.id === product.categoryId);
              const pricePending = product.price <= 0;
              return (
                <article key={product.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-amber-50">
                        <Image src={resolveProductImage(product, category?.name)} alt={product.name} fill sizes="64px" className="object-cover" unoptimized />
                      </span>
                      <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black text-slate-950">{product.name}</h2>
                        <StatusBadge tone={pricePending ? "amber" : product.available ? "green" : "red"}>
                          {pricePending ? "Preço pendente" : product.available ? "Disponível" : "Indisponível"}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-500">
                        {category?.name} · {sectorLabel(product.preparationSector)}
                      </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className={`text-2xl font-black ${pricePending ? "text-amber-700" : "text-emerald-700"}`}>
                        {pricePending ? "Preço pendente" : brl(product.price)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 sm:justify-end">
                        <Button
                          size="sm"
                          variant={product.available ? "green" : "outline"}
                          onClick={() => updateProduct(product.id, { available: !product.available })}
                        >
                          {product.available ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                          {product.available ? "À venda" : "Oculto"}
                        </Button>
                        <Button
                          size="sm"
                          variant={product.active ? "outline" : "green"}
                          onClick={() => updateProduct(product.id, { active: !product.active })}
                        >
                          {product.active ? "Inativar" : "Ativar"}
                        </Button>
                        <Button size="sm" variant="danger" onClick={async () => {
                          if (!window.confirm(`Excluir ${product.name}? Se houver histórico, ele será apenas inativado.`)) return;
                          const result = await removeProduct(product.id);
                          window.alert(result === "deleted" ? "Produto excluído." : "Produto inativado para preservar o histórico.");
                        }}><Trash2 className="h-4 w-4" />Excluir</Button>
                      </div>
                    </div>
                  </div>

                  <details className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <summary className="flex cursor-pointer items-center gap-2 text-sm font-black text-slate-700">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Editar produto
                    </summary>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <input
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold xl:col-span-2"
                        value={product.name}
                        onChange={(event) => updateProduct(product.id, { name: event.target.value })}
                      />
                      <input
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
                        type="number"
                        min={0}
                        step="0.01"
                        value={product.price}
                        onChange={(event) => updateProduct(product.id, { price: Number(event.target.value) || 0 })}
                      />
                      <select
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
                        value={product.categoryId}
                        onChange={(event) => updateProduct(product.id, { categoryId: event.target.value })}
                      >
                        {categories.map((categoryItem) => (
                          <option key={categoryItem.id} value={categoryItem.id}>{categoryItem.name}</option>
                        ))}
                      </select>
                      <select
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
                        value={product.preparationSector}
                        onChange={(event) => updateProduct(product.id, { preparationSector: event.target.value as PreparationSector })}
                      >
                        {sectors.map((sector) => (
                          <option key={sector} value={sector}>{sectorLabel(sector)}</option>
                        ))}
                      </select>
                      <textarea
                        className="min-h-20 rounded-xl border border-slate-200 bg-white p-3 text-sm sm:col-span-2 xl:col-span-4"
                        value={product.description ?? ""}
                        onChange={(event) => updateProduct(product.id, { description: event.target.value })}
                        placeholder="Descrição"
                      />
                      <input
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        type="number"
                        min={0}
                        value={product.estimatedTimeMinutes ?? 0}
                        onChange={(event) => updateProduct(product.id, { estimatedTimeMinutes: Number(event.target.value) || 0 })}
                        placeholder="Tempo (min)"
                      />
                      <input
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        value={product.imageUrl ?? ""}
                        onChange={(event) => updateProduct(product.id, { imageUrl: event.target.value })}
                        placeholder="Imagem URL"
                      />
                      <input
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => handleImageFile(event.target.files?.[0], (imageUrl) => updateProduct(product.id, { imageUrl }))}
                      />
                      {product.imageUrl ? <Button type="button" variant="outline" onClick={() => updateProduct(product.id, { imageUrl: undefined })}>Remover imagem</Button> : null}
                      <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded"
                          checked={product.hasStockControl}
                          onChange={(event) => updateProduct(product.id, { hasStockControl: event.target.checked })}
                        />
                        Estoque
                      </label>
                      {product.hasStockControl ? (
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            type="number"
                            min={0}
                            value={product.stockQuantity ?? 0}
                            onChange={(event) => updateProduct(product.id, { stockQuantity: Number(event.target.value) || 0 })}
                            placeholder="Atual"
                          />
                          <input
                            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            type="number"
                            min={0}
                            value={product.stockMinimum ?? 0}
                            onChange={(event) => updateProduct(product.id, { stockMinimum: Number(event.target.value) || 0 })}
                            placeholder="Mínimo"
                          />
                          <select
                            className="h-11 rounded-xl border border-slate-200 bg-white px-2 text-sm"
                            value={product.stockUnit ?? "unidade"}
                            onChange={(event) => updateProduct(product.id, { stockUnit: event.target.value as StockUnit })}
                          >
                            {stockUnits.map((unit) => <option key={unit} value={unit}>{unit === "porcao" ? "porção" : unit}</option>)}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </RoleGuard>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-2xl px-4 py-2 ${tone}`}>
      <div className="text-xl font-black leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase leading-none">{label}</div>
    </div>
  );
}

function stockUnitLabel(unit: StockUnit | undefined, quantity: number) {
  const value = unit ?? "unidade";
  if (quantity === 1) return value === "porcao" ? "porção" : value;
  const plurals: Record<StockUnit, string> = {
    unidade: "unidades",
    lata: "latas",
    garrafa: "garrafas",
    kg: "kg",
    litro: "litros",
    porcao: "porções"
  };
  return plurals[value];
}
