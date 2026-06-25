"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChefHat } from "lucide-react";
import { PreparationBoard } from "@/components/preparation-board";
import { RoleGuard } from "@/components/role-guard";
import { getKitchenItems, itemAppearsInPreparationSector } from "@/lib/services";
import { useStore } from "@/lib/store";
import { useBusinessPreset } from "@/lib/use-business-preset";

export default function KitchenPage() {
  const { state, restaurant, updateOrderItemStatus, rejectOrderItem } = useStore();
  const { preset } = useBusinessPreset();
  const countRef = useRef(0);
  const items = useMemo(
    () => {
      const restaurantId = restaurant?.id ?? state.restaurants[0].id;
      const activeItems = getKitchenItems(state, restaurantId);
      const readyItems = state.orderItems.filter(
        (item) =>
          item.restaurantId === restaurantId &&
          itemAppearsInPreparationSector(item, "kitchen") &&
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
    <RoleGuard allowed={["owner", "manager", "kitchen"]}>
      <PreparationBoard
        title={preset.dashboardTexts.kitchenQueue}
        subtitle={items.length ? `${items.length} itens agora. Marque como pronto quando terminar.` : "Sem prato esperando agora."}
        icon={ChefHat}
        tone="kitchen"
        items={items}
        orders={state.orders}
        tables={state.tables}
        waiters={state.profiles}
        addons={state.orderItemAddons}
        products={state.products}
        onStatus={updateOrderItemStatus}
        onReceiveOrder={(orderId) => {
          items.filter((item) => item.orderId === orderId && (item.status === "sent" || item.status === "received")).forEach((item) => void updateOrderItemStatus(item.id, "preparing"));
        }}
        onReject={(itemId, reason) => void rejectOrderItem(itemId, reason)}
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
    oscillator.frequency.value = 740;
    gain.gain.value = 0.02;
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.12);
  } catch (error) {
    void error;
  }
}
