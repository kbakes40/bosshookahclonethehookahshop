/**
 * Store Router — public catalog/supporting checkout (Supabase bh_*)
 */

import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "./_core/supabaseAdmin";
import { mapStoreSettingsRow } from "./_core/supabaseMappers";
import { getCachedGroupedStorefrontProducts, getCachedHomeHighlights } from "./storeCatalogCache";
import { getStorefrontProductById } from "./storeCatalog";
import {
  filterProductsForGrid,
  searchProductsByQuery,
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
      const offset = input.cursor ?? 0;
      const all = await getCachedGroupedStorefrontProducts();
      const base =
        input.category === "all" ? all : all.filter(p => p.category === input.category);
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
    }),

  searchProducts: publicProcedure
    .input(
      z.object({
        q: z.string(),
        limit: z.number().min(1).max(48).default(24),
        cursor: z.number().min(0).optional(),
      })
    )
    .query(async ({ input }) => {
      const offset = input.cursor ?? 0;
      const all = await getCachedGroupedStorefrontProducts();
      const found = searchProductsByQuery(all, input.q);
      const sorted = sortStorefrontProducts(found, "best-selling");
      const total = sorted.length;
      const products = sorted.slice(offset, offset + input.limit);
      const nextCursor =
        offset + input.limit < total ? offset + input.limit : null;
      return { products, total, nextCursor };
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
        p => p.category === input.category && p.id !== input.excludeId
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
        deliveryMethod: String(row.delivery_method ?? "shipping"),
        createdAt: String(row.created_at ?? new Date().toISOString()),
      };
    }),
});
