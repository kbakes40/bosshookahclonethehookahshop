import { trpc } from "@/lib/trpc";
import { products as staticCatalog } from "@/lib/products";

/**
 * Live catalog from Supabase `bh_products` via `store.listProducts`.
 * On fetch error only, falls back to bundled static `products` so the site stays usable.
 */
export function useStorefrontCatalog() {
  const query = trpc.store.listProducts.useQuery(undefined, {
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const products =
    query.data ?? (query.isError ? staticCatalog : []);

  return { products, query };
}
