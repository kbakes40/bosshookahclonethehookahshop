/**
 * Persist PayPal-captured orders to Supabase `bh_orders` (shape aligned with Stripe webhook insert).
 */
import type { OrderShippingAddress } from "@shared/orderShippingAddress";
import { supabaseAdmin } from "./_core/supabaseAdmin";

export type CheckoutLineItem = {
  name: string;
  priceInCents: number;
  quantity: number;
  image?: string;
};

function parsePayerName(payer: {
  name?: { given_name?: string; surname?: string };
} | null | undefined): string {
  if (!payer?.name) return "Guest";
  const g = payer.name.given_name || "";
  const s = payer.name.surname || "";
  return `${g} ${s}`.trim() || "Guest";
}

/** `payment_id` from capture → `stripe_payment_intent`; PayPal order id → `stripe_session_id`. */
export async function insertBhOrderFromPaypalCapture(params: {
  paypalOrderId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  capturePayload: any;
  items: CheckoutLineItem[];
  deliveryMethod: "shipping" | "pickup";
  profileEmail: string | null;
  /** From cart when delivery is shipping (PayPal UI may not collect full street address). */
  clientShippingAddress?: OrderShippingAddress | null;
}): Promise<{ supabaseOrderId: string; duplicate: boolean }> {
  const {
    paypalOrderId,
    capturePayload,
    items,
    deliveryMethod,
    profileEmail,
    clientShippingAddress,
  } = params;

  const { data: existing } = await supabaseAdmin
    .from("bh_orders")
    .select("id")
    .eq("stripe_session_id", paypalOrderId)
    .maybeSingle();

  if (existing) {
    return { supabaseOrderId: String((existing as { id: string }).id), duplicate: true };
  }

  const payer = capturePayload?.payer;
  const customerName = parsePayerName(payer);
  const customerEmail = (payer?.email_address as string | undefined) || profileEmail || null;

  const unit = capturePayload?.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  const totalCents = capture?.amount?.value
    ? Math.round(parseFloat(String(capture.amount.value)) * 100)
    : items.reduce((s, i) => s + i.priceInCents * i.quantity, 0);

  const paymentId = capture?.id != null ? String(capture.id) : null;

  let shippingAddress: Record<string, unknown> | OrderShippingAddress | null = null;
  if (deliveryMethod === "shipping" && clientShippingAddress) {
    shippingAddress = clientShippingAddress;
  } else {
    const ship = unit?.shipping;
    if (ship?.address) {
      shippingAddress = { ...(ship.address as Record<string, unknown>), name: ship.name };
    }
  }

  const now = new Date().toISOString();

  const { data: orderData, error: orderError } = await supabaseAdmin
    .from("bh_orders")
    .insert({
      status: "paid",
      fulfillment_status: "pending",
      total_amount: totalCents,
      currency: "usd",
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: null,
      stripe_session_id: paypalOrderId,
      stripe_payment_intent: paymentId,
      payment_method: "paypal",
      delivery_method: deliveryMethod,
      items,
      shipping_address: shippingAddress,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (orderError) {
    console.error("[PayPal] Error saving order to Supabase:", orderError);
    throw new Error(orderError.message);
  }

  if (customerEmail) {
    await supabaseAdmin.from("bh_customers").upsert(
      {
        email: customerEmail,
        name: customerName,
        phone: null,
        stripe_customer_id: null,
        updated_at: now,
      },
      { onConflict: "email" }
    );
  }

  return { supabaseOrderId: String((orderData as { id: string }).id), duplicate: false };
}
