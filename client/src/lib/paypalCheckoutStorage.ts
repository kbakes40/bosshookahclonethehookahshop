/** Session storage key for PayPal return page (cart line items + delivery). */
export const PAYPAL_CHECKOUT_STORAGE_KEY = "paypal_checkout_payload";

/** ZIP entered in cart (shipping) — legacy; full address lives in CHECKOUT_SHIPPING_ADDRESS_KEY. */
export const CHECKOUT_SHIPPING_ZIP_KEY = "bh_checkout_shipping_zip";

/**
 * Full shipping address JSON (`OrderShippingAddress`) when delivery is shipping — Zelle page + quote recovery.
 */
export const CHECKOUT_SHIPPING_ADDRESS_KEY = "bh_checkout_shipping_address_v1";

/**
 * Full cart snapshot when starting Zelle checkout — cart is in-memory only, so this allows
 * `/zelle-checkout` to recover after refresh and avoids empty-cart redirects wiping the flow.
 */
export const ZELLE_CHECKOUT_CART_KEY = "bh_zelle_checkout_cart_v1";

export function clearZelleCheckoutCartBackup(): void {
  try {
    sessionStorage.removeItem(ZELLE_CHECKOUT_CART_KEY);
    sessionStorage.removeItem(CHECKOUT_SHIPPING_ADDRESS_KEY);
  } catch {
    /* ignore */
  }
}

export function saveZelleCheckoutCartBackup(items: unknown): void {
  try {
    sessionStorage.setItem(ZELLE_CHECKOUT_CART_KEY, JSON.stringify({ items }));
  } catch {
    /* ignore quota / private mode */
  }
}
