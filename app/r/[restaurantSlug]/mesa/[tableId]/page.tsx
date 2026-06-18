"use client";

import { useParams } from "next/navigation";
import { BellRing, CheckCircle2, MapPin, MessageCircle, ReceiptText, Send, ShoppingBag, X } from "lucide-react";
import { useMemo, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { ProductGrid } from "@/components/product-grid";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { orderItemStatusLabel, orderStatusLabel } from "@/lib/services";
import { useStore } from "@/lib/store";
import { useBusinessPreset } from "@/lib/use-business-preset";
import type { AppState, UUID } from "@/lib/types";
import { brl } from "@/lib/utils";

interface CartItem {
  id: UUID;
  productId: UUID;
  quantity: number;
  notes?: string;
  variationId?: UUID;
  addonIds?: UUID[];
}

export default function PublicQrPage() {
  const params = useParams<{ restaurantSlug: string; tableId: string }>();
  const { state, createQrOrder, requestTableService } = useStore();
  const { preset } = useBusinessPreset();
  const restaurant = state.restaurants.find((item) => item.slug === params.restaurantSlug);
  const table = state.tables.find((item) => item.id === params.tableId && item.restaurantId === restaurant?.id);
  const restaurantSettings = state.settings.find((item) => item.restaurantId === restaurant?.id);
  const [customerName, setCustomerName] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderId, setOrderId] = useState<UUID | undefined>();
  const [message, setMessage] = useState("");

  const order = state.orders.find((item) => item.id === orderId);
  const orderItems = state.orderItems.filter((item) => item.orderId === orderId);
  const quickDrinkProduct = useMemo(
    () => {
      if (!restaurant) return undefined;
      const beerCategory = state.categories.find(
        (category) =>
          category.restaurantId === restaurant.id &&
          category.active &&
          category.name.toLocaleLowerCase("pt-BR").includes("cerveja")
      );
      return state.products.find(
        (product) =>
          product.restaurantId === restaurant.id &&
          product.active &&
          product.available &&
          (product.categoryId === beerCategory?.id || product.name.toLocaleLowerCase("pt-BR").includes("cerveja"))
      );
    },
    [restaurant, state.categories, state.products]
  );
  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + cartItemTotal(item, state), 0),
    [cart, state]
  );

  if (!restaurant || !table) {
    return <main className="grid min-h-screen place-items-center p-4 font-black text-slate-700">Mesa não encontrada</main>;
  }

  if (!restaurantSettings?.qrOrdersEnabled) {
    return <main className="grid min-h-screen place-items-center p-4 font-black text-slate-700">Pedido por QR Code indisponível no momento</main>;
  }

  function sendOrder() {
    if (!table) return;
    const nextOrderId = createQrOrder(table.id, customerName || undefined, cart);
    if (nextOrderId) {
      setOrderId(nextOrderId);
      setCart([]);
      setMessage(preset.qrTexts.orderSent);
    }
  }

  function addCartItem(productId: UUID, input: { quantity: number; notes?: string; variationId?: UUID; addonIds?: UUID[] }) {
    setCart((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        productId,
        quantity: input.quantity,
        notes: input.notes,
        variationId: input.variationId,
        addonIds: input.addonIds
      }
    ]);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 pb-28">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 px-4 py-3 shadow-soft backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-12 w-12 shrink-0" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black text-slate-950">{restaurant.name}</h1>
              <p className="text-sm font-black text-amber-700">{table.name ?? `Mesa ${table.number}`}</p>
            </div>
          </div>
          <StatusBadge tone={cart.length ? "amber" : "slate"}>{cart.length ? `${cart.length} no carrinho` : preset.menuLabels.products}</StatusBadge>
        </div>
      </header>

      <section className="mx-auto grid min-w-0 max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 gap-4">
          <section className="min-w-0 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-soft">
            <p className="text-xs font-black uppercase tracking-wide text-amber-800">{preset.qrTexts.title}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{preset.qrTexts.subtitle}</h2>
            <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <input
                className="h-12 w-full min-w-0 rounded-2xl border border-amber-200 bg-white px-4 text-base font-bold outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                placeholder="Seu nome (opcional)"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />
              <Button
                variant="outline"
                size="lg"
                className="w-full min-w-0 whitespace-normal border-amber-200 bg-white text-center"
                onClick={() => {
                  requestTableService(table.id, "waiter_call");
                  setMessage(preset.qrTexts.waiterCalled);
                }}
              >
                <BellRing className="h-5 w-5" aria-hidden="true" />
                {preset.qrTexts.callWaiter}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full min-w-0 whitespace-normal border-amber-200 bg-white text-center"
                onClick={() => {
                  requestTableService(table.id, "bill_request");
                  setMessage(preset.qrTexts.billRequested);
                }}
              >
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
                {preset.qrTexts.askBill}
              </Button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {quickDrinkProduct ? (
                <Button variant="amber" className="w-full" onClick={() => addCartItem(quickDrinkProduct.id, { quantity: 1 })}>
                  <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                  {preset.quickActions.addDrink}
                </Button>
              ) : null}
              <Button asChild variant="outline" className="w-full border-amber-200 bg-white">
                <a href={restaurant.whatsappUrl ?? phoneToWhatsapp(restaurant.phone)} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  {preset.qrTexts.whatsapp}
                </a>
              </Button>
              {restaurant.mapsUrl ? (
                <Button asChild variant="outline" className="w-full border-amber-200 bg-white">
                  <a href={restaurant.mapsUrl} target="_blank" rel="noreferrer">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {preset.qrTexts.directions}
                  </a>
                </Button>
              ) : null}
            </div>
          </section>

          <ProductGrid
            categories={state.categories.filter((category) => category.restaurantId === restaurant.id)}
            products={state.products.filter((product) => product.restaurantId === restaurant.id)}
            variations={state.productVariations}
            addons={state.productAddons}
            allowedAddons={state.productAllowedAddons}
            title={preset.qrTexts.title}
            subtitle="O cliente pode pedir sem baixar app."
            addLabel={preset.qrTexts.addButton}
            onAdd={addCartItem}
          />
        </div>

        <aside className="grid min-w-0 content-start gap-3 lg:sticky lg:top-20">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-950">
              <ShoppingBag className="h-5 w-5 text-amber-600" aria-hidden="true" />
              Seu pedido
            </h2>
            <div className="grid gap-2">
              {cart.length ? (
                cart.map((item) => {
                  const product = state.products.find((entry) => entry.id === item.productId);
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold">
                      <span className="min-w-0 flex-1">
                        <span className="font-black text-slate-950">{item.quantity}x</span> {product?.name}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <strong>{brl(cartItemTotal(item, state))}</strong>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 min-h-9 w-9"
                          title="Remover"
                          onClick={() => setCart((current) => current.filter((entry) => entry.id !== item.id))}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">
                  {preset.emptyStates.cart}
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-950 p-4 text-lg font-black text-white">
              <span>Total</span>
              <strong>{brl(cartTotal)}</strong>
            </div>
            <Button className="mt-4 w-full rounded-xl text-base" variant="amber" size="lg" disabled={!cart.length} onClick={sendOrder}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {preset.qrTexts.sendOrder}
            </Button>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-950">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              Acompanhe
            </h2>
            {message ? (
              <div className="mb-3 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-700">
                {message}
              </div>
            ) : null}
            {order ? (
              <div className="grid gap-2">
                <StatusBadge tone={order.status === "closed" ? "green" : "amber"}>{orderStatusLabel(order.status)}</StatusBadge>
                {orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold">
                    <span>{item.productNameSnapshot}</span>
                    <strong>{orderItemStatusLabel(item.status)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-400">
                Seu pedido enviado aparece aqui.
              </div>
            )}
          </article>
        </aside>
      </section>

      {cart.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 shadow-soft-lg lg:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div>
              <span className="text-sm font-bold text-slate-600">{cart.length} {cart.length === 1 ? "item" : "itens"}</span>
              <div className="text-lg font-black text-slate-950">{brl(cartTotal)}</div>
            </div>
            <Button variant="amber" size="lg" className="px-6 text-base" onClick={sendOrder}>
              <Send className="h-4 w-4" aria-hidden="true" />
                {preset.qrTexts.sendOrder}
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function phoneToWhatsapp(phone?: string) {
  const digits = phone?.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "https://wa.me/558896298276";
}

function cartItemTotal(item: CartItem, state: AppState) {
  const product = state.products.find((entry) => entry.id === item.productId);
  const variation = state.productVariations.find((entry) => entry.id === item.variationId);
  const addons = (item.addonIds ?? [])
    .map((addonId) => state.productAddons.find((entry) => entry.id === addonId && entry.active))
    .reduce((sum, addon) => sum + (addon?.price ?? 0), 0);

  return ((product?.price ?? 0) + (variation?.priceDelta ?? 0) + addons) * item.quantity;
}
