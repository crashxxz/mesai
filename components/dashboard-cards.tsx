import {
  Ban,
  Banknote,
  CreditCard,
  PackageCheck,
  ReceiptText,
  Table2,
  TrendingUp,
  Wallet
} from "lucide-react";
import type { DashboardMetrics } from "@/lib/types";
import { brl } from "@/lib/utils";

export function DashboardCards({ metrics }: { metrics: DashboardMetrics }) {
  const cards = [
    { label: "Entrou no caixa", value: brl(metrics.salesToday), icon: TrendingUp, bg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { label: "Pedidos abertos", value: metrics.openOrders, icon: ReceiptText, bg: "bg-sky-50", iconColor: "text-sky-600" },
    { label: "Mesas em atendimento", value: metrics.occupiedTables, icon: Table2, bg: "bg-amber-50", iconColor: "text-amber-600" },
    { label: "Ticket médio", value: brl(metrics.averageTicket), icon: Wallet, bg: "bg-slate-50", iconColor: "text-slate-600" },
    { label: "Pix recebido", value: brl(metrics.totalsByMethod.pix), icon: PackageCheck, bg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { label: "Dinheiro recebido", value: brl(metrics.totalsByMethod.cash), icon: Banknote, bg: "bg-green-50", iconColor: "text-green-600" },
    { label: "Cartão crédito", value: brl(metrics.totalsByMethod.credit_card), icon: CreditCard, bg: "bg-indigo-50", iconColor: "text-indigo-600" },
    { label: "Cartão débito", value: brl(metrics.totalsByMethod.debit_card), icon: CreditCard, bg: "bg-cyan-50", iconColor: "text-cyan-600" },
    { label: "Cancelamentos", value: metrics.cancelledOrders, icon: Ban, bg: "bg-red-50", iconColor: "text-red-500" }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article key={card.label} className="metric-card card-lift rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className={`mb-3 inline-flex rounded-xl p-2 ${card.bg}`}>
              <Icon className={`h-4 w-4 ${card.iconColor}`} aria-hidden="true" />
            </div>
            <div className="text-2xl font-black text-slate-950">{card.value}</div>
            <span className="mt-1 text-xs font-semibold text-slate-500">{card.label}</span>
          </article>
        );
      })}
    </div>
  );
}
