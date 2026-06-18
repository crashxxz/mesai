"use client";

import { TableCard } from "@/components/table-card";
import type { Order, OrderItem, RestaurantTable, TableAlert, UUID } from "@/lib/types";

export function TableGrid({
  tables,
  orders,
  orderItems,
  alerts,
  onOpen,
  onResolveAlert
}: {
  tables: RestaurantTable[];
  orders: Order[];
  orderItems: OrderItem[];
  alerts: TableAlert[];
  onOpen: (tableId: UUID) => void;
  onResolveAlert?: (tableId: UUID, type: TableAlert["type"]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tables.map((table) => (
        <TableCard
          key={table.id}
          table={table}
          order={orders.find(
            (order) => order.tableId === table.id && !["closed", "cancelled"].includes(order.status)
          )}
          orderItems={orderItems}
          alerts={alerts}
          onOpen={() => onOpen(table.id)}
          onResolveAlert={(type) => onResolveAlert?.(table.id, type)}
        />
      ))}
    </div>
  );
}
