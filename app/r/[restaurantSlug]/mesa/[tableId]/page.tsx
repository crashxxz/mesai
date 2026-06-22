"use client";

import { useParams } from "next/navigation";
import { BellRing, CheckCircle2, MessageCircle, ReceiptText, Send, ShoppingBag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { ProductGrid } from "@/components/product-grid";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { runtimeConfig } from "@/lib/runtime-config";
import { orderItemStatusLabel, orderStatusLabel } from "@/lib/services";
import { useStore } from "@/lib/store";
import { supabaseGateway } from "@/lib/supabase-gateway";
import { useBusinessPreset } from "@/lib/use-business-preset";
import type { AppState, Category, Order, OrderItem, Product, ProductAddon, ProductAllowedAddon, ProductVariation, Restaurant, RestaurantSettings, RestaurantTable, UUID } from "@/lib/types";
import { brl } from "@/lib/utils";

interface CartItem { id: UUID; productId: UUID; quantity: number; notes?: string; variationId?: UUID; addonIds?: UUID[] }

export default function PublicQrPage() {
  const params = useParams<{ restaurantSlug: string; tableId: string }>();
  const { state, createQrOrder, requestTableService } = useStore();
  const stateRef = useRef(state); stateRef.current = state;
  const { preset } = useBusinessPreset();
  const [remoteState, setRemoteState] = useState<AppState>();
  const [sessionToken, setSessionToken] = useState("");
  const [loadError, setLoadError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderId, setOrderId] = useState<UUID>();
  const [tracked, setTracked] = useState<{ order: Order; items: OrderItem[] }>();
  const [message, setMessage] = useState("");
  const [drinkPicker, setDrinkPicker] = useState(false);
  const menuState = remoteState ?? state;
  const restaurant = menuState.restaurants.find((item) => item.slug === params.restaurantSlug);
  const table = remoteState?.tables[0] ?? menuState.tables.find((item) => item.id === params.tableId && item.restaurantId === restaurant?.id);
  const restaurantSettings = menuState.settings.find((item) => item.restaurantId === restaurant?.id);
  const localOrder = state.orders.find((item) => item.id === orderId);
  const order = tracked?.order ?? localOrder;
  const orderItems = tracked?.items ?? state.orderItems.filter((item) => item.orderId === orderId);

  useEffect(() => {
    if (runtimeConfig.dataMode !== "supabase") return;
    let mounted = true;
    void supabaseGateway.openPublicTable(params.restaurantSlug, params.tableId).then((payload) => {
      if (!mounted) return;
      setSessionToken(String(payload.session_token));
      setRemoteState(mapPublicMenu(stateRef.current, payload));
    }).catch((error) => { if (mounted) setLoadError(error instanceof Error ? error.message : "Mesa não encontrada"); });
    return () => { mounted = false; };
  }, [params.restaurantSlug, params.tableId]);

  useEffect(() => {
    if (!sessionToken || !orderId) return;
    let mounted = true;
    const refresh = async () => {
      try { const payload = await supabaseGateway.getQrOrder(sessionToken, orderId); if (mounted) setTracked(mapTrackedOrder(payload)); } catch { /* próxima atualização tenta novamente */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [orderId, sessionToken]);

  const drinkProducts = useMemo(() => menuState.products.filter((product) => product.active && product.available && (product.preparationSector === "bar" || product.preparationSector === "both") && /cerveja|long neck|bebida|refrigerante/i.test(`${product.name} ${menuState.categories.find((category) => category.id === product.categoryId)?.name ?? ""}`)).slice(0, 20), [menuState]);
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + cartItemTotal(item, menuState), 0), [cart, menuState]);

  if (runtimeConfig.dataMode === "supabase" && !remoteState) return <main className="grid min-h-screen place-items-center p-4 font-black text-slate-700">{loadError || "Carregando cardápio..."}</main>;
  if (!restaurant || !table) return <main className="grid min-h-screen place-items-center p-4 font-black text-slate-700">Mesa não encontrada</main>;
  if (!restaurantSettings?.qrOrdersEnabled) return <main className="grid min-h-screen place-items-center p-4 font-black text-slate-700">Pedido por QR indisponível</main>;

  async function sendOrder() {
    if (!table || !cart.length) return;
    try {
      const nextOrderId = sessionToken
        ? await supabaseGateway.createQrOrder(sessionToken, cart, customerName || undefined)
        : createQrOrder(table.id, customerName || undefined, cart);
      if (nextOrderId) { setOrderId(nextOrderId); setCart([]); setMessage(preset.qrTexts.orderSent); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível enviar o pedido"); }
  }

  async function callService(type: "waiter_call" | "bill_request") {
    try {
      if (sessionToken) await supabaseGateway.requestTableService(sessionToken, type);
      else requestTableService(table!.id, type);
      setMessage(type === "waiter_call" ? preset.qrTexts.waiterCalled : preset.qrTexts.billRequested);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível enviar o chamado"); }
  }

  function addCartItem(productId: UUID, input: Omit<CartItem, "id" | "productId">) { setCart((current) => [...current, { id: crypto.randomUUID(), productId, ...input }]); }

  return <main className="min-h-screen overflow-x-hidden bg-slate-50 pb-28">
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 px-4 py-3 shadow-soft backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><BrandMark className="h-12 w-12 shrink-0" /><div className="min-w-0"><h1 className="truncate text-xl font-black">{restaurant.name}</h1><p className="text-sm font-black text-amber-700">{table.name ?? `Mesa ${table.number}`}</p></div></div><StatusBadge tone={cart.length ? "amber" : "slate"}>{cart.length ? `${cart.length} no carrinho` : "Cardápio"}</StatusBadge></div></header>
    <section className="mx-auto grid max-w-6xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-4">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-soft"><h2 className="text-2xl font-black">{preset.qrTexts.subtitle}</h2><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><input className="h-12 rounded-2xl border border-amber-200 bg-white px-4 font-bold" placeholder="Seu nome (opcional)" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /><Button variant="outline" onClick={() => void callService("waiter_call")}><BellRing className="h-5 w-5" />Chamar garçom</Button><Button variant="outline" onClick={() => void callService("bill_request")}><ReceiptText className="h-5 w-5" />Pedir conta</Button></div><div className="mt-2 grid gap-2 sm:grid-cols-2"><Button variant="amber" onClick={() => setDrinkPicker(true)} disabled={!drinkProducts.length}><ShoppingBag className="h-4 w-4" />Mais uma bebida</Button><Button asChild variant="outline"><a href={restaurant.whatsappUrl ?? phoneToWhatsapp(restaurant.phone)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a></Button></div></section>
        <ProductGrid categories={dedupeCategories(menuState.categories.filter((category) => category.restaurantId === restaurant.id))} products={menuState.products.filter((product) => product.restaurantId === restaurant.id)} variations={menuState.productVariations} addons={menuState.productAddons} allowedAddons={menuState.productAllowedAddons} title="Cardápio da mesa" subtitle="Escolha os itens e envie." addLabel="Adicionar" onAdd={addCartItem} />
      </div>
      <aside className="grid content-start gap-3 lg:sticky lg:top-20">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><h2 className="mb-3 flex items-center gap-2 text-lg font-black"><ShoppingBag className="h-5 w-5 text-amber-600" />Seu pedido</h2><div className="grid gap-2">{cart.length ? cart.map((item) => { const product = menuState.products.find((entry) => entry.id === item.productId); return <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>{item.quantity}x {product?.name}</span><div className="flex items-center gap-2"><strong>{brl(cartItemTotal(item, menuState))}</strong><Button variant="ghost" size="icon" onClick={() => setCart((current) => current.filter((entry) => entry.id !== item.id))}><X className="h-4 w-4" /></Button></div></div>; }) : <div className="rounded-2xl border border-dashed p-6 text-center text-sm font-bold text-slate-400">Escolha um item.</div>}</div><div className="mt-4 flex justify-between rounded-2xl bg-slate-950 p-4 text-lg font-black text-white"><span>Total</span><strong>{brl(cartTotal)}</strong></div><Button className="mt-4 w-full" variant="amber" size="lg" disabled={!cart.length} onClick={() => void sendOrder()}><Send className="h-4 w-4" />Enviar pedido</Button></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><h2 className="mb-3 flex items-center gap-2 text-lg font-black"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Acompanhe</h2>{message ? <div className="mb-3 rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-700">{message}</div> : null}{order ? <div className="grid gap-2"><StatusBadge tone={order.status === "closed" ? "green" : "amber"}>{orderStatusLabel(order.status)}</StatusBadge>{orderItems.map((item) => <div key={item.id} className="flex justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold"><span>{item.productNameSnapshot}</span><strong>{orderItemStatusLabel(item.status)}</strong></div>)}</div> : <div className="rounded-2xl border border-dashed p-5 text-center text-sm font-bold text-slate-400">Seu pedido enviado aparece aqui.</div>}</article>
      </aside>
    </section>
    {drinkPicker ? <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/50 sm:place-items-center"><section className="max-h-[80vh] w-full max-w-md overflow-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Escolha a bebida</h2><Button variant="ghost" size="icon" onClick={() => setDrinkPicker(false)}><X className="h-5 w-5" /></Button></div><div className="mt-3 grid gap-2">{drinkProducts.map((product) => <button key={product.id} className="flex justify-between rounded-xl border border-slate-200 p-3 text-left font-bold" onClick={() => { addCartItem(product.id, { quantity: 1 }); setDrinkPicker(false); }}><span>{product.name}</span><strong>{brl(product.price)}</strong></button>)}</div></section></div> : null}
  </main>;
}

function mapPublicMenu(base: AppState, payload: Record<string, unknown>): AppState {
  const r = payload.restaurant as Record<string, unknown>; const t = payload.table as Record<string, unknown>; const s = payload.settings as Record<string, unknown>; const restaurantId = String(r.id); const now = new Date().toISOString();
  const restaurant: Restaurant = { id: restaurantId, name: String(r.name), slug: String(r.slug), phone: r.phone ? String(r.phone) : undefined, whatsappUrl: r.whatsapp_url ? String(r.whatsapp_url) : undefined, mapsUrl: r.maps_url ? String(r.maps_url) : undefined, createdAt: now, updatedAt: now };
  const table: RestaurantTable = { id: String(t.id), restaurantId, number: Number(t.number), name: t.name ? String(t.name) : undefined, status: "free", active: true, createdAt: now, updatedAt: now };
  const settings: RestaurantSettings = { restaurantId, qrOrdersEnabled: s.qr_orders_enabled !== false, qrOrdersNeedApproval: s.qr_orders_need_approval === true, waiterCanCloseAccount: s.waiter_can_close_account !== false, serviceFeePercent: Number(s.service_fee_percent ?? 10) };
  const categories = ((payload.categories ?? []) as Record<string, unknown>[]).map((c): Category => ({ id: String(c.id), restaurantId, name: String(c.name), sortOrder: Number(c.sort_order ?? 0), active: c.active !== false, createdAt: String(c.created_at ?? now), updatedAt: String(c.updated_at ?? now) }));
  const products = ((payload.products ?? []) as Record<string, unknown>[]).map((p): Product => ({ id: String(p.id), restaurantId, categoryId: String(p.category_id), name: String(p.name), description: p.description ? String(p.description) : undefined, price: Number(p.price), preparationSector: p.preparation_sector as Product["preparationSector"], estimatedTimeMinutes: p.estimated_time_minutes ? Number(p.estimated_time_minutes) : undefined, available: p.available !== false, hasStockControl: false, imageUrl: p.image_url ? String(p.image_url) : undefined, active: p.active !== false, createdAt: String(p.created_at ?? now), updatedAt: String(p.updated_at ?? now) }));
  const variations = ((payload.variations ?? []) as Record<string, unknown>[]).map((v): ProductVariation => ({ id: String(v.id), productId: String(v.product_id), name: String(v.name), priceDelta: Number(v.price_delta ?? 0), active: v.active !== false }));
  const addons = ((payload.addons ?? []) as Record<string, unknown>[]).map((a): ProductAddon => ({ id: String(a.id), restaurantId, name: String(a.name), price: Number(a.price), active: a.active !== false }));
  const allowed = ((payload.allowed_addons ?? []) as Record<string, unknown>[]).map((a): ProductAllowedAddon => ({ id: String(a.id), productId: String(a.product_id), addonId: String(a.addon_id) }));
  return { ...base, restaurants: [restaurant], settings: [settings], tables: [table], categories: dedupeCategories(categories), products, productVariations: variations, productAddons: addons, productAllowedAddons: allowed };
}

function mapTrackedOrder(payload: Record<string, unknown>) { const o = payload.order as Record<string, unknown>; const items = payload.items as Record<string, unknown>[]; return { order: { id: String(o.id), restaurantId: String(o.restaurant_id), tableId: o.table_id ? String(o.table_id) : undefined, source: o.source as Order["source"], status: o.status as Order["status"], subtotal: Number(o.subtotal), discount: Number(o.discount), serviceFee: Number(o.service_fee), deliveryFee: Number(o.delivery_fee), total: Number(o.total), createdAt: String(o.created_at), updatedAt: String(o.updated_at), closedAt: o.closed_at ? String(o.closed_at) : undefined } as Order, items: items.map((i) => ({ id: String(i.id), orderId: String(i.order_id), restaurantId: String(i.restaurant_id), productId: String(i.product_id), productNameSnapshot: String(i.product_name_snapshot), unitPriceSnapshot: Number(i.unit_price_snapshot), quantity: Number(i.quantity), preparationSector: i.preparation_sector as OrderItem["preparationSector"], status: i.status as OrderItem["status"], createdAt: String(i.created_at), updatedAt: String(i.updated_at), readyAt: i.ready_at ? String(i.ready_at) : undefined } as OrderItem)) }; }
function dedupeCategories(categories: Category[]) { const seen = new Set<string>(); return categories.filter((category) => { const key = category.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }); }
function phoneToWhatsapp(phone?: string) { const digits = phone?.replace(/\D/g, ""); return digits ? `https://wa.me/${digits}` : "https://wa.me/558896298276"; }
function cartItemTotal(item: CartItem, state: AppState) { const product = state.products.find((entry) => entry.id === item.productId); const variation = state.productVariations.find((entry) => entry.id === item.variationId); const addons = (item.addonIds ?? []).map((id) => state.productAddons.find((entry) => entry.id === id && entry.active)).reduce((sum, addon) => sum + (addon?.price ?? 0), 0); return ((product?.price ?? 0) + (variation?.priceDelta ?? 0) + addons) * item.quantity; }
