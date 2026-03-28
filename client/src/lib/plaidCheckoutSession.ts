/** Persisted while Plaid Link runs (including OAuth return on `/plaid-oauth`). */

import type { OrderShippingAddress } from "@shared/orderShippingAddress";

export const PLAID_CHECKOUT_SESSION_KEY = "plaid_checkout_session_v1";

export type PlaidCheckoutLineItem = {
  name: string;
  priceInCents: number;
  quantity: number;
  image?: string;
};

export type PlaidCheckoutSessionPayload = {
  linkToken: string;
  transferIntentId: string;
  items: PlaidCheckoutLineItem[];
  deliveryMethod: "shipping" | "pickup";
  shippingCents: number;
  /** Set when `deliveryMethod === "shipping"`. */
  shippingAddress?: OrderShippingAddress;
};

export function savePlaidCheckoutSession(payload: PlaidCheckoutSessionPayload): void {
  try {
    sessionStorage.setItem(PLAID_CHECKOUT_SESSION_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function loadPlaidCheckoutSession(): PlaidCheckoutSessionPayload | null {
  try {
    const raw = sessionStorage.getItem(PLAID_CHECKOUT_SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PlaidCheckoutSessionPayload;
    if (
      !p?.linkToken ||
      !p?.transferIntentId ||
      !Array.isArray(p.items) ||
      (p.deliveryMethod !== "shipping" && p.deliveryMethod !== "pickup")
    ) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function clearPlaidCheckoutSession(): void {
  try {
    sessionStorage.removeItem(PLAID_CHECKOUT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
