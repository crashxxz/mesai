"use client";

import { useParams } from "next/navigation";
import { QrCode } from "lucide-react";
import { BrandLogo } from "@/components/brand-mark";
import { useStore } from "@/lib/store";

export default function RestaurantQrPage() {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>();
  const { state } = useStore();
  const restaurant = state.restaurants.find((item) => item.slug === restaurantSlug);

  return (
    <main className="grid min-h-screen place-items-center bg-orange-50 px-4 py-8">
      <section className="w-full max-w-sm rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-soft-lg">
        <BrandLogo className="mb-6 justify-center" markClassName="h-14 w-14" />
        {restaurant ? <p className="text-sm font-bold text-slate-500">{restaurant.name}</p> : null}
        <QrCode className="mx-auto mt-5 h-10 w-10 text-amber-600" aria-hidden="true" />
        <h1 className="mt-3 text-2xl font-black text-slate-950">Use o QR da sua mesa</h1>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
          Cada QR abre somente a mesa correta. Pe\u00e7a ajuda ao atendimento se precisar.
        </p>
      </section>
    </main>
  );
}
