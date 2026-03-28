/**
 * Checkout Router - Stripe checkout session + Zelle orders (Supabase bh_orders)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "./_core/trpc";
import { createCheckoutSession } from "./stripe";
import { supabaseAdmin } from "./_core/supabaseAdmin";

export const checkoutRouter = router({
  createSession: publicProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            name: z.string(),
            priceInCents: z.number(),
            quantity: z.number(),
            image: z.string().optional(),
          })
        ),
        deliveryMethod: z.enum(["shipping", "pickup"]).default("shipping"),
        /** Shipping line item in cents (must match client `calculateShipping`). */
        shippingCents: z.number().int().min(0).optional().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const origin = ctx.req.headers.origin || "http://localhost:3000";
        const userId = ctx.user?.id ?? "anonymous";
        console.log("[Checkout] Creating session with:", {
          origin,
          userId,
          userEmail: ctx.user?.email || "",
          userName: ctx.user?.name || "Guest",
          deliveryMethod: input.deliveryMethod,
          itemCount: input.items.length,
        });

        const session = await createCheckoutSession({
          userId,
          userEmail: ctx.user?.email || "",
          userName: ctx.user?.name || "Guest",
          items: input.items,
          deliveryMethod: input.deliveryMethod,
          shippingCents: input.shippingCents,
          successUrl: `${origin}/checkout/success`,
          cancelUrl: `${origin}/checkout/cancel`,
        });

        console.log("[Checkout] Session created successfully:", session.sessionId);
        return session;
      } catch (error: unknown) {
        const err = error as { message?: string; type?: string; code?: string; stack?: string };
        console.error("[Checkout] Error creating session:", {
          message: err?.message,
          type: err?.type,
          code: err?.code,
          stack: err?.stack,
        });
        throw error;
      }
    }),

  createZelleOrder: publicProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            name: z.string(),
            priceInCents: z.coerce.number().int(),
            quantity: z.coerce.number().int().positive(),
            image: z.string().optional(),
          })
        ),
        deliveryMethod: z
          .unknown()
          .transform(v => (v === "pickup" ? "pickup" : "shipping"))
          .pipe(z.enum(["shipping", "pickup"])),
        customerName: z.string().min(1),
        /** 10 US digits (avoids dashed formats that fail common DB CHECK constraints). */
        customerPhone: z
          .string()
          .transform(s => {
            let d = s.replace(/\D/g, "");
            if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
            return d;
          })
          .pipe(z.string().regex(/^\d{10}$/, "Phone must be 10 digits")),
        /** Cart total in cents (matches Stripe `amount_total`) */
        totalAmount: z.coerce.number().int().nonnegative(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      const zelleRef = `zelle_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      console.log("[Zelle Checkout] Creating order with:", {
        userId: ctx.user?.id ?? null,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        deliveryMethod: input.deliveryMethod,
        totalAmount: input.totalAmount,
        itemCount: input.items.length,
      });

      const { data: inserted, error } = await supabaseAdmin
        .from("bh_orders")
        .insert({
          status: "pending",
          fulfillment_status: "pending",
          total_amount: input.totalAmount,
          currency: "usd",
          customer_name: input.customerName,
          customer_email: ctx.user?.email?.trim() || null,
          customer_phone: input.customerPhone,
          stripe_session_id: null,
          stripe_payment_intent: zelleRef,
          payment_method: "zelle",
          delivery_method: input.deliveryMethod,
          items: input.items,
          shipping_address: null,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();

      if (error) {
        console.error("[Zelle Checkout] Supabase error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create Zelle order",
        });
      }

      const orderId = String((inserted as { id: string })?.id ?? "");
      console.log("[Zelle Checkout] Order created successfully:", orderId);

      return {
        orderId,
        success: true,
      };
    }),
});
