/**
 * Stripe Integration - Webhook Handler and Checkout Session Creation
 * Orders are saved to Supabase (bh_orders table) instead of MySQL.
 */
import Stripe from "stripe";
import type { OrderShippingAddress } from "@shared/orderShippingAddress";
import { ENV } from "./_core/env";
import { supabaseAdmin } from "./_core/supabaseAdmin";

/** Dummy key so the module loads in dev; real API calls need STRIPE_SECRET_KEY. */
const DEV_PLACEHOLDER_KEY =
  "sk_test_0000000000000000000000000000000000000000000000000000000000";

if (!ENV.stripeSecretKey) {
  const msg =
    ENV.isProduction
      ? "[Stripe] STRIPE_SECRET_KEY is not set — card checkout/webhooks will fail. Add it in Vercel → Environment Variables (catalog & Zelle still work)."
      : "[Stripe] STRIPE_SECRET_KEY not set — checkout/webhooks will fail until you add it to .env.local";
  console.warn(msg);
}

export const stripe = new Stripe(
  ENV.stripeSecretKey || DEV_PLACEHOLDER_KEY,
  {
    apiVersion: "2026-02-25.clover",
  }
);

/**
 * Create a Stripe Checkout Session for product purchase
 */
function trimMeta(v: string, max = 450): string {
  const t = v.trim();
  return t.length > max ? t.slice(0, max) : t;
}

export async function createCheckoutSession(params: {
  userId: string | number;
  userEmail: string;
  userName: string;
  items: Array<{ name: string; priceInCents: number; quantity: number; image?: string }>;
  deliveryMethod: "shipping" | "pickup";
  /** Added as a separate Stripe line item when greater than 0 (pickup should pass 0). */
  shippingCents?: number;
  /** Cart-collected address; persisted via session metadata + webhook. */
  shippingAddress?: OrderShippingAddress | null;
  successUrl: string;
  cancelUrl: string;
}) {
  if (!ENV.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  const {
    userId,
    userEmail,
    userName,
    items,
    deliveryMethod,
    shippingCents = 0,
    shippingAddress = null,
    successUrl,
    cancelUrl,
  } = params;
  console.log('[Stripe] Creating checkout session:', { userId, userEmail, itemCount: items.length });

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(item => {
    let validImageUrl: string | undefined = undefined;
    if (item.image) {
      try {
        const url = new URL(item.image, 'https://example.com');
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          validImageUrl = item.image.startsWith('http') ? item.image : undefined;
        }
      } catch (e) {
        console.warn('[Stripe] Invalid image URL for item:', item.name, item.image);
      }
    }
    return {
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          images: validImageUrl ? [validImageUrl] : undefined,
        },
        unit_amount: item.priceInCents,
      },
      quantity: item.quantity,
    };
  });

  const shipping = Math.max(0, Math.round(shippingCents));
  if (shipping > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Shipping" },
        unit_amount: shipping,
      },
      quantity: 1,
    });
  }

  try {
    const metadata: Record<string, string> = {
      user_id: String(userId),
      user_name: userName || "Guest",
      delivery_method: deliveryMethod,
      item_count: items.length.toString(),
    };
    if (deliveryMethod === "shipping" && shippingAddress) {
      metadata.ship_fn = trimMeta(shippingAddress.full_name);
      metadata.ship_l1 = trimMeta(shippingAddress.line1);
      metadata.ship_l2 = shippingAddress.line2 ? trimMeta(shippingAddress.line2) : "";
      metadata.ship_city = trimMeta(shippingAddress.city);
      metadata.ship_st = trimMeta(shippingAddress.state);
      metadata.ship_zip = trimMeta(shippingAddress.zip);
      metadata.ship_ph = shippingAddress.phone ? trimMeta(shippingAddress.phone, 32) : "";
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&delivery_method=${deliveryMethod}`,
      cancel_url: cancelUrl,
      ...(userEmail && userEmail.includes('@') ? { customer_email: userEmail } : {}),
      client_reference_id: String(userId),
      metadata,
      allow_promotion_codes: true,
    });

    console.log('[Stripe] Session created:', session.id);
    return { sessionId: session.id, url: session.url };
  } catch (error: any) {
    console.error('[Stripe] Error creating session:', error?.message);
    throw error;
  }
}

/**
 * Handle Stripe webhook events — saves orders to Supabase bh_orders table
 */
export async function handleWebhookEvent(event: Stripe.Event) {
  // Handle test events
  if (event.id.startsWith("evt_test_")) {
    console.log("[Stripe Webhook] Test event detected, returning verification response");
    return { verified: true };
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const userId = session.metadata?.user_id || session.client_reference_id || null;
        const deliveryMethod =
          (session.metadata?.delivery_method as "shipping" | "pickup") || "pickup";
        const customerName = session.customer_details?.name || session.metadata?.user_name || "Guest";
        const customerEmail = session.customer_details?.email || session.customer_email || null;
        const customerPhone = session.customer_details?.phone || null;

        // Retrieve line items from Stripe
        let items: any[] = [];
        try {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          items = lineItems.data.map(item => ({
            name: item.description,
            priceInCents: item.amount_total,
            quantity: item.quantity,
          }));
        } catch (error) {
          console.error('[Stripe Webhook] Error fetching line items:', error);
        }

        const meta = session.metadata || {};
        const fromMeta: OrderShippingAddress | null = (() => {
          const line1 = typeof meta.ship_l1 === "string" ? meta.ship_l1.trim() : "";
          if (!line1) return null;
          const ph = typeof meta.ship_ph === "string" ? meta.ship_ph.replace(/\D/g, "") : "";
          return {
            full_name: typeof meta.ship_fn === "string" ? meta.ship_fn.trim() : "",
            line1,
            line2:
              typeof meta.ship_l2 === "string" && meta.ship_l2.trim()
                ? meta.ship_l2.trim()
                : null,
            city: typeof meta.ship_city === "string" ? meta.ship_city.trim() : "",
            state: typeof meta.ship_st === "string" ? meta.ship_st.trim() : "",
            zip: typeof meta.ship_zip === "string" ? meta.ship_zip.trim() : "",
            phone: ph.length === 10 ? ph : null,
          };
        })();

        let shippingAddress: OrderShippingAddress | Record<string, unknown> | null = fromMeta;

        type ShipDet = {
          name?: string | null;
          address?: {
            line1?: string | null;
            line2?: string | null;
            city?: string | null;
            state?: string | null;
            postal_code?: string | null;
          } | null;
        };
        const shipDet = (session as Stripe.Checkout.Session & { shipping_details?: ShipDet | null })
          .shipping_details;

        if (!shippingAddress && shipDet?.address) {
          const a = shipDet.address;
          const nm = shipDet.name?.trim() || "";
          const ph = session.customer_details?.phone
            ? String(session.customer_details.phone).replace(/\D/g, "")
            : "";
          let ph10 = ph;
          if (ph10.length === 11 && ph10.startsWith("1")) ph10 = ph10.slice(1);
          shippingAddress = {
            full_name: nm,
            line1: a.line1 || "",
            line2: a.line2 || null,
            city: a.city || "",
            state: a.state || "",
            zip: a.postal_code || "",
            phone: ph10.length === 10 ? ph10 : null,
          };
        }

        if (deliveryMethod === "pickup") {
          shippingAddress = null;
        }

        // Save order to Supabase bh_orders
        const { data: orderData, error: orderError } = await supabaseAdmin
          .from('bh_orders')
          .insert({
            status: 'paid',
            fulfillment_status: 'pending',
            total_amount: session.amount_total || 0,
            currency: session.currency || 'usd',
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            stripe_session_id: session.id,
            stripe_payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            payment_method: 'stripe',
            delivery_method: deliveryMethod,
            items: items,
            shipping_address: shippingAddress,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (orderError) {
          console.error('[Stripe Webhook] Error saving order to Supabase:', orderError);
        } else {
          console.log(`[Stripe Webhook] Order saved to Supabase: ${orderData?.id}, session ${session.id}`);
        }

        // Upsert customer in bh_customers if we have an email
        if (customerEmail) {
          await supabaseAdmin
            .from('bh_customers')
            .upsert({
              email: customerEmail,
              name: customerName,
              phone: customerPhone,
              stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'email' });
        }

        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await supabaseAdmin
          .from('bh_orders')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('stripe_payment_intent', paymentIntent.id);
        console.log(`[Stripe Webhook] Payment succeeded for intent ${paymentIntent.id}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await supabaseAdmin
          .from('bh_orders')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('stripe_payment_intent', paymentIntent.id);
        console.log(`[Stripe Webhook] Payment failed for intent ${paymentIntent.id}`);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        if (charge.payment_intent) {
          await supabaseAdmin
            .from('bh_orders')
            .update({ status: 'refunded', updated_at: new Date().toISOString() })
            .eq('stripe_payment_intent', charge.payment_intent as string);
          console.log(`[Stripe Webhook] Charge refunded for intent ${charge.payment_intent}`);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
    return { success: true };
  } catch (error) {
    console.error("[Stripe Webhook] Error processing event:", error);
    return { success: false, error: String(error) };
  }
}
