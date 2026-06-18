"use client";

import { FormEvent, useState } from "react";
import { Banknote, Lock, Plus, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CashMovement, CashSession } from "@/lib/types";
import { brl } from "@/lib/utils";

export function CashSessionPanel({
  session,
  movements,
  onOpen,
  onMove,
  onClose
}: {
  session?: CashSession;
  movements: CashMovement[];
  onOpen: (openingAmount: number) => void;
  onMove: (type: "withdrawal" | "supply" | "adjustment", amount: number, description: string) => void;
  onClose: (countedAmount: number) => void;
}) {
  const [openingAmount, setOpeningAmount] = useState("150");
  const [movement, setMovement] = useState({ type: "withdrawal", amount: "", description: "" });
  const [countedAmount, setCountedAmount] = useState("");

  function open(event: FormEvent) {
    event.preventDefault();
    onOpen(Number(openingAmount) || 0);
  }

  function move(event: FormEvent) {
    event.preventDefault();
    onMove(movement.type as "withdrawal" | "supply" | "adjustment", Number(movement.amount) || 0, movement.description);
    setMovement((current) => ({ ...current, amount: "", description: "" }));
  }

  function close(event: FormEvent) {
    event.preventDefault();
    onClose(Number(countedAmount) || 0);
    setCountedAmount("");
  }

  if (!session) {
    return (
      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft" onSubmit={open}>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-950">
          <Unlock className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          Abrir caixa
        </h2>
        <div className="grid gap-2">
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Valor inicial
            <input
              className="h-12 rounded-2xl border border-slate-200 px-3 text-base font-bold"
              type="number"
              min={0}
              step="0.01"
              value={openingAmount}
              onChange={(event) => setOpeningAmount(event.target.value)}
            />
          </label>
          <Button variant="green" type="submit">Abrir caixa</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-4">
      <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-soft">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">Caixa aberto</h2>
            <p className="text-sm font-bold text-slate-500">{new Date(session.openedAt).toLocaleString("pt-BR")}</p>
          </div>
          <div className="text-right">
            <div className="text-xs font-black text-slate-500">Dinheiro esperado</div>
            <div className="text-2xl font-black text-emerald-700">{brl(session.expectedAmount)}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm font-bold">
          <div className="rounded-2xl bg-white p-3">
            <span className="text-slate-500">Inicial</span>
            <div className="text-lg font-black text-slate-950">{brl(session.openingAmount)}</div>
          </div>
          <div className="rounded-2xl bg-white p-3">
            <span className="text-slate-500">Movimentos</span>
            <div className="text-lg font-black text-slate-950">{movements.length}</div>
          </div>
        </div>
      </article>

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft" onSubmit={move}>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-950">
          <Plus className="h-5 w-5 text-amber-600" aria-hidden="true" />
          Movimento
        </h2>
        <div className="mb-3 grid gap-1 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800">
          <span><strong>Sangria</strong> = tirei dinheiro do caixa</span>
          <span><strong>Suprimento</strong> = coloquei dinheiro no caixa</span>
          <span><strong>Ajuste</strong> = corrigi o valor do caixa</span>
        </div>
        <div className="grid gap-2">
          <select
            className="h-12 rounded-2xl border border-slate-200 px-3 text-sm font-bold"
            value={movement.type}
            onChange={(event) => setMovement((current) => ({ ...current, type: event.target.value }))}
          >
            <option value="withdrawal">Sangria</option>
            <option value="supply">Suprimento</option>
            <option value="adjustment">Ajuste</option>
          </select>
          <input
            className="h-12 rounded-2xl border border-slate-200 px-3 text-sm font-bold"
            type="number"
            min={0}
            step="0.01"
            value={movement.amount}
            onChange={(event) => setMovement((current) => ({ ...current, amount: event.target.value }))}
            placeholder="Valor"
          />
          <input
            className="h-12 rounded-2xl border border-slate-200 px-3 text-sm font-bold"
            value={movement.description}
            onChange={(event) => setMovement((current) => ({ ...current, description: event.target.value }))}
            placeholder="Descrição"
          />
          <Button variant="outline" type="submit">
            <Banknote className="h-4 w-4" aria-hidden="true" />
            Registrar
          </Button>
        </div>
      </form>

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft" onSubmit={close}>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-950">
          <Lock className="h-5 w-5 text-red-600" aria-hidden="true" />
          Fechar caixa
        </h2>
        <div className="grid gap-2">
          <label className="grid gap-1 text-sm font-bold text-slate-700">
            Quanto tem no caixa agora?
            <input
              className="h-12 rounded-2xl border border-slate-200 px-3 text-base font-bold"
              type="number"
              min={0}
              step="0.01"
              value={countedAmount}
              onChange={(event) => setCountedAmount(event.target.value)}
              placeholder="Valor contado"
            />
          </label>
          <Button variant="danger" type="submit">Fechar caixa</Button>
        </div>
      </form>
    </div>
  );
}
