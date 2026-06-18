"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReasonDialog({
  open,
  title,
  label = "Motivo",
  confirmLabel,
  suggestions = [],
  onCancel,
  onConfirm
}: {
  open: boolean;
  title: string;
  label?: string;
  confirmLabel: string;
  suggestions?: string[];
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  if (!open) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = reason.trim();
    if (!value) return;
    onConfirm(value);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/45 p-0 sm:place-items-center sm:p-4">
      <form
        className="w-full max-w-md rounded-t-lg bg-white p-4 shadow-soft sm:rounded-lg"
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950">{title}</h2>
          <Button variant="ghost" size="icon" title="Fechar" type="button" onClick={onCancel}>
            <X className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        {suggestions.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => setReason(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        <label className="grid gap-1 text-sm font-bold text-slate-700">
          {label}
          <textarea
            className="min-h-28 rounded-lg border border-slate-200 p-3 outline-none ring-amber-400 focus:ring-2"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            autoFocus
          />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" type="button" onClick={onCancel}>
            Voltar
          </Button>
          <Button variant="amber" type="submit" disabled={!reason.trim()}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
