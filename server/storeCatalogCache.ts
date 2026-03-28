import type { Product } from "../client/src/lib/products";
import {
  fetchAndGroupHomeHighlightProducts,
  fetchStorefrontListRows,
  groupBhProductRowsToStorefrontProducts,
} from "./storeCatalog";

type Highlights = Awaited<ReturnType<typeof fetchAndGroupHomeHighlightProducts>>;

let groupedCache: { products: Product[]; at: number } | null = null;
let highlightsCache: { data: Highlights; at: number } | null = null;

const GROUP_TTL_MS = 45_000;
const HIGHLIGHT_TTL_MS = 30_000;

export async function getCachedGroupedStorefrontProducts(): Promise<Product[]> {
  const now = Date.now();
  if (groupedCache && now - groupedCache.at < GROUP_TTL_MS) {
    return groupedCache.products;
  }
  const rows = await fetchStorefrontListRows();
  const products = groupBhProductRowsToStorefrontProducts(rows);
  groupedCache = { products, at: now };
  return products;
}

export async function getCachedHomeHighlights(): Promise<Highlights> {
  const now = Date.now();
  if (highlightsCache && now - highlightsCache.at < HIGHLIGHT_TTL_MS) {
    return highlightsCache.data;
  }
  const data = await fetchAndGroupHomeHighlightProducts();
  highlightsCache = { data, at: now };
  return data;
}

/** Call after mutations that change storefront-visible catalog rows. */
export function invalidateStorefrontCatalogCaches(): void {
  groupedCache = null;
  highlightsCache = null;
}
