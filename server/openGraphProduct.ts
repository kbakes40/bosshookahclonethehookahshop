import { stripHtmlToPlainText } from "../shared/htmlPlainText";
import { getStorefrontProductById } from "./storeCatalog";

export type ProductOpenGraphMeta = {
  title: string;
  description: string;
  image: string;
  url: string;
};

function absoluteImageUrl(imageRaw: string, origin: string): string {
  const t = imageRaw.trim();
  if (!t) return `${origin}/og-image.png?v=3`;
  if (/^https?:\/\//i.test(t)) return t;
  return `${origin}${t.startsWith("/") ? t : `/${t}`}`;
}

/** Build OG/Twitter meta for link unfurling (iMessage, Slack, etc.). */
export async function buildOpenGraphProductMeta(
  productId: string,
  requestOrigin: string,
  variantId?: string | null
): Promise<ProductOpenGraphMeta | null> {
  const product = await getStorefrontProductById(productId.trim());
  if (!product) return null;

  const origin = requestOrigin.replace(/\/$/, "");
  const vid = variantId?.trim();
  const variant = vid ? product.variants?.find(v => v.id === vid) : undefined;

  const imageRaw = (variant?.image || product.image || "").trim();
  const image = absoluteImageUrl(imageRaw, origin);

  let description = stripHtmlToPlainText(product.description ?? "", 320);
  if (variant?.description?.trim()) {
    const vd = stripHtmlToPlainText(variant.description, 200);
    description = description ? `${description} ${vd}` : vd;
  }
  if (variant?.name) {
    description = description ? `${variant.name}. ${description}` : variant.name;
  }
  if (!description && product.brand?.trim()) {
    description = `${product.brand.trim()} — ${product.name}`;
  }
  if (!description) {
    description = `Shop ${product.name} at The Hookah Shop.`;
  }
  if (description.length > 320) {
    description = `${description.slice(0, 319).trim()}\u2026`;
  }

  const qs = vid ? `?variant=${encodeURIComponent(vid)}` : "";
  const url = `${origin}/product/${encodeURIComponent(product.id)}${qs}`;
  const title = variant
    ? `${product.name} — ${variant.name} | The Hookah Shop`
    : `${product.name} | The Hookah Shop`;

  return { title, description, image, url };
}
