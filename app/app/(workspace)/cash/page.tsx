"use client";

import { CashSessionPanel } from "@/components/cash-session-panel";
import { RoleGuard } from "@/components/role-guard";
import { cashMovementTypeLabel, cashSessionStatusLabel, paymentMethodLabel } from "@/lib/services";
import { useStore } from "@/lib/store";
import { brl, dateKey } from "@/lib/utils";

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
  const salesFromMovements = movements.filter((movement) => movement.type === "sale").reduce((sum, movement) => sum + movement.amount, 0);

  const today = dateKey(new Date());
  const todayPayments = state.payments
    .filter((p) => p.restaurantId === restaurant?.id && (p.paymentStatus ?? "paid") === "paid" && dateKey(p.createdAt) === today)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const todayTotal = todayPayments.reduce((sum, p) => sum + p.amount, 0);

  // Pagamentos do turno atual (dentro da sessão aberta)
  const sessionPayments = openSession
    ? todayPayments.filter((p) => new Date(p.createdAt) >= new Date(openSession.openedAt))
    : [];
  const sessionTotal = sessionPayments.reduce((sum, p) => sum + p.amount, 0);
  const sessionCashOnly = sessionPayments.filter((p) => p.method === "cash").reduce((sum, p) => sum + p.amount, 0);

  // Pagamentos fora do caixa (antes de abrir ou sem sessão)
  const outsidePayments = openSession
    ? todayPayments.filter((p) => new Date(p.createdAt) < new Date(openSession.openedAt))
    : todayPayments;
  const outsideTotal = outsidePayments.reduce((sum, p) => sum + p.amount, 0);

  // Esperado físico = inicial + vendas em dinheiro no turno + suprimentos - sangrias
  const computedExpected = openSession
    ? openSession.openingAmount + Math.max(salesFromMovements, sessionCashOnly) + supplies - withdrawals
    : 0;

  return (
    <RoleGuard allowed={["owner", "manager", "cashier"]}>
      <section className="grid gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Caixa do turno</p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-950">Caixa</h1>
              <p className="text-sm font-bold text-slate-500">Abrir, registrar dinheiro que saiu/entrou e fechar.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <CashStat label="Dinheiro esperado" value={brl(openSession ? computedExpected : 0)} tone="bg-emerald-50 text-emerald-800" />
              <CashStat label="Sangria" value={brl(withdrawals)} tone="bg-red-50 text-red-700" />
              <CashStat label="Suprimento" value={brl(supplies)} tone="bg-sky-50 text-sky-800" />
            </div>
          </div>
        </header>

        {!openSession && todayPayments.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-900">
            ⚠️ Caixa fechado. Há {todayPayments.length} pagamento(s) hoje ({brl(todayTotal)}) que não entraram no controle de caixa. Abra o caixa para registrar movimentos.
          </div>
        ) : null}

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
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-950">{openSession ? "Recebido no turno" : "Pagamentos recebidos hoje"}</h2>
                <strong className="text-emerald-700">{brl(openSession ? sessionTotal : todayTotal)}</strong>
              </div>
              <div className="grid gap-2">
                {(openSession ? sessionPayments : todayPayments).length ? (
                  (openSession ? sessionPayments : todayPayments).map((payment) => (
                    <div key={payment.id} className="flex justify-between rounded-2xl bg-slate-50 p-3 text-sm font-bold">
                      <span>{paymentMethodLabel(payment.method)}{payment.cardBrand ? ` · ${payment.cardBrand}` : ""}</span>
                      <strong className="text-emerald-700">{brl(payment.amount)}</strong>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-400">
                    Nenhum pagamento no turno
                  </div>
                )}
              </div>
              {openSession && outsideTotal > 0 ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-black text-amber-700">Pagamentos fora do caixa ({brl(outsideTotal)})</summary>
                  <div className="mt-2 grid gap-1">
                    {outsidePayments.map((payment) => (
                      <div key={payment.id} className="flex justify-between rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-800">
                        <span>{paymentMethodLabel(payment.method)}</span>
                        <span>{brl(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
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
