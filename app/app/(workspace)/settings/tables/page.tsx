"use client";

import { Plus } from "lucide-react";
import { QRCodeTablePanel } from "@/components/qrcode-table-panel";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import type { TableStatus } from "@/lib/types";

export default function TablesSettingsPage() {
  const { state, restaurant, createTable, updateTable } = useStore();
  const tables = state.tables
    .filter((table) => table.restaurantId === restaurant?.id)
    .sort((a, b) => a.number - b.number);

  if (!restaurant) return null;

  return (
    <RoleGuard allowed={["owner", "manager"]}>
      <section className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-950">Mesas</h1>
            <p className="text-sm font-bold text-slate-500">Cadastro de mesas e QR Codes</p>
          </div>
          <Button variant="amber" onClick={createTable}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Mesa
          </Button>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {tables.map((table) => (
            <article key={table.id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-soft lg:grid-cols-[1fr_210px]">
              <div className="grid gap-2">
                <input
                  className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold"
                  value={table.name ?? ""}
                  onChange={(event) => updateTable(table.id, { name: event.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold"
                    type="number"
                    value={table.number}
                    onChange={(event) => updateTable(table.id, { number: Number(event.target.value) || table.number })}
                  />
                  <select
                    className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold"
                    value={table.status}
                    onChange={(event) => updateTable(table.id, { status: event.target.value as TableStatus })}
                  >
                    <option value="free">Livre</option>
                    <option value="occupied">Ocupada</option>
                    <option value="closing">Fechando</option>
                    <option value="reserved">Reservada</option>
                  </select>
                </div>
                <Button
                  variant={table.active ? "outline" : "green"}
                  onClick={() => updateTable(table.id, { active: !table.active })}
                >
                  {table.active ? "Inativar" : "Ativar"}
                </Button>
              </div>
              <QRCodeTablePanel restaurant={restaurant} table={table} />
            </article>
          ))}
        </div>
      </section>
    </RoleGuard>
  );
}
