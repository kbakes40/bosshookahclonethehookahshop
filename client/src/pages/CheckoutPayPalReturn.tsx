import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/contexts/CartContext";
import { PAYPAL_CHECKOUT_STORAGE_KEY } from "@/lib/paypalCheckoutStorage";
import type { OrderShippingAddress } from "@shared/orderShippingAddress";

type StoredPayload = {
  items: Array<{
    name: string;
    priceInCents: number;
    quantity: number;
    image?: string;
  }>;
  deliveryMethod: "shipping" | "pickup";
  /** Included in PayPal order total from cart (capture amount includes shipping). */
  shippingCents?: number;
  shippingAddress?: OrderShippingAddress;
};

export default function CheckoutPayPalReturn() {
  const [location] = useLocation();
  const [msg, setMsg] = useState("Completing your payment…");
  const { clearCart } = useCart();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const orderID = params.get("token") || params.get("orderID");
      if (!orderID) {
        setMsg("Missing PayPal order. Redirecting…");
        window.location.replace("/checkout/cancel");
        return;
      }

      let payload: StoredPayload | null = null;
      try {
        const raw = sessionStorage.getItem(PAYPAL_CHECKOUT_STORAGE_KEY);
        if (raw) payload = JSON.parse(raw) as StoredPayload;
      } catch {
        payload = null;
      }

      if (
        !payload?.items?.length ||
        (payload.deliveryMethod !== "shipping" && payload.deliveryMethod !== "pickup")
      ) {
        setMsg("Cart data expired. Please contact support with your PayPal receipt.");
        return;
      }

      if (payload.deliveryMethod === "shipping" && !payload.shippingAddress?.line1) {
        setMsg("Shipping address missing. Please start checkout again from your cart.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setMsg("Session expired. Please sign in and contact support.");
        return;
      }

      try {
        const res = await fetch("/api/paypal/capture-order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderID,
            items: payload.items,
            deliveryMethod: payload.deliveryMethod,
            shippingAddress:
              payload.deliveryMethod === "shipping" ? payload.shippingAddress : undefined,
          }),
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        if (!res.ok) {
          throw new Error(data.message || "Capture failed");
        }
        sessionStorage.removeItem(PAYPAL_CHECKOUT_STORAGE_KEY);
        if (!cancelled) {
          clearCart();
          window.location.replace(
            `/checkout/success?session_id=${encodeURIComponent(orderID)}&delivery_method=${encodeURIComponent(payload.deliveryMethod)}`
          );
        }
      } catch (e) {
        if (!cancelled) {
          setMsg(e instanceof Error ? e.message : "Payment could not be completed.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location, clearCart]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center py-16">
        <p className="text-lg font-semibold">{msg}</p>
      </main>
      <Footer />
    </div>
  );
}
