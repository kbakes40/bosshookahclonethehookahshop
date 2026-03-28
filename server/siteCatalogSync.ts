/**
 * Maps storefront `products` (client/src/lib/products.ts) to bh_products rows for Supabase.
 * Image paths like /images/x become absolute using the public site origin.
 */
import { products } from "../client/src/lib/products";
import type { Product } from "../client/src/lib/products";

const DEFAULT_ORIGIN = "https://www.thehookahshop.com";

function siteOrigin(): string {
  const o =
    process.env.VITE_SITE_ORIGIN?.trim() ||
    process.env.PUBLIC_SITE_URL?.trim() ||
    DEFAULT_ORIGIN;
  return o.replace(/\/$/, "");
}

function absImageUrl(image: string, origin: string): string {
  const trimmed = image.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${origin}${path}`;
}

export type BhProductInsert = {
  name: string;
  brand: string;
  category: string;
  price: number;
  cost: number | null;
  sale_price: number | null;
  stock: number;
  low_stock_threshold: number;
  sku: string;
  badge: string | null;
  in_stock: boolean;
  image_url: string | null;
  description: string | null;
  featured: boolean;
  trending: boolean;
  weight_lb: number | null;
  created_at: string;
  updated_at: string;
  /** Set by external importers (e.g. THS WooCommerce permalink) for dedup and enrichment */
  source_product_url?: string | null;
  /** JSON blob for importer-only fields (gallery, raw attributes, wp ids) */
  import_meta?: Record<string, unknown> | null;
};

/** One row per sellable SKU (products with variants are flattened). */
export function siteProductsToBhRows(
  catalog: Product[] = products,
  opts?: { origin?: string; defaultStock?: number }
): BhProductInsert[] {
  const origin = opts?.origin ?? siteOrigin();
  const defaultStock = opts?.defaultStock ?? 50;
  const now = new Date().toISOString();
  const out: BhProductInsert[] = [];

  for (const p of catalog) {
    const baseImage = absImageUrl(p.image, origin);

    if (!p.variants?.length) {
      out.push({
        name: p.name,
        brand: p.brand,
        category: p.category,
        price: p.price,
        cost: null,
        sale_price: p.salePrice ?? null,
        stock: defaultStock,
        low_stock_threshold: 10,
        sku: `catalog:${p.id}`,
        badge: p.badge ?? null,
        in_stock: p.inStock,
        image_url: baseImage,
        description: p.description ?? null,
        featured: Boolean(p.featured),
        trending: Boolean(p.trending),
        weight_lb: p.weightLb != null && p.weightLb > 0 ? p.weightLb : null,
        created_at: now,
        updated_at: now,
      });
      continue;
    }

    for (const v of p.variants) {
      const variantImage = v.image ? absImageUrl(v.image, origin) : baseImage;
      const vPrice = v.price ?? p.price;
      const vSale = v.salePrice ?? p.salePrice ?? null;
      out.push({
        name: `${p.name} — ${v.name}`,
        brand: p.brand,
        category: p.category,
        price: vPrice,
        cost: null,
        sale_price: vSale,
        stock: defaultStock,
        low_stock_threshold: 10,
        sku: `catalog:${p.id}:${v.id}`,
        badge: p.badge ?? null,
        in_stock: p.inStock,
        image_url: variantImage,
        description: v.description ?? p.description ?? null,
        featured: Boolean(p.featured),
        trending: Boolean(p.trending),
        weight_lb: p.weightLb != null && p.weightLb > 0 ? p.weightLb : null,
        created_at: now,
        updated_at: now,
      });
    }
  }

  return out;
}

export function countSiteCatalogSkus(): number {
  return siteProductsToBhRows(products).length;
}
