// Zelle Payment Instructions Page
// Shows Zelle payment details and creates pending order

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";
import { Copy, CheckCircle2, MapPin, Phone } from "lucide-react";
import { calculateShipping, orderGrandTotalUsd } from "@shared/shipping";
import {
  CHECKOUT_SHIPPING_ZIP_KEY,
  ZELLE_CHECKOUT_CART_KEY,
  clearZelleCheckoutCartBackup,
} from "@/lib/paypalCheckoutStorage";
import { useShopCurrency } from "@/contexts/CurrencyContext";
import type { CartItem } from "@/contexts/CartContext";

/** Shown when `bh_store_settings.zelle_*` is empty; keep in sync with store operations. */
const DEFAULT_ZELLE_PHONE = "313-200-1873";
const ZELLE_RECIPIENT_BUSINESS_NAME = "AMPRO RETAIL STORES LLC";

export default function ZelleCheckout() {
  const [, setLocation] = useLocation();
  const { items, cartTotal, clearCart, replaceCart } = useCart();
  const { formatUsd, displayTotals } = useShopCurrency();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Format phone number as XXX-XXX-XXXX (strip leading US country code 1)
  const formatPhoneNumber = (value: string) => {
    let digits = value.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith("1")) {
      digits = digits.slice(1);
    }
    const limited = digits.slice(0, 10);
    
    // Format with dashes
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `${limited.slice(0, 3)}-${limited.slice(3)}`;
    } else {
      return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setCustomerPhone(formatted);
  };
  
  const storeSettings = trpc.store.getSettings.useQuery();
  const createZelleOrder = trpc.checkout.createZelleOrder.useMutation();

  // Get delivery method from URL params
  const params = new URLSearchParams(window.location.search);
  const deliveryMethod = (params.get("delivery") as "shipping" | "pickup") || "shipping";

  const shippingZip =
    typeof window !== "undefined" ? sessionStorage.getItem(CHECKOUT_SHIPPING_ZIP_KEY) ?? "" : "";

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

  const orderGrandTotal = orderGrandTotalUsd(cartTotal, shippingQuote);
  const shipUsd =
    deliveryMethod === "pickup" ? 0 : shippingQuote.shippingAmount;
  const checkoutTotals = displayTotals(cartTotal, shipUsd);

  useEffect(() => {
    if (items.length > 0) return;
    try {
      const raw = sessionStorage.getItem(ZELLE_CHECKOUT_CART_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { items?: CartItem[] };
        if (parsed.items?.length) {
          replaceCart(parsed.items);
          return;
        }
      }
    } catch {
      /* ignore corrupt snapshot */
    }
    setLocation("/");
  }, [items.length, replaceCart, setLocation]);

  const handleSubmitOrder = async () => {
    if (!customerName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!customerPhone.trim()) {
      toast.error("Please enter your phone number");
      return;
    }
    let phoneDigits = customerPhone.replace(/\D/g, "");
    if (phoneDigits.length === 11 && phoneDigits.startsWith("1")) {
      phoneDigits = phoneDigits.slice(1);
    }
    if (phoneDigits.length !== 10) {
      toast.error("Please enter a valid 10-digit US phone number");
      return;
    }
    const customerPhoneNormalized = `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`;

    const totalCents = Math.round(orderGrandTotal * 100);
    if (!Number.isFinite(totalCents) || totalCents < 0) {
      toast.error("Invalid order total. Refresh and try again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const orderItems = items.map(item => ({
        name: item.selectedVariantName 
          ? `${item.brand} - ${item.name} - ${item.selectedVariantName}`
          : `${item.brand} - ${item.name}`,
        priceInCents: Math.round((item.salePrice || item.price) * 100),
        quantity: item.quantity,
      }));

      const result = await createZelleOrder.mutateAsync({
        items: orderItems,
        deliveryMethod,
        customerName: customerName.trim(),
        customerPhone: customerPhoneNormalized,
        totalAmount: totalCents,
      });

      setOrderId(result.orderId);
      clearZelleCheckoutCartBackup();
      toast.success("Order created! Please send payment via Zelle");
    } catch (error) {
      console.error("[ZelleCheckout] createZelleOrder failed:", error);
      const msg =
        error instanceof TRPCClientError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to create order";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const zelleEmail = storeSettings.data?.zelleEmail?.trim() || "";
  const zellePhone = storeSettings.data?.zellePhone?.trim() || DEFAULT_ZELLE_PHONE;

  // Show customer info form if order not created yet
  if (!orderId) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="container max-w-2xl">
          <div className="bg-card brutalist-border brutalist-shadow p-8 space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 brutalist-border">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl font-display font-black">ZELLE PAYMENT</h1>
              <p className="text-muted-foreground">
                Enter your details to complete your order
              </p>
            </div>

            {/* Customer Info Form */}
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-bold mb-2">
                    FULL NAME *
                  </label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Smith"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="brutalist-border"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-bold mb-2">
                    PHONE NUMBER *
                  </label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="313-555-1234"
                    value={customerPhone}
                    onChange={handlePhoneChange}
                    className="brutalist-border"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Order Summary */}
              <div className="space-y-4">
                <h3 className="font-display font-bold">ORDER SUMMARY</h3>
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>
                        {item.name} {item.selectedVariantName && `- ${item.selectedVariantName}`} x {item.quantity}
                      </span>
                      <span className="font-bold">
                        {formatUsd((item.salePrice || item.price) * item.quantity)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t-3 border-border pt-2 mt-2 space-y-2 text-sm">
                    <div className="flex justify-between font-semibold">
                      <span className="font-display">SUBTOTAL</span>
                      <span>{checkoutTotals.subtotal}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="font-display">SHIPPING</span>
                      <span>
                        {deliveryMethod === "pickup"
                          ? formatUsd(0)
                          : shippingQuote.isFreeShipping
                            ? "FREE"
                            : checkoutTotals.shipping}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between font-display font-bold text-lg pt-2 border-t-3 border-border">
                    <span>TOTAL</span>
                    <span className="text-primary">{checkoutTotals.total}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Method */}
              <div className="bg-secondary brutalist-border p-4">
                <p className="font-bold text-sm mb-2">
                  {deliveryMethod === "pickup" ? "IN-STORE PICKUP" : "SHIPPING"}
                </p>
                {deliveryMethod === "pickup" && storeSettings.data && (
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{storeSettings.data.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <span>{storeSettings.data.phone}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  clearZelleCheckoutCartBackup();
                  setLocation("/");
                }}
                className="flex-1 brutalist-border"
                disabled={isSubmitting}
              >
                CANCEL
              </Button>
              <Button
                onClick={handleSubmitOrder}
                className="flex-1 brutalist-border brutalist-shadow bg-primary text-primary-foreground"
                disabled={isSubmitting}
              >
                {isSubmitting ? "CREATING ORDER..." : "CONTINUE TO PAYMENT"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show payment instructions after order is created
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container max-w-2xl">
        <div className="bg-card brutalist-border brutalist-shadow p-8 space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 brutalist-border">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-black">ZELLE PAYMENT</h1>
            <p className="text-muted-foreground">
              Order #{orderId} Created
            </p>
          </div>

          {/* Payment Instructions */}
          <div className="space-y-6">
            <div className="bg-secondary brutalist-border p-6 space-y-4">
              <h2 className="font-display font-bold text-lg">PAYMENT INSTRUCTIONS</h2>
              <p className="text-sm leading-relaxed text-foreground">
                We offer payment through Zelle. Send payment to{" "}
                <span className="font-semibold">{zellePhone}</span>. It will be under{" "}
                <span className="font-semibold">{ZELLE_RECIPIENT_BUSINESS_NAME}</span>. Please send a
                text to confirm your order. Thank you for your business.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Open your banking app and select Zelle</li>
                <li>
                  Send <span className="font-semibold">{formatUsd(orderGrandTotal)}</span> using the
                  recipient name and phone number below
                </li>
              </ol>

              {/* Recipient / business name (Zelle payee) */}
              <div className="bg-background brutalist-border p-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground">RECIPIENT / BUSINESS NAME</p>
                <div className="flex items-center justify-between gap-4">
                  <p className="font-mono text-base sm:text-lg break-words pr-2">
                    {ZELLE_RECIPIENT_BUSINESS_NAME}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(ZELLE_RECIPIENT_BUSINESS_NAME)}
                    className="brutalist-border shrink-0"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Zelle Phone */}
              <div className="bg-background brutalist-border p-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground">PHONE (ZELLE)</p>
                <div className="flex items-center justify-between gap-4">
                  <p className="font-mono text-lg">{zellePhone}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(zellePhone)}
                    className="brutalist-border"
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Optional email from admin settings only */}
              {zelleEmail ? (
                <div className="bg-background brutalist-border p-4 space-y-2">
                  <p className="text-xs font-bold text-muted-foreground">EMAIL (IF SHOWN IN YOUR BANK APP)</p>
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-mono text-lg break-all">{zelleEmail}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(zelleEmail)}
                      className="brutalist-border shrink-0"
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : null}

              <ol start={3} className="list-decimal list-inside space-y-2 text-sm">
                <li>Include your order number (#{orderId}) in the payment note / memo</li>
                <li>Send a text message to confirm your order after payment</li>
                <li>We will confirm your order once payment is received</li>
              </ol>
            </div>

            {/* Order Summary */}
            <div className="space-y-4">
              <h3 className="font-display font-bold">ORDER SUMMARY</h3>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>
                      {item.name} {item.selectedVariantName && `- ${item.selectedVariantName}`} x {item.quantity}
                    </span>
                    <span className="font-bold">
                      {formatUsd((item.salePrice || item.price) * item.quantity)}
                    </span>
                  </div>
                ))}
                <div className="border-t-3 border-border pt-2 mt-1 space-y-2 text-sm">
                  <div className="flex justify-between font-semibold">
                    <span className="font-display">SUBTOTAL</span>
                    <span>{checkoutTotals.subtotal}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="font-display">SHIPPING</span>
                    <span>
                      {deliveryMethod === "pickup"
                        ? formatUsd(0)
                        : shippingQuote.isFreeShipping
                          ? "FREE"
                          : checkoutTotals.shipping}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between font-display font-bold text-lg pt-2 border-t-3 border-border">
                  <span>TOTAL</span>
                  <span className="text-primary">{checkoutTotals.total}</span>
                </div>
              </div>
            </div>

            {/* Delivery Method */}
            <div className="bg-secondary brutalist-border p-4">
              <p className="font-bold text-sm mb-2">
                {deliveryMethod === "pickup" ? "IN-STORE PICKUP" : "SHIPPING"}
              </p>
              {deliveryMethod === "pickup" && storeSettings.data && (
                <div className="text-sm space-y-1 text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{storeSettings.data.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span>{storeSettings.data.phone}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              onClick={() => {
                clearZelleCheckoutCartBackup();
                clearCart();
                setLocation("/");
              }}
              className="flex-1 brutalist-border brutalist-shadow bg-primary text-primary-foreground"
            >
              DONE
            </Button>
          </div>

          {/* Help Text */}
          <p className="text-xs text-center text-muted-foreground">
            Questions? Contact us at {storeSettings.data?.phone || "(313) 200-1873"}
          </p>
        </div>
      </div>
    </div>
  );
}
