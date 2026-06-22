"use client";

import Link from "next/link";
import { RefreshCcw, Table2, UsersRound } from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { businessPresetOptions, type BusinessProfile } from "@/lib/business-presets";
import { useStore } from "@/lib/store";
import { useBusinessPreset } from "@/lib/use-business-preset";
import { runtimeConfig } from "@/lib/runtime-config";

export default function SettingsPage() {
  const { restaurant, settings, updateRestaurant, updateSettings, resetDemo } = useStore();
  const { profile, preset, setBusinessProfile } = useBusinessPreset();

  if (!restaurant || !settings) return null;

  return (
    <RoleGuard allowed={["owner"]}>
      <section className="mx-auto grid max-w-4xl gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-950">Ajustes</h1>
          <p className="text-sm font-bold text-slate-500">{restaurant.name}</p>
        </div>

        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-soft">
          <h2 className="mb-3 text-lg font-black text-slate-950">Tipo de estabelecimento</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Tipo
              <select
                className="h-12 rounded-2xl border border-amber-200 bg-white px-3"
                value={profile}
                onChange={(event) => setBusinessProfile(event.target.value as BusinessProfile)}
              >
                {businessPresetOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-2xl bg-white p-3 text-sm font-bold text-amber-900">
              {preset.description}
              <div className="mt-1 text-xs text-amber-800">
                Esse tipo ajusta os nomes, atalhos e o cardápio da mesa.
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
          <h2 className="mb-3 text-lg font-black text-slate-950">Estabelecimento</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Nome
              <input
                className="h-12 rounded-lg border border-slate-200 px-3"
                value={restaurant.name}
                onChange={(event) => updateRestaurant({ name: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              {"Nome usado no link do QR"}
              <input
                className="h-12 rounded-lg border border-slate-200 px-3"
                value={restaurant.slug}
                onChange={(event) => updateRestaurant({ slug: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Telefone
              <input
                className="h-12 rounded-lg border border-slate-200 px-3"
                value={restaurant.phone ?? ""}
                onChange={(event) => updateRestaurant({ phone: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              WhatsApp
              <input
                className="h-12 rounded-lg border border-slate-200 px-3"
                value={restaurant.whatsappUrl ?? ""}
                onChange={(event) => updateRestaurant({ whatsappUrl: event.target.value })}
                placeholder="https://wa.me/558896298276"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Cidade
              <input
                className="h-12 rounded-lg border border-slate-200 px-3"
                value={restaurant.city ?? ""}
                onChange={(event) => updateRestaurant({ city: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Endereço
              <input
                className="h-12 rounded-lg border border-slate-200 px-3"
                value={restaurant.address ?? ""}
                onChange={(event) => updateRestaurant({ address: event.target.value })}
              />
            </label>
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
          <h2 className="mb-3 text-lg font-black text-slate-950">Pedido por QR Code</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={settings.qrOrdersEnabled}
                onChange={(event) => updateSettings({ qrOrdersEnabled: event.target.checked })}
              />
              Cliente pode pedir pelo QR Code?
            </label>
            <label className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={settings.qrOrdersNeedApproval}
                onChange={(event) => updateSettings({ qrOrdersNeedApproval: event.target.checked })}
              />
              Pedido precisa ser aprovado?
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              Taxa de serviço (%)
              <input
                className="h-12 rounded-lg border border-slate-200 px-3"
                type="number"
                min={0}
                value={settings.serviceFeePercent}
                onChange={(event) => updateSettings({ serviceFeePercent: Number(event.target.value) || 0 })}
              />
            </label>
          </div>
        </article>

        <div className="grid gap-3 sm:grid-cols-3">
          <Button asChild variant="outline">
            <Link href="/app/settings/users">
              <UsersRound className="h-4 w-4" aria-hidden="true" />
              Equipe
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/app/settings/tables">
              <Table2 className="h-4 w-4" aria-hidden="true" />
              Mesas e QR Codes
            </Link>
          </Button>
          {runtimeConfig.dataMode === "demo" ? <Button variant="danger" onClick={() => { if (window.confirm("Resetar todos os dados locais de demonstração?")) resetDemo(); }}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Resetar dados demo
          </Button> : null}
        </div>
      </section>
    </RoleGuard>
  );
}
