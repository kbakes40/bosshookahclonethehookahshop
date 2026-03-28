/**
 * Canonical `bh_orders.shipping_address` JSON shape (snake_case keys).
 */
import type { ShippingAddressInput } from "./shipping";

export type OrderShippingAddress = {
  full_name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
};

export type ShippingFormFields = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
};

export function orderShippingToQuoteInput(a: OrderShippingAddress): ShippingAddressInput {
  return {
    zip: a.zip,
    line1: a.line1,
    city: a.city,
    state: a.state,
    country: "US",
  };
}

export function normalizeToOrderShipping(f: ShippingFormFields): OrderShippingAddress {
  let phoneDigits = f.phone.replace(/\D/g, "");
  if (phoneDigits.length === 11 && phoneDigits.startsWith("1")) {
    phoneDigits = phoneDigits.slice(1);
  }
  const phone = phoneDigits.length === 10 ? phoneDigits : null;

  return {
    full_name: f.fullName.trim(),
    line1: f.line1.trim(),
    line2: f.line2.trim() || null,
    city: f.city.trim(),
    state: f.state.trim(),
    zip: f.zip.trim(),
    phone,
  };
}

/** Short messages for toast / inline errors. */
export function shippingFormValidationMessages(f: ShippingFormFields): string[] {
  const errs: string[] = [];
  if (!f.fullName.trim()) errs.push("Enter the shipping full name.");
  if (!f.line1.trim()) errs.push("Enter street address.");
  if (!f.city.trim()) errs.push("Enter city.");
  if (!f.state.trim()) errs.push("Enter state.");
  if (!f.zip.trim()) errs.push("Enter ZIP code.");
  else if (!/^\d{5}(-\d{4})?$/.test(f.zip.replace(/\s/g, ""))) {
    errs.push("ZIP must be 5 digits (optional +4).");
  }
  if (f.phone.trim()) {
    let d = f.phone.replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
    if (d.length !== 10) errs.push("Phone should be 10 digits, or leave blank.");
  }
  return errs;
}
