import type { Product } from "@/lib/types";

type ProductImageCandidate = Partial<Product> & {
  image_url?: unknown;
  imagePath?: unknown;
  image_path?: unknown;
  image?: unknown;
  slug?: unknown;
};

const keywordImages: Array<{ words: string[]; path: string }> = [
  { words: ["pastel", "pastelzinho"], path: "/menu-images/petiscos/pastelzinho.webp" },
  { words: ["macaxeira", "mandioca", "aipim"], path: "/menu-images/petiscos/macaxeira.webp" },
  { words: ["batata", "fritas"], path: "/menu-images/petiscos/batata-rustica.webp" },
  { words: ["feijao", "feijão", "baiao", "baião"], path: "/menu-images/pratos/feijao-verde.webp" },
  { words: ["tripa"], path: "/menu-images/petiscos/tripa.png" },
  { words: ["torresmo"], path: "/menu-images/petiscos/torresmo.png" },
  { words: ["calabresa", "bolinho", "porcao", "porção", "queijo", "frango", "isca"], path: "/menu-images/petiscos/default-petisco.webp" },
  { words: ["cerveja", "heineken", "skol", "brahma", "antarctica", "long neck"], path: "/menu-images/cervejas/default-cerveja.webp" },
  { words: ["caipirinha", "gin", "vodka", "whisky", "drink", "cocktail"], path: "/menu-images/drinks/default-drink.webp" },
  { words: ["suco", "laranja", "limao", "limão", "maracuja", "maracujá"], path: "/menu-images/sucos/default-suco.webp" },
  { words: ["agua de coco", "água de coco"], path: "/menu-images/bebidas/agua-de-coco.png" },
  { words: ["h2o"], path: "/menu-images/bebidas/h2o.png" },
  { words: ["agua", "água"], path: "/menu-images/bebidas/agua.png" },
  { words: ["refri", "refrigerante", "coca", "guarana", "guaraná"], path: "/menu-images/refrigerantes/default-refrigerante.webp" },
  { words: ["pizza", "mussarela", "portuguesa", "catupiry"], path: "/menu-images/pizzas/default-pizza.webp" },
  { words: ["burger", "hamburguer", "hambúrguer", "x-burger", "x-salada", "artesanal"], path: "/menu-images/hamburgueres/default-burger.webp" },
  { words: ["pudim", "bolo", "sorvete", "doce", "sobremesa"], path: "/menu-images/sobremesas/default-sobremesa.webp" },
  { words: ["cafe", "café"], path: "/menu-images/cafe/default-cafe.webp" },
  { words: ["arroz", "feijao", "feijão", "carne", "peixe", "almoco", "almoço", "executivo", "prato"], path: "/menu-images/pratos/default-prato.webp" }
];

const categoryImages: Array<{ words: string[]; path: string }> = [
  { words: ["petisco", "porcao", "porção", "churrasco", "espeto"], path: "/menu-images/petiscos/default-petisco.webp" },
  { words: ["cerveja", "long neck", "energetico", "energético"], path: "/menu-images/cervejas/default-cerveja.webp" },
  { words: ["bebida", "agua", "água", "refrigerante"], path: "/menu-images/bebidas/default-bebida.webp" },
  { words: ["suco"], path: "/menu-images/sucos/default-suco.webp" },
  { words: ["drink"], path: "/menu-images/drinks/default-drink.webp" },
  { words: ["massa"], path: "/menu-images/massas/default-massa.webp" },
  { words: ["pizza"], path: "/menu-images/pizzas/default-pizza.webp" },
  { words: ["hamburg"], path: "/menu-images/hamburgueres/default-burger.webp" },
  { words: ["sobremesa", "doce"], path: "/menu-images/sobremesas/default-sobremesa.webp" },
  { words: ["cafe", "café", "quente"], path: "/menu-images/cafe/default-cafe.webp" },
  { words: ["prato", "arroz", "feijao", "feijão"], path: "/menu-images/pratos/default-prato.webp" }
];

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function firstImage(product: ProductImageCandidate) {
  return [product.imageUrl, product.image_url, product.imagePath, product.image_path, product.image]
    .map(text)
    .find(Boolean);
}

function match(textValue: string, entries: Array<{ words: string[]; path: string }>) {
  return entries.find((entry) => entry.words.some((word) => textValue.includes(normalized(word))))?.path;
}

/** Resolves the same image everywhere: own image, product name, category, then local fallback. */
export function resolveProductImage(product: ProductImageCandidate, categoryName = "") {
  const ownImage = firstImage(product);
  if (ownImage) return ownImage;

  const productMatch = match(normalized(`${text(product.name)} ${text(product.slug)}`), keywordImages);
  if (productMatch) return productMatch;

  return match(normalized(categoryName), categoryImages) ?? "/menu-images/default/default-food.webp";
}
