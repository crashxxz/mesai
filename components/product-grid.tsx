"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Martini, Minus, PackageCheck, Plus, Search, Utensils, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sectorLabel } from "@/lib/services";
import { resolveProductImage } from "@/lib/product-image";
import type {
  Category,
  Product,
  ProductAddon,
  ProductAllowedAddon,
  ProductVariation
} from "@/lib/types";
import { brl, cn } from "@/lib/utils";

interface AddInput {
  quantity: number;
  notes?: string;
  variationId?: string;
  addonIds?: string[];
}

export function ProductGrid({
  categories,
  products,
  variations,
  addons,
  allowedAddons,
  title = "Cardápio",
  subtitle = "Toque no produto, ajuste e envie.",
  addLabel = "Adicionar",
  initialCategoryId = "all",
  onAdd
}: {
  categories: Category[];
  products: Product[];
  variations: ProductVariation[];
  addons: ProductAddon[];
  allowedAddons: ProductAllowedAddon[];
  title?: string;
  subtitle?: string;
  addLabel?: string;
  initialCategoryId?: string;
  onAdd: (productId: string, input: AddInput) => void | Promise<unknown>;
}) {
  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    return categories.filter((category) => {
      const key = category.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categories]);
  const [activeCategory, setActiveCategory] = useState(initialCategoryId);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [variationId, setVariationId] = useState<string | undefined>();
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const categoryById = useMemo(
    () => new Map(uniqueCategories.map((category) => [category.id, category])),
    [uniqueCategories]
  );

  useEffect(() => {
    setActiveCategory(initialCategoryId === "all" || uniqueCategories.some((category) => category.id === initialCategoryId) ? initialCategoryId : "all");
  }, [initialCategoryId, uniqueCategories]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (!product.active || !product.available) return false;
      if (activeCategory !== "all" && product.categoryId !== activeCategory) return false;
      if (!term) return true;
      return product.name.toLowerCase().includes(term) || product.description?.toLowerCase().includes(term);
    });
  }, [activeCategory, products, search]);

  const selectedVariations = selected
    ? variations.filter((variation) => variation.productId === selected.id && variation.active)
    : [];
  const selectedAddons = selected
    ? allowedAddons
        .filter((allowed) => allowed.productId === selected.id)
        .map((allowed) => addons.find((addon) => addon.id === allowed.addonId && addon.active))
        .filter(Boolean) as ProductAddon[]
    : [];

  function resetSelection() {
    setSelected(undefined);
    setQuantity(1);
    setNotes("");
    setVariationId(undefined);
    setAddonIds([]);
  }

  async function addSelected() {
    if (!selected || adding) return;
    setAdding(true);
    setAddError("");
    try {
      await onAdd(selected.id, { quantity, notes, variationId, addonIds });
      resetSelection();
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Não foi possível adicionar o item.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div className="sticky top-14 z-10 -mx-4 min-w-0 border-b border-slate-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:mx-0 md:rounded-2xl md:border md:border-slate-100 md:shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-950">{title}</h2>
            <p className="text-xs font-bold text-slate-500">{subtitle}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {filteredProducts.length} itens
          </span>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-bold outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/20"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar no cardápio"
          />
        </div>
        <div className="mt-2.5 flex min-w-0 max-w-full gap-1.5 overflow-x-auto pb-0.5 touch-scroll">
          <button
            type="button"
            className={cn(
              "h-10 shrink-0 rounded-xl px-4 text-sm font-black transition",
              activeCategory === "all"
                ? "bg-slate-950 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
            onClick={() => setActiveCategory("all")}
          >
            Todos
          </button>
          {uniqueCategories
            .filter((category) => category.active)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((category) => (
              <button
                key={category.id}
                type="button"
                className={cn(
                  "h-10 shrink-0 rounded-xl px-4 text-sm font-black transition",
                  activeCategory === category.id
                    ? "bg-slate-950 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {filteredProducts.length ? (
          filteredProducts.map((product) => {
            const category = categoryById.get(product.categoryId);
            const SectorIcon = product.preparationSector === "bar" ? Martini : product.preparationSector === "kitchen" ? Utensils : PackageCheck;
            return (
              <button
                key={product.id}
                type="button"
                className="card-lift grid min-h-32 grid-cols-[72px_1fr] gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-soft transition hover:border-amber-200 active:scale-[0.97]"
                onClick={() => {
                  setSelected(product);
                  setVariationId(undefined);
                  setAddonIds([]);
                }}
              >
                <ProductImage url={resolveProductImage(product, category?.name)} name={product.name} icon={SectorIcon} />
                <span className="flex min-w-0 flex-col">
                  <span className="line-clamp-2 text-base font-black leading-tight text-slate-950">{product.name}</span>
                  <span className="mt-2 self-start rounded-xl bg-emerald-50 px-2.5 py-1 text-sm font-black text-emerald-700">
                    {brl(product.price)}
                  </span>
                  {product.description ? (
                    <span className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{product.description}</span>
                  ) : null}
                  <span className="mt-auto flex flex-wrap gap-1.5 pt-3">
                    {category ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-800">
                        {category.name}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                      {sectorLabel(product.preparationSector)}
                    </span>
                  </span>
                </span>
              </button>
            );
          })
        ) : (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-soft">
            <p className="text-sm font-black text-slate-500">Nenhum produto encontrado</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">Tente outra busca ou categoria.</p>
          </div>
        )}
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
          <section className="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-5 shadow-soft-lg sm:rounded-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-amber-700">{categoryById.get(selected.categoryId)?.name ?? "Produto"}</p>
                <h2 className="mt-1 text-2xl font-black leading-tight text-slate-950">{selected.name}</h2>
                <p className="mt-1 text-xl font-black text-emerald-700">{brl(selected.price)}</p>
              </div>
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                title="Fechar"
                onClick={resetSelection}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <span className="text-sm font-black text-slate-700">Quantidade</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="grid h-12 w-12 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 active:scale-95"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="min-w-10 text-center text-3xl font-black text-slate-950">{quantity}</span>
                  <button
                    type="button"
                    className="grid h-12 w-12 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 active:scale-95"
                    onClick={() => setQuantity((q) => q + 1)}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {selectedVariations.length ? (
                <div className="grid gap-1.5">
                  <span className="text-sm font-black text-slate-700">Variação</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedVariations.map((variation) => (
                      <button
                        key={variation.id}
                        type="button"
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm font-bold transition",
                          variationId === variation.id
                            ? "border-amber-400 bg-amber-50 text-amber-900"
                            : "border-slate-200 text-slate-700 hover:border-slate-300"
                        )}
                        onClick={() => setVariationId(variation.id)}
                      >
                        {variation.name} {variation.priceDelta ? `+${brl(variation.priceDelta)}` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedAddons.length ? (
                <div className="grid gap-1.5">
                  <span className="text-sm font-black text-slate-700">Adicionais</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedAddons.map((addon) => {
                      const active = addonIds.includes(addon.id);
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          className={cn(
                            "rounded-xl border px-3 py-2 text-sm font-bold transition",
                            active
                              ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                              : "border-slate-200 text-slate-700 hover:border-slate-300"
                          )}
                          onClick={() =>
                            setAddonIds((current) =>
                              active ? current.filter((id) => id !== addon.id) : [...current, addon.id]
                            )
                          }
                        >
                          {addon.name} +{brl(addon.price)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <label className="grid gap-1.5 text-sm font-black text-slate-700">
                Observação
                <textarea
                  className="min-h-24 rounded-xl border border-slate-200 bg-slate-50 p-3 text-base transition focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/20"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Observação opcional"
                />
              </label>

              <ProductImage url={resolveProductImage(selected, categoryById.get(selected.categoryId)?.name)} name={selected.name} icon={selected.preparationSector === "bar" ? Martini : selected.preparationSector === "kitchen" ? Utensils : PackageCheck} />
              {addError ? <p className="text-sm font-bold text-red-600">{addError}</p> : null}
              <Button variant="amber" size="lg" className="text-base" disabled={adding} onClick={() => void addSelected()}>
                <Plus className="h-5 w-5" aria-hidden="true" />
                {adding ? "Adicionando..." : `${addLabel} · ${brl(selected.price * quantity)}`}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ProductImage({ url, name, icon: Icon }: { url?: string; name: string; icon: LucideIcon }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return <span className="relative grid h-full min-h-24 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 text-amber-700">
    {url && !failed ? <Image src={url} alt={name} fill sizes="72px" className="object-cover" unoptimized onError={() => setFailed(true)} /> : <span className="grid place-items-center"><Icon className="h-8 w-8" aria-hidden="true" /></span>}
  </span>;
}
