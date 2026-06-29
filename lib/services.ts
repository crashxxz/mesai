import type {
  AppState,
  AuditLog,
  CashMovementType,
  CashSessionStatus,
  DashboardMetrics,
  FinancialSummary,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PreparationSector,
  Product,
  TableStatus,
  UUID
} from "@/lib/types";
import { dateKey, isSameMonth, uid } from "@/lib/utils";

export type PeriodKey = "today" | "yesterday" | "week" | "month" | "custom";

export interface PeriodFilterValue {
  key: PeriodKey;
  start?: string;
  end?: string;
}

export function getOrderItems(state: AppState, orderId: UUID) {
  return state.orderItems.filter((item) => item.orderId === orderId);
}

export function getOrderPayments(state: AppState, orderId: UUID) {
  return state.payments.filter((payment) => payment.orderId === orderId);
}

export function getPaidTotal(state: AppState, orderId: UUID) {
  return getOrderPayments(state, orderId)
    .filter((payment) => (payment.paymentStatus ?? "paid") === "paid")
    .reduce((sum, payment) => sum + payment.amount, 0);
}

export function getOpenOrderForTable(state: AppState, tableId: UUID) {
  return state.orders.find(
    (order) => order.tableId === tableId && !["closed", "cancelled"].includes(order.status)
  );
}

/** Derives the customer-facing command status from valid items, not stale order rows. */
export function getOrderOverallStatus(order: Order, items: OrderItem[]): OrderStatus {
  if (order.status === "closed") return "closed";
  if (order.status === "cancelled") return "cancelled";
  if (!items.length) return order.status === "open" ? "open" : order.status;

  const validItems = items.filter((item) => item.status !== "cancelled");
  if (!validItems.length) return "cancelled";
  if (validItems.every((item) => item.status === "delivered")) return "delivered";
  const prepItems = validItems.filter((item) => item.preparationSector !== "none");
  if (prepItems.some((item) => item.status === "preparing")) return "preparing";
  if (prepItems.some((item) => item.status === "ready")) return "ready";
  if (prepItems.some((item) => ["sent", "received"].includes(item.status))) return "sent";
  // If all pending items are direct (no prep), show as open
  if (validItems.every((item) => item.status === "pending")) return "open";
  return order.status;
}

export function calculateOrderTotals(state: AppState, order: Order) {
  const subtotal = getOrderItems(state, order.id)
    .filter((item) => item.status !== "cancelled")
    .reduce((sum, item) => {
      const variation = item.variationPriceDelta ?? 0;
      const addons = state.orderItemAddons
        .filter((addon) => addon.orderItemId === item.id)
        .reduce((addonSum, addon) => addonSum + addon.addonPriceSnapshot * addon.quantity, 0);

      return sum + (item.unitPriceSnapshot + variation) * item.quantity + addons;
    }, 0);

  const settings = state.settings.find((setting) => setting.restaurantId === order.restaurantId);
  const serviceFeeEnabled = order.serviceFeeEnabled ?? (settings?.serviceFeePercent ?? 0) > 0;
  const serviceFee = serviceFeeEnabled
    ? Number(((subtotal - order.discount) * ((settings?.serviceFeePercent ?? 0) / 100)).toFixed(2))
    : 0;
  const total = Number(Math.max(0, subtotal - order.discount + serviceFee + order.deliveryFee).toFixed(2));

  return {
    subtotal: Number(subtotal.toFixed(2)),
    serviceFee,
    total
  };
}

export function getPreparationItems(
  state: AppState,
  restaurantId: UUID,
  sector: Exclude<PreparationSector, "none">
) {
  const activeStatuses: OrderItem["status"][] = ["sent", "received", "preparing"];

  return state.orderItems
    .filter(
      (item) =>
        item.restaurantId === restaurantId &&
        itemAppearsInPreparationSector(item, sector) &&
        activeStatuses.includes(item.status)
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function itemAppearsInPreparationSector(
  item: Pick<OrderItem, "preparationSector">,
  sector: Exclude<PreparationSector, "none">
) {
  if (item.preparationSector === "none") return false;
  if (item.preparationSector === sector || item.preparationSector === "both") return true;
  return sector === "kitchen" && item.preparationSector === "bar";
}

export function getKitchenItems(state: AppState, restaurantId: UUID) {
  return getPreparationItems(state, restaurantId, "kitchen");
}

export function getBarItems(state: AppState, restaurantId: UUID) {
  return getPreparationItems(state, restaurantId, "bar");
}

export function getDashboardMetrics(
  state: AppState,
  restaurantId: UUID,
  period: PeriodFilterValue = { key: "today" }
): DashboardMetrics {
  const financialIncome = state.financialEntries.filter((entry) => entry.restaurantId === restaurantId && entry.type === "income" && entry.paid && inPeriod(`${entry.date}T12:00:00`, period));
  const paidOrderIds = new Set(financialIncome.flatMap((entry) => entry.orderId ? [entry.orderId] : []));
  const payments = state.payments.filter((payment) => payment.restaurantId === restaurantId && inPeriod(payment.createdAt, period) && paidOrderIds.has(payment.orderId));
  const orders = state.orders.filter(
    (order) => order.restaurantId === restaurantId && inPeriod(order.createdAt, period)
  );
  const closedOrders = orders.filter((order) => order.status === "closed" && paidOrderIds.has(order.id));
  const today = dateKey(new Date());
  const monthSales = state.financialEntries
    .filter((entry) => entry.restaurantId === restaurantId && entry.type === "income" && entry.paid && isSameMonth(`${entry.date}T12:00:00`))
    .reduce((sum, entry) => sum + entry.amount, 0);

  const totalsByMethod: Record<PaymentMethod, number> = {
    pix: 0,
    cash: 0,
    credit_card: 0,
    debit_card: 0,
    voucher: 0,
    internal_consumption: 0
  };

  for (const payment of payments) {
    totalsByMethod[payment.method] += payment.amount;
  }

  const orderIds = new Set(closedOrders.map((order) => order.id));
  const topMap = new Map<string, { name: string; quantity: number; total: number }>();
  const categoryMap = new Map<string, { name: string; quantity: number; total: number }>();

  for (const item of state.orderItems) {
    if (!orderIds.has(item.orderId) || item.status === "cancelled") continue;
    const current = topMap.get(item.productId) ?? { name: item.productNameSnapshot, quantity: 0, total: 0 };
    current.quantity += item.quantity;
    current.total += item.unitPriceSnapshot * item.quantity;
    topMap.set(item.productId, current);

    const product = state.products.find((p) => p.id === item.productId);
    const category = product ? state.categories.find((c) => c.id === product.categoryId) : undefined;
    const catName = category?.name ?? "Outros";
    const catCurrent = categoryMap.get(catName) ?? { name: catName, quantity: 0, total: 0 };
    catCurrent.quantity += item.quantity;
    catCurrent.total += item.unitPriceSnapshot * item.quantity;
    categoryMap.set(catName, catCurrent);
  }

  const sales = financialIncome.reduce((sum, entry) => sum + entry.amount, 0);
  const todaySales = state.financialEntries
    .filter((entry) => entry.restaurantId === restaurantId && entry.type === "income" && entry.paid && dateKey(`${entry.date}T12:00:00`) === today)
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    salesToday: todaySales,
    salesMonth: monthSales,
    openOrders: state.orders.filter(
      (order) => order.restaurantId === restaurantId && !["closed", "cancelled"].includes(order.status)
    ).length,
    occupiedTables: state.tables.filter(
      (table) => table.restaurantId === restaurantId && table.status === "occupied"
    ).length,
    averageTicket: closedOrders.length ? sales / closedOrders.length : 0,
    totalsByMethod,
    topProducts: Array.from(topMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5),
    topCategories: Array.from(categoryMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    cancelledOrders: orders.filter((order) => order.status === "cancelled").length,
    discounts: orders.reduce((sum, order) => sum + order.discount, 0),
    internalConsumption: totalsByMethod.internal_consumption,
    orderCount: orders.length
  };
}

export function getFinancialSummary(
  state: AppState,
  restaurantId: UUID,
  period: PeriodFilterValue = { key: "today" }
): FinancialSummary {
  const entries = state.financialEntries
    .filter(
      (entry) =>
        entry.restaurantId === restaurantId &&
        entry.paid &&
        inPeriod(`${entry.date}T12:00:00`, period)
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const income = entries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expenses = entries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    income: Number(income.toFixed(2)),
    expenses: Number(expenses.toFixed(2)),
    result: Number((income - expenses).toFixed(2)),
    entries
  };
}

export function getStockStatus(product: Product) {
  const quantity = product.stockQuantity ?? 0;
  const minimum = product.stockMinimum ?? 0;
  if (quantity <= 0) return "empty" as const;
  if (quantity <= minimum) return "low" as const;
  return "ok" as const;
}

export function stockStatusLabel(status: ReturnType<typeof getStockStatus>) {
  return status === "empty" ? "Zerado" : status === "low" ? "Baixo" : "Em dia";
}

export function createAuditLog(
  state: AppState,
  action: string,
  entity: string,
  entityId: UUID,
  oldData?: unknown,
  newData?: unknown
): AuditLog {
  const profile = state.profiles.find((item) => item.id === state.currentProfileId);
  const restaurantId = profile?.restaurantId ?? state.restaurants[0]?.id ?? "restaurant";

  return {
    id: uid("audit"),
    restaurantId,
    userId: profile?.id,
    action,
    entity,
    entityId,
    oldData,
    newData,
    createdAt: new Date().toISOString()
  };
}

export function paymentMethodLabel(method: PaymentMethod) {
  const labels: Record<PaymentMethod, string> = {
    pix: "Pix",
    cash: "Dinheiro",
    credit_card: "Cartão crédito",
    debit_card: "Cartão débito",
    voucher: "Vale",
    internal_consumption: "Consumo interno"
  };
  return labels[method];
}

export function orderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    open: "Aberto",
    sent: "Enviado para preparo",
    preparing: "Em preparo",
    ready: "Pronto para entrega",
    delivered: "Entregue",
    closed: "Comanda fechada",
    cancelled: "Cancelado"
  };
  return labels[status];
}

export function orderItemStatusLabel(status: OrderItem["status"], preparationSector?: string) {
  if (status === "pending" && preparationSector === "none") return "Aguardando entrega";
  const labels: Record<OrderItem["status"], string> = {
    pending: "Aguardando envio",
    sent: "Enviado",
    received: "Recebido",
    preparing: "Preparando",
    ready: "Pronto",
    delivered: "Entregue",
    cancelled: "Cancelado"
  };
  return labels[status];
}

export function tableStatusLabel(status: TableStatus) {
  const labels: Record<TableStatus, string> = {
    free: "Livre",
    occupied: "Ocupada",
    closing: "Fechando conta",
    reserved: "Reservada"
  };
  return labels[status];
}

export function cashSessionStatusLabel(status: CashSessionStatus) {
  const labels: Record<CashSessionStatus, string> = {
    open: "Aberto",
    closed: "Fechado"
  };
  return labels[status];
}

export function cashMovementTypeLabel(type: CashMovementType) {
  const labels: Record<CashMovementType, string> = {
    sale: "Venda",
    withdrawal: "Sangria",
    supply: "Suprimento",
    adjustment: "Ajuste"
  };
  return labels[type];
}

export function sectorLabel(sector: PreparationSector) {
  const labels: Record<PreparationSector, string> = {
    kitchen: "Cozinha",
    bar: "Bar",
    both: "Cozinha e bar",
    none: "Não prepara"
  };
  return labels[sector];
}

function inPeriod(date: string, period: PeriodFilterValue) {
  const value = new Date(date);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (period.key === "today") return value >= startOfToday;
  if (period.key === "yesterday") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 1);
    return value >= start && value < startOfToday;
  }
  if (period.key === "week") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 7);
    return value >= start;
  }
  if (period.key === "month") return isSameMonth(value);
  if (period.key === "custom" && period.start && period.end) {
    return value >= new Date(period.start) && value <= new Date(`${period.end}T23:59:59`);
  }

  return true;
}
