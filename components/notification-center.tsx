"use client";

import { Bell, BellRing, CheckCheck, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { effectiveRoles } from "@/lib/permissions";
import { itemAppearsInPreparationSector } from "@/lib/services";
import { useStore } from "@/lib/store";
import type { UserRole } from "@/lib/types";

interface Notice { id: string; text: string; at: string; roles: UserRole[] }

export function NotificationCenter() {
  const { state, profile, restaurant } = useStore();
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string[]>([]);
  const [sound, setSound] = useState(false);
  const [toast, setToast] = useState<Notice>();
  const initialized = useRef(false);
  const previousIds = useRef<string[]>([]);
  const roles = useMemo(() => effectiveRoles(profile), [profile]);
  const notices = useMemo(() => buildNotices(state, restaurant?.id).filter((notice) => notice.roles.some((role) => roles.includes(role))).slice(0, 30), [restaurant?.id, roles, state]);
  const noticesRef = useRef(notices);
  noticesRef.current = notices;
  const unread = notices.filter((notice) => !read.includes(notice.id));
  const storageKey = `mesai-notices-${profile?.id ?? "guest"}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setRead(saved ? JSON.parse(saved) as string[] : noticesRef.current.map((notice) => notice.id));
    setSound(localStorage.getItem(`${storageKey}-sound`) === "1");
    previousIds.current = noticesRef.current.map((notice) => notice.id);
    initialized.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!initialized.current) return;
    const fresh = notices.find((notice) => !previousIds.current.includes(notice.id));
    previousIds.current = notices.map((notice) => notice.id);
    if (!fresh) return;
    setToast(fresh);
    const timer = window.setTimeout(() => setToast(undefined), 4000);
    if (sound) void beep();
    return () => window.clearTimeout(timer);
  }, [notices, sound]);

  function markAllRead() {
    const ids = notices.map((notice) => notice.id);
    setRead(ids); localStorage.setItem(storageKey, JSON.stringify(ids));
  }

  return <>
    <div className="relative">
      <button type="button" title="Notificações" className="relative grid h-11 w-11 place-items-center rounded-xl text-slate-600 hover:bg-slate-100" onClick={() => setOpen((value) => !value)}>
        {unread.length ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        {unread.length ? <span className="absolute right-1 top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-black text-white">{Math.min(unread.length, 99)}</span> : null}
      </button>
      {open ? <div className="fixed inset-x-3 top-16 z-50 flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-soft-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[360px]">
        <div className="flex items-center justify-between"><strong>Notificações</strong><div className="flex gap-1"><button title="Som" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" onClick={() => { const next = !sound; setSound(next); localStorage.setItem(`${storageKey}-sound`, next ? "1" : "0"); }}>{sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button><button title="Marcar todas como lidas" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" onClick={markAllRead}><CheckCheck className="h-4 w-4" /></button></div></div>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain">{notices.length ? notices.map((notice) => <button key={notice.id} className={`block w-full rounded-xl p-3 text-left text-sm ${read.includes(notice.id) ? "text-slate-500" : "bg-amber-50 font-bold text-slate-900"}`} onClick={() => { const next = [...new Set([...read, notice.id])]; setRead(next); localStorage.setItem(storageKey, JSON.stringify(next)); }}><span>{notice.text}</span><small className="mt-1 block text-xs text-slate-400">{relativeTime(notice.at)}</small></button>) : <p className="p-5 text-center text-sm font-bold text-slate-400">Tudo tranquilo por aqui.</p>}</div>
      </div> : null}
    </div>
    {toast ? <div role="status" className="fixed inset-x-3 top-16 z-[60] flex items-start gap-3 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-soft-lg sm:left-auto sm:right-4 sm:max-w-xs"><span className="min-w-0 flex-1">{toast.text}</span><button type="button" aria-label="Fechar notificação" className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-white/10" onClick={() => setToast(undefined)}><X className="h-4 w-4" /></button></div> : null}
  </>;
}

function buildNotices(state: ReturnType<typeof useStore>["state"], restaurantId?: string): Notice[] {
  if (!restaurantId) return [];
  const notices: Notice[] = [];
  for (const order of state.orders.filter((item) => item.restaurantId === restaurantId)) {
    if (order.status === "closed") notices.push({ id: `closed-${order.id}`, text: "Comanda fechada", at: order.closedAt ?? order.updatedAt, roles: ["owner", "manager", "cashier"] });
    else {
      const orderItems = state.orderItems.filter((item) => item.orderId === order.id);
      const roles: UserRole[] = ["owner", "manager", "waiter"];
      if (orderItems.some((item) => itemAppearsInPreparationSector(item, "kitchen"))) roles.push("kitchen");
      if (orderItems.some((item) => itemAppearsInPreparationSector(item, "bar"))) roles.push("bar");
      notices.push({ id: `order-${order.id}`, text: order.source === "qr_code" ? "Novo pedido pelo QR" : "Novo pedido do atendimento", at: order.createdAt, roles: [...new Set(roles)] });
    }
  }
  for (const alert of state.tableAlerts.filter((item) => item.restaurantId === restaurantId && item.active)) notices.push({ id: `alert-${alert.id}`, text: alert.type === "bill_request" ? "Cliente pediu a conta" : "Cliente chamou o garçom", at: alert.createdAt, roles: alert.type === "bill_request" ? ["owner", "manager", "waiter", "cashier"] : ["owner", "manager", "waiter"] });
  for (const item of state.orderItems.filter((entry) => entry.restaurantId === restaurantId && entry.status === "ready")) notices.push({ id: `ready-${item.id}`, text: item.preparationSector === "bar" ? "Item pronto no bar" : item.preparationSector === "both" ? "Item pronto no preparo" : "Item pronto na cozinha", at: item.readyAt ?? item.updatedAt, roles: ["owner", "manager", "waiter"] });
  for (const item of state.orderItems.filter((entry) => entry.restaurantId === restaurantId && entry.status === "delivered" && entry.deliveredAt && Date.now() - new Date(entry.deliveredAt).getTime() < 300000)) notices.push({ id: `delivered-${item.id}`, text: `Item entregue: ${item.productNameSnapshot}`, at: item.deliveredAt!, roles: ["owner", "manager", "waiter"] });
  for (const item of state.orderItems.filter((entry) => entry.restaurantId === restaurantId && entry.status === "cancelled" && entry.cancelReason)) notices.push({ id: `rejected-${item.id}`, text: `Item recusado: ${item.productNameSnapshot}. Motivo: ${item.cancelReason ?? "sem motivo"}`, at: item.updatedAt, roles: ["owner", "manager", "waiter"] });
  return notices.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function relativeTime(value: string) { const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000)); return minutes < 1 ? "agora" : minutes < 60 ? `há ${minutes} min` : minutes < 1440 ? `há ${Math.floor(minutes / 60)} h` : `há ${Math.floor(minutes / 1440)} d`; }
async function beep() { try { const audio = new AudioContext(); const oscillator = audio.createOscillator(); const gain = audio.createGain(); oscillator.connect(gain); gain.connect(audio.destination); oscillator.frequency.value = 680; gain.gain.value = 0.025; oscillator.start(); oscillator.stop(audio.currentTime + 0.12); } catch { /* som opcional */ } }
