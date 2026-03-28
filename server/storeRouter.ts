/**
 * Store Router — public catalog/supporting checkout (Supabase bh_*)
 */

import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "./_core/supabaseAdmin";
import { mapStoreSettingsRow } from "./_core/supabaseMappers";
import {
  fetchAllBhProductRows,
  getStorefrontProductById,
  groupBhProductRowsToStorefrontProducts,
} from "./storeCatalog";

const defaultStoreSettings = () =>
  mapStoreSettingsRow({
    id: null,
    store_name: "The Hookah Shop",
    address: "6520 Greenfield Rd",
    city: "Dearborn",
    state: "MI",
    zip_code: "48126",
    phone: "(313) 406-6589",
    email: "info@bosshookah.com",
    hours: "Open Daily\nCloses 1:00 AM",
    pickup_instructions:
      "Please bring your order confirmation and a valid ID when picking up your order. Call us at (313) 406-6589 if you have any questions.",
    zelle_email: null,
    zelle_phone: null,
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

  /** Full storefront catalog from `bh_products` (grouped catalog SKUs → variants). */
  listProducts: publicProcedure.query(async () => {
    const rows = await fetchAllBhProductRows();
    return groupBhProductRowsToStorefrontProducts(rows);
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
