"use client";

import { CashSessionPanel } from "@/components/cash-session-panel";
import { RoleGuard } from "@/components/role-guard";
import { cashMovementTypeLabel, cashSessionStatusLabel } from "@/lib/services";
import { useStore } from "@/lib/store";
import { brl } from "@/lib/utils";

export default function CashPage() {
  const { state, restaurant, openCashSession, addCashMovement, closeCashSession } = useStore();
  const sessions = state.cashSessions
    .filter((session) => session.restaurantId === restaurant?.id)
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
  const openSession = sessions.find((session) => session.status === "open");
  const movements = openSession
    ? state.cashMovements.filter((movement) => movement.cashSessionId === openSession.id)
    : [];
  const withdrawals = movements.filter((movement) => movement.type === "withdrawal").reduce((sum, movement) => sum + movement.amount, 0);
  const supplies = movements.filter((movement) => movement.type === "supply").reduce((sum, movement) => sum + movement.amount, 0);

  return (
    <RoleGuard allowed={["owner"]}>
      <section className="grid gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Caixa do turno</p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-950">Caixa</h1>
              <p className="text-sm font-bold text-slate-500">Abrir, registrar dinheiro que saiu/entrou e fechar.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <CashStat label="Esperado" value={brl(openSession?.expectedAmount ?? 0)} tone="bg-emerald-50 text-emerald-800" />
              <CashStat label="Sangria" value={brl(withdrawals)} tone="bg-red-50 text-red-700" />
              <CashStat label="Suprimento" value={brl(supplies)} tone="bg-sky-50 text-sky-800" />
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
          <div>
            <CashSessionPanel
              session={openSession}
              movements={movements}
              onOpen={openCashSession}
              onMove={addCashMovement}
              onClose={closeCashSession}
            />
          </div>

          <div className="grid content-start gap-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <h2 className="mb-3 text-lg font-black text-slate-950">Movimentos de hoje</h2>
              <div className="grid gap-2">
                {movements.length ? (
                  movements.map((movement) => (
                    <div key={movement.id} className="flex justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold">
                      <span>{cashMovementTypeLabel(movement.type)} - {movement.description}</span>
                      <strong>{brl(movement.amount)}</strong>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-400">
                    Nenhum movimento registrado
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <h2 className="mb-3 text-lg font-black text-slate-950">Histórico de caixa</h2>
              <div className="grid gap-2">
                {sessions.map((session) => (
                  <div key={session.id} className="rounded-2xl bg-slate-50 p-3 text-sm font-bold">
                    <div className="flex justify-between">
                      <span>{new Date(session.openedAt).toLocaleDateString("pt-BR")}</span>
                      <strong>{cashSessionStatusLabel(session.status)}</strong>
                    </div>
                    <div className="mt-2 grid gap-2 text-slate-500 sm:grid-cols-2">
                      <span>Dinheiro esperado: {brl(session.expectedAmount)}</span>
                      <span>Diferença: {brl(session.differenceAmount ?? 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>
    </RoleGuard>
  );
}

function CashStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-2xl px-3 py-2 ${tone}`}>
      <div className="text-lg font-black leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase leading-none">{label}</div>
    </div>
  );
}
