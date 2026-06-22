"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { brand } from "@/lib/brand";
import { runtimeConfig } from "@/lib/runtime-config";
import { supabaseGateway } from "@/lib/supabase-gateway";
import type { Restaurant, RestaurantTable } from "@/lib/types";
import { Button } from "@/components/ui/button";

export function QRCodeTablePanel({ restaurant, table }: { restaurant: Restaurant; table: RestaurantTable }) {
  const [token, setToken] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (runtimeConfig.dataMode === "demo") setToken(table.id);
  }, [table.id]);

  useEffect(() => {
    if (!token) {
      setUrl("");
      setImage("");
      return;
    }
    const origin = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const nextUrl = `${origin}/r/${restaurant.slug}/mesa/${table.id}?t=${encodeURIComponent(token)}`;
    setUrl(nextUrl);
    QRCode.toDataURL(nextUrl, {
      margin: 1,
      width: 168,
      color: { dark: brand.colors.charcoal, light: "#ffffff" }
    }).then(setImage).catch(() => setImage(""));
  }, [restaurant.slug, table.id, token]);

  async function generateQr() {
    setLoading(true);
    setError("");
    try {
      setToken(await supabaseGateway.rotateTableQrToken(table.id));
    } catch {
      setError("Não foi possível gerar o QR seguro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">{table.name ?? `Mesa ${table.number}`}</h2>
          {url ? <p className="break-all text-xs font-bold text-slate-500">{url}</p> : <p className="text-xs font-bold text-slate-500">Gere o QR seguro para esta mesa.</p>}
        </div>
      </div>
      {image ? (
        <Image className="h-40 w-40 rounded-lg border border-slate-200" src={image} alt={`QR ${table.name ?? table.number}`} width={160} height={160} unoptimized />
      ) : (
        <div className="grid h-40 w-40 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">QR</div>
      )}
      {runtimeConfig.dataMode === "supabase" ? (
        <Button className="mt-3 w-full" variant="outline" size="sm" disabled={loading} onClick={() => void generateQr()}>
          {loading ? "Gerando..." : token ? "Rotacionar QR" : "Gerar QR seguro"}
        </Button>
      ) : null}
      {error ? <p className="mt-2 text-xs font-bold text-red-600">{error}</p> : null}
    </div>
  );
}
