/**
 * Express handlers for PayPal checkout (mounted under /api/paypal/*).
 */
import type { Express, Request, Response } from "express";
import type { OrderShippingAddress } from "@shared/orderShippingAddress";
import { verifySupabaseToken } from "./_core/supabaseAdmin";
import { paypalCaptureOrder, paypalCreateOrder } from "./paypalRest";
import { insertBhOrderFromPaypalCapture, type CheckoutLineItem } from "./paypalOrderDb";

function isOrderShippingAddress(x: unknown): x is OrderShippingAddress {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.full_name === "string" &&
    o.full_name.trim().length > 0 &&
    typeof o.line1 === "string" &&
    o.line1.trim().length > 0 &&
    typeof o.city === "string" &&
    o.city.trim().length > 0 &&
    typeof o.state === "string" &&
    o.state.trim().length > 0 &&
    typeof o.zip === "string" &&
    o.zip.trim().length >= 3
  );
}

function extractBearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (h && h.startsWith("Bearer ")) return h.slice(7);
  return null;
}

function firstForwarded(value: string | undefined): string | undefined {
  return value?.split(",")[0]?.trim();
}

/** Full origin (no trailing path) for PayPal return/cancel — must match the storefront domain or sessionStorage is wrong. */
function normalizeConfiguredOrigin(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim().replace(/\/+$/, "");
  try {
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(withScheme);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function publicOrigin(req: Request): string {
  const fromEnv =
    normalizeConfiguredOrigin(process.env.PUBLIC_SITE_URL) ||
    normalizeConfiguredOrigin(process.env.VITE_SITE_ORIGIN);
  if (fromEnv) return fromEnv;

  const xfHost =
    firstForwarded(req.get("x-forwarded-host")) || firstForwarded(req.get("host"));
  let xfProto = firstForwarded(req.get("x-forwarded-proto"));

  if (!xfProto && xfHost && !xfHost.includes("localhost") && !xfHost.startsWith("127.")) {
    xfProto = "https";
  }
  const proto =
    xfProto || (req.secure ? "https" : req.protocol === "https" ? "https" : "http");

  if (xfHost) {
    return `${proto}://${xfHost}`;
  }

  const vu = process.env.VERCEL_URL?.trim();
  if (vu) {
    return `https://${vu.replace(/^https?:\/\//i, "")}`;
  }

  return "http://localhost:3000";
}

const AMOUNT_RE = /^\d+\.\d{2}$/;

function isLineItem(x: unknown): x is CheckoutLineItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    typeof o.priceInCents === "number" &&
    typeof o.quantity === "number"
  );
}

export function registerPayPalRoutes(app: Express): void {
  app.post("/api/paypal/create-order", async (req: Request, res: Response) => {
    try {
      const token = extractBearer(req);
      if (!token) {
        return res.status(401).json({ error: "Unauthorized", message: "Missing Authorization Bearer token" });
      }
      const user = await verifySupabaseToken(token);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired session" });
      }

      const amount = typeof req.body?.amount === "string" ? req.body.amount.trim() : "";
      if (!AMOUNT_RE.test(amount)) {
        return res.status(400).json({
          error: "Bad Request",
          message: "amount must be a USD string with two decimals, e.g. \"12.34\"",
        });
      }

      const origin = publicOrigin(req);
      const returnUrl = `${origin}/checkout/paypal-return`;
      const cancelUrl = `${origin}/checkout/cancel`;

      const { id, approveUrl } = await paypalCreateOrder({
        amount,
        returnUrl,
        cancelUrl,
      });

      if (!approveUrl) {
        console.error("[PayPal] create-order missing approve link for order", id);
        return res.status(502).json({ error: "Bad Gateway", message: "PayPal did not return an approval URL" });
      }

      return res.status(200).json({ id, approveUrl });
    } catch (err) {
      console.error("[PayPal] create-order:", err);
      const message = err instanceof Error ? err.message : "PayPal create order failed";
      return res.status(500).json({ error: "Internal Server Error", message });
    }
  });

  app.post("/api/paypal/capture-order", async (req: Request, res: Response) => {
    try {
      const token = extractBearer(req);
      if (!token) {
        return res.status(401).json({ error: "Unauthorized", message: "Missing Authorization Bearer token" });
      }
      const user = await verifySupabaseToken(token);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired session" });
      }

      const orderID =
        typeof req.body?.orderID === "string" ? req.body.orderID.trim() : "";
      if (!orderID) {
        return res.status(400).json({ error: "Bad Request", message: "orderID is required" });
      }

      const deliveryMethod = req.body?.deliveryMethod;
      if (deliveryMethod !== "shipping" && deliveryMethod !== "pickup") {
        return res.status(400).json({
          error: "Bad Request",
          message: "deliveryMethod must be \"shipping\" or \"pickup\"",
        });
      }

      const rawItems = req.body?.items;
      if (!Array.isArray(rawItems) || !rawItems.every(isLineItem)) {
        return res.status(400).json({
          error: "Bad Request",
          message:
            "items must be an array of { name, priceInCents, quantity, image? } (same shape as Stripe checkout)",
        });
      }
      const items = rawItems as CheckoutLineItem[];

      let clientShipping: OrderShippingAddress | null = null;
      if (deliveryMethod === "shipping") {
        const addr = req.body?.shippingAddress;
        if (!isOrderShippingAddress(addr)) {
          return res.status(400).json({
            error: "Bad Request",
            message:
              "shippingAddress with full_name, line1, city, state, zip is required when deliveryMethod is shipping",
          });
        }
        let ph = typeof addr.phone === "string" ? addr.phone.replace(/\D/g, "") : "";
        if (ph.length === 11 && ph.startsWith("1")) ph = ph.slice(1);
        clientShipping = {
          full_name: addr.full_name.trim(),
          line1: addr.line1.trim(),
          line2:
            typeof addr.line2 === "string" && addr.line2.trim() ? addr.line2.trim() : null,
          city: addr.city.trim(),
          state: addr.state.trim(),
          zip: addr.zip.trim(),
          phone: ph.length === 10 ? ph : null,
        };
      }

      const capturePayload = await paypalCaptureOrder(orderID);

      const { supabaseOrderId, duplicate } = await insertBhOrderFromPaypalCapture({
        paypalOrderId: orderID,
        capturePayload,
        items,
        deliveryMethod,
        profileEmail: user.email,
        clientShippingAddress: clientShipping,
      });

      return res.status(200).json({
        success: true,
        capture: capturePayload,
        orderId: orderID,
        supabaseOrderId,
        duplicate,
      });
    } catch (err) {
      console.error("[PayPal] capture-order:", err);
      const message = err instanceof Error ? err.message : "PayPal capture failed";
      return res.status(500).json({ error: "Internal Server Error", message });
    }
  });
}
