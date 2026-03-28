// CartDrawer Component - Neo-Brutalism meets Luxury Retail
// Slide-out cart drawer with product list and checkout

import { useCart } from "@/contexts/CartContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { X, Minus, Plus, Trash2, Truck, Store } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  PAYPAL_CHECKOUT_STORAGE_KEY,
  CHECKOUT_SHIPPING_ZIP_KEY,
  saveZelleCheckoutCartBackup,
} from "@/lib/paypalCheckoutStorage";
import { calculateShipping, orderGrandTotalUsd, FREE_SHIPPING_THRESHOLD_USD } from "@shared/shipping";
import { useShopCurrency } from "@/contexts/CurrencyContext";

export default function CartDrawer() {
  const { items, cartTotal, cartCount, isOpen, closeCart, updateQuantity, removeFromCart, clearCart } = useCart();
  const { formatUsd, displayTotals } = useShopCurrency();
  const [, setLocation] = useLocation();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"shipping" | "pickup">("shipping");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "zelle" | "bitcoin" | "paypal">("paypal");
  const [cardPaypalInfoOpen, setCardPaypalInfoOpen] = useState(false);
  const [bitcoinInfoOpen, setBitcoinInfoOpen] = useState(false);
  const [shippingZip, setShippingZip] = useState("");
  const createCheckoutSession = trpc.checkout.createSession.useMutation();

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
              <div className="w-24 h-24 bg-secondary brutalist-border flex-shrink-0">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover"
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
              onClick={() => setCardPaypalInfoOpen(true)}
              className="p-4 brutalist-border flex flex-col items-center gap-2 transition-colors bg-background hover:bg-secondary"
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
              onClick={() => {
                setPaymentMethod("bitcoin");
                setBitcoinInfoOpen(true);
              }}
              className={`p-4 brutalist-border flex flex-col items-center gap-2 transition-colors ${
                paymentMethod === "bitcoin"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-secondary"
              }`}
            >
              <span className="text-sm font-bold">BITCOIN</span>
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
              } else if (paymentMethod === "bitcoin") {
                setBitcoinInfoOpen(true);
                setIsCheckingOut(false);
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
              } else {
                // Stripe checkout
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

                const session = await createCheckoutSession.mutateAsync({
                  items: checkoutItems,
                  deliveryMethod,
                  shippingCents: Math.round(shippingQuote.shippingAmount * 100),
                });

                if (session.url) {
                  toast.success("Redirecting to checkout...");
                  window.open(session.url, "_blank");
                  closeCart();
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

      {bitcoinInfoOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setBitcoinInfoOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg bg-background border-3 border-border brutalist-border brutalist-shadow p-8"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-bitcoin-title"
          >
            <h3
              id="cart-bitcoin-title"
              className="font-display font-black text-xl md:text-2xl text-center mb-6 tracking-tight"
            >
              BITCOIN PAYMENT
            </h3>
            <div className="space-y-4 mb-8 text-sm leading-relaxed text-center text-foreground">
              <p>
                Bitcoin checkout is available <span className="font-bold">on request</span>. Reach out and
                we&apos;ll send wallet details and a quote for your order total.
              </p>
              <p>
                Call{" "}
                <a href="tel:+13134066589" className="font-bold text-primary hover:underline">
                  (313) 406-6589
                </a>{" "}
                or visit our{" "}
                <Link href="/contact" className="font-bold text-primary hover:underline" onClick={closeCart}>
                  Contact
                </Link>{" "}
                page to arrange payment.
              </p>
            </div>
            <div className="space-y-3">
              <Button
                type="button"
                className="w-full h-14 brutalist-border brutalist-shadow bg-primary text-primary-foreground hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all duration-150 text-lg font-black"
                onClick={() => setBitcoinInfoOpen(false)}
              >
                GOT IT
              </Button>
            </div>
          </div>
        </div>
      )}

      {cardPaypalInfoOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setCardPaypalInfoOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg bg-background border-3 border-border brutalist-border brutalist-shadow p-8"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-card-paypal-title"
          >
            <h3
              id="cart-card-paypal-title"
              className="font-display font-black text-xl md:text-2xl text-center mb-6 tracking-tight"
            >
              PAY WITH DEBIT OR CREDIT CARD
            </h3>
            <div className="space-y-4 mb-8 text-sm leading-relaxed text-center text-foreground">
              <p>
                We take card payments through <span className="font-bold">PayPal</span>. You do not need a PayPal
                balance. At checkout you can choose{" "}
                <span className="font-bold">Debit or Credit Card</span> on PayPal&apos;s secure page.
              </p>
              <p>
                Select <span className="font-bold">PAYPAL</span> in the payment options below, then tap{" "}
                <span className="font-bold">CHECKOUT</span> to continue.
              </p>
            </div>
            <div className="space-y-3">
              <Button
                type="button"
                className="w-full h-14 brutalist-border brutalist-shadow bg-primary text-primary-foreground hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all duration-150 text-lg font-black"
                onClick={() => {
                  setPaymentMethod("paypal");
                  setCardPaypalInfoOpen(false);
                }}
              >
                SELECT PAYPAL
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 brutalist-border bg-background font-bold"
                onClick={() => setCardPaypalInfoOpen(false)}
              >
                GOT IT
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
