"use client";

import { FormEvent, useMemo, useState } from "react";
import { Download, MinusCircle, PlusCircle, ReceiptText, Star } from "lucide-react";
import { PeriodFilter } from "@/components/period-filter";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import type { PeriodFilterValue } from "@/lib/services";
import { getDashboardMetrics, getFinancialSummary, paymentMethodLabel } from "@/lib/services";
import { useStore } from "@/lib/store";
import type { PaymentMethod } from "@/lib/types";
import { useBusinessPreset } from "@/lib/use-business-preset";
import { brl, dateKey, toCsv } from "@/lib/utils";

const expenseCategories = [
  ["merchandise", "Compra de mercadoria"],
  ["employee", "Funcionário"],
  ["rent", "Aluguel"],
  ["energy", "Energia"],
  ["water", "Água"],
  ["gas", "Gás"],
  ["maintenance", "Manutenção"],
  ["other", "Outros"]
] as const;

const expensePaymentMethods: PaymentMethod[] = ["pix", "cash", "credit_card", "debit_card"];

export default function FinancePage() {
  const { state, restaurant, createExpense } = useStore();
  const { preset } = useBusinessPreset();
  const [period, setPeriod] = useState<PeriodFilterValue>({ key: "today" });
  const [expense, setExpense] = useState({
    description: "",
    amount: "",
    category: "merchandise",
    date: dateKey(new Date()),
    paymentMethod: "" as PaymentMethod | "",
    notes: ""
  });
  const restaurantId = restaurant?.id ?? state.restaurants[0].id;
  const metrics = useMemo(
    () => getDashboardMetrics(state, restaurantId, period),
    [period, restaurantId, state]
  );
  const financial = useMemo(
    () => getFinancialSummary(state, restaurantId, period),
    [period, restaurantId, state]
  );
  const expenses = financial.entries.filter((entry) => entry.type === "expense");
  const topProduct = metrics.topProducts[0];

  function submitExpense(event: FormEvent) {
    event.preventDefault();
    createExpense({
      description: expense.description,
      amount: Number(expense.amount) || 0,
      category: expense.category,
      date: expense.date,
      paymentMethod: expense.paymentMethod || undefined,
      notes: expense.notes
    });
    setExpense((current) => ({ ...current, description: "", amount: "", notes: "" }));
  }

  function exportCsv() {
    const rows = financial.entries.map((entry) => ({
      data: entry.date,
      tipo: entry.type === "income" ? "Entrou" : "Saiu",
      categoria: expenseCategoryLabel(entry.category),
      descricao: entry.description,
      forma: entry.paymentMethod ? paymentMethodLabel(entry.paymentMethod) : "",
      valor: entry.amount,
      observacao: entry.notes ?? ""
    }));
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mesai-financeiro.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <RoleGuard allowed={["owner", "manager"]}>
      <section className="grid gap-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Dinheiro do boteco</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">{preset.menuLabels.finance}</h1>
              <p className="text-sm font-bold text-slate-500">O que entrou, o que saiu e o resultado.</p>
            </div>
            <div className="grid gap-2 sm:min-w-96">
              <PeriodFilter value={period} onChange={setPeriod} />
              <Button variant="outline" onClick={exportCsv}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <MoneyCard label="Entrou" value={financial.income} icon={PlusCircle} tone="bg-emerald-50 text-emerald-900 border-emerald-200" />
          <MoneyCard label="Saiu" value={financial.expenses} icon={MinusCircle} tone="bg-red-50 text-red-800 border-red-200" />
          <MoneyCard
            label="Resultado do período"
            value={financial.result}
            icon={ReceiptText}
            tone={financial.result < 0 ? "bg-red-50 text-red-800 border-red-200" : "bg-sky-50 text-sky-900 border-sky-200"}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-soft">
            <p className="flex items-center gap-2 text-sm font-black text-amber-900">
              <Star className="h-4 w-4" aria-hidden="true" />
              Produto mais vendido
            </p>
            <div className="mt-2 text-2xl font-black text-slate-950">{topProduct?.name ?? "Sem venda"}</div>
            <p className="mt-2 text-sm font-bold text-amber-900">
              {topProduct ? `${topProduct.quantity} vendidos · ${brl(topProduct.total)}` : "Aparece quando houver pedido fechado."}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <p className="text-sm font-black text-slate-600">Ticket médio</p>
            <div className="mt-2 text-4xl font-black text-slate-950">{brl(metrics.averageTicket)}</div>
            <p className="mt-2 text-sm font-bold text-slate-500">Média das contas fechadas no período.</p>
          </article>
        </div>

        <section className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <summary className="cursor-pointer text-lg font-black text-slate-950">Adicionar despesa</summary>
            <form className="mt-4 grid gap-3" onSubmit={submitExpense}>
              <label className="grid gap-1 text-sm font-bold text-slate-700">
                Descrição
                <input
                  className="h-12 rounded-xl border border-slate-200 px-3"
                  value={expense.description}
                  onChange={(event) => setExpense((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Ex: compra de bebidas"
                  required
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Valor
                  <input
                    className="h-12 rounded-xl border border-slate-200 px-3"
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={expense.amount}
                    onChange={(event) => setExpense((current) => ({ ...current, amount: event.target.value }))}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Data
                  <input
                    className="h-12 rounded-xl border border-slate-200 px-3"
                    type="date"
                    value={expense.date}
                    onChange={(event) => setExpense((current) => ({ ...current, date: event.target.value }))}
                    required
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-bold text-slate-700">
                Categoria
                <select
                  className="h-12 rounded-xl border border-slate-200 px-3"
                  value={expense.category}
                  onChange={(event) => setExpense((current) => ({ ...current, category: event.target.value }))}
                >
                  {expenseCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold text-slate-700">
                Forma de pagamento
                <select
                  className="h-12 rounded-xl border border-slate-200 px-3"
                  value={expense.paymentMethod}
                  onChange={(event) => setExpense((current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod | "" }))}
                >
                  <option value="">Não informado</option>
                  {expensePaymentMethods.map((method) => <option key={method} value={method}>{paymentMethodLabel(method)}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold text-slate-700">
                Observação
                <textarea
                  className="min-h-20 rounded-xl border border-slate-200 p-3"
                  value={expense.notes}
                  onChange={(event) => setExpense((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Opcional"
                />
              </label>
              <Button variant="amber" type="submit">Salvar despesa</Button>
            </form>
          </details>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="mb-3 text-lg font-black text-slate-950">Despesas do período</h2>
            <div className="grid gap-2">
              {expenses.length ? expenses.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                  <div>
                    <div className="font-black text-slate-900">{entry.description}</div>
                    <div className="text-xs font-bold text-slate-500">{expenseCategoryLabel(entry.category)} · {new Date(`${entry.date}T12:00:00`).toLocaleDateString("pt-BR")}</div>
                    {entry.notes ? <div className="mt-1 text-xs text-slate-500">{entry.notes}</div> : null}
                  </div>
                  <strong className="shrink-0 text-red-700">-{brl(entry.amount)}</strong>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-400">Nenhuma despesa no período.</div>
              )}
            </div>
          </article>
        </section>

        <div className="grid gap-3 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="mb-3 text-lg font-black text-slate-950">Recebido por forma</h2>
            <div className="grid gap-2">
              {Object.entries(metrics.totalsByMethod).map(([method, total]) => (
                <Signal key={method} label={`${paymentMethodLabel(method as PaymentMethod)} recebido`} value={brl(total)} />
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="mb-3 text-lg font-black text-slate-950">Sinais do período</h2>
            <div className="grid gap-2">
              <Signal label="Vendas do mês" value={brl(metrics.salesMonth)} />
              <Signal label="Cancelamentos" value={`${metrics.cancelledOrders}`} />
              <Signal label="Descontos aplicados" value={brl(metrics.discounts)} />
              <Signal label="Consumo interno" value={brl(metrics.internalConsumption)} />
            </div>
          </article>
        </div>
      </section>
    </RoleGuard>
  );
}

function MoneyCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof PlusCircle; tone: string }) {
  return (
    <article className={`rounded-2xl border p-4 shadow-soft ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black">{label}</p>
          <div className="mt-1 text-3xl font-black">{brl(value)}</div>
        </div>
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
    </article>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm font-bold">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function expenseCategoryLabel(category: string) {
  return expenseCategories.find(([value]) => value === category)?.[1] ?? (category === "sale" ? "Venda" : category);
}
