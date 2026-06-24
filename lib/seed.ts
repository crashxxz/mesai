import type {
  AppState,
  CashMovement,
  CashSession,
  Category,
  Order,
  OrderItem,
  Payment,
  Product,
  ProductAddon,
  ProductAllowedAddon,
  ProductVariation,
  Profile,
  Restaurant,
  RestaurantSettings,
  RestaurantTable,
  StockUnit,
  Tab
} from "@/lib/types";
import { dateKey } from "@/lib/utils";

const restaurantId = "rest_maricota_demo";
const ownerId = "profile_owner";
const waiterId = "profile_waiter";
const kitchenId = "profile_kitchen";
const barId = "profile_bar";

const createdAt = new Date().toISOString();

const categories: Category[] = [
  category("cat_petiscos", "Petiscos", 1),
  category("cat_churrasco", "Churrasco", 2),
  category("cat_pratos", "Pratos", 3),
  category("cat_agua", "Água", 4),
  category("cat_sucos", "Sucos", 5),
  category("cat_refri_1l", "Refrigerantes 1 litro", 6),
  category("cat_refri_lata", "Refrigerantes lata", 7),
  category("cat_refri_600", "Refrigerantes 600ml", 8),
  category("cat_long_neck", "Long neck", 9),
  category("cat_long_neck_zero", "Long neck zero", 10),
  category("cat_energetico", "Energético", 11),
  category("cat_cervejas", "Cervejas", 12),
  category("cat_bebidas_quentes", "Bebidas quentes", 13)
];

const products: Product[] = [
  product("prod_porcao_pastel", "cat_petiscos", "Pastelzinho", 15, "kitchen", 9),
  product("prod_macaxeira", "cat_petiscos", "Macaxeira", 15, "kitchen", 10),
  product("prod_batatinha", "cat_petiscos", "Batatinha", 15, "kitchen", 10),
  product("prod_batata_rustica", "cat_petiscos", "Batata rústica", 15, "kitchen", 12),
  product("prod_feijao_verde", "cat_petiscos", "Feijão verde", 15, "kitchen", 10),
  product("prod_feijao_especial", "cat_petiscos", "Feijão verde especial", 25, "kitchen", 12),
  product("prod_tripa", "cat_petiscos", "Tripa", 15, "kitchen", 12),
  product("prod_torresmo", "cat_petiscos", "Torresmo", 12, "kitchen", 10),
  product("prod_munguza", "cat_petiscos", "Mungunzá", 15, "kitchen", 9),
  product("prod_pao_alho", "cat_petiscos", "Pão de alho", 6, "kitchen", 7),
  product("prod_bolinha_queijo", "cat_petiscos", "Bolinha de queijo", 15, "kitchen", 8),
  product("prod_bolinha_mista", "cat_petiscos", "Bolinha mista", 15, "kitchen", 8),

  product("prod_linguica_toscana", "cat_churrasco", "Linguiça Toscana", 5, "kitchen", 10),
  pendingProduct("prod_espeto_coracao", "cat_churrasco", "Espeto de coração", "kitchen", 10),
  product("prod_espeto_queijo", "cat_churrasco", "Espeto de queijo", 10, "kitchen", 10),
  product("prod_espeto_boi", "cat_churrasco", "Espeto de boi", 12, "kitchen", 12),
  product("prod_espeto_porco", "cat_churrasco", "Espeto de porco", 12, "kitchen", 12),
  product("prod_espeto_frango", "cat_churrasco", "Espeto de frango", 12, "kitchen", 12),
  product("prod_espeto_frango_bacon", "cat_churrasco", "Espeto de frango com bacon", 14, "kitchen", 12),
  product("prod_porcao_carne", "cat_churrasco", "Boi 300g", 30, "kitchen", 15),
  product("prod_porco_300", "cat_churrasco", "Porco 300g", 25, "kitchen", 15),
  product("prod_mistao", "cat_churrasco", "Mistão", 35, "kitchen", 15),

  product("prod_arroz_branco", "cat_pratos", "Arroz branco", 10, "kitchen", 8),
  product("prod_arroz_grega", "cat_pratos", "Arroz à grega", 14, "kitchen", 10),
  product("prod_arroz_carreteiro", "cat_pratos", "Arroz carreteiro", 15, "kitchen", 10),
  product("prod_baiao_comum", "cat_pratos", "Baião comum", 12, "kitchen", 9),
  product("prod_baiao_mole", "cat_pratos", "Baião mole", 14, "kitchen", 10),

  product("prod_agua_sem_gas", "cat_agua", "Água sem gás", 3, "bar", 2),
  product("prod_agua_com_gas", "cat_agua", "Água com gás", 4, "bar", 2),
  product("prod_agua_coco", "cat_agua", "Água de coco", 6, "bar", 2),
  product("prod_h2o", "cat_agua", "H2O", 8, "bar", 2),

  product("prod_suco_goiaba_copo", "cat_sucos", "Suco de goiaba copo", 8, "bar", 5),
  product("prod_suco_acerola_copo", "cat_sucos", "Suco de acerola copo", 8, "bar", 5),
  product("prod_suco_cajarana_copo", "cat_sucos", "Suco de cajarana copo", 8, "bar", 5),
  product("prod_suco_manga_copo", "cat_sucos", "Suco de manga copo", 8, "bar", 5),
  product("prod_suco_caja_copo", "cat_sucos", "Suco de cajá copo", 8, "bar", 5),
  product("prod_suco_maracuja_copo", "cat_sucos", "Suco de maracujá copo", 10, "bar", 5),
  product("prod_suco_laranja_copo", "cat_sucos", "Suco de laranja copo", 10, "bar", 5),
  product("prod_suco_abacaxi_limao_copo", "cat_sucos", "Suco de abacaxi com limão copo", 10, "bar", 5),
  product("prod_suco_goiaba_jarra", "cat_sucos", "Suco de goiaba jarra", 15, "bar", 7),
  product("prod_suco_acerola_jarra", "cat_sucos", "Suco de acerola jarra", 15, "bar", 7),
  product("prod_suco_cajarana_jarra", "cat_sucos", "Suco de cajarana jarra", 15, "bar", 7),
  product("prod_suco_manga_jarra", "cat_sucos", "Suco de manga jarra", 15, "bar", 7),
  product("prod_suco_caja_jarra", "cat_sucos", "Suco de cajá jarra", 15, "bar", 7),
  product("prod_suco_maracuja_jarra", "cat_sucos", "Suco de maracujá jarra", 20, "bar", 7),
  product("prod_suco_laranja_jarra", "cat_sucos", "Suco de laranja jarra", 20, "bar", 7),
  product("prod_suco_abacaxi_limao_jarra", "cat_sucos", "Suco de abacaxi com limão jarra", 20, "bar", 7),

  product("prod_guarana_1l", "cat_refri_1l", "Guaraná 1L", 10, "bar", 2),
  product("prod_pepsi_1l", "cat_refri_1l", "Pepsi 1L", 10, "bar", 2),
  product("prod_coca_1l", "cat_refri_1l", "Coca-Cola 1L", 10, "bar", 2),
  product("prod_pepsi_lata", "cat_refri_lata", "Pepsi lata", 6, "bar", 2),
  product("prod_refri_lata", "cat_refri_lata", "Coca-Cola lata", 6, "bar", 2),
  product("prod_guarana_lata", "cat_refri_lata", "Guaraná lata", 6, "bar", 2),
  product("prod_coca_600", "cat_refri_600", "Coca-Cola 600ml", 8, "bar", 2),

  product("prod_corona_long_neck", "cat_long_neck", "Corona long neck", 10, "bar", 2),
  product("prod_heineken_long_neck", "cat_long_neck", "Heineken long neck", 10, "bar", 2),
  product("prod_cabare_long_neck", "cat_long_neck", "Cabaré long neck", 10, "bar", 2),
  product("prod_budweiser_long_neck", "cat_long_neck", "Budweiser long neck", 10, "bar", 2),
  product("prod_spaten_long_neck", "cat_long_neck", "Spaten long neck", 10, "bar", 2),
  product("prod_budweiser_zero_long_neck", "cat_long_neck_zero", "Budweiser zero long neck", 10, "bar", 2),
  product("prod_heineken_zero_long_neck", "cat_long_neck_zero", "Heineken zero long neck", 10, "bar", 2),

  product("prod_red_bull", "cat_energetico", "Red Bull", 14, "bar", 2),
  product("prod_monster_pequeno", "cat_energetico", "Monster pequeno", 12, "bar", 2),
  product("prod_monster_grande", "cat_energetico", "Monster grande", 15, "bar", 2),

  product("prod_litrinho", "cat_cervejas", "Litrinho", 4, "bar", 2),
  product("prod_cerveja_lata", "cat_cervejas", "Latinha", 6, "bar", 2),
  product("prod_cerveja_600", "cat_cervejas", "Brahma 600ml", 10, "bar", 2),
  product("prod_skol_600", "cat_cervejas", "Skol 600ml", 10, "bar", 2),
  product("prod_devassa_600", "cat_cervejas", "Devassa 600ml", 10, "bar", 2),
  product("prod_budweiser_600", "cat_cervejas", "Budweiser 600ml", 12, "bar", 2),
  product("prod_amstel_600", "cat_cervejas", "Amstel 600ml", 12, "bar", 2),
  product("prod_bohemia_600", "cat_cervejas", "Bohemia 600ml", 12, "bar", 2),
  product("prod_original_600", "cat_cervejas", "Original 600ml", 12, "bar", 2),
  product("prod_spaten_600", "cat_cervejas", "Spaten 600ml", 13, "bar", 2),
  product("prod_stella_600", "cat_cervejas", "Stella 600ml", 13, "bar", 2),
  product("prod_heineken_600", "cat_cervejas", "Heineken 600ml", 15, "bar", 2),

  product("prod_black_white_dose", "cat_bebidas_quentes", "Black & White dose", 9, "bar", 2),
  product("prod_red_label_dose", "cat_bebidas_quentes", "Red Label dose", 13, "bar", 2),
  product("prod_old_parr_dose", "cat_bebidas_quentes", "Old Parr dose", 15, "bar", 2),
  product("prod_white_horse_dose", "cat_bebidas_quentes", "White Horse dose", 13, "bar", 2),
  product("prod_campari_dose", "cat_bebidas_quentes", "Campari dose", 9, "bar", 2),
  product("prod_martini_dose", "cat_bebidas_quentes", "Martini dose", 8, "bar", 2),
  product("prod_vinho_dose", "cat_bebidas_quentes", "Vinho dose", 13, "bar", 2),
  product("prod_taca_vinho", "cat_bebidas_quentes", "Taça de vinho", 13, "bar", 2),
  product("prod_absolut_dose", "cat_bebidas_quentes", "Vodka Absolut dose", 6, "bar", 2),
  product("prod_absolut_copo", "cat_bebidas_quentes", "Vodka Absolut copo", 15, "bar", 2),
  product("prod_smirnoff_dose", "cat_bebidas_quentes", "Vodka Smirnoff dose", 7, "bar", 2),
  product("prod_smirnoff_copo", "cat_bebidas_quentes", "Vodka Smirnoff copo", 15, "bar", 2),
  product("prod_orloff_dose", "cat_bebidas_quentes", "Vodka Orloff dose", 5, "bar", 2),
  product("prod_orloff_copo", "cat_bebidas_quentes", "Vodka Orloff copo", 12, "bar", 2),
  product("prod_ypioca_dose", "cat_bebidas_quentes", "Ypióca dose", 3, "bar", 2),
  product("prod_ypioca_copo", "cat_bebidas_quentes", "Ypióca copo", 10, "bar", 2),
  product("prod_51_dose", "cat_bebidas_quentes", "Cachaça 51 dose", 3, "bar", 2),
  product("prod_51_copo", "cat_bebidas_quentes", "Cachaça 51 copo", 10, "bar", 2),
  product("prod_pitu_dose", "cat_bebidas_quentes", "Pitú dose", 3, "bar", 2),
  product("prod_pitu_copo", "cat_bebidas_quentes", "Pitú copo", 8, "bar", 2),
  product("prod_ypioca_150_dose", "cat_bebidas_quentes", "Ypióca 150 dose", 7, "bar", 2),
  product("prod_ypioca_150_copo", "cat_bebidas_quentes", "Ypióca 150 copo", 15, "bar", 2),
  product("prod_dreher_dose", "cat_bebidas_quentes", "Dreher dose", 3, "bar", 2),
  product("prod_dreher_copo", "cat_bebidas_quentes", "Dreher copo", 10, "bar", 2),
  product("prod_montilla_dose", "cat_bebidas_quentes", "Rum Montilla dose", 5, "bar", 2),
  product("prod_montilla_copo", "cat_bebidas_quentes", "Rum Montilla copo", 12, "bar", 2),
  product("prod_bacardi_dose", "cat_bebidas_quentes", "Rum Bacardi dose", 7, "bar", 2),
  product("prod_bacardi_copo", "cat_bebidas_quentes", "Rum Bacardi copo", 15, "bar", 2)
];

const variations: ProductVariation[] = [];
const addons: ProductAddon[] = [];
const allowedAddons: ProductAllowedAddon[] = [];

export function createMaricotaCatalog() {
  return {
    categories: categories.map((item) => ({ ...item })),
    products: products.map((item) => ({ ...item })),
    productVariations: variations.map((item) => ({ ...item })),
    productAddons: addons.map((item) => ({ ...item })),
    productAllowedAddons: allowedAddons.map((item) => ({ ...item }))
  };
}

export function createSeedState(): AppState {
  const catalog = createMaricotaCatalog();
  const now = new Date();
  const today = now.toISOString();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const twelveAgo = new Date(now.getTime() - 12 * 60 * 1000).toISOString();
  const sevenAgo = new Date(now.getTime() - 7 * 60 * 1000).toISOString();
  const fourAgo = new Date(now.getTime() - 4 * 60 * 1000).toISOString();
  const twoAgo = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const restaurant: Restaurant = {
    id: restaurantId,
    name: "Boteco da Maricota",
    slug: "boteco-da-maricota",
    city: "Iguatu-CE",
    phone: "+55 88 9629-8276",
    whatsappUrl: "https://wa.me/558896298276",
    address: "Iguatu-CE",
    createdAt,
    updatedAt: createdAt
  };

  const settings: RestaurantSettings = {
    restaurantId,
    qrOrdersEnabled: true,
    qrOrdersNeedApproval: false,
    waiterCanCloseAccount: true,
    serviceFeePercent: 10,
    pixKey: "",
    pixRecipientName: "Boteco da Maricota",
    pixCity: "Iguatu",
    pixProvider: "manual",
    pixProviderEnvironment: "test",
    systemTheme: "system"
  };

  const profiles: Profile[] = [
    profile(ownerId, "Dono Maricota", "dono@mesai.demo", "owner"),
    profile(waiterId, "Garçom Maricota", "garcom@mesai.demo", "waiter"),
    profile(kitchenId, "Cozinha Maricota", "cozinha@mesai.demo", "kitchen"),
    profile(barId, "Bar Maricota", "bar@mesai.demo", "bar")
  ];

  const tables: RestaurantTable[] = Array.from({ length: 15 }, (_, index) => ({
    id: `table_${index + 1}`,
    restaurantId,
    number: index + 1,
    name: `Mesa ${index + 1}`,
    status: index === 1 ? "occupied" : "free",
    active: true,
    createdAt,
    updatedAt: createdAt
  }));

  const tabs: Tab[] = [
    {
      id: "tab_open_2",
      restaurantId,
      tableId: "table_2",
      status: "open",
      openedBy: waiterId,
      openedAt: twelveAgo
    },
    {
      id: "tab_closed_1",
      restaurantId,
      tableId: "table_1",
      status: "closed",
      openedBy: waiterId,
      closedBy: ownerId,
      openedAt: oneHourAgo,
      closedAt: today
    }
  ];

  const openOrder: Order = {
    id: "order_open_2",
    restaurantId,
    tableId: "table_2",
    tabId: "tab_open_2",
    source: "waiter",
    status: "sent",
    createdBy: waiterId,
    subtotal: 30.8,
    discount: 0,
    serviceFee: 3.08,
    deliveryFee: 0,
    total: 33.88,
    notes: "Mesa chegou agora",
    createdAt: twelveAgo,
    updatedAt: twoAgo
  };

  const closedOrder: Order = {
    id: "order_closed_1",
    restaurantId,
    tableId: "table_1",
    tabId: "tab_closed_1",
    source: "waiter",
    status: "closed",
    createdBy: waiterId,
    closedBy: ownerId,
    subtotal: 66,
    discount: 0,
    serviceFee: 6.6,
    deliveryFee: 0,
    total: 72.6,
    createdAt: oneHourAgo,
    updatedAt: today,
    closedAt: today
  };

  const orderItems: OrderItem[] = [
    item("item_open_baiao", "order_open_2", "prod_baiao_comum", "Baião comum", 12, 1, "kitchen", "sent", "Caprichar no cheiro verde", fourAgo),
    item("item_open_cerveja", "order_open_2", "prod_cerveja_lata", "Cerveja lata", 5.9, 2, "bar", "preparing", "Bem gelada", sevenAgo),
    item("item_open_pao", "order_open_2", "prod_pao_alho", "Pão de alho", 7, 1, "kitchen", "ready", undefined, twoAgo),
    item("item_closed_carne", "order_closed_1", "prod_porcao_carne", "Porção de carne", 34, 1, "kitchen", "delivered", undefined, oneHourAgo),
    item("item_closed_refri", "order_closed_1", "prod_refri_lata", "Refrigerante lata", 6, 2, "bar", "delivered", undefined, oneHourAgo),
    item("item_closed_pastel", "order_closed_1", "prod_porcao_pastel", "Porção de pastel", 20, 1, "kitchen", "delivered", undefined, oneHourAgo)
  ];

  const payments: Payment[] = [
    {
      id: "pay_closed_pix",
      restaurantId,
      orderId: "order_closed_1",
      method: "pix",
      amount: 72.6,
      createdBy: ownerId,
      createdAt: today
    }
  ];

  const cashSessions: CashSession[] = [
    {
      id: "cash_open_today",
      restaurantId,
      openedBy: ownerId,
      openingAmount: 150,
      expectedAmount: 150,
      status: "open",
      openedAt: yesterday
    }
  ];

  const cashMovements: CashMovement[] = [
    {
      id: "cash_supply_initial",
      restaurantId,
      cashSessionId: "cash_open_today",
      type: "supply",
      amount: 150,
      description: "Troco inicial",
      createdBy: ownerId,
      createdAt: yesterday
    }
  ];

  return {
    restaurants: [restaurant],
    settings: [settings],
    profiles,
    tables,
    tableAlerts: [],
    tabs,
    categories: catalog.categories,
    products: catalog.products,
    productVariations: catalog.productVariations,
    productAddons: catalog.productAddons,
    productAllowedAddons: catalog.productAllowedAddons,
    orders: [openOrder, closedOrder],
    orderItems,
    orderItemAddons: [],
    payments,
    cashSessions,
    cashMovements,
    financialEntries: [
      {
        id: "fin_closed_order",
        restaurantId,
        type: "income",
        category: "sale",
        description: "Venda mesa 1",
        amount: 72.6,
        date: dateKey(now),
        paid: true,
        paymentMethod: "pix",
        orderId: "order_closed_1",
        createdBy: ownerId,
        createdAt: today,
        updatedAt: today
      },
      {
        id: "fin_demo_gas",
        restaurantId,
        type: "expense",
        category: "gas",
        description: "Botijão de gás",
        amount: 18,
        date: dateKey(now),
        paid: true,
        paymentMethod: "pix",
        notes: "Despesa demo",
        createdBy: ownerId,
        createdAt: today,
        updatedAt: today
      }
    ],
    stockMovements: [],
    customers: [],
    customerDebts: [],
    auditLogs: [],
    credentials: [
      { email: "dono@mesai.demo", password: "demo123", profileId: ownerId },
      { email: "garcom@mesai.demo", password: "demo123", profileId: waiterId },
      { email: "cozinha@mesai.demo", password: "demo123", profileId: kitchenId },
      { email: "bar@mesai.demo", password: "demo123", profileId: barId }
    ]
  };
}

function category(id: string, name: string, sortOrder: number): Category {
  return {
    id,
    restaurantId,
    name,
    sortOrder,
    active: true,
    createdAt,
    updatedAt: createdAt
  };
}

function product(
  id: string,
  categoryId: string,
  name: string,
  price: number,
  preparationSector: "kitchen" | "bar" | "none",
  estimatedTimeMinutes?: number,
  description?: string,
  stock?: { quantity: number; minimum: number; unit: StockUnit }
): Product {
  return {
    id,
    restaurantId,
    categoryId,
    name,
    description,
    price,
    preparationSector,
    estimatedTimeMinutes,
    available: true,
    hasStockControl: Boolean(stock),
    stockQuantity: stock?.quantity ?? 0,
    stockMinimum: stock?.minimum ?? 0,
    stockUnit: stock?.unit,
    active: true,
    createdAt,
    updatedAt: createdAt
  };
}

function pendingProduct(
  id: string,
  categoryId: string,
  name: string,
  preparationSector: "kitchen" | "bar" | "none",
  estimatedTimeMinutes?: number
): Product {
  return {
    ...product(id, categoryId, name, 0, preparationSector, estimatedTimeMinutes, "Preço pendente"),
    available: false,
    active: false
  };
}

function profile(id: string, name: string, email: string, role: Profile["role"]): Profile {
  return {
    id,
    userId: `user_${id}`,
    restaurantId,
    name,
    email,
    role,
    active: true,
    createdAt,
    updatedAt: createdAt
  };
}

function item(
  id: string,
  orderId: string,
  productId: string,
  productNameSnapshot: string,
  unitPriceSnapshot: number,
  quantity: number,
  preparationSector: "kitchen" | "bar" | "none",
  status: OrderItem["status"],
  notes: string | undefined,
  timestamp: string
): OrderItem {
  return {
    id,
    orderId,
    restaurantId,
    productId,
    productNameSnapshot,
    unitPriceSnapshot,
    quantity,
    notes,
    preparationSector,
    status,
    createdBy: waiterId,
    createdAt: timestamp,
    updatedAt: timestamp,
    sentAt: timestamp,
    preparingAt: ["preparing", "ready", "delivered"].includes(status) ? timestamp : undefined,
    readyAt: ["ready", "delivered"].includes(status) ? timestamp : undefined,
    deliveredAt: status === "delivered" ? timestamp : undefined
  };
}
