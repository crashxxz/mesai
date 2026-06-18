export type UUID = string;

export type UserRole = "owner" | "waiter" | "kitchen" | "bar";
export type TableStatus = "free" | "occupied" | "closing" | "reserved";
export type TabStatus = "open" | "closed" | "cancelled";
export type PreparationSector = "kitchen" | "bar" | "none";
export type OrderSource = "waiter" | "qr_code" | "counter" | "delivery" | "takeaway";
export type OrderStatus =
  | "open"
  | "sent"
  | "preparing"
  | "ready"
  | "delivered"
  | "closed"
  | "cancelled";
export type OrderItemStatus =
  | "pending"
  | "sent"
  | "received"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";
export type PaymentMethod =
  | "pix"
  | "cash"
  | "credit_card"
  | "debit_card"
  | "voucher"
  | "internal_consumption";
export type CashSessionStatus = "open" | "closed";
export type CashMovementType = "sale" | "withdrawal" | "supply" | "adjustment";
export type FinancialEntryType = "income" | "expense";
export type TableAlertType = "waiter_call" | "bill_request";
export type StockUnit = "unidade" | "lata" | "garrafa" | "kg" | "litro" | "porcao";
export type StockMovementType = "entry" | "exit" | "adjustment";

export interface Restaurant {
  id: UUID;
  name: string;
  slug: string;
  logoUrl?: string;
  city?: string;
  phone?: string;
  whatsappUrl?: string;
  mapsUrl?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantSettings {
  restaurantId: UUID;
  qrOrdersEnabled: boolean;
  qrOrdersNeedApproval: boolean;
  waiterCanCloseAccount: boolean;
  serviceFeePercent: number;
}

export interface Profile {
  id: UUID;
  userId: UUID;
  restaurantId: UUID;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantTable {
  id: UUID;
  restaurantId: UUID;
  number: number;
  name?: string;
  status: TableStatus;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TableAlert {
  id: UUID;
  restaurantId: UUID;
  tableId: UUID;
  type: TableAlertType;
  active: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface Tab {
  id: UUID;
  restaurantId: UUID;
  tableId?: UUID;
  customerName?: string;
  status: TabStatus;
  openedBy: UUID;
  closedBy?: UUID;
  openedAt: string;
  closedAt?: string;
}

export interface Category {
  id: UUID;
  restaurantId: UUID;
  name: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: UUID;
  restaurantId: UUID;
  categoryId: UUID;
  name: string;
  description?: string;
  price: number;
  preparationSector: PreparationSector;
  estimatedTimeMinutes?: number;
  available: boolean;
  hasStockControl: boolean;
  stockQuantity?: number;
  stockMinimum?: number;
  stockUnit?: StockUnit;
  imageUrl?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariation {
  id: UUID;
  productId: UUID;
  name: string;
  priceDelta: number;
  active: boolean;
}

export interface ProductAddon {
  id: UUID;
  restaurantId: UUID;
  name: string;
  price: number;
  active: boolean;
}

export interface ProductAllowedAddon {
  id: UUID;
  productId: UUID;
  addonId: UUID;
}

export interface Order {
  id: UUID;
  restaurantId: UUID;
  tableId?: UUID;
  tabId?: UUID;
  customerName?: string;
  source: OrderSource;
  status: OrderStatus;
  createdBy?: UUID;
  closedBy?: UUID;
  subtotal: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  total: number;
  notes?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface OrderItem {
  id: UUID;
  orderId: UUID;
  restaurantId: UUID;
  productId: UUID;
  productNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  variationName?: string;
  variationPriceDelta?: number;
  notes?: string;
  preparationSector: PreparationSector;
  status: OrderItemStatus;
  cancelReason?: string;
  createdBy?: UUID;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  preparingAt?: string;
  readyAt?: string;
  deliveredAt?: string;
}

export interface OrderItemAddon {
  id: UUID;
  orderItemId: UUID;
  addonNameSnapshot: string;
  addonPriceSnapshot: number;
  quantity: number;
}

export interface Payment {
  id: UUID;
  restaurantId: UUID;
  orderId: UUID;
  method: PaymentMethod;
  amount: number;
  cardBrand?: string;
  changeAmount?: number;
  createdBy?: UUID;
  createdAt: string;
}

export interface CashSession {
  id: UUID;
  restaurantId: UUID;
  openedBy: UUID;
  closedBy?: UUID;
  openingAmount: number;
  expectedAmount: number;
  countedAmount?: number;
  differenceAmount?: number;
  status: CashSessionStatus;
  openedAt: string;
  closedAt?: string;
}

export interface CashMovement {
  id: UUID;
  restaurantId: UUID;
  cashSessionId: UUID;
  type: CashMovementType;
  amount: number;
  description: string;
  createdBy?: UUID;
  createdAt: string;
}

export interface FinancialEntry {
  id: UUID;
  restaurantId: UUID;
  type: FinancialEntryType;
  category: string;
  description: string;
  amount: number;
  date: string;
  paid: boolean;
  paymentMethod?: PaymentMethod;
  notes?: string;
  orderId?: UUID;
  createdBy?: UUID;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: UUID;
  restaurantId: UUID;
  name: string;
  phone?: string;
  cpf?: string;
  address?: string;
  notes?: string;
  creditLimit?: number;
  active: boolean;
}

export interface CustomerDebt {
  id: UUID;
  restaurantId: UUID;
  customerId: UUID;
  orderId?: UUID;
  amount: number;
  paidAmount: number;
  dueDate?: string;
  status: "open" | "partially_paid" | "paid" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: UUID;
  restaurantId: UUID;
  userId?: UUID;
  action: string;
  entity: string;
  entityId: UUID;
  oldData?: unknown;
  newData?: unknown;
  createdAt: string;
}

export interface StockMovement {
  id: UUID;
  restaurantId: UUID;
  productId: UUID;
  type: StockMovementType;
  quantity: number;
  reason: string;
  createdBy?: UUID;
  createdAt: string;
}

export interface DemoCredential {
  email: string;
  password: string;
  profileId: UUID;
}

export interface AppState {
  restaurants: Restaurant[];
  settings: RestaurantSettings[];
  profiles: Profile[];
  tables: RestaurantTable[];
  tableAlerts: TableAlert[];
  tabs: Tab[];
  categories: Category[];
  products: Product[];
  productVariations: ProductVariation[];
  productAddons: ProductAddon[];
  productAllowedAddons: ProductAllowedAddon[];
  orders: Order[];
  orderItems: OrderItem[];
  orderItemAddons: OrderItemAddon[];
  payments: Payment[];
  cashSessions: CashSession[];
  cashMovements: CashMovement[];
  financialEntries: FinancialEntry[];
  stockMovements: StockMovement[];
  customers: Customer[];
  customerDebts: CustomerDebt[];
  auditLogs: AuditLog[];
  credentials: DemoCredential[];
  currentProfileId?: UUID;
}

export interface DashboardMetrics {
  salesToday: number;
  salesMonth: number;
  openOrders: number;
  occupiedTables: number;
  averageTicket: number;
  totalsByMethod: Record<PaymentMethod, number>;
  topProducts: Array<{ name: string; quantity: number; total: number }>;
  cancelledOrders: number;
  discounts: number;
  internalConsumption: number;
  orderCount: number;
}

export interface FinancialSummary {
  income: number;
  expenses: number;
  result: number;
  entries: FinancialEntry[];
}
