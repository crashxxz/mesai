"use client";

import { useEffect, useMemo, useRef } from "react";
import { Martini } from "lucide-react";
import { PreparationBoard } from "@/components/preparation-board";
import { RoleGuard } from "@/components/role-guard";
import { getBarItems } from "@/lib/services";
import { useStore } from "@/lib/store";
import { useBusinessPreset } from "@/lib/use-business-preset";

export default function BarPage() {
  const { state, restaurant, updateOrderItemStatus } = useStore();
  const { preset } = useBusinessPreset();
  const countRef = useRef(0);
  const items = useMemo(
    () => {
      const restaurantId = restaurant?.id ?? state.restaurants[0].id;
      const activeItems = getBarItems(state, restaurantId);
      const readyItems = state.orderItems.filter(
        (item) =>
          item.restaurantId === restaurantId &&
          item.preparationSector === "bar" &&
          item.status === "ready"
      );
      return [...activeItems, ...readyItems];
    },
    [restaurant?.id, state]
  );

  useEffect(() => {
    if (items.length > countRef.current) void beep();
    countRef.current = items.length;
  }, [items.length]);

  return (
    <RoleGuard allowed={["owner", "bar"]}>
      <PreparationBoard
        title={preset.dashboardTexts.barQueue}
        subtitle={items.length ? `Bebidas aparecem aqui. ${items.length} na fila agora.` : "Bebidas aparecem aqui. Nenhuma esperando agora."}
        icon={Martini}
        tone="bar"
        items={items}
        orders={state.orders}
        tables={state.tables}
        waiters={state.profiles}
        addons={state.orderItemAddons}
        products={state.products}
        onStatus={updateOrderItemStatus}
      />
    </RoleGuard>
  );
}

async function beep() {
  try {
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.frequency.value = 560;
    gain.gain.value = 0.02;
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.12);
  } catch (error) {
    void error;
  }
}
