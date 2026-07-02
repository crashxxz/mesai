"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { disableCurrentPushSubscription, getExistingSubscription, getPushPermission, getSupabaseAccessToken, isPushSupported, subscribeToPush } from "@/lib/push";

export function PushButton() {
  const [status, setStatus] = useState<"loading" | "unsupported" | "denied" | "active" | "inactive">("loading");
  const [message, setMessage] = useState("");
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const checkStatus = useCallback(async () => {
    if (!isPushSupported() || !vapidKey) { setStatus("unsupported"); return; }
    const permission = getPushPermission();
    if (permission === "denied") { setStatus("denied"); return; }
    const sub = await getExistingSubscription();
    setStatus(sub ? "active" : "inactive");
  }, [vapidKey]);

  useEffect(() => { void checkStatus(); }, [checkStatus]);

  async function activate() {
    if (!vapidKey) return;
    setStatus("loading");
    setMessage("");
    try {
      const subscription = await subscribeToPush(vapidKey);
      if (!subscription) { setStatus(getPushPermission() === "denied" ? "denied" : "inactive"); return; }
      const keys = subscription.toJSON().keys;
      const token = await getSupabaseAccessToken();
      if (!token || !keys?.p256dh || !keys.auth) {
        setStatus("inactive");
        setMessage("Entre com usuário real para ativar.");
        return;
      }
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } })
      });
      if (!response.ok) throw new Error("Falha ao salvar inscrição");
      setStatus("active");
      setMessage("Ativadas.");
    } catch {
      setStatus("inactive");
      setMessage("Não foi possível ativar.");
    }
  }

  async function deactivate() {
    setStatus("loading");
    await disableCurrentPushSubscription({ unsubscribe: true });
    setStatus("inactive");
    setMessage("Desativadas.");
  }

  async function sendTest() {
    setMessage("");
    const token = await getSupabaseAccessToken();
    if (!token) { setMessage("Entre com usuário real."); return; }
    const response = await fetch("/api/push/send-test", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    setMessage(response.ok ? "Teste enviado." : "Teste não enviado.");
  }

  if (status === "loading") return null;
  if (status === "unsupported") return <p className="text-xs font-bold text-slate-400">Notificações não suportadas neste navegador.</p>;
  if (status === "denied") return <p className="text-xs font-bold text-red-500">Notificações bloqueadas. Altere nas configurações do navegador.</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "active" ? (
        <>
          <Button variant="outline" size="sm" onClick={deactivate}><BellOff className="h-4 w-4" />Desativar este dispositivo</Button>
          <Button variant="outline" size="sm" onClick={() => void sendTest()}><BellRing className="h-4 w-4" />Testar</Button>
          <span className="text-xs font-bold text-emerald-600">Ativadas</span>
        </>
      ) : (
        <Button variant="amber" size="sm" onClick={() => void activate()}><Bell className="h-4 w-4" />Ativar notificações</Button>
      )}
      {message ? <span className="text-xs font-bold text-slate-500">{message}</span> : null}
      <p className="basis-full text-xs font-semibold text-slate-500">
        Para receber e abrir como app no celular, instale o MesaY na Tela de Início e ative as notificações dentro do app instalado.
      </p>
    </div>
  );
}
