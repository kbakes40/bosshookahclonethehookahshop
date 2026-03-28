/**
 * Store Router — public catalog/supporting checkout (Supabase bh_*)
 */

import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "./_core/supabaseAdmin";
import { mapStoreSettingsRow } from "./_core/supabaseMappers";
import {
  getCachedGroupedStorefrontProducts,
  getCachedHomeHighlights,
} from "./storeCatalogCache";
import { getStorefrontProductById } from "./storeCatalog";
import {
  categoryMatches,
  filterProductsForGrid,
  matchCategoryNavHits,
  rankProductsBySearch,
  sortStorefrontProducts,
} from "./storeCatalogQuery";

const defaultStoreSettings = () =>
  mapStoreSettingsRow({
    id: null,
    store_name: "The Hookah Shop",
    address: "15320 Michigan Ave",
    city: "Dearborn",
    state: "MI",
    zip_code: "48126",
    phone: "(313) 200-1873",
    email: "thehookahshoponline@gmail.com",
    hours:
      "In-store: Mon–Sun, 12:00 PM – Midnight\nPhone & web: Mon–Sun, 11:00 AM – 11:00 PM",
    pickup_instructions:
      "Please bring your order confirmation and a valid ID when picking up your order. Call or text us at (313) 200-1873 if you have any questions.",
    zelle_email: null,
    zelle_phone: "313-200-1873",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })!;

export const storeRouter = router({
  getSettings: publicProcedure.query(async () => {
    const { data, error } = await supabaseAdmin
      .from("bh_store_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    return mapStoreSettingsRow((data ?? null) as Record<string, unknown> | null) ?? defaultStoreSettings();
  }),

  /** Full storefront catalog (cached ~45s). Prefer `listProductsPage` / `searchProducts` on the client. */
  listProducts: publicProcedure.query(async () => {
    return getCachedGroupedStorefrontProducts();
  }),

  /** Trending + featured sections only (cached ~30s). */
  listHomeHighlights: publicProcedure.query(async () => {
    return getCachedHomeHighlights();
  }),

  listProductsPage: publicProcedure
    .input(
      z.object({
        category: z.string().default("all"),
        brand: z.string().optional(),
        priceMin: z.number().min(0).default(0),
        priceMax: z.number().min(0).default(999_999),
        showInStock: z.boolean().default(false),
        showOutOfStock: z.boolean().default(false),
        sortBy: z
          .enum(["best-selling", "price-low", "price-high", "newest"])
          .default("best-selling"),
        limit: z.number().min(1).max(48).default(24),
        cursor: z.number().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const offset = input.cursor ?? 0;
        const all = await getCachedGroupedStorefrontProducts();
        const base =
          input.category === "all" || input.category.trim() === ""
            ? all
            : all.filter(p => categoryMatches(p.category, input.category));
        const inStockCount = base.filter(p => p.inStock).length;
        const outOfStockCount = base.filter(p => !p.inStock).length;

        let filtered = filterProductsForGrid(all, {
          category: input.category,
          brand: input.brand,
          priceMin: input.priceMin,
          priceMax: input.priceMax,
          showInStock: input.showInStock,
          showOutOfStock: input.showOutOfStock,
        });
        filtered = sortStorefrontProducts(filtered, input.sortBy);
        const total = filtered.length;
        const products = filtered.slice(offset, offset + input.limit);
        const nextCursor =
          offset + input.limit < total ? offset + input.limit : null;

        return {
          products,
          total,
          inStockCount,
          outOfStockCount,
          nextCursor,
        };
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : typeof cause === "string"
              ? cause
              : "Failed to load products";
        console.error("[store.listProductsPage]", cause);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
          cause: cause instanceof Error ? cause : undefined,
        });
      }
    }),

  searchProducts: publicProcedure
    .input(
      z.object({
        q: z.string(),
        category: z.string().optional(),
        limit: z.number().min(1).max(48).default(24),
        cursor: z.number().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      const offset = input.cursor ?? 0;
      const all = await getCachedGroupedStorefrontProducts();
      const pool =
        input.category?.trim() && input.category.trim().toLowerCase() !== "all"
          ? all.filter(p => categoryMatches(p.category, input.category!.trim()))
          : all;
      const ranked = rankProductsBySearch(pool, input.q);
      const sorted = ranked.map(r => r.product);
      const total = sorted.length;
      const products = sorted.slice(offset, offset + input.limit);
      const nextCursor =
        offset + input.limit < total ? offset + input.limit : null;
      return { products, total, nextCursor };
    }),

  /**
   * Predictive search: idle snapshot (popular + trends) or ranked preview + facet hints.
   * Uses the same cached catalog as the rest of the storefront (production-safe).
   */
  searchPreview: publicProcedure
    .input(
      z.object({
        q: z.string().max(120).optional(),
        category: z.string().optional(),
        previewLimit: z.number().min(4).max(24).default(10),
      })
    )
    .query(async ({ input }) => {
      const all = await getCachedGroupedStorefrontProducts();
      const highlights = await getCachedHomeHighlights();
      const q = (input.q ?? "").trim();
      const cat =
        input.category?.trim() && input.category.trim().toLowerCase() !== "all"
          ? input.category.trim()
          : "";
      const pool = cat ? all.filter(p => categoryMatches(p.category, cat)) : all;

      const trendingSearches = [
        "Al Fakher",
        "Starbuzz",
        "disposable vape",
        "coconut charcoal",
        "Starbuzz Mini",
        "Mazaya",
        "MOB hookah",
        "quick light coals",
      ];

      const topCategories = [
        { id: "vapes", label: "Vapes", href: "/vapes" },
        { id: "hookahs", label: "Hookahs", href: "/hookahs" },
        { id: "shisha", label: "Shisha", href: "/shisha" },
        { id: "charcoal", label: "Charcoal", href: "/charcoal" },
        { id: "accessories", label: "Accessories", href: "/accessories" },
        { id: "bowls", label: "Hookah Bowls", href: "/bowls" },
      ];

      if (!q) {
        const seen = new Set<string>();
        const mergeFeatured: typeof all = [];
        for (const p of [...highlights.featured, ...highlights.trending]) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          mergeFeatured.push(p);
        }
        const popularProducts =
          mergeFeatured.length >= 6
            ? mergeFeatured.slice(0, input.previewLimit)
            : sortStorefrontProducts(all, "best-selling").slice(0, input.previewLimit);

        return {
          mode: "idle" as const,
          popularProducts,
          trendingSearches,
          topCategories,
          totalMatching: 0,
        };
      }

      const ranked = rankProductsBySearch(pool, q);
      const totalMatching = ranked.length;
      const slice = ranked.slice(0, input.previewLimit).map(r => ({
        product: r.product,
        score: r.score,
      }));

      const categoryNav = matchCategoryNavHits(q, 4);
      const brandCounts = new Map<string, number>();
      for (const { product } of ranked.slice(0, 48)) {
        const b = product.brand?.trim();
        if (b) brandCounts.set(b, (brandCounts.get(b) ?? 0) + 1);
      }
      const brandHints = Array.from(brandCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([brand, count]) => ({ brand, count }));

      const nq = q.toLowerCase();
      const suggestions = trendingSearches
        .filter(
          t =>
            t.toLowerCase().includes(nq) ||
            nq.split(/\s+/).some(w => w.length > 1 && t.toLowerCase().includes(w))
        )
        .slice(0, 6);

      return {
        mode: "results" as const,
        products: slice,
        totalMatching,
        categoryNav,
        brandHints,
        suggestions: suggestions.length ? suggestions : trendingSearches.slice(0, 4),
        topCategories,
      };
    }),

  listRelatedProducts: publicProcedure
    .input(
      z.object({
        category: z.string(),
        excludeId: z.string(),
        limit: z.number().min(1).max(24).default(8),
      })
    )
    .query(async ({ input }) => {
      const all = await getCachedGroupedStorefrontProducts();
      const filtered = all.filter(
        p => categoryMatches(p.category, input.category) && p.id !== input.excludeId
      );
      const sorted = sortStorefrontProducts(filtered, "best-selling");
      return sorted.slice(0, input.limit);
    }),

  /** Distinct brands per category for nav dropdowns (lightweight vs `listProducts`). */
  listNavBrandIndex: publicProcedure.query(async () => {
    const { data, error } = await supabaseAdmin
      .from("bh_products")
      .select("brand,category")
      .order("category", { ascending: true })
      .order("brand", { ascending: true });

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    const byCat = new Map<string, Set<string>>();
    for (const row of data ?? []) {
      const r = row as { brand?: string | null; category?: string | null };
      const category = String(r.category ?? "");
      const brand = String(r.brand ?? "").trim();
      if (!brand) continue;
      if (!byCat.has(category)) byCat.set(category, new Set());
      byCat.get(category)!.add(brand);
    }

    const sorted = (s: Set<string>) =>
      Array.from(s).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    return {
      shisha: sorted(byCat.get("shisha") ?? new Set()),
      charcoal: sorted(byCat.get("charcoal") ?? new Set()),
      vapes: sorted(byCat.get("vapes") ?? new Set()),
    };
  }),

  /** Single product by storefront id (catalog parent key, e.g. `50`, or `bh_products.id` UUID). */
  getProduct: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getStorefrontProductById(input.id);
    }),

  getOrderBySessionId: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      if (!input.sessionId) {
        return null;
      }

      const { data, error } = await supabaseAdmin
        .from("bh_orders")
        .select("id, stripe_session_id, total_amount, delivery_method, created_at")
        .eq("stripe_session_id", input.sessionId)
        .maybeSingle();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      if (!data) {
        return null;
      }

      const row = data as Record<string, unknown>;
      return {
        id: String(row.id ?? ""),
        stripeCheckoutSessionId: (row.stripe_session_id as string) ?? null,
        totalAmount: Number(row.total_amount) || 0,
        deliveryMethod: String(row.delivery_method ?? "pickup"),
        createdAt: String(row.created_at ?? new Date().toISOString()),
      };
    }),
});
