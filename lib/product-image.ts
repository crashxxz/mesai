import type { Product } from "@/lib/types";

// Visual types for product image classification
export type ProductVisualType =
  | "agua" | "agua_coco" | "suco" | "refrigerante"
  | "cerveja" | "long_neck" | "energetico"
  | "dose" | "vinho" | "drink" | "cafe"
  | "petisco" | "churrasco" | "prato" | "sobremesa"
  | "pizza" | "hamburger" | "massa"
  | "placeholder";

type ProductImageCandidate = Partial<Product> & {
  image_url?: unknown;
  generatedImageUrl?: unknown;
  generated_image_url?: unknown;
  imagePath?: unknown;
  image_path?: unknown;
  image?: unknown;
  slug?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function norm(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Classifies a product into a visual type based on name + category + description */
export function getProductVisualType(product: ProductImageCandidate, categoryName = ""): ProductVisualType {
  const combined = norm(`${text(product.name)} ${text(product.description)} ${categoryName}`);
  const name = norm(text(product.name));

  // Specific matches first (order matters — more specific before generic)

  // Águas
  if (/agua de coco|água de coco/.test(name)) return "agua_coco";
  if (/h2o/.test(name)) return "agua";
  if (/^agua|^água/.test(name) || (combined.includes("agua") && !combined.includes("suco"))) return "agua";

  // Energéticos (before cerveja to avoid misclassification)
  if (/red bull|monster|energetico|energético|energy/.test(combined)) return "energetico";

  // Cervejas
  if (/long neck/.test(combined)) return "long_neck";
  if (/cerveja|heineken|skol|brahma|antarctica|corona|budweiser|spaten|stella|bohemia|original|amstel|devassa|cabare|cabaré|litrinho|latinha/.test(combined)) return "cerveja";

  // Doses / Bebidas quentes (destilados)
  if (/whisky|whiskey|red label|black.*white|old parr|white horse/.test(combined)) return "dose";
  if (/vodka|absolut|smirnoff|orloff/.test(combined)) return "dose";
  if (/cachaca|cachaça|pitu|pitú|ypioca|ypióca|dreher|51/.test(combined)) return "dose";
  if (/rum|montilla|bacardi/.test(combined)) return "dose";
  if (/martini|campari/.test(combined)) return "dose";

  // Vinho
  if (/vinho|taca|taça/.test(combined)) return "vinho";

  // Drinks preparados
  if (/caipirinha|gin|drink|cocktail|coquetel/.test(combined)) return "drink";

  // Café
  if (/cafe|café/.test(combined)) return "cafe";

  // Sucos
  if (/suco|laranja|limao|limão|maracuja|maracujá|goiaba|acerola|manga|caja|cajá|cajarana|abacaxi/.test(combined)) return "suco";

  // Refrigerantes
  if (/pepsi|coca|coca-cola|guarana|guaraná|refri|refrigerante/.test(combined)) return "refrigerante";

  // Sobremesas
  if (/pudim|bolo|sorvete|doce|sobremesa/.test(combined)) return "sobremesa";

  // Pizza
  if (/pizza|mussarela|portuguesa|catupiry/.test(combined)) return "pizza";

  // Hamburger
  if (/burger|hamburguer|hambúrguer|x-burger|x-salada/.test(combined)) return "hamburger";

  // Massa
  if (/massa|lasanha|espaguete|macarrao|macarrão/.test(combined)) return "massa";

  // Churrasco / Espetinhos
  if (/espeto|espetinho|linguica|linguiça|mistao|mistão|churrasco|picanha|maminha/.test(combined)) return "churrasco";

  // Petiscos
  if (/pastel|macaxeira|mandioca|batata|batatinha|torresmo|tripa|bolinho|bolinha|calabresa|isca|porcao|porção|petisco|mungunza|mungunzá|pao de alho|pão de alho/.test(combined)) return "petisco";

  // Pratos
  if (/arroz|feijao|feijão|baiao|baião|carne|peixe|prato|almoco|almoço|carreteiro|executivo/.test(combined)) return "prato";

  // Category-level fallback
  if (/energetico|energético/.test(norm(categoryName))) return "energetico";
  if (/cerveja|long neck/.test(norm(categoryName))) return "cerveja";
  if (/refrigerante|refri/.test(norm(categoryName))) return "refrigerante";
  if (/suco/.test(norm(categoryName))) return "suco";
  if (/agua|água/.test(norm(categoryName))) return "agua";
  if (/bebida|dose|quente/.test(norm(categoryName))) return "dose";
  if (/petisco|porcao|porção/.test(norm(categoryName))) return "petisco";
  if (/churrasco|espeto/.test(norm(categoryName))) return "churrasco";
  if (/prato/.test(norm(categoryName))) return "prato";
  if (/drink/.test(norm(categoryName))) return "drink";

  return "placeholder";
}

// Map visual type to the best available REAL image, or null if none is trustworthy
const typeToImage: Record<ProductVisualType, string | null> = {
  agua: "/menu-images/bebidas/agua.png",
  agua_coco: "/menu-images/bebidas/agua-de-coco.png",
  suco: null,
  refrigerante: null,
  cerveja: null,
  long_neck: null,
  energetico: null,
  dose: null,
  vinho: null,
  drink: null,
  cafe: "/menu-images/cafe/default-cafe.webp",
  petisco: null,
  churrasco: null,
  prato: null,
  sobremesa: "/menu-images/sobremesas/default-sobremesa.webp",
  pizza: "/menu-images/pizzas/default-pizza.webp",
  hamburger: "/menu-images/hamburgueres/default-burger.webp",
  massa: "/menu-images/massas/default-massa.webp",
  placeholder: null
};

// Some products have specific real images (better than placeholder)
const specificImages: Array<{ words: string[]; path: string }> = [
  { words: ["pastel", "pastelzinho"], path: "/menu-images/petiscos/pastelzinho.webp" },
  { words: ["macaxeira", "mandioca", "aipim"], path: "/menu-images/petiscos/macaxeira.webp" },
  { words: ["batata", "batatinha", "rustica", "rústica", "fritas"], path: "/menu-images/petiscos/batata-rustica.webp" },
  { words: ["feijao", "feijão", "baiao", "baião"], path: "/menu-images/pratos/feijao-verde.webp" },
  { words: ["tripa"], path: "/menu-images/petiscos/tripa.png" },
  { words: ["torresmo"], path: "/menu-images/petiscos/torresmo.png" },
  { words: ["h2o"], path: "/menu-images/bebidas/h2o.png" },
  { words: ["agua de coco", "água de coco"], path: "/menu-images/bebidas/agua-de-coco.png" }
];

function firstManualImage(product: ProductImageCandidate) {
  return [product.imageUrl, product.image_url, product.imagePath, product.image_path, product.image]
    .map(text)
    .find(Boolean);
}

function generatedImage(product: ProductImageCandidate) {
  return [product.generatedImageUrl, product.generated_image_url].map(text).find(Boolean);
}

/** Resolves the best image for a product. Conservative: prefers placeholder over wrong image. */
export function resolveProductImage(product: ProductImageCandidate, categoryName = ""): string | null {
  // 1. Manual image always wins
  const manual = firstManualImage(product);
  if (manual) return manual;

  // 2. Previously generated image
  const generated = generatedImage(product);
  if (generated) return generated;

  // 3. Specific real image by keyword (high confidence matches only)
  const productName = norm(text(product.name));
  const specific = specificImages.find((entry) =>
    entry.words.some((word) => productName.includes(norm(word)))
  );
  if (specific) return specific.path;

  // 4. Type-based real image (only if we have a trustworthy real photo, otherwise null)
  const type = getProductVisualType(product, categoryName);
  return typeToImage[type];
}
