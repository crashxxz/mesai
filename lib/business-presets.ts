export type BusinessProfile =
  | "boteco_popular"
  | "restaurante"
  | "bar_noturno"
  | "hamburgueria"
  | "pizzaria"
  | "cafeteria"
  | "lanchonete"
  | "espetaria"
  | "balcao";

export interface BusinessPreset {
  id: BusinessProfile;
  label: string;
  description: string;
  menuLabels: {
    dashboard: string;
    tables: string;
    kitchen: string;
    bar: string;
    cash: string;
    products: string;
    finance: string;
    settings: string;
  };
  dashboardTexts: {
    heroEyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    salesToday: string;
    activeTables: string;
    readyOrders: string;
    kitchenQueue: string;
    barQueue: string;
    alerts: string;
    ownerFocus: string;
    moneySummary: string;
  };
  quickActions: {
    openTable: string;
    addOrder: string;
    addDrink: string;
    closeAccount: string;
    deliverReady: string;
    sendToPrep: string;
  };
  qrTexts: {
    title: string;
    subtitle: string;
    addButton: string;
    sendOrder: string;
    callWaiter: string;
    askBill: string;
    whatsapp: string;
    directions: string;
    orderSent: string;
    waiterCalled: string;
    billRequested: string;
  };
  emptyStates: {
    tables: string;
    preparation: string;
    ready: string;
    cart: string;
  };
  productSuggestions: string[];
  tone: string;
  themeHints: {
    primary: string;
    confirm: string;
    background: string;
    density: "compact" | "comfortable";
  };
  evolution: {
    status: "complete" | "planned";
    priorities: string[];
    initialCategories: string[];
    primaryFlow: string[];
    futureCapabilities: string[];
  };
}

export const businessProfileStorageKey = "mesai-business-profile";
export const defaultBusinessProfile: BusinessProfile = "boteco_popular";

const botecoPopular: BusinessPreset = {
  id: "boteco_popular",
  label: "Boteco popular",
  description: "Bar simples, informal e rápido de operar no celular.",
  menuLabels: {
    dashboard: "Agora",
    tables: "Mesas",
    kitchen: "Cozinha",
    bar: "Bar",
    cash: "Caixa",
    products: "Cardápio",
    finance: "Financeiro",
    settings: "Ajustes"
  },
  dashboardTexts: {
    heroEyebrow: "Boteco rodando",
    heroTitle: "Hoje no balcão",
    heroSubtitle: "Bateu o olho: dinheiro, mesas e pedidos parados.",
    salesToday: "Entrou no caixa",
    activeTables: "Mesas em atendimento",
    readyOrders: "Pedidos prontos",
    kitchenQueue: "Fila da cozinha",
    barQueue: "Fila do bar",
    alerts: "Alertas",
    ownerFocus: "Dono olha primeiro",
    moneySummary: "Resumo do caixa"
  },
  quickActions: {
    openTable: "Abrir mesa",
    addOrder: "Adicionar pedido",
    addDrink: "Mais uma cerveja",
    closeAccount: "Fechar conta",
    deliverReady: "Entregar pedido pronto",
    sendToPrep: "Mandar para preparo"
  },
  qrTexts: {
    title: "Cardápio da mesa",
    subtitle: "Pedir agora, chamar garçom ou pedir conta.",
    addButton: "Pedir agora",
    sendOrder: "Enviar pedido",
    callWaiter: "Chamar garçom",
    askBill: "Pedir conta",
    whatsapp: "Abrir WhatsApp",
    directions: "Como chegar",
    orderSent: "Pedido chegou na cozinha.",
    waiterCalled: "Garçom chamado. Já vamos até você.",
    billRequested: "Conta solicitada. Aguarde na mesa."
  },
  emptyStates: {
    tables: "Comece abrindo uma mesa livre.",
    preparation: "Nada aqui.",
    ready: "Tudo certo por aqui.",
    cart: "Escolha um item do cardápio."
  },
  productSuggestions: [
    "Cerveja 600ml",
    "Cerveja lata",
    "Baião mole",
    "Tripa",
    "Macaxeira",
    "Feijão verde",
    "Espeto",
    "Porção de pastel"
  ],
  tone: "popular, direto, sem gourmetizar",
  themeHints: {
    primary: "#F59E0B",
    confirm: "#10B981",
    background: "#FFF7ED",
    density: "compact"
  },
  evolution: {
    status: "complete",
    priorities: ["mesas", "cerveja", "cozinha", "bar", "caixa", "QR simples"],
    initialCategories: ["Bebidas", "Cervejas", "Sucos", "Baião", "Porções", "Espetos", "Petiscos"],
    primaryFlow: ["abrir mesa", "adicionar pedido", "preparar", "entregar", "fechar conta"],
    futureCapabilities: ["estoque por insumo", "fidelidade", "fiado controlado"]
  }
};

const presets: Record<BusinessProfile, BusinessPreset> = {
  boteco_popular: botecoPopular,
  restaurante: {
    ...botecoPopular,
    id: "restaurante",
    label: "Restaurante",
    description: "Salão com atendimento por mesa e fluxo de cozinha.",
    dashboardTexts: {
      ...botecoPopular.dashboardTexts,
      heroEyebrow: "Movimento de hoje",
      heroTitle: "Movimento de hoje",
      activeTables: "Salão",
      salesToday: "Entrou hoje"
    },
    quickActions: {
      ...botecoPopular.quickActions,
      addDrink: "Adicionar item"
    },
    qrTexts: {
      ...botecoPopular.qrTexts,
      title: "Ver cardápio",
      callWaiter: "Solicitar atendimento",
      askBill: "Solicitar conta"
    },
    productSuggestions: ["Prato do dia", "Refrigerante", "Suco", "Sobremesa"],
    evolution: {
      status: "planned",
      priorities: ["salão", "pratos", "cozinha", "fechamento detalhado"],
      initialCategories: ["Entradas", "Pratos", "Bebidas", "Sobremesas"],
      primaryFlow: ["receber mesa", "lançar pratos", "produzir", "servir", "fechar conta"],
      futureCapabilities: ["reservas", "mapa do salão", "sequência de pratos"]
    }
  },
  bar_noturno: {
    ...botecoPopular,
    id: "bar_noturno",
    label: "Bar noturno",
    description: "Comandas, drinks e fechamento rápido.",
    dashboardTexts: {
      ...botecoPopular.dashboardTexts,
      heroEyebrow: "Noite em andamento",
      heroTitle: "Noite em andamento",
      barQueue: "Drinks na fila"
    },
    menuLabels: {
      ...botecoPopular.menuLabels,
      tables: "Comandas"
    },
    quickActions: {
      ...botecoPopular.quickActions,
      closeAccount: "Fechar comanda"
    },
    productSuggestions: ["Drink", "Cerveja long neck", "Porção", "Água"],
    evolution: {
      status: "planned",
      priorities: ["comandas", "drinks", "bar", "fechamento rápido"],
      initialCategories: ["Cervejas", "Drinks", "Doses", "Porções"],
      primaryFlow: ["abrir comanda", "lançar bebida", "preparar", "entregar", "fechar comanda"],
      futureCapabilities: ["ficha de drink", "controle de doses", "eventos"]
    }
  },
  hamburgueria: {
    ...botecoPopular,
    id: "hamburgueria",
    label: "Hamburgueria",
    description: "Pedidos em produção, combos e retirada.",
    dashboardTexts: {
      ...botecoPopular.dashboardTexts,
      heroTitle: "Pedidos em produção",
      kitchenQueue: "Lanches na fila"
    },
    quickActions: {
      ...botecoPopular.quickActions,
      addOrder: "Montar lanche",
      deliverReady: "Retirar no balcão"
    },
    productSuggestions: ["Combo", "Hambúrguer", "Batata", "Refrigerante"],
    evolution: {
      status: "planned",
      priorities: ["adicionais", "combos", "produção", "balcão"],
      initialCategories: ["Hambúrgueres", "Combos", "Acompanhamentos", "Bebidas"],
      primaryFlow: ["montar pedido", "produzir", "embalar", "entregar ou retirar"],
      futureCapabilities: ["montagem de lanche", "combos", "senhas de retirada"]
    }
  },
  pizzaria: {
    ...botecoPopular,
    id: "pizzaria",
    label: "Pizzaria",
    description: "Pizzas na fila, sabores e entrega/retirada.",
    dashboardTexts: {
      ...botecoPopular.dashboardTexts,
      kitchenQueue: "Pizzas na fila"
    },
    quickActions: {
      ...botecoPopular.quickActions,
      addOrder: "Adicionar pizza"
    },
    productSuggestions: ["Pizza", "Meia pizza", "Sabores", "Entrega/retirada"],
    evolution: {
      status: "planned",
      priorities: ["sabores", "bordas", "delivery", "retirada"],
      initialCategories: ["Pizzas", "Bebidas", "Combos", "Sobremesas"],
      primaryFlow: ["montar pizza", "assar", "embalar", "entregar ou retirar"],
      futureCapabilities: ["meio a meio", "bordas", "taxa por bairro"]
    }
  },
  cafeteria: {
    ...botecoPopular,
    id: "cafeteria",
    label: "Cafeteria",
    description: "Pedidos do balcão, cafés, doces e retirada.",
    dashboardTexts: {
      ...botecoPopular.dashboardTexts,
      heroTitle: "Pedidos do balcão"
    },
    productSuggestions: ["Cafés", "Doces", "Salgados", "Retirada"],
    evolution: {
      status: "planned",
      priorities: ["balcão", "cafés", "doces", "retirada"],
      initialCategories: ["Cafés", "Bebidas", "Doces", "Salgados"],
      primaryFlow: ["receber pedido", "preparar", "chamar", "entregar"],
      futureCapabilities: ["tamanhos", "leites", "fidelidade"]
    }
  },
  lanchonete: {
    ...botecoPopular,
    id: "lanchonete",
    label: "Lanchonete",
    description: "Lanches, balcão e pedidos rápidos.",
    menuLabels: {
      ...botecoPopular.menuLabels,
      tables: "Balcão"
    },
    productSuggestions: ["Lanches", "Sucos", "Salgados", "Pedidos rápidos"],
    evolution: {
      status: "planned",
      priorities: ["lanches", "balcão", "pedidos rápidos", "retirada"],
      initialCategories: ["Lanches", "Salgados", "Sucos", "Bebidas"],
      primaryFlow: ["anotar pedido", "preparar", "chamar", "entregar"],
      futureCapabilities: ["senhas", "combos", "retirada"]
    }
  },
  espetaria: {
    ...botecoPopular,
    id: "espetaria",
    label: "Espetaria",
    description: "Espetos, churrasqueira e pedidos rápidos.",
    dashboardTexts: {
      ...botecoPopular.dashboardTexts,
      kitchenQueue: "Churrasqueira"
    },
    quickActions: {
      ...botecoPopular.quickActions,
      addDrink: "Mais um espeto"
    },
    productSuggestions: ["Espetos", "Pão de alho", "Cerveja", "Macaxeira"],
    evolution: {
      status: "planned",
      priorities: ["espetos", "churrasqueira", "bebidas", "mesas"],
      initialCategories: ["Espetos", "Acompanhamentos", "Cervejas", "Bebidas"],
      primaryFlow: ["abrir mesa", "lançar espeto", "assar", "entregar", "fechar conta"],
      futureCapabilities: ["ponto da carne", "churrasqueira", "combos"]
    }
  },
  balcao: {
    ...botecoPopular,
    id: "balcao",
    label: "Balcão",
    description: "Atendimento rápido, pedido no balcão e retirada.",
    dashboardTexts: {
      ...botecoPopular.dashboardTexts,
      heroTitle: "Atendimento rápido"
    },
    quickActions: {
      ...botecoPopular.quickActions,
      openTable: "Pedido no balcão",
      deliverReady: "Retirada"
    },
    productSuggestions: ["Pedido no balcão", "Retirada", "Lanche rápido", "Bebida"],
    evolution: {
      status: "planned",
      priorities: ["balcão", "agilidade", "senha", "retirada"],
      initialCategories: ["Mais pedidos", "Lanches", "Bebidas", "Combos"],
      primaryFlow: ["registrar pedido", "receber", "preparar", "chamar", "entregar"],
      futureCapabilities: ["senhas", "painel de retirada", "pré-pagamento"]
    }
  }
};

export const businessPresets = presets;
export const businessPresetOptions = Object.values(presets).map((preset) => ({
  id: preset.id,
  label: preset.label,
  description: preset.description
}));

export function getBusinessPreset(profile?: string): BusinessPreset {
  if (profile && profile in presets) return presets[profile as BusinessProfile];
  return presets[defaultBusinessProfile];
}
