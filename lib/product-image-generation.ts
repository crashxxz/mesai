import { resolveProductImage } from "@/lib/product-image";
import type { Product } from "@/lib/types";

export type ProductVisualCategory = "petiscos" | "pratos" | "bebidas" | "sobremesas" | "churrasco" | "porcoes" | "drinks" | "sucos" | "refrigerantes" | "cervejas" | "aguas" | "default";
type ProductVisualInput = Pick<Product, "name" | "description" | "preparationSector"> & Partial<Product>;

function normalize(value: string | undefined) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Maps a product to the stable local visual library. A remote provider can replace this seam later. */
export function normalizeProductVisualCategory(product: ProductVisualInput, categoryName = ""): ProductVisualCategory {
  const text = normalize(`${product.name} ${product.description ?? ""} ${categoryName}`);
  if (/agua|h2o/.test(text)) return "aguas";
  if (/cerveja|long neck|heineken|brahma|skol|antarctica/.test(text)) return "cervejas";
  if (/refrigerante|refri|coca|guarana/.test(text)) return "refrigerantes";
  if (/suco|laranja|limao|maracuja/.test(text)) return "sucos";
  if (/caipirinha|gin|vodka|whisky|drink|cocktail/.test(text)) return "drinks";
  if (/sobremesa|pudim|bolo|sorvete|doce/.test(text)) return "sobremesas";
  if (/espeto|churrasco/.test(text)) return "churrasco";
  if (/porcao|pastel|batata|macaxeira|torresmo|tripa|bolinho/.test(text)) return "porcoes";
  if (/prato|arroz|feijao|baiao|carne|peixe/.test(text)) return "pratos";
  if (/bebida/.test(text) || product.preparationSector === "bar") return "bebidas";
  if (/petisco/.test(text)) return "petiscos";
  return "default";
}

export function buildProductImagePrompt(product: ProductVisualInput, categoryName = "") {
  const group = normalizeProductVisualCategory(product, categoryName);
  const name = product.name ?? "";
  const desc = product.description ? `, ${product.description}` : "";

  const baseStyle = "fotografia realista de cardápio profissional, fundo limpo e neutro, boa iluminação, foco no produto, sem texto, sem logotipo, sem marca d'água, sem pessoas, sem mãos, proporção quadrada";

  const groupPrompts: Record<ProductVisualCategory, string> = {
    petiscos: `porção de ${name}${desc}, servido em prato ou tigela simples, estilo petisco de boteco brasileiro, aparência caseira e apetitosa, ${baseStyle}`,
    pratos: `prato de ${name}${desc}, comida brasileira regional, servido em prato de cerâmica simples, porção generosa, ${baseStyle}`,
    bebidas: `${name}${desc}, bebida gelada, condensação no copo ou garrafa, ${baseStyle}`,
    sobremesas: `${name}${desc}, sobremesa brasileira, apresentação simples e apetitosa, ${baseStyle}`,
    churrasco: `${name}${desc}, carne grelhada suculenta, marcas de grelha, acompanhamento simples se aplicável, ${baseStyle}`,
    porcoes: `porção de ${name}${desc}, petisco de bar brasileiro, servido em prato ou cumbuca, aspecto crocante e dourado, ${baseStyle}`,
    drinks: `${name}${desc}, drink preparado em copo adequado, gelo, decoração discreta, ${baseStyle}`,
    sucos: `copo de ${name}${desc}, suco natural brasileiro, cor vibrante, gelo, fruta fresca como decoração, ${baseStyle}`,
    refrigerantes: `${name}${desc}, lata ou garrafa genérica gelada sem marca famosa visível, condensação, ${baseStyle}`,
    cervejas: `${name}${desc}, garrafa ou lata de cerveja genérica gelada sem marca famosa, condensação, copo opcional, ${baseStyle}`,
    aguas: `${name}${desc}, garrafa de água mineral genérica gelada, transparente, gotas de condensação, ${baseStyle}`,
    default: `${name}${desc}, item de cardápio brasileiro, apresentação simples e apetitosa, ${baseStyle}`
  };

  return groupPrompts[group];
}

/**
 * Current provider: curated local images. Keep this async contract so a server-side
 * image provider can be added later without coupling UI components to that provider.
 */
export async function generateProductImage(product: ProductVisualInput, categoryName = "") {
  const candidate = { ...product, imageUrl: undefined, image_url: undefined, generatedImageUrl: undefined, generated_image_url: undefined };
  return {
    url: resolveProductImage(candidate, categoryName),
    prompt: buildProductImagePrompt(product, categoryName),
    category: normalizeProductVisualCategory(product, categoryName)
  };
}

export async function saveGeneratedProductImage(
  product: ProductVisualInput,
  categoryName: string,
  save: (url: string) => void | Promise<void>
) {
  const generated = await generateProductImage(product, categoryName);
  await save(generated.url);
  return generated;
}
