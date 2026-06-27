"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { PaymentForm } from "@/components/payment-form";
import { ReasonDialog } from "@/components/reason-dialog";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { canCloseAccount } from "@/lib/permissions";
import { getOrderItems } from "@/lib/services";
import { useStore } from "@/lib/store";

export default function CheckoutPage() {
  const params = useParams<{ orderId: string }>();
  const {
    state,
    profile,
    restaurant,
    settings,
    updateOrderDiscount,
    setOrderServiceFeeEnabled,
    registerPayment,
    closeOrder,
    reopenOrder
  } = useStore();
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const order = state.orders.find((item) => item.id === params.orderId);
  const table = state.tables.find((item) => item.id === order?.tableId);
  const items = order ? getOrderItems(state, order.id) : [];
  const payments = state.payments.filter((payment) => payment.orderId === order?.id);
  const cashOpen = profile?.role === "waiter" || state.cashSessions.some((s) => s.restaurantId === restaurant?.id && s.status === "open");

  if (!order) {
    return <div className="rounded-lg bg-white p-5 font-black text-slate-700">Pedido não encontrado</div>;
  }

  if (!canCloseAccount(profile, settings?.waiterCanCloseAccount ?? true)) {
    return (
      <RoleGuard allowed={["owner", "manager", "waiter", "cashier"]}>
        <div className="rounded-lg border border-slate-200 bg-white p-5 font-black text-slate-700 shadow-soft">
          Fechamento bloqueado
        </div>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowed={["owner", "manager", "waiter", "cashier"]}>
      <section className="mx-auto grid max-w-3xl gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-slate-950">Fechamento</h1>
            <p className="text-sm font-bold text-slate-500">{table?.name ?? order.customerName ?? "Comanda"}</p>
            <p className="mt-1 text-sm font-bold text-amber-700">Confira o total antes de fechar a conta.</p>
          </div>
          <Button asChild variant="outline">
            <Link href={table ? `/app/tables/${table.id}` : `/app/orders/${order.id}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar
            </Link>
          </Button>
        </div>
        <PaymentForm
          order={order}
          items={items}
          payments={payments}
          accountName={table?.name ?? order.customerName ?? "Comanda"}
          cashOpen={cashOpen}
          onDiscount={(value) => updateOrderDiscount(order.id, value)}
          onSetServiceFeeEnabled={(enabled) => void setOrderServiceFeeEnabled(order.id, enabled)}
          pix={{ key: settings?.pixKey, recipient: settings?.pixRecipientName ?? restaurant?.name, city: settings?.pixCity ?? restaurant?.city, provider: settings?.pixProvider, providerEnvironment: settings?.pixProviderEnvironment }}
          onPay={(input) => registerPayment(order.id, input)}
          onClose={() => closeOrder(order.id)}
          onReopen={() => setReopenDialogOpen(true)}
        />
        <ReasonDialog
          open={reopenDialogOpen}
          title="Reabrir conta"
          confirmLabel="Reabrir"
          onCancel={() => setReopenDialogOpen(false)}
          onConfirm={(reason) => {
            reopenOrder(order.id, reason);
            setReopenDialogOpen(false);
          }}
        />
      </section>
    </RoleGuard>
  );
}
