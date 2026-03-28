// CartDrawer Component - Neo-Brutalism meets Luxury Retail
// Slide-out cart drawer with product list and checkout

import { useCart } from "@/contexts/CartContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { X, Minus, Plus, Trash2, Truck, Store } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  PAYPAL_CHECKOUT_STORAGE_KEY,
  CHECKOUT_SHIPPING_ZIP_KEY,
  saveZelleCheckoutCartBackup,
} from "@/lib/paypalCheckoutStorage";
import {
  clearPlaidCheckoutSession,
  savePlaidCheckoutSession,
  type PlaidCheckoutSessionPayload,
} from "@/lib/plaidCheckoutSession";
import { usePlaidLink } from "react-plaid-link";
import { calculateShipping, orderGrandTotalUsd, FREE_SHIPPING_THRESHOLD_USD } from "@shared/shipping";
import { useShopCurrency } from "@/contexts/CurrencyContext";

export default function CartDrawer() {
  const { items, cartTotal, cartCount, isOpen, closeCart, updateQuantity, removeFromCart, clearCart } = useCart();
  const { formatUsd, displayTotals } = useShopCurrency();
  const [, setLocation] = useLocation();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"shipping" | "pickup">("shipping");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "zelle" | "bank_transfer" | "paypal">(
    "card"
  );
  const [bankModalOpen, setBankModalOpen] = useState(false);
  type BankFlow = "closed" | "preparing" | "linking" | "processing" | "success" | "error" | "cancelled";
  const [bankFlow, setBankFlow] = useState<BankFlow>("closed");
  const [bankError, setBankError] = useState<string | null>(null);
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const plaidPayloadRef = useRef<PlaidCheckoutSessionPayload | null>(null);
  const transferIntentIdRef = useRef<string | null>(null);
  const [shippingZip, setShippingZip] = useState("");
  const createCheckoutSession = trpc.checkout.createSession.useMutation();
  const createPlaidSession = trpc.checkout.createPlaidBankSession.useMutation();
  const completePlaidOrder = trpc.checkout.completePlaidBankOrder.useMutation();

  const { open: openPlaid, ready: plaidReady } = usePlaidLink({
    token: plaidLinkToken,
    onSuccess: async (publicToken, meta) => {
      const p = plaidPayloadRef.current;
      const tid = transferIntentIdRef.current;
      if (!p || !tid) return;
      setBankFlow("processing");
      setBankError(null);
      try {
        await completePlaidOrder.mutateAsync({
          publicToken,
          transferIntentId: tid,
          items: p.items,
          deliveryMethod: p.deliveryMethod,
          shippingCents: p.shippingCents,
          shippingZip: p.shippingZip,
          linkTransferStatus: meta.transfer_status,
          institutionName: meta.institution?.name,
          linkSessionId: meta.link_session_id,
        });
        clearPlaidCheckoutSession();
        setPlaidLinkToken(null);
        transferIntentIdRef.current = null;
        plaidPayloadRef.current = null;
        setBankFlow("success");
        clearCart();
        toast.success("Bank payment submitted. Your order is pending processing.");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Payment failed";
        setBankError(msg);
        setBankFlow("error");
        setPlaidLinkToken(null);
      }
    },
    onExit: err => {
      setPlaidLinkToken(null);
      if (err) {
        setBankError(err.display_message || err.error_message || "Bank connection failed.");
        setBankFlow("error");
      } else {
        setBankFlow("cancelled");
      }
    },
  });

  useEffect(() => {
    if (plaidLinkToken && plaidReady && bankFlow === "linking") {
      openPlaid();
    }
  }, [plaidLinkToken, plaidReady, bankFlow, openPlaid]);

  const shippingQuote = useMemo(
    () =>
      calculateShipping({
        subtotal: cartTotal,
        deliveryMethod,
        lines: items.map(i => ({
          quantity: i.quantity,
          weightLb: i.weightLb,
        })),
        address:
          deliveryMethod === "shipping" && shippingZip.trim()
            ? { zip: shippingZip.trim() }
            : {},
      }),
    [cartTotal, deliveryMethod, items, shippingZip]
  );

  const cartGrandTotal = orderGrandTotalUsd(cartTotal, shippingQuote);
  const shipUsd =
    deliveryMethod === "pickup" ? 0 : shippingQuote.shippingAmount;
  const checkoutTotals = displayTotals(cartTotal, shipUsd);

  useEffect(() => {
    if (!isOpen) {
      document.documentElement.classList.remove("cart-open");
      document.body.classList.remove("cart-open");
      return;
    }

    const mq = window.matchMedia("(max-width: 767px)");
    const syncBodyLock = () => {
      if (mq.matches) {
        document.documentElement.classList.add("cart-open");
        document.body.classList.add("cart-open");
      } else {
        document.documentElement.classList.remove("cart-open");
        document.body.classList.remove("cart-open");
      }
    };

    syncBodyLock();
    mq.addEventListener("change", syncBodyLock);
    return () => {
      mq.removeEventListener("change", syncBodyLock);
      document.documentElement.classList.remove("cart-open");
      document.body.classList.remove("cart-open");
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const cartItemsSection =
    items.length === 0 ? (
      <div className="text-center py-16">
        <p className="text-xl font-display font-bold mb-4">Your cart is empty</p>
        <Button
          onClick={closeCart}
          className="brutalist-border bg-primary text-primary-foreground"
        >
          CONTINUE SHOPPING
        </Button>
      </div>
    ) : (
      <div className="space-y-6">
        {items.map((item) => (
          <div
            key={`${item.id}-${item.selectedVariantId || "default"}`}
            className="flex gap-4 pb-6 border-b-3 border-border last:border-0"
          >
            <Link href={`/product/${item.id}`} onClick={closeCart}>
              <div className="w-24 h-24 bg-secondary brutalist-border flex-shrink-0 flex items-center justify-center overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  className="max-h-full max-w-full w-full h-full object-contain object-center"
                />
              </div>
            </Link>

            <div className="flex-1 min-w-0">
              <Link href={`/product/${item.id}`} onClick={closeCart}>
                <h3 className="font-semibold text-sm mb-1 line-clamp-2 hover:text-primary">
                  {item.name}
                  {item.selectedVariantName && (
                    <span className="text-primary"> - {item.selectedVariantName}</span>
                  )}
                </h3>
              </Link>
              <p className="text-xs text-muted-foreground mb-3">{item.brand}</p>

              <div className="flex items-center gap-4">
                <div className="flex items-center brutalist-border">
                  <button
                    onClick={() =>
                      updateQuantity(item.id, item.quantity - 1, item.selectedVariantId)
                    }
                    className="w-8 h-8 flex items-center justify-center hover:bg-secondary"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-10 h-8 flex items-center justify-center border-x-3 border-border text-sm font-bold">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() =>
                      updateQuantity(item.id, item.quantity + 1, item.selectedVariantId)
                    }
                    className="w-8 h-8 flex items-center justify-center hover:bg-secondary"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                <button
                  onClick={() => removeFromCart(item.id, item.selectedVariantId)}
                  className="text-destructive hover:text-destructive/80"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="text-right">
              <p className="price-tag font-bold">
                {formatUsd((item.salePrice || item.price) * item.quantity)}
              </p>
            </div>
          </div>
        ))}
      </div>
    );

  const checkoutFooter =
    items.length > 0 ? (
      <div className="shrink-0 border-t-3 border-border p-6 space-y-4">
        {/* Shipping Notice */}
        <div className="bg-secondary brutalist-border p-4 text-sm">
          <p className="font-semibold">
            {cartTotal >= FREE_SHIPPING_THRESHOLD_USD ? (
              <span className="text-primary">You unlocked FREE SHIPPING</span>
            ) : (
              <>
                Spend {formatUsd(shippingQuote.remainingForFreeShipping)} more for FREE
                SHIPPING
              </>
            )}
          </p>
        </div>

        {/* Subtotal */}
        <div className="flex items-center justify-between text-base">
          <span className="font-display font-bold">SUBTOTAL</span>
          <span className="price-tag font-bold">{checkoutTotals.subtotal}</span>
        </div>

        {/* Delivery Method Selection */}
        <div className="space-y-2">
          <p className="font-display font-bold text-sm">DELIVERY METHOD</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setDeliveryMethod("shipping")}
              className={`p-4 brutalist-border flex flex-col items-center gap-2 transition-colors ${
                deliveryMethod === "shipping"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              <Truck className="h-5 w-5" />
              <span className="text-sm font-bold">SHIPPING</span>
            </button>
            <button
              onClick={() => setDeliveryMethod("pickup")}
              className={`p-4 brutalist-border flex flex-col items-center gap-2 transition-colors ${
                deliveryMethod === "pickup"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              <Store className="h-5 w-5" />
              <span className="text-sm font-bold">PICKUP</span>
            </button>
          </div>
          {deliveryMethod === "shipping" && (
            <div className="space-y-1 pt-1">
              <label
                htmlFor="cart-shipping-zip"
                className="text-[10px] font-bold uppercase text-muted-foreground"
              >
                ZIP code (optional — refines estimate)
              </label>
              <Input
                id="cart-shipping-zip"
                value={shippingZip}
                onChange={e => setShippingZip(e.target.value)}
                placeholder="e.g. 48124"
                className="h-9 brutalist-border text-sm"
                inputMode="numeric"
                autoComplete="postal-code"
              />
            </div>
          )}
        </div>

        {/* Shipping + total (after delivery method so pickup zeros shipping correctly) */}
        <div className="space-y-2 border-t-3 border-border pt-3">
          <div className="flex items-center justify-between text-base">
            <span className="font-display font-bold">SHIPPING</span>
            <span className="price-tag font-bold">
              {deliveryMethod === "pickup"
                ? formatUsd(0)
                : shippingQuote.isFreeShipping
                  ? "FREE"
                  : checkoutTotals.shipping}
            </span>
          </div>
          {deliveryMethod === "shipping" &&
            shippingQuote.isEstimated &&
            shippingQuote.estimatedShippingText && (
              <p className="text-[10px] text-muted-foreground leading-snug">
                {shippingQuote.estimatedShippingText}
              </p>
            )}
          <div className="flex items-center justify-between text-lg pt-1">
            <span className="font-display font-bold">TOTAL</span>
            <span className="price-tag font-black text-2xl">{checkoutTotals.total}</span>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="space-y-2">
          <p className="font-display font-bold text-sm">PAYMENT METHOD</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("card")}
              className={`p-4 brutalist-border flex flex-col items-center gap-2 transition-colors ${
                paymentMethod === "card"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              <span className="text-sm font-bold">CREDIT CARD</span>
            </button>
            <button
              onClick={() => setPaymentMethod("zelle")}
              className={`p-4 brutalist-border flex flex-col items-center gap-2 transition-colors ${
                paymentMethod === "zelle"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              <span className="text-sm font-bold">ZELLE</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("bank_transfer")}
              className={`p-4 brutalist-border flex flex-col items-center gap-2 transition-colors ${
                paymentMethod === "bank_transfer"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              <span className="text-sm font-bold">PAY BY BANK</span>
            </button>
            <button
              onClick={() => setPaymentMethod("paypal")}
              className={`p-4 brutalist-border flex flex-col items-center gap-2 transition-colors ${
                paymentMethod === "paypal"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              <span className="text-sm font-bold">PAYPAL</span>
            </button>
          </div>
        </div>

        {/* Checkout Button */}
        <Button
          className="w-full h-14 brutalist-border brutalist-shadow bg-primary text-primary-foreground hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all duration-150 text-lg font-black"
          disabled={isCheckingOut}
          onClick={async () => {
            setIsCheckingOut(true);
            try {
              if (paymentMethod === "zelle") {
                if (deliveryMethod === "shipping") {
                  sessionStorage.setItem(CHECKOUT_SHIPPING_ZIP_KEY, shippingZip.trim());
                } else {
                  sessionStorage.removeItem(CHECKOUT_SHIPPING_ZIP_KEY);
                }
                saveZelleCheckoutCartBackup(items);
                closeCart();
                setLocation(`/zelle-checkout?delivery=${deliveryMethod}`);
              } else if (paymentMethod === "bank_transfer") {
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                if (!session?.access_token) {
                  toast.error("Please log in to checkout");
                  setIsCheckingOut(false);
                  return;
                }

                const checkoutItems = items.map(item => {
                  const itemName = item.selectedVariantName
                    ? `${item.brand} - ${item.name} - ${item.selectedVariantName}`
                    : `${item.brand} - ${item.name}`;
                  return {
                    name: itemName,
                    priceInCents: Math.round((item.salePrice || item.price) * 100),
                    quantity: item.quantity,
                    image: item.image,
                  };
                });

                setBankError(null);
                setBankModalOpen(true);
                setBankFlow("preparing");

                try {
                  const res = await createPlaidSession.mutateAsync({
                    items: checkoutItems,
                    deliveryMethod,
                    shippingCents: Math.round(shippingQuote.shippingAmount * 100),
                  });
                  transferIntentIdRef.current = res.transferIntentId;
                  const payload: PlaidCheckoutSessionPayload = {
                    linkToken: res.linkToken,
                    transferIntentId: res.transferIntentId,
                    items: checkoutItems,
                    deliveryMethod,
                    shippingCents: Math.round(shippingQuote.shippingAmount * 100),
                    shippingZip: deliveryMethod === "shipping" ? shippingZip.trim() : undefined,
                  };
                  plaidPayloadRef.current = payload;
                  savePlaidCheckoutSession(payload);
                  setBankFlow("linking");
                  setPlaidLinkToken(res.linkToken);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Could not start bank checkout.";
                  setBankError(msg);
                  setBankFlow("error");
                  toast.error(msg);
                } finally {
                  setIsCheckingOut(false);
                }
                return;
              } else if (paymentMethod === "paypal") {
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                if (!session?.access_token) {
                  toast.error("Please log in to checkout");
                  setIsCheckingOut(false);
                  return;
                }

                const checkoutItems = items.map(item => {
                  const itemName = item.selectedVariantName
                    ? `${item.brand} - ${item.name} - ${item.selectedVariantName}`
                    : `${item.brand} - ${item.name}`;
                  return {
                    name: itemName,
                    priceInCents: Math.round((item.salePrice || item.price) * 100),
                    quantity: item.quantity,
                    image: item.image,
                  };
                });

                sessionStorage.setItem(
                  PAYPAL_CHECKOUT_STORAGE_KEY,
                  JSON.stringify({
                    items: checkoutItems,
                    deliveryMethod,
                    shippingCents: Math.round(shippingQuote.shippingAmount * 100),
                  })
                );

                const amount = cartGrandTotal.toFixed(2);
                const res = await fetch("/api/paypal/create-order", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({ amount }),
                  credentials: "include",
                });
                const data = (await res.json().catch(() => ({}))) as {
                  message?: string;
                  approveUrl?: string;
                };
                if (!res.ok) {
                  sessionStorage.removeItem(PAYPAL_CHECKOUT_STORAGE_KEY);
                  throw new Error(data.message || "PayPal create order failed");
                }
                if (!data.approveUrl) {
                  sessionStorage.removeItem(PAYPAL_CHECKOUT_STORAGE_KEY);
                  toast.error("PayPal did not return a redirect URL");
                  setIsCheckingOut(false);
                  return;
                }
                toast.success("Redirecting to PayPal…");
                closeCart();
                window.location.assign(data.approveUrl);
                return;
              } else if (paymentMethod === "card") {
                const checkoutItems = items.map(item => {
                  const itemName = item.selectedVariantName
                    ? `${item.brand} - ${item.name} - ${item.selectedVariantName}`
                    : `${item.brand} - ${item.name}`;

                  return {
                    name: itemName,
                    priceInCents: Math.round((item.salePrice || item.price) * 100),
                    quantity: item.quantity,
                    image: item.image,
                  };
                });

                const stripeSession = await createCheckoutSession.mutateAsync({
                  items: checkoutItems,
                  deliveryMethod,
                  shippingCents: Math.round(shippingQuote.shippingAmount * 100),
                });

                if (stripeSession.url) {
                  toast.success("Redirecting to checkout…");
                  closeCart();
                  window.location.assign(stripeSession.url);
                } else {
                  toast.error("Checkout did not return a payment URL");
                }
              }
            } catch (error: unknown) {
              const message =
                error instanceof Error ? error.message : "Failed to create checkout session";
              if (message.includes("login")) {
                toast.error("Please log in to checkout");
              } else if (message.includes("PayPal") || paymentMethod === "paypal") {
                toast.error(message);
              } else {
                toast.error("Failed to create checkout session");
              }
            } finally {
              setIsCheckingOut(false);
            }
          }}
        >
          {isCheckingOut ? "PROCESSING..." : "CHECKOUT"}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Shipping and taxes calculated at checkout
        </p>
      </div>
    ) : null;

  return (
    <>
      {/* Mobile: fixed layer below cart — blocks taps/scroll reaching the page (cart sits at z-[60]) */}
      <div
        className="md:hidden fixed inset-0 z-[55] pointer-events-auto touch-none"
        aria-hidden
      />
      {/* Desktop only: dim page behind drawer */}
      <div
        className="hidden md:block fixed inset-0 bg-foreground/50 z-[50] transition-opacity"
        onClick={closeCart}
        aria-hidden
      />

      {/* Drawer: mobile = full viewport; md+ = right rail (unchanged layout) */}
      <div
        className={cn(
          "fixed z-[60] flex flex-col bg-background border-border pointer-events-auto",
          // Mobile — true full-screen layer (100dvh + 100vh min for older Safari)
          "inset-0 h-[100dvh] max-h-[100dvh] min-h-[100vh] w-full max-w-[100vw] overflow-hidden rounded-none border-0",
          // Desktop
          "md:inset-x-auto md:left-auto md:right-0 md:top-0 md:bottom-auto md:h-full md:max-h-none md:min-h-0 md:w-full md:max-w-md md:border-l-3"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between p-6 border-b-3 border-border">
          <h2 id="cart-drawer-title" className="text-2xl font-display font-black">
            YOUR CART ({cartCount})
          </h2>
          <button 
            onClick={closeCart}
            className="w-10 h-10 brutalist-border flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/*
          One DOM tree (no duplicate inputs): mobile = single scroll (items + checkout);
          md+ = outer clips, line items scroll, checkout pinned to drawer bottom.
        */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              "overflow-y-auto overscroll-y-contain touch-auto",
              "[-webkit-overflow-scrolling:touch]",
              "pb-[max(2.25rem,env(safe-area-inset-bottom,0px))]",
              "md:overflow-hidden md:pb-0"
            )}
          >
            <div
              className={cn(
                "px-6 pt-6",
                "md:min-h-0 md:flex-1 md:overflow-y-auto md:pb-6"
              )}
            >
              {cartItemsSection}
            </div>
            {checkoutFooter}
          </div>
        </div>
      </div>

      {bankModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => {
            if (bankFlow === "preparing" || bankFlow === "linking" || bankFlow === "processing") {
              return;
            }
            setBankModalOpen(false);
            setBankFlow("closed");
            setBankError(null);
            setPlaidLinkToken(null);
            clearPlaidCheckoutSession();
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-lg bg-background border-3 border-border brutalist-border brutalist-shadow p-8"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-bank-title"
          >
            <h3
              id="cart-bank-title"
              className="font-display font-black text-xl md:text-2xl text-center mb-6 tracking-tight"
            >
              PAY BY BANK
            </h3>

            {bankFlow === "preparing" && (
              <p className="text-sm text-center text-muted-foreground mb-8">
                Preparing a secure bank connection…
              </p>
            )}

            {bankFlow === "linking" && (
              <p className="text-sm text-center text-muted-foreground mb-8">
                Complete the steps in the Plaid window. Your payment is authorized through Plaid Transfer
                (Nacha-compliant).
              </p>
            )}

            {bankFlow === "processing" && (
              <p className="text-sm text-center text-muted-foreground mb-8">
                Confirming your transfer…
              </p>
            )}

            {bankFlow === "success" && (
              <p className="text-sm text-center text-foreground mb-8 leading-relaxed">
                Your bank transfer was submitted. The order stays{" "}
                <span className="font-bold">pending</span> until funds post; you&apos;ll see status in your
                order history once processed.
              </p>
            )}

            {bankFlow === "cancelled" && (
              <p className="text-sm text-center text-muted-foreground mb-8 leading-relaxed">
                You closed the bank window before finishing. No charge was made. Choose Pay by Bank again to
                retry.
              </p>
            )}

            {bankFlow === "error" && bankError && (
              <p className="text-sm text-center text-destructive mb-6 leading-relaxed">{bankError}</p>
            )}

            <div className="space-y-3">
              {(bankFlow === "success" || bankFlow === "error" || bankFlow === "cancelled") && (
                <Button
                  type="button"
                  className="w-full h-14 brutalist-border brutalist-shadow bg-primary text-primary-foreground hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all duration-150 text-lg font-black"
                  onClick={() => {
                    setBankModalOpen(false);
                    setBankFlow("closed");
                    setBankError(null);
                    setPlaidLinkToken(null);
                    clearPlaidCheckoutSession();
                    if (bankFlow === "success") {
                      closeCart();
                    }
                  }}
                >
                  {bankFlow === "success" ? "DONE" : "CLOSE"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
