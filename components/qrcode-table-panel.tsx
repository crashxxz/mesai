"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { brand } from "@/lib/brand";
import type { Restaurant, RestaurantTable } from "@/lib/types";

export function QRCodeTablePanel({
  restaurant,
  table
}: {
  restaurant: Restaurant;
  table: RestaurantTable;
}) {
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");

  useEffect(() => {
    const origin = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const nextUrl = `${origin}/r/${restaurant.slug}/mesa/${table.id}`;
    setUrl(nextUrl);
    QRCode.toDataURL(nextUrl, {
      margin: 1,
      width: 168,
      color: {
        dark: brand.colors.charcoal,
        light: "#ffffff"
      }
    })
      .then(setImage)
      .catch(() => setImage(""));
  }, [restaurant.slug, table.id]);

  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">{table.name ?? `Mesa ${table.number}`}</h2>
          <p className="break-all text-xs font-bold text-slate-500">{url}</p>
        </div>
      </div>
      {image ? (
        <Image
          className="h-40 w-40 rounded-lg border border-slate-200"
          src={image}
          alt={`QR ${table.name ?? table.number}`}
          width={160}
          height={160}
          unoptimized
        />
      ) : (
        <div className="grid h-40 w-40 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
          QR
        </div>
      )}
    </div>
  );
}
