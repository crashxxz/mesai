"use client";

import type { PeriodFilterValue, PeriodKey } from "@/lib/services";
import { cn } from "@/lib/utils";

const options: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "custom", label: "Período" }
];

export function PeriodFilter({
  value,
  onChange
}: {
  value: PeriodFilterValue;
  onChange: (value: PeriodFilterValue) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex gap-2 overflow-x-auto pb-1 touch-scroll">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className={cn(
              "h-10 shrink-0 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600",
              value.key === option.key && "border-slate-900 bg-slate-900 text-white"
            )}
            onClick={() => onChange({ key: option.key })}
          >
            {option.label}
          </button>
        ))}
      </div>
      {value.key === "custom" ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold"
            type="date"
            value={value.start ?? ""}
            onChange={(event) => onChange({ ...value, start: event.target.value })}
          />
          <input
            className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold"
            type="date"
            value={value.end ?? ""}
            onChange={(event) => onChange({ ...value, end: event.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}
