import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { requireSupabaseConfiguration } from "@/lib/runtime-config";
import { supabase } from "@/lib/supabase";
import type { OrderItemStatus, PaymentMethod, Profile, UUID } from "@/lib/types";

export interface RpcOrderItemInput {
  productId: UUID;
  quantity: number;
  notes?: string;
  variationId?: UUID;
  addonIds?: UUID[];
}

export interface WorkspaceBootstrap {
  restaurant: Record<string, unknown>;
  settings: Record<string, unknown> | null;
  profile: Profile;
  categories: Record<string, unknown>[];
  products: Record<string, unknown>[];
  tables: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  orderItems: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  financialEntries: Record<string, unknown>[];
  stockMovements: Record<string, unknown>[];
  tableAlerts: Record<string, unknown>[];
  cashSessions: Record<string, unknown>[];
  cashMovements: Record<string, unknown>[];
}

function client() {
  requireSupabaseConfiguration();
  if (!supabase) throw new Error("Cliente Supabase indisponível.");
  return supabase;
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }, message: string): T {
  if (result.error) throw new Error(`${message}: ${result.error.message}`);
  if (result.data === null) throw new Error(message);
  return result.data;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireDatabaseUuid(value: UUID, label: string) {
  if (!uuidPattern.test(value)) {
    throw new Error(`${label} ainda não foi sincronizado com o Supabase. Reabra a tela e tente novamente.`);
  }
}

export const supabaseGateway = {
  async openPublicTable(restaurantSlug: string, tableRef: string) {
    const result = await client().rpc("open_public_table", { p_slug: restaurantSlug, p_table_ref: tableRef });
    return unwrap(result, "Não foi possível abrir a mesa") as Record<string, unknown>;
  },

  async signIn(email: string, password: string) {
    const result = await client().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (result.error) throw new Error(`Não foi possível entrar: ${result.error.message}`);
    if (!result.data.user || !result.data.session) throw new Error("Não foi possível entrar");
    return result.data;
  },

  async signOut() {
    const { error } = await client().auth.signOut();
    if (error) throw new Error(`Não foi possível sair: ${error.message}`);
  },

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    const subscription = client().auth.onAuthStateChange(callback);
    return () => subscription.data.subscription.unsubscribe();
  },

  async loadWorkspace(): Promise<WorkspaceBootstrap> {
    const authResult = await client().auth.getUser();
    if (authResult.error) throw new Error(`Sessão não encontrada: ${authResult.error.message}`);
    const user = authResult.data.user;
    if (!user) throw new Error("Sessão não encontrada");
    const profileResult = await client()
      .from("profiles")
      .select("id,user_id,restaurant_id,name,email,username,role,roles,active,created_at,updated_at")
      .eq("user_id", user.id)
      .eq("active", true)
      .single();
    const row = unwrap(profileResult, "Perfil ativo não encontrado");
    const [restaurantResult, settingsResult, categoriesResult, productsResult, tablesResult, ordersResult, orderItemsResult, paymentsResult, financialEntriesResult, stockMovementsResult, alertsResult, cashSessionsResult, cashMovementsResult] = await Promise.all([
      client().from("restaurants").select("*").eq("id", row.restaurant_id).single(),
      client().from("restaurant_settings").select("*").eq("restaurant_id", row.restaurant_id).maybeSingle(),
      client().from("categories").select("*").eq("restaurant_id", row.restaurant_id),
      client().from("products").select("*").eq("restaurant_id", row.restaurant_id),
      client().from("tables").select("*").eq("restaurant_id", row.restaurant_id),
      client().from("orders").select("*").eq("restaurant_id", row.restaurant_id).order("created_at", { ascending: false }).limit(200),
      client().from("order_items").select("*").eq("restaurant_id", row.restaurant_id).order("created_at", { ascending: false }).limit(500),
      client().from("payments").select("*").eq("restaurant_id", row.restaurant_id).order("created_at", { ascending: false }).limit(500),
      client().from("financial_entries").select("*").eq("restaurant_id", row.restaurant_id).order("created_at", { ascending: false }).limit(500),
      client().from("stock_movements").select("*").eq("restaurant_id", row.restaurant_id).order("created_at", { ascending: false }).limit(500),
      client().from("table_alerts").select("*").eq("restaurant_id", row.restaurant_id).order("created_at", { ascending: false }).limit(100),
      client().from("cash_sessions").select("*").eq("restaurant_id", row.restaurant_id).order("opened_at", { ascending: false }).limit(20),
      client().from("cash_movements").select("*").eq("restaurant_id", row.restaurant_id).order("created_at", { ascending: false }).limit(200)
    ]);
    const restaurant = unwrap(restaurantResult, "Estabelecimento não encontrado") as Record<string, unknown>;
    if (settingsResult.error) throw new Error(`Configurações não encontradas: ${settingsResult.error.message}`);

    if (categoriesResult.error || productsResult.error || tablesResult.error || ordersResult.error || orderItemsResult.error || alertsResult.error) throw new Error("Dados do estabelecimento não encontrados.");

    if (paymentsResult.error || financialEntriesResult.error || stockMovementsResult.error) throw new Error("Dados complementares indisponiveis.");

    return {
      restaurant,
      settings: settingsResult.data as Record<string, unknown> | null,
      categories: categoriesResult.data as Record<string, unknown>[],
      products: productsResult.data as Record<string, unknown>[],
      tables: tablesResult.data as Record<string, unknown>[],
      orders: ordersResult.data as Record<string, unknown>[],
      orderItems: orderItemsResult.data as Record<string, unknown>[],
      payments: paymentsResult.data as Record<string, unknown>[],
      financialEntries: financialEntriesResult.data as Record<string, unknown>[],
      stockMovements: stockMovementsResult.data as Record<string, unknown>[],
      tableAlerts: alertsResult.data as Record<string, unknown>[],
      cashSessions: cashSessionsResult.data as Record<string, unknown>[] ?? [],
      cashMovements: cashMovementsResult.data as Record<string, unknown>[] ?? [],
      profile: {
        id: row.id,
        userId: row.user_id,
        restaurantId: row.restaurant_id,
        name: row.name,
        email: row.email ?? user.email ?? "",
        username: row.username ?? undefined,
        role: row.role,
        roles: row.roles?.length ? row.roles : [row.role],
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      } as Profile
    };
  },

  async createOrder(tableId: UUID | undefined, items: RpcOrderItemInput[], customerName?: string, notes?: string) {
    const result = await client().rpc("create_order_with_items", {
      p_table_id: tableId ?? null,
      p_customer_name: customerName?.trim() || null,
      p_notes: notes?.trim() || null,
      p_items: items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        notes: item.notes?.trim() || null,
        variation_id: item.variationId ?? null,
        addon_ids: item.addonIds ?? []
      }))
    });
    return unwrap(result, "Não foi possível criar o pedido") as UUID;
  },

  async ensureOpenTableOrder(tableId: UUID) {
    requireDatabaseUuid(tableId, "A mesa");
    const result = await client().rpc("ensure_open_table_order", { p_table_id: tableId });
    return unwrap(result, "Não foi possível abrir a mesa") as UUID;
  },

  async addOrderItem(orderId: UUID, productId: UUID, quantity: number, notes?: string) {
    requireDatabaseUuid(orderId, "A comanda");
    requireDatabaseUuid(productId, "O produto");
    const result = await client().rpc("add_order_item", { p_order_id: orderId, p_product_id: productId, p_quantity: quantity, p_notes: notes?.trim() || null });
    return unwrap(result, "Não foi possível adicionar o item") as UUID;
  },

  async sendOrderItems(orderId: UUID) {
    const result = await client().rpc("send_order_items", { p_order_id: orderId });
    return unwrap(result, "Não foi possível enviar o pedido") as UUID;
  },

  async removeProduct(productId: UUID) {
    const result = await client().rpc("remove_product", { p_product_id: productId });
    return unwrap(result, "Não foi possível excluir o produto") as "deleted" | "inactivated";
  },

  async updatePreparationStatus(itemId: UUID, status: OrderItemStatus) {
    const result = await client().rpc("update_preparation_status", {
      p_item_id: itemId,
      p_status: status
    });
    return unwrap(result, "Não foi possível atualizar o preparo");
  },

  async cancelOrderItem(itemId: UUID, reason: string) {
    const result = await client().rpc("cancel_order_item", { p_item_id: itemId, p_reason: reason.trim() });
    return unwrap(result, "Não foi possível cancelar o item") as UUID;
  },

  async cancelOrder(orderId: UUID, reason: string) {
    const result = await client().rpc("cancel_order", { p_order_id: orderId, p_reason: reason.trim() });
    return unwrap(result, "Não foi possível cancelar o pedido") as UUID;
  },

  async rejectOrderItem(itemId: UUID, reason: string) {
    const result = await client().rpc("reject_order_item", { p_item_id: itemId, p_reason: reason.trim() });
    return unwrap(result, "Não foi possível recusar o item") as UUID;
  },

  async registerPayment(orderId: UUID, method: PaymentMethod, amount: number, cardBrand?: string, changeAmount?: number) {
    const result = await client().rpc("register_order_payment", {
      p_order_id: orderId,
      p_method: method,
      p_amount: amount,
      p_card_brand: cardBrand?.trim() || null,
      p_change_amount: changeAmount ?? null
    });
    return unwrap(result, "Não foi possível registrar o pagamento") as UUID;
  },

  async closeOrder(orderId: UUID) {
    const result = await client().rpc("close_paid_order", { p_order_id: orderId });
    return unwrap(result, "Não foi possível fechar a conta") as UUID;
  },

  async reopenOrder(orderId: UUID, reason: string) {
    const result = await client().rpc("reopen_order", { p_order_id: orderId, p_reason: reason.trim() });
    return unwrap(result, "Não foi possível reabrir o pedido") as UUID;
  },

  async cancelFinancialEntry(entryId: UUID, reason: string) {
    const result = await client().rpc("cancel_financial_entry", { p_entry_id: entryId, p_reason: reason.trim() });
    return unwrap(result, "Não foi possível cancelar o lançamento") as UUID;
  },

  async cancelSale(orderId: UUID, reason: string) {
    const result = await client().rpc("cancel_sale", { p_order_id: orderId, p_reason: reason.trim() });
    return unwrap(result, "Não foi possível estornar a venda") as UUID;
  },

  async applyOrderServiceFee(orderId: UUID) {
    const result = await client().rpc("apply_order_service_fee", { p_order_id: orderId });
    return unwrap(result, "Não foi possível adicionar a taxa de serviço") as UUID;
  },

  async setOrderServiceFeeEnabled(orderId: UUID, enabled: boolean) {
    const result = await client().rpc("set_order_service_fee_enabled", { p_order_id: orderId, p_enabled: enabled });
    return unwrap(result, "Não foi possível atualizar a taxa de serviço") as UUID;
  },

  async closeTable(tableId: UUID) {
    const result = await client().rpc("close_table", { p_table_id: tableId });
    return unwrap(result, "Nao foi possivel fechar a mesa") as UUID;
  },

  async resetTestTable(tableId: UUID) {
    const result = await client().rpc("reset_test_table", { p_table_id: tableId });
    return unwrap(result, "Nao foi possivel resetar a mesa") as UUID;
  },

  async rotateTableQrToken(tableId: UUID) {
    const result = await client().rpc("rotate_table_qr_token", { p_table_id: tableId });
    return unwrap(result, "Nao foi possivel gerar o QR Code") as string;
  },

  async startQrSession(tableToken: string) {
    const result = await client().rpc("start_qr_session", { p_table_token: tableToken });
    return unwrap(result, "QR Code inválido ou expirado") as string;
  },

  async createQrOrder(sessionToken: string, items: RpcOrderItemInput[], customerName?: string) {
    const result = await client().rpc("create_qr_order", {
      p_session_token: sessionToken,
      p_customer_name: customerName?.trim() || null,
      p_items: items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        notes: item.notes?.trim() || null,
        variation_id: item.variationId ?? null,
        addon_ids: item.addonIds ?? []
      }))
    });
    return unwrap(result, "Não foi possível enviar o pedido pelo QR") as UUID;
  },

  async getPublicMenu(tableToken: string) {
    const result = await client().rpc("get_public_menu", { p_table_token: tableToken });
    return unwrap(result, "Não foi possível carregar o cardápio público") as Record<string, unknown>;
  },

  async getQrOrder(sessionToken: string, orderId: UUID) {
    const result = await client().rpc("get_qr_order", { p_session_token: sessionToken, p_order_id: orderId });
    return unwrap(result, "Não foi possível acompanhar o pedido") as Record<string, unknown>;
  },

  async requestTableService(sessionToken: string, type: "waiter_call" | "bill_request") {
    const result = await client().rpc("request_table_service", { p_session_token: sessionToken, p_type: type });
    return unwrap(result, "Não foi possível chamar o atendimento") as UUID;
  },

  async openCashSession(openingAmount: number) {
    const result = await client().rpc("open_cash_session", { p_opening_amount: openingAmount });
    return unwrap(result, "Não foi possível abrir o caixa") as UUID;
  },

  async addCashMovement(type: "withdrawal" | "supply" | "adjustment", amount: number, description: string) {
    const result = await client().rpc("add_cash_movement", {
      p_type: type,
      p_amount: amount,
      p_description: description.trim()
    });
    return unwrap(result, "Não foi possível registrar o movimento") as UUID;
  },

  async closeCashSession(countedAmount: number) {
    const result = await client().rpc("close_cash_session", { p_counted_amount: countedAmount });
    return unwrap(result, "Não foi possível fechar o caixa") as UUID;
  },

  async recordStockMovement(productId: UUID, type: "entry" | "exit" | "adjustment", quantity: number, reason: string) {
    const result = await client().rpc("record_stock_movement", {
      p_product_id: productId,
      p_type: type,
      p_quantity: quantity,
      p_reason: reason.trim()
    });
    return unwrap(result, "Não foi possível atualizar o estoque") as UUID;
  }
};
