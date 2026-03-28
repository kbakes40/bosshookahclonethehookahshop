import { useCart } from "@/contexts/CartContext";
import {
  clearPlaidCheckoutSession,
  loadPlaidCheckoutSession,
  type PlaidCheckoutSessionPayload,
} from "@/lib/plaidCheckoutSession";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { triggerHaptic } from "@/lib/haptics";

/**
 * OAuth return target: set `PLAID_REDIRECT_URI` to `${origin}/plaid-oauth` in the Plaid Dashboard.
 */
export default function PlaidLinkResume() {
  const [, navigate] = useLocation();
  const { clearCart } = useCart();
  const completePlaid = trpc.checkout.completePlaidBankOrder.useMutation();
  const [token, setToken] = useState<string | null>(null);
  const payloadRef = useRef<PlaidCheckoutSessionPayload | null>(null);

  useEffect(() => {
    const p = loadPlaidCheckoutSession();
    if (!p?.linkToken) {
      toast.error("Session expired. Open your cart and try Pay by Bank again.");
      void navigate("/");
      return;
    }
    payloadRef.current = p;
    setToken(p.linkToken);
  }, [navigate]);

  const receivedRedirectUri =
    typeof window !== "undefined" && window.location.href.includes("oauth_state_id")
      ? window.location.href
      : undefined;

  const { open, ready } = usePlaidLink({
    token,
    receivedRedirectUri,
    onSuccess: async (publicToken, meta) => {
      const p = payloadRef.current;
      if (!p) return;
      try {
        await completePlaid.mutateAsync({
          publicToken,
          transferIntentId: p.transferIntentId,
          items: p.items,
          deliveryMethod: p.deliveryMethod,
          shippingCents: p.shippingCents,
          shippingAddress: p.shippingAddress
            ? {
                full_name: p.shippingAddress.full_name,
                line1: p.shippingAddress.line1,
                line2: p.shippingAddress.line2 ?? "",
                city: p.shippingAddress.city,
                state: p.shippingAddress.state,
                zip: p.shippingAddress.zip,
                phone: p.shippingAddress.phone ?? "",
              }
            : undefined,
          linkTransferStatus: meta.transfer_status,
          institutionName: meta.institution?.name,
          linkSessionId: meta.link_session_id,
        });
        clearPlaidCheckoutSession();
        clearCart();
        toast.success("Bank payment submitted. Your order is pending processing.");
        triggerHaptic("confirm");
        void navigate("/");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Payment failed";
        toast.error(msg);
        clearPlaidCheckoutSession();
        triggerHaptic("error");
        void navigate("/");
      }
    },
    onExit: err => {
      clearPlaidCheckoutSession();
      if (err?.display_message || err?.error_message) {
        toast.error(err.display_message || err.error_message);
      }
      void navigate("/");
    },
  });

  useEffect(() => {
    if (token && ready) {
      open();
    }
  }, [token, ready, open]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 p-8">
      <p className="font-display font-black text-lg">FINISHING BANK CONNECTION</p>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Use the Plaid window to complete your bank login. This page stays open during OAuth return.
      </p>
    </div>
  );
}
