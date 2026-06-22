"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { runtimeConfig } from "@/lib/runtime-config";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

interface PublicTable { id: string; number: number; name?: string }

export default function RestaurantQrPage() {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>();
  const { state } = useStore();
  const localRestaurant = state.restaurants.find((item) => item.slug === restaurantSlug);
  const [restaurantName, setRestaurantName] = useState(localRestaurant?.name ?? "");
  const [tables, setTables] = useState<PublicTable[]>(() => state.tables.filter((item) => item.restaurantId === localRestaurant?.id && item.active));
  const [tableId, setTableId] = useState("");

  useEffect(() => {
    if (runtimeConfig.dataMode !== "supabase" || !supabase) return;
    void supabase.rpc("get_public_restaurant_tables", { p_slug: restaurantSlug }).then(({ data }) => {
      const payload = data as { restaurant?: { name?: string }; tables?: PublicTable[] } | null;
      if (payload?.restaurant?.name) setRestaurantName(payload.restaurant.name);
      if (payload?.tables) setTables(payload.tables);
    });
  }, [restaurantSlug]);

  return <main className="grid min-h-screen place-items-center bg-orange-50 px-4 py-8">
    <section className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-6 shadow-soft-lg">
      <BrandLogo className="mb-6 justify-center" markClassName="h-14 w-14" />
      <p className="text-center text-sm font-bold text-slate-500">{restaurantName}</p>
      <h1 className="mt-1 text-center text-2xl font-black text-slate-950">Informe sua mesa</h1>
      <label className="mt-5 grid gap-2 text-sm font-bold text-slate-700">Escolher mesa
        <select className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-bold" value={tableId} onChange={(event) => setTableId(event.target.value)}>
          <option value="">Selecione</option>
          {tables.map((table) => <option key={table.id} value={table.id}>{table.name || `Mesa ${table.number}`}</option>)}
        </select>
      </label>
      <Button asChild variant="amber" size="lg" className="mt-4 w-full">
        <Link aria-disabled={!tableId} className={!tableId ? "pointer-events-none opacity-50" : ""} href={tableId ? `/r/${restaurantSlug}/mesa/${tableId}` : "#"}>Continuar</Link>
      </Button>
    </section>
  </main>;
}
