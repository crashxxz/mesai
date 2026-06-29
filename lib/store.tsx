"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { createMaricotaCatalog, createSeedState } from "@/lib/seed";
import { emitDemoRealtime } from "@/lib/realtime";
import { runtimeConfig } from "@/lib/runtime-config";
import { createLocalStorageAdapter } from "@/lib/storage-adapter";
import { supabase } from "@/lib/supabase";
import { supabaseGateway, type WorkspaceBootstrap } from "@/lib/supabase-gateway";
import { resolveProductImage } from "@/lib/product-image";
import {
  calculateOrderTotals,
  createAuditLog,
  getOpenOrderForTable,
  getPaidTotal
} from "@/lib/services";
import type {
  AppState,
  CashMovement,
  CashSession,
  Category,
  FinancialEntry,
  Order,
  OrderItem,
  OrderItemAddon,
  OrderItemStatus,
  OrderSource,
  Payment,
  PaymentMethod,
  Product,
  Profile,
  Restaurant,
  RestaurantSettings,
  RestaurantTable,
  TableAlert,
  TableAlertType,
  StockMovement,
  UUID
} from "@/lib/types";
import { uid } from "@/lib/utils";

const storageKey = "mesai-demo-v2";
const storageAdapter = createLocalStorageAdapter<AppState>(storageKey);

interface AddOrderItemInput {
  quantity: number;
  notes?: string;
  variationId?: UUID;
  addonIds?: UUID[];
}

interface RegisterPaymentInput {
  method: PaymentMethod;
  amount: number;
  cardBrand?: string;
  changeAmount?: number;
}

interface CartItemInput extends AddOrderItemInput {
  productId: UUID;
}

interface CreateExpenseInput {
  description: string;
  amount: number;
  category: string;
  date: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

interface StoreContextValue {
  state: AppState;
  hydrated: boolean;
  profile?: Profile;
  restaurant?: Restaurant;
  settings?: RestaurantSettings;
  login: (email: string, password: string) => Promise<Profile | undefined>;
  logout: () => void;
  resetDemo: () => void;
  reloadMaricotaCatalog: () => void;
  createOrder: (tableId?: UUID, source?: OrderSource, customerName?: string, notes?: string) => UUID;
  createQrOrder: (tableId: UUID, customerName: string | undefined, items: CartItemInput[]) => UUID | undefined;
  ensureOpenOrderForTable: (tableId: UUID) => Promise<UUID>;
  addOrderItem: (orderId: UUID, productId: UUID, input: AddOrderItemInput) => Promise<UUID | undefined>;
  sendItemsToPreparation: (orderId: UUID) => Promise<void>;
  updateOrderItemStatus: (itemId: UUID, status: OrderItemStatus) => Promise<void>;
  rejectOrderItem: (itemId: UUID, reason: string) => Promise<void>;
  cancelOrderItem: (itemId: UUID, reason: string) => Promise<void>;
  cancelOrder: (orderId: UUID, reason: string) => Promise<void>;
  updateOrderDiscount: (orderId: UUID, discount: number) => void;
  applyOrderServiceFee: (orderId: UUID) => Promise<void>;
  setOrderServiceFeeEnabled: (orderId: UUID, enabled: boolean) => Promise<void>;
  transferOrderTable: (orderId: UUID, newTableId: UUID) => void;
  mergeOrders: (sourceOrderId: UUID, targetOrderId: UUID) => void;
  closeOrder: (orderId: UUID) => Promise<void>;
  closeTable: (tableId: UUID) => Promise<void>;
  resetTestTable: (tableId: UUID) => Promise<void>;
  reopenOrder: (orderId: UUID, reason: string) => void;
  registerPayment: (orderId: UUID, input: RegisterPaymentInput) => Promise<void>;
  createExpense: (input: CreateExpenseInput) => void;
  cancelFinancialEntry: (entryId: UUID, reason: string) => Promise<void>;
  cancelSale: (orderId: UUID, reason: string) => Promise<void>;
  createCategory: (name: string) => void;
  createProduct: (input: Partial<Product> & Pick<Product, "name" | "categoryId" | "price" | "preparationSector">) => void;
  updateProduct: (productId: UUID, patch: Partial<Product>) => void;
  removeProduct: (productId: UUID) => Promise<"deleted" | "inactivated">;
  recordStockMovement: (productId: UUID, type: "entry" | "exit", quantity: number, reason: string) => Promise<void>;
  updateTable: (tableId: UUID, patch: Partial<RestaurantTable>) => void;
  requestTableService: (tableId: UUID, type: TableAlertType) => void;
  resolveTableAlerts: (tableId: UUID, type?: TableAlertType) => void;
  createTable: () => void;
  updateRestaurant: (patch: Partial<Restaurant>) => void;
  updateSettings: (patch: Partial<RestaurantSettings>) => void;
  createProfile: (name: string, username: string, email: string, password: string, roles: Profile["role"][], active: boolean) => void;
  openCashSession: (openingAmount: number) => UUID;
  addCashMovement: (type: "withdrawal" | "supply" | "adjustment", amount: number, description: string) => void;
  closeCashSession: (countedAmount: number) => void;
  updateProfile: (profileId: UUID, patch: Partial<Profile>) => void;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => runtimeConfig.dataMode === "supabase" ? createSupabaseState() : loadState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      let next = runtimeConfig.dataMode === "supabase" ? createSupabaseState() : loadState();
      if (runtimeConfig.dataMode === "supabase") {
        try {
          const session = await supabase?.auth.getSession();
          if (session?.data.session) next = mergeWorkspace(next, await supabaseGateway.loadWorkspace());
          else next = { ...next, currentProfileId: undefined };
        } catch {
          next = { ...next, currentProfileId: undefined };
        }
      }
      if (mounted) {
        setState(next);
        setHydrated(true);
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && hydrated) {
      storageAdapter.save(state);
    }
  }, [hydrated, state]);

  useEffect(() => {
    if (runtimeConfig.dataMode !== "supabase" || !hydrated || !state.currentProfileId) return;
    let mounted = true;
    const timer = window.setInterval(() => {
      void supabaseGateway.loadWorkspace().then((workspace) => {
        if (mounted) setState((current) => mergeWorkspace(current, workspace));
      }).catch(() => undefined);
    }, 15000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [hydrated, state.currentProfileId]);

  const profile = state.profiles.find((item) => item.id === state.currentProfileId);
  const restaurant = state.restaurants.find((item) => item.id === profile?.restaurantId) ?? state.restaurants[0];
  const settings = state.settings.find((item) => item.restaurantId === restaurant?.id);

  const value = useMemo<StoreContextValue>(() => {
    function commit(next: AppState, topic = "state") {
      setState(next);
      emitDemoRealtime(topic);
    }

    function withTotals(next: AppState, orderId: UUID) {
      const order = next.orders.find((item) => item.id === orderId);
      if (!order) return next;
      const totals = calculateOrderTotals(next, order);
      return {
        ...next,
        orders: next.orders.map((item) =>
          item.id === orderId
            ? {
                ...item,
                subtotal: totals.subtotal,
                serviceFee: totals.serviceFee,
                total: totals.total,
                updatedAt: new Date().toISOString()
              }
            : item
        )
      };
    }

    function currentProfile(next = state) {
      return next.profiles.find((item) => item.id === next.currentProfileId) ?? next.profiles[0];
    }

    function createOrderAction(tableId?: UUID, source: OrderSource = "waiter", customerName?: string, notes?: string) {
      const now = new Date().toISOString();
      const activeProfile = source === "qr_code" ? undefined : currentProfile();
      const orderId = uid("order");
      const tabId = uid("tab");
      const table = state.tables.find((item) => item.id === tableId);
      const restaurantId = table?.restaurantId ?? activeProfile?.restaurantId ?? restaurant?.id ?? state.restaurants[0].id;
      let next: AppState = {
        ...state,
        tabs: [
          ...state.tabs,
          {
            id: tabId,
            restaurantId,
            tableId,
            customerName,
            status: "open",
            openedBy: activeProfile?.id ?? "public_qr",
            openedAt: now
          }
        ],
        orders: [
          ...state.orders,
          {
            id: orderId,
            restaurantId,
            tableId,
            tabId,
            customerName,
            source,
            status: "open",
            createdBy: activeProfile?.id,
            subtotal: 0,
            discount: 0,
            serviceFee: 0,
            deliveryFee: 0,
            total: 0,
            notes,
            createdAt: now,
            updatedAt: now
          }
        ],
        tables: state.tables.map((table) =>
          table.id === tableId ? { ...table, status: "occupied", updatedAt: now } : table
        )
      };
      next = {
        ...next,
        auditLogs: [...next.auditLogs, createAuditLog(next, "order_created", "orders", orderId)]
      };
      commit(next, "order");
      return orderId;
    }

    return {
      state,
      hydrated,
      profile,
      restaurant,
      settings,
      async login(email, password) {
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.signIn(email, password);
          const workspace = await supabaseGateway.loadWorkspace();
          commit(mergeWorkspace(state, workspace), "auth");
          return workspace.profile;
        }
        const normalized = email.trim().toLowerCase();
        const credential = state.credentials.find(
          (item) => (item.email === normalized || item.username === normalized) && item.password === password
        );
        const nextProfile = state.profiles.find((item) => item.id === credential?.profileId && item.active);
        if (!credential || !nextProfile) return undefined;
        commit({ ...state, currentProfileId: credential.profileId }, "auth");
        return nextProfile;
      },
      logout() {
        if (runtimeConfig.dataMode === "supabase") void supabaseGateway.signOut().catch(() => undefined);
        commit({ ...state, currentProfileId: undefined }, "auth");
      },
      resetDemo() {
        commit(createSeedState(), "reset");
      },
      reloadMaricotaCatalog() {
        commit({ ...state, ...createMaricotaCatalog() }, "catalog");
      },
      createOrder: createOrderAction,
      createQrOrder(tableId, customerName, items) {
        if (!items.length) return undefined;
        const now = new Date().toISOString();
        const orderId = uid("order");
        const tabId = uid("tab");
        const table = state.tables.find((item) => item.id === tableId);
        const restaurantId = table?.restaurantId ?? restaurant?.id ?? state.restaurants[0].id;
        const qrNeedApproval =
          state.settings.find((setting) => setting.restaurantId === restaurantId)?.qrOrdersNeedApproval ?? false;
        const orderItems: OrderItem[] = [];
        const orderAddons: OrderItemAddon[] = [];

        for (const cartItem of items) {
          const product = state.products.find((item) => item.id === cartItem.productId && item.active && item.available);
          if (!product) continue;
          const itemId = uid("item");
          const variation = state.productVariations.find((item) => item.id === cartItem.variationId);
          const effectiveSector = product.preparationRequired === false ? "none" : product.preparationSector;
          orderItems.push({
            id: itemId,
            orderId,
            restaurantId,
            productId: product.id,
            productNameSnapshot: product.name,
            unitPriceSnapshot: product.price,
            quantity: Math.max(1, cartItem.quantity),
            variationName: variation?.name,
            variationPriceDelta: variation?.priceDelta,
            notes: cartItem.notes,
            preparationSector: effectiveSector,
            status: qrNeedApproval ? "pending" : effectiveSector === "none" ? "delivered" : "sent",
            createdAt: now,
            updatedAt: now,
            sentAt: qrNeedApproval ? undefined : now,
            deliveredAt: !qrNeedApproval && effectiveSector === "none" ? now : undefined
          });
          for (const addonId of cartItem.addonIds ?? []) {
            const addon = state.productAddons.find((item) => item.id === addonId && item.active);
            if (!addon) continue;
            orderAddons.push({
              id: uid("item_addon"),
              orderItemId: itemId,
              addonNameSnapshot: addon.name,
              addonPriceSnapshot: addon.price,
              quantity: 1
            });
          }
        }

        if (!orderItems.length) return undefined;
        let next: AppState = {
          ...state,
          tabs: [
            ...state.tabs,
            {
              id: tabId,
              restaurantId,
              tableId,
              customerName,
              status: "open",
              openedBy: "public_qr",
              openedAt: now
            }
          ],
          orders: [
            ...state.orders,
            {
              id: orderId,
              restaurantId,
              tableId,
              tabId,
              customerName,
              source: "qr_code",
              status: qrNeedApproval ? "open" : "sent",
              subtotal: 0,
              discount: 0,
              serviceFee: 0,
              deliveryFee: 0,
              total: 0,
              createdAt: now,
              updatedAt: now
            }
          ],
          orderItems: [...state.orderItems, ...orderItems],
          orderItemAddons: [...state.orderItemAddons, ...orderAddons],
          tables: state.tables.map((table) =>
            table.id === tableId ? { ...table, status: "occupied", updatedAt: now } : table
          )
        };
        next = withTotals(next, orderId);
        next = {
          ...next,
          auditLogs: [...next.auditLogs, createAuditLog(next, "qr_order_created", "orders", orderId)]
        };
        commit(next, "preparation");
        return orderId;
      },
      async ensureOpenOrderForTable(tableId) {
        if (runtimeConfig.dataMode === "supabase") {
          const orderId = await supabaseGateway.ensureOpenTableOrder(tableId);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return orderId;
        }
        const existing = getOpenOrderForTable(state, tableId);
        if (existing) return existing.id;
        return createOrderAction(tableId, "waiter");
      },
      async addOrderItem(orderId, productId, input) {
        if (runtimeConfig.dataMode === "supabase") {
          const optimisticId = `pending_${crypto.randomUUID()}`;
          const now = new Date().toISOString();
          setState((current) => {
            const order = current.orders.find((item) => item.id === orderId);
            const product = current.products.find((item) => item.id === productId && item.active && item.available);
            if (!order || !product) return current;
            const variation = current.productVariations.find((item) => item.id === input.variationId && item.productId === productId);
            const next: AppState = {
              ...current,
              orderItems: [...current.orderItems, {
                id: optimisticId,
                orderId,
                restaurantId: order.restaurantId,
                productId: product.id,
                productNameSnapshot: product.name,
                unitPriceSnapshot: product.price,
                quantity: Math.max(1, input.quantity),
                variationName: variation?.name,
                variationPriceDelta: variation?.priceDelta,
                notes: input.notes,
                preparationSector: product.preparationSector,
                status: "pending",
                createdBy: profile?.id,
                createdAt: now,
                updatedAt: now
              }]
            };
            return withTotals(next, orderId);
          });
          try {
            const itemId = await supabaseGateway.addOrderItem(orderId, productId, input.quantity, input.notes);
            try {
              const workspace = await supabaseGateway.loadWorkspace();
              setState((current) => mergeWorkspace(current, workspace));
            } catch {
              setState((current) => ({
                ...current,
                orderItems: current.orderItems.map((item) => item.id === optimisticId ? { ...item, id: itemId } : item)
              }));
            }
            return itemId;
          } catch (error) {
            setState((current) => withTotals({ ...current, orderItems: current.orderItems.filter((item) => item.id !== optimisticId) }, orderId));
            throw error;
          }
        }
        const product = state.products.find((item) => item.id === productId && item.active && item.available);
        const order = state.orders.find((item) => item.id === orderId);
        if (!product || !order) return undefined;

        const now = new Date().toISOString();
        const variation = state.productVariations.find((item) => item.id === input.variationId);
        const itemId = uid("item");
        const addons = (input.addonIds ?? [])
          .map((addonId): OrderItemAddon | undefined => {
            const addon = state.productAddons.find((item) => item.id === addonId && item.active);
            if (!addon) return undefined;
            return {
              id: uid("item_addon"),
              orderItemId: itemId,
              addonNameSnapshot: addon.name,
              addonPriceSnapshot: addon.price,
              quantity: 1
            };
          })
          .filter(Boolean) as OrderItemAddon[];

        const item: OrderItem = {
          id: itemId,
          orderId,
          restaurantId: order.restaurantId,
          productId: product.id,
          productNameSnapshot: product.name,
          unitPriceSnapshot: product.price,
          quantity: Math.max(1, input.quantity),
          variationName: variation?.name,
          variationPriceDelta: variation?.priceDelta,
          notes: input.notes,
          preparationSector: product.preparationRequired === false ? "none" : product.preparationSector,
          status: "pending",
          createdBy: profile?.id,
          createdAt: now,
          updatedAt: now
        };

        let next: AppState = {
          ...state,
          orderItems: [...state.orderItems, item],
          orderItemAddons: [...state.orderItemAddons, ...addons],
        };
        next = withTotals(next, orderId);
        next = {
          ...next,
          auditLogs: [...next.auditLogs, createAuditLog(next, "order_item_added", "order_items", itemId)]
        };
        commit(next, "order_item");
        return itemId;
      },
      async sendItemsToPreparation(orderId) {
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.sendOrderItems(orderId);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        const now = new Date().toISOString();
        let hasPrepItem = false;
        const nextItems = state.orderItems.map((item) => {
          if (item.orderId !== orderId || item.status !== "pending") return item;
          // Items without prep stay pending (waiter delivers manually)
          if (item.preparationSector === "none") return item;
          hasPrepItem = true;
          return {
            ...item,
            status: "sent" as const,
            sentAt: now,
            updatedAt: now
          };
        });
        if (!hasPrepItem) return; // Nothing to send
        let next: AppState = {
          ...state,
          orderItems: nextItems,
          orders: state.orders.map((order) =>
            order.id === orderId
              ? { ...order, status: "sent", updatedAt: now }
              : order
          )
        };
        next = {
          ...next,
          auditLogs: [...next.auditLogs, createAuditLog(next, "items_sent_to_preparation", "orders", orderId)]
        };
        commit(next, "preparation");
      },
      async updateOrderItemStatus(itemId, status) {
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.updatePreparationStatus(itemId, status);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        const now = new Date().toISOString();
        const oldItem = state.orderItems.find((item) => item.id === itemId);
        if (!oldItem) return;

        const nextItems = state.orderItems.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status,
                updatedAt: now,
                preparingAt: status === "preparing" ? now : item.preparingAt,
                readyAt: status === "ready" ? now : item.readyAt,
                deliveredAt: status === "delivered" ? now : item.deliveredAt
              }
            : item
        );
        const orderItems = nextItems.filter((item) => item.orderId === oldItem.orderId && item.status !== "cancelled");
        const orderStatus = orderItems.length > 0 && orderItems.every((item) => item.status === "delivered")
          ? "delivered"
          : orderItems.some((item) => item.status === "preparing")
            ? "preparing"
            : orderItems.length > 0 && orderItems.every((item) => item.status === "ready" || item.status === "delivered")
              ? "ready"
              : "sent";

        let next: AppState = {
          ...state,
          orderItems: nextItems,
          orders: state.orders.map((order) =>
            order.id === oldItem.orderId && order.status !== "closed"
              ? { ...order, status: orderStatus, updatedAt: now }
              : order
          )
        };
        next = {
          ...next,
          auditLogs: [...next.auditLogs, createAuditLog(next, "order_item_status_updated", "order_items", itemId, oldItem)]
        };
        commit(next, "preparation");
      },
      async cancelOrderItem(itemId, reason) {
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.cancelOrderItem(itemId, reason);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        const activeProfile = currentProfile();
        const oldItem = state.orderItems.find((item) => item.id === itemId);
        if (!oldItem || !reason.trim()) return;
        if (oldItem.status === "preparing" && activeProfile?.role !== "owner") return;

        const now = new Date().toISOString();
        let next: AppState = {
          ...state,
          orderItems: state.orderItems.map((item) =>
            item.id === itemId
              ? { ...item, status: "cancelled", cancelReason: reason, updatedAt: now }
              : item
          )
        };
        next = withTotals(next, oldItem.orderId);
        next = {
          ...next,
          auditLogs: [
            ...next.auditLogs,
            createAuditLog(next, "order_item_cancelled", "order_items", itemId, oldItem, { reason })
          ]
        };
        commit(next, "order_item");
      },
      async cancelOrder(orderId, reason) {
        if (!reason.trim()) return;
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.cancelOrder(orderId, reason);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        const now = new Date().toISOString();
        const order = state.orders.find((item) => item.id === orderId);
        if (!order) return;
        let next: AppState = {
          ...state,
          orderItems: state.orderItems.map((item) => item.orderId === orderId && !["cancelled", "delivered"].includes(item.status) ? { ...item, status: "cancelled", cancelReason: reason.trim(), updatedAt: now } : item)
        };
        next = withTotals(next, orderId);
        const updatedOrder = next.orders.find((item) => item.id === orderId);
        if (updatedOrder && updatedOrder.total <= 0) {
          next = {
            ...next,
            orders: next.orders.map((item) => item.id === orderId ? { ...item, status: "cancelled", cancelReason: reason.trim(), closedAt: now, updatedAt: now } : item),
            tabs: next.tabs.map((tab) => tab.id === order.tabId ? { ...tab, status: "closed", closedAt: now } : tab)
          };
          if (order.tableId) {
            next = {
              ...next,
              tables: next.tables.map((table) => table.id === order.tableId ? { ...table, status: "free", updatedAt: now } : table),
              tableAlerts: (next.tableAlerts ?? []).map((alert) => alert.tableId === order.tableId && alert.active ? { ...alert, active: false, resolvedAt: now } : alert)
            };
          }
        }
        next = { ...next, auditLogs: [...next.auditLogs, createAuditLog(next, "order_cancelled", "orders", orderId, order, { reason })] };
        commit(next, "order");
      },
      async rejectOrderItem(itemId, reason) {
        if (!reason.trim()) return;
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.rejectOrderItem(itemId, reason);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        const oldItem = state.orderItems.find((item) => item.id === itemId);
        if (!oldItem) return;
        const now = new Date().toISOString();
        let next: AppState = {
          ...state,
          orderItems: state.orderItems.map((item) => item.id === itemId ? { ...item, status: "cancelled", cancelReason: reason.trim(), updatedAt: now } : item)
        };
        next = withTotals(next, oldItem.orderId);
        next = { ...next, auditLogs: [...next.auditLogs, createAuditLog(next, "order_item_rejected", "order_items", itemId, oldItem, { reason })] };
        commit(next, "order_item");
      },
      updateOrderDiscount(orderId, discount) {
        const order = state.orders.find((item) => item.id === orderId);
        const maxDiscount = order ? calculateOrderTotals(state, order).subtotal : 0;
        const clamped = Math.min(Math.max(0, discount), maxDiscount);
        let next: AppState = {
          ...state,
          orders: state.orders.map((item) =>
            item.id === orderId ? { ...item, discount: clamped } : item
          )
        };
        next = withTotals(next, orderId);
        next = {
          ...next,
          auditLogs: [...next.auditLogs, createAuditLog(next, "discount_applied", "orders", orderId)]
        };
        commit(next, "order");
      },
      async applyOrderServiceFee(orderId) {
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.applyOrderServiceFee(orderId);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        const order = state.orders.find((item) => item.id === orderId);
        if (!order || order.serviceFee > 0) return;
        const next = withTotals({
          ...state,
          orders: state.orders.map((item) => item.id === orderId ? { ...item, serviceFeeEnabled: true } : item)
        }, orderId);
        commit(next, "order");
      },
      async setOrderServiceFeeEnabled(orderId, enabled) {
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.setOrderServiceFeeEnabled(orderId, enabled);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        const order = state.orders.find((item) => item.id === orderId);
        if (!order) return;
        const next = withTotals({
          ...state,
          orders: state.orders.map((item) => item.id === orderId ? { ...item, serviceFeeEnabled: enabled } : item)
        }, orderId);
        commit(next, "order");
      },
      transferOrderTable(orderId, newTableId) {
        const now = new Date().toISOString();
        const order = state.orders.find((item) => item.id === orderId);
        if (!order || order.tableId === newTableId) return;
        const oldTableId = order.tableId;
        let next: AppState = {
          ...state,
          orders: state.orders.map((item) =>
            item.id === orderId ? { ...item, tableId: newTableId, updatedAt: now } : item
          ),
          tabs: state.tabs.map((tab) =>
            tab.id === order.tabId ? { ...tab, tableId: newTableId } : tab
          ),
          tables: state.tables.map((table) =>
            table.id === newTableId ? { ...table, status: "occupied", updatedAt: now } : table
          )
        };
        const oldHasOpen = next.orders.some(
          (item) => item.tableId === oldTableId && item.id !== orderId && !["closed", "cancelled"].includes(item.status)
        );
        if (oldTableId && !oldHasOpen) {
          next = {
            ...next,
            tables: next.tables.map((table) =>
              table.id === oldTableId ? { ...table, status: "free", updatedAt: now } : table
            )
          };
        }
        next = {
          ...next,
          auditLogs: [
            ...next.auditLogs,
            createAuditLog(next, "table_transferred", "orders", orderId, { tableId: oldTableId }, { tableId: newTableId })
          ]
        };
        commit(next, "tables");
      },
      mergeOrders(sourceOrderId, targetOrderId) {
        const now = new Date().toISOString();
        const source = state.orders.find((item) => item.id === sourceOrderId);
        const target = state.orders.find((item) => item.id === targetOrderId);
        if (!source || !target || source.id === target.id) return;
        let next: AppState = {
          ...state,
          orderItems: state.orderItems.map((item) =>
            item.orderId === sourceOrderId ? { ...item, orderId: targetOrderId, updatedAt: now } : item
          ),
          orders: state.orders.map((order) =>
            order.id === sourceOrderId
              ? { ...order, status: "cancelled", cancelReason: `Juntado ao pedido ${targetOrderId}`, updatedAt: now }
              : order
          )
        };
        next = withTotals(next, targetOrderId);
        if (source.tableId) {
          const sourceHasOpen = next.orders.some(
            (item) => item.tableId === source.tableId && item.id !== sourceOrderId && !["closed", "cancelled"].includes(item.status)
          );
          if (!sourceHasOpen) {
            next = {
              ...next,
              tables: next.tables.map((table) =>
                table.id === source.tableId ? { ...table, status: "free", updatedAt: now } : table
              )
            };
          }
        }
        next = {
          ...next,
          auditLogs: [
            ...next.auditLogs,
            createAuditLog(next, "tables_merged", "orders", targetOrderId, { sourceOrderId }, { targetOrderId })
          ]
        };
        commit(next, "order");
      },
      async closeOrder(orderId) {
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.closeOrder(orderId);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        const now = new Date().toISOString();
        const order = state.orders.find((item) => item.id === orderId);
        if (!order) return;

        let next: AppState = {
          ...state,
          orders: state.orders.map((item) =>
            item.id === orderId
              ? { ...item, status: "closed", closedBy: profile?.id, closedAt: now, updatedAt: now }
              : item
          ),
          tabs: state.tabs.map((tab) =>
            tab.id === order.tabId ? { ...tab, status: "closed", closedBy: profile?.id, closedAt: now } : tab
          )
        };
        const hasOtherOpen = next.orders.some(
          (item) => item.tableId === order.tableId && item.id !== orderId && !["closed", "cancelled"].includes(item.status)
        );
        if (order.tableId && !hasOtherOpen) {
          next = {
            ...next,
            tables: next.tables.map((table) =>
              table.id === order.tableId ? { ...table, status: "free", updatedAt: now } : table
            )
          };
        }
        if (order.tableId) {
          next = {
            ...next,
            tableAlerts: (next.tableAlerts ?? []).map((alert) =>
              alert.tableId === order.tableId && alert.active
                ? { ...alert, active: false, resolvedAt: now }
                : alert
            )
          };
        }
        // Deduct stock for controlled products (idempotent)
        const orderItemsForStock = next.orderItems.filter((oi) => oi.orderId === orderId && oi.status !== "cancelled");
        const stockByProduct = new Map<string, number>();
        for (const oi of orderItemsForStock) stockByProduct.set(oi.productId, (stockByProduct.get(oi.productId) ?? 0) + oi.quantity);
        for (const [productId, qty] of stockByProduct) {
          const prod = next.products.find((p) => p.id === productId);
          if (!prod?.hasStockControl) continue;
          const alreadyDeducted = (next.stockMovements ?? []).some((m) => m.productId === productId && m.reason === `Venda - Pedido ${orderId}`);
          if (alreadyDeducted) continue;
          next = {
            ...next,
            products: next.products.map((p) => p.id === productId ? { ...p, stockQuantity: Math.max(0, (p.stockQuantity ?? 0) - qty), updatedAt: now } : p),
            stockMovements: [...(next.stockMovements ?? []), { id: uid("stock"), restaurantId: order.restaurantId, productId, type: "exit" as const, quantity: qty, reason: `Venda - Pedido ${orderId}`, createdBy: profile?.id, createdAt: now }]
          };
        }
        next = {
          ...next,
          auditLogs: [...next.auditLogs, createAuditLog(next, "order_closed", "orders", orderId)]
        };
        commit(next, "order");
      },
      async closeTable(tableId) {
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.closeTable(tableId);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        const table = state.tables.find((item) => item.id === tableId);
        if (!table) return;
        const now = new Date().toISOString();
        const openOrders = state.orders.filter((item) => item.tableId === tableId && !["closed", "cancelled"].includes(item.status));
        if (openOrders.some((item) => getPaidTotal(state, item.id) + 0.001 < item.total)) return;
        const openOrderIds = new Set(openOrders.map((item) => item.id));
        const next: AppState = {
          ...state,
          orders: state.orders.map((item) => openOrderIds.has(item.id) ? { ...item, status: "closed", closedBy: profile?.id, closedAt: now, updatedAt: now } : item),
          tabs: state.tabs.map((tab) => tab.tableId === tableId && tab.status === "open" ? { ...tab, status: "closed", closedBy: profile?.id, closedAt: now } : tab),
          tables: state.tables.map((item) => item.id === tableId ? { ...item, status: "free", updatedAt: now } : item),
          tableAlerts: (state.tableAlerts ?? []).map((alert) => alert.tableId === tableId && alert.active ? { ...alert, active: false, resolvedAt: now } : alert)
        };
        commit({ ...next, auditLogs: [...next.auditLogs, createAuditLog(next, "table_closed", "tables", tableId)] }, "tables");
      },
      async resetTestTable(tableId) {
        const activeProfile = currentProfile();
        if (!activeProfile || !["owner", "manager"].includes(activeProfile.role)) return;
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.resetTestTable(tableId);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        const now = new Date().toISOString();
        const openOrderIds = new Set(state.orders.filter((item) => item.tableId === tableId && !["closed", "cancelled"].includes(item.status)).map((item) => item.id));
        const next: AppState = {
          ...state,
          orderItems: state.orderItems.map((item) => openOrderIds.has(item.orderId) ? { ...item, status: "cancelled", cancelReason: "Mesa de teste resetada", updatedAt: now } : item),
          orders: state.orders.map((item) => openOrderIds.has(item.id) ? { ...item, status: "closed", subtotal: 0, discount: 0, serviceFee: 0, serviceFeeEnabled: false, deliveryFee: 0, total: 0, closedAt: now, closedBy: activeProfile.id, updatedAt: now } : item),
          tabs: state.tabs.map((tab) => tab.tableId === tableId && tab.status === "open" ? { ...tab, status: "closed", closedAt: now, closedBy: activeProfile.id } : tab),
          tables: state.tables.map((item) => item.id === tableId ? { ...item, status: "free", updatedAt: now } : item),
          tableAlerts: state.tableAlerts.map((alert) => alert.tableId === tableId && alert.active ? { ...alert, active: false, resolvedAt: now } : alert)
        };
        commit({ ...next, auditLogs: [...next.auditLogs, createAuditLog(next, "table_test_reset", "tables", tableId)] }, "tables");
      },
      reopenOrder(orderId, reason) {
        const now = new Date().toISOString();
        const order = state.orders.find((item) => item.id === orderId);
        const activeProfile = currentProfile();
        if (!order || !reason.trim() || !["owner", "manager", "waiter"].includes(activeProfile?.role ?? "bar")) return;

        if (runtimeConfig.dataMode === "supabase") {
          void (async () => {
            await supabaseGateway.reopenOrder(orderId, reason);
            const workspace = await supabaseGateway.loadWorkspace();
            setState((current) => mergeWorkspace(current, workspace));
          })();
          return;
        }

        let next: AppState = {
          ...state,
          orders: state.orders.map((item) =>
            item.id === orderId
              ? { ...item, status: "open", closedAt: undefined, closedBy: undefined, updatedAt: now }
              : item
          )
        };
        if (order.tableId) {
          next = {
            ...next,
            tables: next.tables.map((table) =>
              table.id === order.tableId ? { ...table, status: "occupied", updatedAt: now } : table
            )
          };
        }
        next = {
          ...next,
          auditLogs: [...next.auditLogs, createAuditLog(next, "order_reopened", "orders", orderId, order, { reason })]
        };
        commit(next, "order");
      },
      async registerPayment(orderId, input) {
        const localOrder = state.orders.find((item) => item.id === orderId);
        const localRemaining = localOrder ? Math.max(0, localOrder.total - getPaidTotal(state, orderId)) : input.amount;
        const amount = Number(Math.min(input.amount, localRemaining).toFixed(2));
        if (amount <= 0) return;
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.registerPayment(orderId, input.method, amount, input.cardBrand, input.changeAmount);
          let workspace = await supabaseGateway.loadWorkspace();
          const remoteOrder = workspace.orders.find((item) => String(item.id) === orderId);
          const paid = workspace.payments
            .filter((item) => String(item.order_id) === orderId && String(item.payment_status ?? "paid") === "paid")
            .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
          if (remoteOrder && paid + 0.001 >= Number(remoteOrder.total ?? 0) && remoteOrder.status !== "closed") {
            try {
              await supabaseGateway.closeOrder(orderId);
              workspace = await supabaseGateway.loadWorkspace();
            } catch {
              // Auto-close failed — user can close manually via "Fechar conta" button
            }
          }
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        const now = new Date().toISOString();
        const order = localOrder;
        if (!order) return;
        const paymentId = uid("pay");
        const activeCash = state.cashSessions.find(
          (item) => item.restaurantId === order.restaurantId && item.status === "open"
        );

        let next: AppState = {
          ...state,
          payments: [
            ...state.payments,
            {
              id: paymentId,
              restaurantId: order.restaurantId,
              orderId,
              method: input.method,
              amount,
              cardBrand: input.cardBrand,
              changeAmount: input.changeAmount,
              provider: "manual",
              paymentStatus: "paid",
              paidAt: now,
              createdBy: profile?.id,
              createdAt: now
            }
          ],
          financialEntries: [
            ...state.financialEntries,
            {
              id: uid("fin"),
              restaurantId: order.restaurantId,
              type: "income",
              category: input.method === "internal_consumption" ? "internal_consumption" : "sale",
              description: `Pedido ${order.id}`,
              amount,
              date: now.slice(0, 10),
              paid: true,
              paymentMethod: input.method,
              orderId,
              createdBy: profile?.id,
              createdAt: now,
              updatedAt: now
            }
          ]
        };

        if (activeCash && input.method === "cash") {
          next = {
            ...next,
            cashMovements: [
              ...next.cashMovements,
              {
                id: uid("cash_move"),
                restaurantId: order.restaurantId,
                cashSessionId: activeCash.id,
                type: "sale",
                amount,
                description: `Pedido ${order.id}`,
                createdBy: profile?.id,
                createdAt: now
              }
            ],
            cashSessions: next.cashSessions.map((session) =>
              session.id === activeCash.id
                ? { ...session, expectedAmount: session.expectedAmount + amount }
                : session
            )
          };
        }

        next = {
          ...next,
          auditLogs: [...next.auditLogs, createAuditLog(next, "payment_registered", "payments", paymentId)]
        };

        const paid = getPaidTotal(next, orderId);
        if (paid + 0.001 >= order.total) {
          next = {
            ...next,
            orders: next.orders.map((item) =>
              item.id === orderId
                ? { ...item, status: "closed", closedBy: profile?.id, closedAt: now, updatedAt: now }
                : item
            ),
            tabs: next.tabs.map((tab) =>
              tab.id === order.tabId ? { ...tab, status: "closed", closedBy: profile?.id, closedAt: now } : tab
            )
          };
          if (order.tableId) {
            next = {
              ...next,
              tables: next.tables.map((table) =>
                table.id === order.tableId ? { ...table, status: "free", updatedAt: now } : table
              ),
              tableAlerts: (next.tableAlerts ?? []).map((alert) =>
                alert.tableId === order.tableId && alert.active
                  ? { ...alert, active: false, resolvedAt: now }
                  : alert
              )
            };
          }
        }

        commit(next, "payment");
      },
      createExpense(input) {
        const description = input.description.trim();
        const amount = Number(input.amount.toFixed(2));
        if (!description || amount <= 0 || !input.category || !input.date) return;
        const now = new Date().toISOString();
        const entryId = uid("fin");
        let next: AppState = {
          ...state,
          financialEntries: [
            ...state.financialEntries,
            {
              id: entryId,
              restaurantId: restaurant?.id ?? state.restaurants[0].id,
              type: "expense",
              category: input.category,
              description,
              amount,
              date: input.date,
              paid: true,
              paymentMethod: input.paymentMethod,
              notes: input.notes?.trim() || undefined,
              createdBy: profile?.id,
              createdAt: now,
              updatedAt: now
            }
          ]
        };
        next = {
          ...next,
          auditLogs: [...next.auditLogs, createAuditLog(next, "expense_created", "financial_entries", entryId)]
        };
        commit(next, "finance");
      },
      async cancelFinancialEntry(entryId, reason) {
        if (!reason.trim()) return;
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.cancelFinancialEntry(entryId, reason);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        const now = new Date().toISOString();
        const entry = state.financialEntries.find((item) => item.id === entryId);
        if (!entry || !entry.paid) return;
        const next: AppState = { ...state, financialEntries: state.financialEntries.map((item) => item.id === entryId ? { ...item, paid: false, cancelReason: reason.trim(), cancelledAt: now, updatedAt: now } : item) };
        commit({ ...next, auditLogs: [...next.auditLogs, createAuditLog(next, "financial_entry_cancelled", "financial_entries", entryId, entry, { reason })] }, "finance");
      },
      async cancelSale(orderId, reason) {
        if (!reason.trim()) return;
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.cancelSale(orderId, reason);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        // Local/demo mode: cancel financial entry + payments + restore stock for this order
        const now = new Date().toISOString();
        const orderItems = state.orderItems.filter((oi) => oi.orderId === orderId && oi.status !== "cancelled");
        let restoredProducts = state.products;
        const newMovements = [...(state.stockMovements ?? [])];
        for (const oi of orderItems) {
          const product = state.products.find((p) => p.id === oi.productId);
          if (!product?.hasStockControl) continue;
          // Check if stock was deducted for this order (avoid double restore)
          const alreadyRestored = state.stockMovements?.some((m) => m.productId === oi.productId && m.reason === `Estorno - Pedido ${orderId}`);
          if (alreadyRestored) continue;
          restoredProducts = restoredProducts.map((p) => p.id === oi.productId ? { ...p, stockQuantity: (p.stockQuantity ?? 0) + oi.quantity, updatedAt: now } : p);
          newMovements.push({ id: uid("stock"), restaurantId: product.restaurantId, productId: oi.productId, type: "entry", quantity: oi.quantity, reason: `Estorno - Pedido ${orderId}`, createdBy: profile?.id, createdAt: now });
        }
        const next: AppState = {
          ...state,
          financialEntries: state.financialEntries.map((item) => item.orderId === orderId && item.type === "income" && item.paid ? { ...item, paid: false, cancelReason: reason.trim(), cancelledAt: now, updatedAt: now } : item),
          payments: state.payments.map((item) => item.orderId === orderId && (item.paymentStatus ?? "paid") === "paid" ? { ...item, paymentStatus: "cancelled" as const } : item),
          orders: state.orders.map((item) => item.id === orderId ? { ...item, status: "cancelled" as const, cancelReason: reason.trim(), updatedAt: now } : item),
          products: restoredProducts,
          stockMovements: newMovements
        };
        commit({ ...next, auditLogs: [...next.auditLogs, createAuditLog(next, "sale_cancelled", "orders", orderId, undefined, { reason })] }, "finance");
      },
      createCategory(name) {
        const now = new Date().toISOString();
        const restaurantId = restaurant?.id ?? state.restaurants[0].id;
        const category: Category = {
          id: runtimeConfig.dataMode === "supabase" ? crypto.randomUUID() : uid("cat"),
          restaurantId,
          name,
          sortOrder: state.categories.length + 1,
          active: true,
          createdAt: now,
          updatedAt: now
        };
        if (runtimeConfig.dataMode === "supabase" && supabase) void supabase.from("categories").insert({ id: category.id, restaurant_id: restaurantId, name, sort_order: category.sortOrder, active: true }).then(() => undefined);
        commit({ ...state, categories: [...state.categories, category] }, "catalog");
      },
      createProduct(input) {
        const now = new Date().toISOString();
        const restaurantId = restaurant?.id ?? state.restaurants[0].id;
        const product: Product = {
          id: runtimeConfig.dataMode === "supabase" ? crypto.randomUUID() : uid("prod"),
          restaurantId,
          categoryId: input.categoryId,
          name: input.name,
          description: input.description,
          price: Number(input.price),
          preparationSector: input.preparationSector,
          estimatedTimeMinutes: input.estimatedTimeMinutes,
          available: input.available ?? true,
          hasStockControl: input.hasStockControl ?? false,
          stockQuantity: input.stockQuantity ?? 0,
          stockMinimum: input.stockMinimum ?? 0,
          imageUrl: input.imageUrl,
          generatedImageUrl: input.generatedImageUrl,
          active: input.active ?? true,
          createdAt: now,
          updatedAt: now
        };
        if (runtimeConfig.dataMode === "supabase" && supabase) void supabase.from("products").insert(toProductRow(product)).then(() => undefined);
        commit({ ...state, products: [...state.products, product] }, "catalog");
      },
      updateProduct(productId, patch) {
        const oldProduct = state.products.find((item) => item.id === productId);
        const now = new Date().toISOString();
        if (runtimeConfig.dataMode === "supabase" && supabase) void supabase.from("products").update(toProductPatch(patch)).eq("id", productId).then(() => undefined);
        let next: AppState = {
          ...state,
          products: state.products.map((product) =>
            product.id === productId ? { ...product, ...patch, updatedAt: now } : product
          )
        };
        next = {
          ...next,
          auditLogs: [
            ...next.auditLogs,
            createAuditLog(next, "product_updated", "products", productId, oldProduct, patch)
          ]
        };
        commit(next, "catalog");
      },
      async removeProduct(productId) {
        if (runtimeConfig.dataMode === "supabase") {
          const result = await supabaseGateway.removeProduct(productId);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return result;
        }
        const hasHistory = state.orderItems.some((item) => item.productId === productId);
        if (hasHistory) {
          commit({ ...state, products: state.products.map((item) => item.id === productId ? { ...item, active: false, available: false } : item) }, "catalog");
          return "inactivated";
        }
        commit({ ...state, products: state.products.filter((item) => item.id !== productId) }, "catalog");
        return "deleted";
      },
      async recordStockMovement(productId, type, quantity, reason) {
        if (runtimeConfig.dataMode === "supabase") {
          await supabaseGateway.recordStockMovement(productId, type, quantity, reason);
          const workspace = await supabaseGateway.loadWorkspace();
          setState((current) => mergeWorkspace(current, workspace));
          return;
        }
        const product = state.products.find((item) => item.id === productId);
        const amount = Math.abs(quantity);
        if (!product || amount <= 0 || !reason.trim()) return;
        const currentQuantity = product.stockQuantity ?? 0;
        const nextQuantity = Math.max(0, type === "entry" ? currentQuantity + amount : currentQuantity - amount);
        const movedQuantity = Math.abs(nextQuantity - currentQuantity);
        if (movedQuantity <= 0) return;
        const now = new Date().toISOString();
        const movementId = uid("stock");
        let next: AppState = {
          ...state,
          products: state.products.map((item) =>
            item.id === productId
              ? { ...item, hasStockControl: true, stockQuantity: nextQuantity, updatedAt: now }
              : item
          ),
          stockMovements: [
            ...(state.stockMovements ?? []),
            {
              id: movementId,
              restaurantId: product.restaurantId,
              productId,
              type,
              quantity: movedQuantity,
              reason: reason.trim(),
              createdBy: profile?.id,
              createdAt: now
            }
          ]
        };
        next = {
          ...next,
          auditLogs: [...next.auditLogs, createAuditLog(next, "stock_movement_created", "stock_movements", movementId)]
        };
        commit(next, "stock");
      },
      updateTable(tableId, patch) {
        const now = new Date().toISOString();
        if (runtimeConfig.dataMode === "supabase") {
          const row: Record<string, unknown> = {};
          if ("name" in patch) row.name = patch.name ?? null;
          if ("number" in patch) row.number = patch.number;
          if ("status" in patch) row.status = patch.status;
          if ("active" in patch) row.active = patch.active;
          if (supabase) void supabase.from("tables").update(row).eq("id", tableId).then(() => undefined);
        }
        commit(
          {
            ...state,
            tables: state.tables.map((table) =>
              table.id === tableId ? { ...table, ...patch, updatedAt: now } : table
            )
          },
          "tables"
        );
      },
      requestTableService(tableId, type) {
        const table = state.tables.find((item) => item.id === tableId);
        if (!table) return;
        const now = new Date().toISOString();
        const hasOpenAlert = (state.tableAlerts ?? []).some(
          (alert) => alert.tableId === tableId && alert.type === type && alert.active
        );
        commit(
          {
            ...state,
            tableAlerts: hasOpenAlert
              ? state.tableAlerts
              : [
                  ...(state.tableAlerts ?? []),
                  {
                    id: uid("table_alert"),
                    restaurantId: table.restaurantId,
                    tableId,
                    type,
                    active: true,
                    createdAt: now
                  }
                ],
            tables:
              type === "bill_request"
                ? state.tables.map((item) =>
                    item.id === tableId ? { ...item, status: "closing", updatedAt: now } : item
                  )
                : state.tables
          },
          "tables"
        );
      },
      resolveTableAlerts(tableId, type) {
        const now = new Date().toISOString();
        if (runtimeConfig.dataMode === "supabase") {
          let query = supabase!.from("table_alerts").update({ active: false, resolved_at: now }).eq("table_id", tableId).eq("active", true);
          if (type) query = query.eq("type", type);
          void query.then(() => undefined);
        }
        commit(
          {
            ...state,
            tableAlerts: (state.tableAlerts ?? []).map((alert) =>
              alert.tableId === tableId && alert.active && (!type || alert.type === type)
                ? { ...alert, active: false, resolvedAt: now }
                : alert
            )
          },
          "tables"
        );
      },
      createTable() {
        const now = new Date().toISOString();
        const restaurantId = restaurant?.id ?? state.restaurants[0].id;
        const max = Math.max(0, ...state.tables.map((table) => table.number));
        commit(
          {
            ...state,
            tables: [
              ...state.tables,
              {
                id: uid("table"),
                restaurantId,
                number: max + 1,
                name: `Mesa ${max + 1}`,
                status: "free",
                active: true,
                createdAt: now,
                updatedAt: now
              }
            ]
          },
          "tables"
        );
      },
      updateRestaurant(patch) {
        const now = new Date().toISOString();
        commit(
          {
            ...state,
            restaurants: state.restaurants.map((item) =>
              item.id === restaurant?.id ? { ...item, ...patch, updatedAt: now } : item
            )
          },
          "settings"
        );
      },
      updateSettings(patch) {
        if (runtimeConfig.dataMode === "supabase" && restaurant?.id) {
          const row: Record<string, unknown> = {};
          if ("qrOrdersEnabled" in patch) row.qr_orders_enabled = patch.qrOrdersEnabled;
          if ("qrOrdersNeedApproval" in patch) row.qr_orders_need_approval = patch.qrOrdersNeedApproval;
          if ("waiterCanCloseAccount" in patch) row.waiter_can_close_account = patch.waiterCanCloseAccount;
          if ("serviceFeePercent" in patch) row.service_fee_percent = patch.serviceFeePercent;
          if ("pixKey" in patch) row.pix_key = patch.pixKey;
          if ("pixRecipientName" in patch) row.pix_recipient_name = patch.pixRecipientName;
          if ("pixCity" in patch) row.pix_city = patch.pixCity;
          if ("pixProvider" in patch) row.pix_provider = patch.pixProvider;
          if ("pixProviderEnvironment" in patch) row.pix_provider_environment = patch.pixProviderEnvironment;
          if ("systemTheme" in patch) row.system_theme = patch.systemTheme;
          if (supabase) void supabase.from("restaurant_settings").update(row).eq("restaurant_id", restaurant.id).then(() => undefined);
        }
        commit(
          {
            ...state,
            settings: state.settings.map((item) =>
              item.restaurantId === restaurant?.id ? { ...item, ...patch } : item
            )
          },
          "settings"
        );
      },
      createProfile(name, username, email, password, roles, active) {
        const now = new Date().toISOString();
        const profileId = uid("profile");
        const normalized = email.trim().toLowerCase();
        const role = (["manager", "cashier", "waiter", "kitchen", "bar"] as Profile["role"][]).find((item) => roles.includes(item)) ?? "waiter";
        commit(
          {
            ...state,
            profiles: [
              ...state.profiles,
              {
                id: profileId,
                userId: uid("user"),
                restaurantId: restaurant?.id ?? state.restaurants[0].id,
                name,
                email: normalized,
                username,
                role,
                roles,
                active,
                createdAt: now,
                updatedAt: now
              }
            ],
            credentials: [
              ...state.credentials,
              {
                email: normalized || `${username}@interno.mesai.local`,
                username,
                password,
                profileId
              }
            ]
          },
          "users"
        );
      },
      openCashSession(openingAmount) {
        if (runtimeConfig.dataMode === "supabase") {
          const resultId = uid("cash_pending");
          void (async () => {
            await supabaseGateway.openCashSession(openingAmount);
            const workspace = await supabaseGateway.loadWorkspace();
            setState((current) => mergeWorkspace(current, workspace));
          })().catch((e) => alert(e instanceof Error ? e.message : "Não foi possível abrir o caixa"));
          return resultId;
        }
        const current = state.cashSessions.find(
          (item) => item.restaurantId === restaurant?.id && item.status === "open"
        );
        if (current) return current.id;
        const now = new Date().toISOString();
        const sessionId = uid("cash");
        let next: AppState = {
          ...state,
          cashSessions: [
              ...state.cashSessions,
              {
                id: sessionId,
                restaurantId: restaurant?.id ?? state.restaurants[0].id,
                openedBy: profile?.id ?? state.profiles[0].id,
                openingAmount,
                expectedAmount: openingAmount,
                status: "open",
                openedAt: now
              }
          ],
          cashMovements: [
              ...state.cashMovements,
              {
                id: uid("cash_move"),
                restaurantId: restaurant?.id ?? state.restaurants[0].id,
                cashSessionId: sessionId,
                type: "supply",
                amount: openingAmount,
                description: "Abertura de caixa",
                createdBy: profile?.id,
                createdAt: now
              }
          ]
        };
        next = {
          ...next,
          auditLogs: [...next.auditLogs, createAuditLog(next, "cash_opened", "cash_sessions", sessionId)]
        };
        commit(next, "cash");
        return sessionId;
      },
      addCashMovement(type, amount, description) {
        if (runtimeConfig.dataMode === "supabase") {
          void (async () => {
            await supabaseGateway.addCashMovement(type, amount, description);
            const workspace = await supabaseGateway.loadWorkspace();
            setState((current) => mergeWorkspace(current, workspace));
          })().catch((e) => alert(e instanceof Error ? e.message : "Não foi possível registrar movimento"));
          return;
        }
        const session = state.cashSessions.find(
          (item) => item.restaurantId === restaurant?.id && item.status === "open"
        );
        if (!session || amount <= 0 || !description.trim()) return;
        const now = new Date().toISOString();
        const signed = type === "withdrawal" ? -amount : amount;
        const movementId = uid("cash_move");
        let next: AppState = {
          ...state,
          cashMovements: [
              ...state.cashMovements,
              {
                id: movementId,
                restaurantId: session.restaurantId,
                cashSessionId: session.id,
                type,
                amount,
                description,
                createdBy: profile?.id,
                createdAt: now
              }
          ],
          cashSessions: state.cashSessions.map((item) =>
              item.id === session.id ? { ...item, expectedAmount: item.expectedAmount + signed } : item
          )
        };
        next = {
          ...next,
          auditLogs: [...next.auditLogs, createAuditLog(next, "cash_movement_created", "cash_movements", movementId)]
        };
        commit(next, "cash");
      },
      closeCashSession(countedAmount) {
        if (runtimeConfig.dataMode === "supabase") {
          void (async () => {
            await supabaseGateway.closeCashSession(countedAmount);
            const workspace = await supabaseGateway.loadWorkspace();
            setState((current) => mergeWorkspace(current, workspace));
          })().catch((e) => alert(e instanceof Error ? e.message : "Não foi possível fechar o caixa"));
          return;
        }
        const session = state.cashSessions.find(
          (item) => item.restaurantId === restaurant?.id && item.status === "open"
        );
        if (!session) return;
        const now = new Date().toISOString();
        const difference = countedAmount - session.expectedAmount;
        let next: AppState = {
          ...state,
          cashSessions: state.cashSessions.map((item) =>
            item.id === session.id
              ? {
                  ...item,
                  countedAmount,
                  differenceAmount: difference,
                  closedBy: profile?.id,
                  status: "closed",
                  closedAt: now
                }
              : item
          )
        };
        next = {
          ...next,
          auditLogs: [...next.auditLogs, createAuditLog(next, "cash_closed", "cash_sessions", session.id)]
        };
        commit(next, "cash");
      },
      updateProfile(profileId, patch) {
        const now = new Date().toISOString();
        commit(
          {
            ...state,
            profiles: state.profiles.map((item) =>
              item.id === profileId ? { ...item, ...patch, updatedAt: now } : item
            )
          },
          "users"
        );
      }
    };
  }, [hydrated, profile, restaurant, settings, state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error("useStore must be used inside StoreProvider");
  }
  return value;
}

function mergeWorkspace(current: AppState, workspace: WorkspaceBootstrap): AppState {
  const row = workspace.restaurant;
  const id = String(row.id);
  const now = new Date().toISOString();
  const restaurant: Restaurant = {
    id,
    name: String(row.name ?? "MesaY"),
    slug: String(row.slug ?? id),
    logoUrl: typeof row.logo_url === "string" ? row.logo_url : undefined,
    city: typeof row.city === "string" ? row.city : undefined,
    phone: typeof row.phone === "string" ? row.phone : undefined,
    whatsappUrl: typeof row.whatsapp_url === "string" ? row.whatsapp_url : undefined,
    mapsUrl: typeof row.maps_url === "string" ? row.maps_url : undefined,
    address: typeof row.address === "string" ? row.address : undefined,
    createdAt: String(row.created_at ?? now),
    updatedAt: String(row.updated_at ?? now)
  };
  const settingsRow = workspace.settings;
  const remoteSettings: RestaurantSettings | undefined = settingsRow
    ? {
        restaurantId: id,
        qrOrdersEnabled: settingsRow.qr_orders_enabled !== false,
        qrOrdersNeedApproval: settingsRow.qr_orders_need_approval === true,
        waiterCanCloseAccount: settingsRow.waiter_can_close_account !== false,
        serviceFeePercent: Number(settingsRow.service_fee_percent ?? 10),
        pixKey: typeof settingsRow.pix_key === "string" ? settingsRow.pix_key : "",
        pixRecipientName: typeof settingsRow.pix_recipient_name === "string" ? settingsRow.pix_recipient_name : "",
        pixCity: typeof settingsRow.pix_city === "string" ? settingsRow.pix_city : "",
        pixProvider: settingsRow.pix_provider === "openpix" || settingsRow.pix_provider === "mercado_pago" ? settingsRow.pix_provider : "manual",
        pixProviderEnvironment: settingsRow.pix_provider_environment === "production" ? "production" : "test",
        systemTheme: settingsRow.system_theme === "dark" || settingsRow.system_theme === "light" ? settingsRow.system_theme : "system"
      }
    : undefined;
  const remoteCategories: Category[] = workspace.categories.map((item) => ({ id: String(item.id), restaurantId: id, name: String(item.name), sortOrder: Number(item.sort_order ?? 0), active: item.active !== false, createdAt: String(item.created_at ?? now), updatedAt: String(item.updated_at ?? now) }));
  const remoteProducts: Product[] = workspace.products.map((item) => {
    const categoryValue = workspace.categories.find((category) => String(category.id) === String(item.category_id))?.name;
    const categoryName = typeof categoryValue === "string" ? categoryValue : undefined;
    const manualImageUrl = typeof item.image_url === "string" ? item.image_url : undefined;
    return { id: String(item.id), restaurantId: id, categoryId: String(item.category_id), name: String(item.name), description: typeof item.description === "string" ? item.description : undefined, price: Number(item.price), preparationSector: item.preparation_sector as Product["preparationSector"], preparationRequired: item.preparation_required !== false, estimatedTimeMinutes: item.estimated_time_minutes ? Number(item.estimated_time_minutes) : undefined, available: item.available !== false, hasStockControl: item.has_stock_control === true, stockQuantity: item.stock_quantity === null ? undefined : Number(item.stock_quantity), stockMinimum: item.stock_minimum === null ? undefined : Number(item.stock_minimum), stockUnit: item.stock_unit as Product["stockUnit"], imageUrl: manualImageUrl, generatedImageUrl: typeof item.generated_image_url === "string" ? item.generated_image_url : manualImageUrl ? undefined : resolveProductImage(item, categoryName), active: item.active !== false, createdAt: String(item.created_at ?? now), updatedAt: String(item.updated_at ?? now) };
  });
  const remoteTables: RestaurantTable[] = workspace.tables.map((item) => ({ id: String(item.id), restaurantId: id, number: Number(item.number), name: typeof item.name === "string" ? item.name : undefined, status: item.status as RestaurantTable["status"], active: item.active !== false, createdAt: String(item.created_at ?? now), updatedAt: String(item.updated_at ?? now) }));
  const remoteOrders: Order[] = workspace.orders.map((item) => ({ id: String(item.id), restaurantId: id, tableId: item.table_id ? String(item.table_id) : undefined, tabId: item.tab_id ? String(item.tab_id) : undefined, customerName: typeof item.customer_name === "string" ? item.customer_name : undefined, source: item.source as Order["source"], status: item.status as Order["status"], createdBy: item.created_by ? String(item.created_by) : undefined, closedBy: item.closed_by ? String(item.closed_by) : undefined, subtotal: Number(item.subtotal ?? 0), discount: Number(item.discount ?? 0), serviceFee: Number(item.service_fee ?? 0), serviceFeeEnabled: item.service_fee_enabled !== false, deliveryFee: Number(item.delivery_fee ?? 0), total: Number(item.total ?? 0), notes: typeof item.notes === "string" ? item.notes : undefined, cancelReason: typeof item.cancel_reason === "string" ? item.cancel_reason : undefined, createdAt: String(item.created_at ?? now), updatedAt: String(item.updated_at ?? now), closedAt: item.closed_at ? String(item.closed_at) : undefined }));
  const remoteOrderItems: OrderItem[] = workspace.orderItems.map((item) => ({ id: String(item.id), orderId: String(item.order_id), restaurantId: id, productId: String(item.product_id), productNameSnapshot: String(item.product_name_snapshot), unitPriceSnapshot: Number(item.unit_price_snapshot), quantity: Number(item.quantity), variationName: typeof item.variation_name === "string" ? item.variation_name : undefined, variationPriceDelta: item.variation_price_delta === null ? undefined : Number(item.variation_price_delta), notes: typeof item.notes === "string" ? item.notes : undefined, preparationSector: item.preparation_sector as OrderItem["preparationSector"], status: item.status as OrderItem["status"], cancelReason: typeof item.cancel_reason === "string" ? item.cancel_reason : undefined, createdBy: item.created_by ? String(item.created_by) : undefined, createdAt: String(item.created_at ?? now), updatedAt: String(item.updated_at ?? now), sentAt: item.sent_at ? String(item.sent_at) : undefined, preparingAt: item.preparing_at ? String(item.preparing_at) : undefined, readyAt: item.ready_at ? String(item.ready_at) : undefined, deliveredAt: item.delivered_at ? String(item.delivered_at) : undefined }));
  const remotePayments: Payment[] = workspace.payments.map((item) => ({ id: String(item.id), restaurantId: id, orderId: String(item.order_id), method: item.method as Payment["method"], amount: Number(item.amount ?? 0), cardBrand: typeof item.card_brand === "string" ? item.card_brand : undefined, changeAmount: item.change_amount === null ? undefined : Number(item.change_amount), provider: item.provider === "openpix" || item.provider === "mercado_pago" ? item.provider : "manual", providerEnvironment: item.provider_environment === "production" ? "production" : "test", externalPaymentId: typeof item.external_payment_id === "string" ? item.external_payment_id : undefined, txid: typeof item.txid === "string" ? item.txid : undefined, paymentStatus: item.payment_status as Payment["paymentStatus"] ?? "paid", pixCopyPaste: typeof item.pix_copy_paste === "string" ? item.pix_copy_paste : undefined, expiresAt: item.expires_at ? String(item.expires_at) : undefined, paidAt: item.paid_at ? String(item.paid_at) : undefined, createdBy: item.created_by ? String(item.created_by) : undefined, createdAt: String(item.created_at ?? now) }));
  const remoteFinancialEntries: FinancialEntry[] = workspace.financialEntries.map((item) => ({ id: String(item.id), restaurantId: id, type: item.type as FinancialEntry["type"], category: String(item.category ?? ""), description: String(item.description ?? ""), amount: Number(item.amount ?? 0), date: String(item.date ?? now.slice(0, 10)), paid: item.paid === true, paymentMethod: item.payment_method as FinancialEntry["paymentMethod"], notes: typeof item.notes === "string" ? item.notes : undefined, orderId: item.order_id ? String(item.order_id) : undefined, createdBy: item.created_by ? String(item.created_by) : undefined, createdAt: String(item.created_at ?? now), updatedAt: String(item.updated_at ?? now), cancelledAt: item.cancelled_at ? String(item.cancelled_at) : undefined, cancelReason: typeof item.cancel_reason === "string" ? item.cancel_reason : undefined }));
  const remoteStockMovements: StockMovement[] = workspace.stockMovements.map((item) => ({ id: String(item.id), restaurantId: id, productId: String(item.product_id), type: item.type as StockMovement["type"], quantity: Number(item.quantity ?? 0), reason: String(item.reason ?? ""), createdBy: item.created_by ? String(item.created_by) : undefined, createdAt: String(item.created_at ?? now) }));
  const remoteAlerts: TableAlert[] = workspace.tableAlerts.map((item) => ({ id: String(item.id), restaurantId: id, tableId: String(item.table_id), type: item.type as TableAlert["type"], active: item.active === true, createdAt: String(item.created_at ?? now), resolvedAt: item.resolved_at ? String(item.resolved_at) : undefined }));
  const remoteCashSessions: CashSession[] = (workspace.cashSessions ?? []).map((item) => ({ id: String(item.id), restaurantId: id, openedBy: String(item.opened_by ?? ""), closedBy: item.closed_by ? String(item.closed_by) : undefined, openingAmount: Number(item.opening_amount ?? 0), expectedAmount: Number(item.expected_amount ?? 0), countedAmount: item.counted_amount !== null && item.counted_amount !== undefined ? Number(item.counted_amount) : undefined, differenceAmount: item.difference_amount !== null && item.difference_amount !== undefined ? Number(item.difference_amount) : undefined, status: item.status as CashSession["status"], openedAt: String(item.opened_at ?? now), closedAt: item.closed_at ? String(item.closed_at) : undefined }));
  const remoteCashMovements: CashMovement[] = (workspace.cashMovements ?? []).map((item) => ({ id: String(item.id), restaurantId: id, cashSessionId: String(item.cash_session_id), type: item.type as CashMovement["type"], amount: Number(item.amount ?? 0), description: String(item.description ?? ""), createdBy: item.created_by ? String(item.created_by) : undefined, createdAt: String(item.created_at ?? now) }));

  return {
    ...current,
    restaurants: [...current.restaurants.filter((item) => item.id !== id), restaurant],
    settings: remoteSettings
      ? [...current.settings.filter((item) => item.restaurantId !== id), remoteSettings]
      : current.settings,
    profiles: [...current.profiles.filter((item) => item.userId !== workspace.profile.userId), workspace.profile],
    categories: [...current.categories.filter((item) => item.restaurantId !== id), ...remoteCategories],
    products: [...current.products.filter((item) => item.restaurantId !== id), ...remoteProducts],
    tables: [...current.tables.filter((item) => item.restaurantId !== id), ...remoteTables],
    orders: [...current.orders.filter((item) => item.restaurantId !== id), ...remoteOrders],
    orderItems: [...current.orderItems.filter((item) => item.restaurantId !== id), ...remoteOrderItems],
    payments: [...current.payments.filter((item) => item.restaurantId !== id), ...remotePayments],
    financialEntries: [...current.financialEntries.filter((item) => item.restaurantId !== id), ...remoteFinancialEntries],
    stockMovements: [...current.stockMovements.filter((item) => item.restaurantId !== id), ...remoteStockMovements],
    tableAlerts: [...current.tableAlerts.filter((item) => item.restaurantId !== id), ...remoteAlerts],
    cashSessions: remoteCashSessions.length ? [...current.cashSessions.filter((item) => item.restaurantId !== id), ...remoteCashSessions] : current.cashSessions,
    cashMovements: remoteCashMovements.length ? [...current.cashMovements.filter((item) => item.restaurantId !== id), ...remoteCashMovements] : current.cashMovements,
    currentProfileId: workspace.profile.id
  };
}

function toProductRow(product: Product) {
  return { id: product.id, restaurant_id: product.restaurantId, category_id: product.categoryId, name: product.name, description: product.description ?? null, price: product.price, preparation_sector: product.preparationSector, preparation_required: product.preparationRequired ?? true, estimated_time_minutes: product.estimatedTimeMinutes ?? null, available: product.available, has_stock_control: product.hasStockControl, stock_quantity: product.stockQuantity ?? null, stock_minimum: product.stockMinimum ?? null, stock_unit: product.stockUnit ?? null, image_url: product.imageUrl ?? null, generated_image_url: product.generatedImageUrl ?? null, active: product.active };
}

function toProductPatch(patch: Partial<Product>) {
  const row: Record<string, unknown> = {};
  const fields: Array<[keyof Product, string]> = [["categoryId", "category_id"], ["name", "name"], ["description", "description"], ["price", "price"], ["preparationSector", "preparation_sector"], ["preparationRequired", "preparation_required"], ["estimatedTimeMinutes", "estimated_time_minutes"], ["available", "available"], ["hasStockControl", "has_stock_control"], ["stockQuantity", "stock_quantity"], ["stockMinimum", "stock_minimum"], ["stockUnit", "stock_unit"], ["imageUrl", "image_url"], ["generatedImageUrl", "generated_image_url"], ["active", "active"]];
  for (const [key, column] of fields) if (key in patch) row[column] = patch[key] ?? null;
  return row;
}

function loadState() {
  if (typeof window === "undefined") return createSeedState();

  try {
    const parsed = storageAdapter.load();
    if (!parsed) return createSeedState();
    if (!parsed.restaurants?.length || !parsed.products?.length) return createSeedState();
    return migrateDemoText(parsed);
  } catch {
    return createSeedState();
  }
}

function createSupabaseState(): AppState {
  const seed = createSeedState();
  return {
    ...seed,
    restaurants: [], settings: [], profiles: [], tables: [], tableAlerts: [], tabs: [],
    categories: [], products: [], productVariations: [], productAddons: [], productAllowedAddons: [],
    orders: [], orderItems: [], orderItemAddons: [], payments: [], cashSessions: [], cashMovements: [],
    financialEntries: [], stockMovements: [], customers: [], customerDebts: [], auditLogs: [],
    credentials: [], currentProfileId: undefined
  };
}

function migrateDemoText(state: AppState): AppState {
  const freshDemo = createSeedState();
  const needsMaricotaCatalog =
    state.restaurants.some((restaurant) => restaurant.id === "rest_maricota_demo") &&
    !state.products.some((product) => product.id === "prod_bacardi_copo");
  const stockDefaults = new Map(freshDemo.products.map((product) => [product.id, product]));
  const demoExpense = freshDemo.financialEntries.find((entry) => entry.id === "fin_demo_gas");
  const text: Record<string, string> = {
    "Garcom HYOC": "Garçom Maricota",
    "Dono HYOC": "Dono Maricota",
    "Garçom HYOC": "Garçom Maricota",
    "Cozinha HYOC": "Cozinha Maricota",
    "Bar HYOC": "Bar Maricota",
    Garcom: "Garçom",
    Porcoes: "Porções",
    Agua: "Água",
    "Porcao crocante": "Porção crocante",
    "Porcao de calabresa": "Porção de calabresa"
  };

  const restaurants = state.restaurants.map((restaurant) => ({
    ...restaurant,
    name: restaurant.name === "HYOC Boteco Demo" ? "Boteco da Maricota" : restaurant.name,
    slug: restaurant.slug === "hyoc-boteco-demo" ? "boteco-da-maricota" : restaurant.slug,
    city: restaurant.city ?? "Iguatu-CE",
    phone: restaurant.phone === "(11) 99999-0000" || !restaurant.phone ? "+55 88 9629-8276" : restaurant.phone,
    whatsappUrl: restaurant.whatsappUrl ?? "https://wa.me/558896298276",
    address: restaurant.address === "Rua Demo, 123" || !restaurant.address ? "Iguatu-CE" : restaurant.address
  }));
  const credentialProfile = (email: string) => state.credentials.find((item) => item.email === email)?.profileId;
  const credentials = [
    ...state.credentials,
    credentialProfile("dono@hyoc.demo") && !state.credentials.some((item) => item.email === "dono@mesai.demo")
      ? { email: "dono@mesai.demo", password: "demo123", profileId: credentialProfile("dono@hyoc.demo")! }
      : undefined,
    credentialProfile("garcom@hyoc.demo") && !state.credentials.some((item) => item.email === "garcom@mesai.demo")
      ? { email: "garcom@mesai.demo", password: "demo123", profileId: credentialProfile("garcom@hyoc.demo")! }
      : undefined,
    credentialProfile("cozinha@hyoc.demo") && !state.credentials.some((item) => item.email === "cozinha@mesai.demo")
      ? { email: "cozinha@mesai.demo", password: "demo123", profileId: credentialProfile("cozinha@hyoc.demo")! }
      : undefined,
    credentialProfile("bar@hyoc.demo") && !state.credentials.some((item) => item.email === "bar@mesai.demo")
      ? { email: "bar@mesai.demo", password: "demo123", profileId: credentialProfile("bar@hyoc.demo")! }
      : undefined
  ].filter(Boolean) as AppState["credentials"];

  return {
    ...state,
    restaurants,
    tableAlerts: state.tableAlerts ?? [],
    profiles: state.profiles.map((profile) => ({ ...profile, name: text[profile.name] ?? profile.name })),
    categories: needsMaricotaCatalog
      ? freshDemo.categories
      : state.categories.map((category) => ({ ...category, name: text[category.name] ?? category.name })),
    products: needsMaricotaCatalog
      ? freshDemo.products
      : state.products.map((product) => {
          const stockDefault = stockDefaults.get(product.id);
          const needsStockDefaults = !product.stockUnit && stockDefault?.stockUnit;
          return {
            ...product,
            name: text[product.name] ?? product.name,
            description: product.description ? text[product.description] ?? product.description : product.description,
            hasStockControl: needsStockDefaults ? stockDefault.hasStockControl : product.hasStockControl,
            stockQuantity: needsStockDefaults ? stockDefault.stockQuantity : product.stockQuantity,
            stockMinimum: needsStockDefaults ? stockDefault.stockMinimum : product.stockMinimum,
            stockUnit: product.stockUnit ?? stockDefault?.stockUnit
          };
        }),
    productVariations: needsMaricotaCatalog ? freshDemo.productVariations : state.productVariations,
    productAddons: needsMaricotaCatalog ? freshDemo.productAddons : state.productAddons,
    productAllowedAddons: needsMaricotaCatalog ? freshDemo.productAllowedAddons : state.productAllowedAddons,
    orderItems: state.orderItems.map((item) => ({
      ...item,
      productNameSnapshot: text[item.productNameSnapshot] ?? item.productNameSnapshot
    })),
    financialEntries:
      demoExpense && !state.financialEntries.some((entry) => entry.type === "expense")
        ? [...state.financialEntries, demoExpense]
        : state.financialEntries,
    stockMovements: state.stockMovements ?? [],
    credentials
  };
}
