import { supabase } from "@/lib/supabase";
import type { PreparationSector, UUID } from "@/lib/types";

export function emitDemoRealtime(topic: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("hyoc:realtime", { detail: { topic } }));
  }
}

export function subscribePreparationItems(
  restaurantId: UUID,
  sector: Exclude<PreparationSector, "none">,
  onChange: () => void
) {
  if (!supabase) {
    const handler = () => onChange();
    window.addEventListener("hyoc:realtime", handler);
    return () => window.removeEventListener("hyoc:realtime", handler);
  }

  const client = supabase;
  const channel = client
    .channel(`preparation:${restaurantId}:${sector}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "order_items",
        filter: `restaurant_id=eq.${restaurantId}`
      },
      onChange
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export function subscribeRestaurantOperation(restaurantId: UUID, onChange: (table: string) => void) {
  if (!supabase) {
    const handler = (event: Event) => onChange((event as CustomEvent<{ topic?: string }>).detail?.topic ?? "state");
    window.addEventListener("hyoc:realtime", handler);
    return () => window.removeEventListener("hyoc:realtime", handler);
  }

  const client = supabase;
  const tables = ["orders", "order_items", "tables", "table_alerts"] as const;
  const channel = client.channel(`operation:${restaurantId}`);
  for (const table of tables) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter: `restaurant_id=eq.${restaurantId}` },
      () => onChange(table)
    );
  }
  channel.subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
