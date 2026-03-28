import { TRPCError } from "@trpc/server";
import {
  ACHClass,
  CountryCode,
  Products,
  TransferIntentAuthorizationDecision,
  TransferIntentCreateMode,
  TransferIntentStatus,
} from "plaid";
import type { CheckoutLineItem } from "./paypalOrderDb";
import { getPlaidClient } from "./plaidClient";
import { isPlaidTransferConfigured, readPlaidConfig } from "./plaidEnv";
import { supabaseAdmin } from "./_core/supabaseAdmin";

const PLAID_USER_META = "supabase_user_id";

export function assertPlaidTransferReady(): void {
  if (!isPlaidTransferConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Pay by Bank is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.",
    });
  }
}

function formatUsdAmount(cents: number): string {
  const v = Math.max(0, Math.round(cents)) / 100;
  return v.toFixed(2);
}

function lineItemsSubtotalCents(items: CheckoutLineItem[]): number {
  return items.reduce((s, i) => s + i.priceInCents * i.quantity, 0);
}

export async function createPlaidTransferLinkSession(params: {
  supabaseUserId: string;
  legalName: string;
  email: string | null;
  items: CheckoutLineItem[];
  deliveryMethod: "shipping" | "pickup";
  shippingCents: number;
}): Promise<{ linkToken: string; transferIntentId: string; amountCents: number }> {
  assertPlaidTransferReady();
  const cfg = readPlaidConfig();
  const subtotal = lineItemsSubtotalCents(params.items);
  const ship = Math.max(0, Math.round(params.shippingCents));
  const totalCents = subtotal + ship;
  const amountDecimal = formatUsdAmount(totalCents);

  const client = getPlaidClient();

  const intentReq = {
    mode: TransferIntentCreateMode.Payment,
    amount: amountDecimal,
    description: "THS Checkout",
    ach_class: ACHClass.Web,
    user: {
      legal_name: params.legalName.trim(),
      email_address: params.email?.trim() || undefined,
    },
    metadata: {
      [PLAID_USER_META]: params.supabaseUserId,
    },
    ...(cfg.fundingAccountId ? { funding_account_id: cfg.fundingAccountId } : {}),
    iso_currency_code: "USD",
  };

  let intentId: string;
  try {
    const intentRes = await client.transferIntentCreate(intentReq);
    intentId = intentRes.data.transfer_intent.id;
  } catch (e: unknown) {
    console.error("[Plaid] transferIntentCreate:", e);
    throw plaidToTrpc(e, "Could not start bank transfer.");
  }

  const linkBody: Parameters<typeof client.linkTokenCreate>[0] = {
    client_name: cfg.originatorDisplayName,
    language: "en",
    country_codes: [CountryCode.Us],
    user: {
      client_user_id: params.supabaseUserId,
      legal_name: params.legalName.trim(),
      email_address: params.email?.trim() || undefined,
    },
    products: [Products.Transfer],
    transfer: { intent_id: intentId },
    ...(cfg.linkCustomizationName ? { link_customization_name: cfg.linkCustomizationName } : {}),
    ...(cfg.redirectUri ? { redirect_uri: cfg.redirectUri } : {}),
    ...(cfg.webhookUrl ? { webhook: cfg.webhookUrl } : {}),
  };

  try {
    const linkRes = await client.linkTokenCreate(linkBody);
    const linkToken = linkRes.data.link_token;
    if (!linkToken) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Plaid did not return a link token." });
    }
    return { linkToken, transferIntentId: intentId, amountCents: totalCents };
  } catch (e: unknown) {
    console.error("[Plaid] linkTokenCreate:", e);
    throw plaidToTrpc(e, "Could not open bank connection.");
  }
}

async function fetchTransferIntentWithRetry(transferIntentId: string) {
  const client = getPlaidClient();
  let last!: Awaited<ReturnType<typeof client.transferIntentGet>>;
  for (let i = 0; i < 5; i++) {
    last = await client.transferIntentGet({ transfer_intent_id: transferIntentId });
    const intent = last.data.transfer_intent;
    if (intent.status !== TransferIntentStatus.Pending || intent.transfer_id != null) {
      break;
    }
    await new Promise(r => setTimeout(r, 600));
  }
  return last.data.transfer_intent;
}

export async function completePlaidTransferOrder(params: {
  supabaseUserId: string;
  customerEmail: string | null;
  customerNameFallback: string | null;
  publicToken: string;
  transferIntentId: string;
  items: CheckoutLineItem[];
  deliveryMethod: "shipping" | "pickup";
  shippingCents: number;
  shippingAddress: Record<string, unknown> | null;
  /** From Plaid Link `metadata.transfer_status` when present. */
  linkTransferStatus?: string | null;
  institutionName?: string | null;
  linkSessionId?: string | null;
}): Promise<{
  orderId: string;
  transferId: string | null;
  intentStatus: string;
  linkTransferStatus: string | null;
}> {
  assertPlaidTransferReady();
  const client = getPlaidClient();

  let itemId: string;
  try {
    const ex = await client.itemPublicTokenExchange({ public_token: params.publicToken });
    itemId = ex.data.item_id;
  } catch (e: unknown) {
    console.error("[Plaid] itemPublicTokenExchange:", e);
    throw plaidToTrpc(e, "Could not verify bank link.");
  }

  const intent = await fetchTransferIntentWithRetry(params.transferIntentId);

  const metaUid = intent.metadata?.[PLAID_USER_META];
  if (metaUid && metaUid !== params.supabaseUserId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Transfer does not match this account." });
  }

  const subtotal = lineItemsSubtotalCents(params.items);
  const ship = Math.max(0, Math.round(params.shippingCents));
  const expectedTotalCents = subtotal + ship;
  const intentCents = Math.round(parseFloat(intent.amount) * 100);
  if (Math.abs(expectedTotalCents - intentCents) > 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cart total no longer matches the authorized bank transfer. Restart checkout.",
    });
  }

  if (intent.status === TransferIntentStatus.Failed) {
    const fr = intent.failure_reason;
    const msg = fr?.error_message || fr?.error_code || "Bank transfer could not be completed.";
    throw new TRPCError({ code: "BAD_REQUEST", message: msg });
  }

  if (intent.authorization_decision === TransferIntentAuthorizationDecision.Declined) {
    const r = intent.authorization_decision_rationale;
    const msg = r?.description || r?.code || "Your bank declined this transfer.";
    throw new TRPCError({ code: "BAD_REQUEST", message: msg });
  }

  if (intent.status !== TransferIntentStatus.Succeeded) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Bank transfer did not finish. You can try again or use another payment method. If you already confirmed in your bank app, contact support.",
    });
  }

  const transferId = intent.transfer_id;
  const sessionKey = `plaid_intent_${params.transferIntentId}`;

  const { data: existing } = await supabaseAdmin
    .from("bh_orders")
    .select("id")
    .eq("stripe_session_id", sessionKey)
    .maybeSingle();
  if (existing) {
    return {
      orderId: String((existing as { id: string }).id),
      transferId,
      intentStatus: intent.status,
      linkTransferStatus: params.linkTransferStatus ?? null,
    };
  }

  const now = new Date().toISOString();
  const payment_metadata = {
    provider: "plaid_transfer",
    payment_method: "bank_transfer",
    plaid_item_id: itemId,
    plaid_transfer_id: transferId,
    plaid_transfer_intent_id: params.transferIntentId,
    transfer_intent_status: intent.status,
    authorization_decision: intent.authorization_decision,
    authorization_rationale_code: intent.authorization_decision_rationale?.code ?? null,
    link_transfer_status: params.linkTransferStatus ?? null,
    institution_name: params.institutionName ?? null,
    link_session_id: params.linkSessionId ?? null,
    failure_reason: intent.failure_reason,
    plaid_env: (process.env.PLAID_ENV ?? "sandbox").trim(),
  };

  const { data: inserted, error } = await supabaseAdmin
    .from("bh_orders")
    .insert({
      status: "pending",
      fulfillment_status: "pending",
      total_amount: expectedTotalCents,
      currency: "usd",
      customer_name: intent.user?.legal_name?.trim() || params.customerNameFallback || "Guest",
      customer_email: params.customerEmail?.trim() || null,
      customer_phone: null,
      stripe_session_id: sessionKey,
      stripe_payment_intent: transferId,
      payment_method: "bank_transfer",
      delivery_method: params.deliveryMethod,
      items: params.items,
      shipping_address: params.shippingAddress,
      payment_metadata,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[Plaid] bh_orders insert:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message || "Failed to save order",
    });
  }

  return {
    orderId: String((inserted as { id: string }).id),
    transferId,
    intentStatus: intent.status,
    linkTransferStatus: params.linkTransferStatus ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function plaidToTrpc(err: unknown, fallback: string): TRPCError {
  const ax = err as { response?: { data?: any }; message?: string };
  const d = ax.response?.data;
  const msg =
    (typeof d?.error_message === "string" && d.error_message) ||
    (typeof d?.display_message === "string" && d.display_message) ||
    ax.message ||
    fallback;
  return new TRPCError({ code: "BAD_REQUEST", message: msg });
}
