import { getProductVisualType, resolveProductImage, type ProductVisualType } from "@/lib/product-image";
import type { Product } from "@/lib/types";

type ProductVisualInput = Pick<Product, "name" | "description" | "preparationSector"> & Partial<Product>;

export function buildProductImagePrompt(product: ProductVisualInput, categoryName = "") {
  const type = getProductVisualType(product, categoryName);
  const name = product.name ?? "";
  const desc = product.description ? `, ${product.description}` : "";

  const baseStyle = "fotografia realista de cardápio profissional, fundo limpo e neutro, boa iluminação, foco no produto, sem texto, sem logotipo, sem marca d'água, sem pessoas, sem mãos, proporção quadrada";

  const prompts: Record<ProductVisualType, string> = {
    agua: `garrafa de água mineral genérica gelada, transparente, gotas de condensação, ${baseStyle}`,
    agua_coco: `água de coco natural em copo ou embalagem genérica, ${baseStyle}`,
    suco: `copo de ${name}${desc}, suco natural brasileiro, cor vibrante, gelo, ${baseStyle}`,
    refrigerante: `${name}${desc}, lata ou garrafa de refrigerante genérica sem marca famosa visível, gelada, ${baseStyle}`,
    cerveja: `${name}${desc}, garrafa ou lata de cerveja genérica gelada sem marca, condensação, ${baseStyle}`,
    long_neck: `garrafa long neck genérica gelada sem marca famosa, condensação, ${baseStyle}`,
    energetico: `lata de energético genérica gelada sem marca famosa, design moderno, ${baseStyle}`,
    dose: `copo pequeno de dose de ${name}${desc}, bebida destilada genérica, sem marca, ${baseStyle}`,
    vinho: `taça de vinho tinto ou rosé, elegante, ${baseStyle}`,
    drink: `${name}${desc}, drink preparado em copo adequado, gelo, decoração discreta, ${baseStyle}`,
    cafe: `xícara de café brasileiro, quente, fumegante, ${baseStyle}`,
    petisco: `porção de ${name}${desc}, petisco de bar brasileiro, servido em prato ou cumbuca, aspecto crocante e dourado, ${baseStyle}`,
    churrasco: `${name}${desc}, carne grelhada suculenta no espeto ou prato, marcas de grelha, ${baseStyle}`,
    prato: `prato de ${name}${desc}, comida brasileira regional, servido em prato de cerâmica simples, porção generosa, ${baseStyle}`,
    sobremesa: `${name}${desc}, sobremesa brasileira, apresentação simples e apetitosa, ${baseStyle}`,
    pizza: `${name}${desc}, pizza cortada vista de cima, queijo derretido, ${baseStyle}`,
    hamburger: `${name}${desc}, hambúrguer artesanal suculento, ${baseStyle}`,
    massa: `${name}${desc}, prato de massa italiana, ${baseStyle}`,
    placeholder: `${name}${desc}, item de cardápio brasileiro, apresentação simples e apetitosa, ${baseStyle}`
  };

  return prompts[type];
}

/** Normalize visual category for backward compatibility */
export type ProductVisualCategory = "petiscos" | "pratos" | "bebidas" | "sobremesas" | "churrasco" | "porcoes" | "drinks" | "sucos" | "refrigerantes" | "cervejas" | "aguas" | "default";

export function normalizeProductVisualCategory(product: ProductVisualInput, categoryName = ""): ProductVisualCategory {
  const type = getProductVisualType(product, categoryName);
  const map: Record<ProductVisualType, ProductVisualCategory> = {
    agua: "aguas", agua_coco: "aguas", suco: "sucos", refrigerante: "refrigerantes",
    cerveja: "cervejas", long_neck: "cervejas", energetico: "bebidas",
    dose: "drinks", vinho: "drinks", drink: "drinks", cafe: "bebidas",
    petisco: "petiscos", churrasco: "churrasco", prato: "pratos", sobremesa: "sobremesas",
    pizza: "pratos", hamburger: "pratos", massa: "pratos", placeholder: "default"
  };
  return map[type];
}

/**
 * Current provider: SVG placeholders + curated local images.
 * Keep async contract for future server-side image provider.
 */
export async function generateProductImage(product: ProductVisualInput, categoryName = "") {
  const candidate = { ...product, imageUrl: undefined, image_url: undefined, generatedImageUrl: undefined, generated_image_url: undefined };
  return {
    url: resolveProductImage(candidate, categoryName) ?? undefined,
    prompt: buildProductImagePrompt(product, categoryName),
    type: getProductVisualType(product, categoryName)
  };
}

export async function saveGeneratedProductImage(
  product: ProductVisualInput,
  categoryName: string,
  save: (url: string) => void | Promise<void>
) {
  const generated = await generateProductImage(product, categoryName);
  if (generated.url) await save(generated.url);
  return generated;
}
