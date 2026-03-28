import { resolveSupabaseServiceRoleKey, resolveSupabaseUrl } from "./supabaseEnv";

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  // Supabase
  supabaseUrl: resolveSupabaseUrl(),
  supabaseServiceRoleKey: resolveSupabaseServiceRoleKey(),
  // Admin emails - these users will always have admin role
  adminEmail: "kevin@bakerhub.com",
  adminEmails: [
    "kevin@bakerhub.com",
    "chillvibesss420@gmail.com",
    "admin@thehookahshop.com",
  ],
  /**
   * PayPal REST (server). On Vercel, set `PUBLIC_SITE_URL` (or `VITE_SITE_ORIGIN`) to the canonical https storefront so PayPal return URLs match the tab where checkout started.
   */
  paypalClientId: (process.env.PAYPAL_CLIENT_ID ?? "").trim(),
  paypalSecret: (process.env.PAYPAL_SECRET ?? "").trim(),
  /**
   * `live` → api-m.paypal.com; everything else → sandbox.
   * Accepts: live, production, prod (case-insensitive).
   */
  paypalEnv: (() => {
    const r = (process.env.PAYPAL_ENV ?? "sandbox").trim().toLowerCase();
    if (r === "live" || r === "production" || r === "prod") return "live";
    return "sandbox";
  })(),
};

/** Normalize PEM / Vercel one-line keys (literal `\n`, CRLF, wrapping quotes). */
function normalizeGa4PrivateKey(raw: string | undefined): string {
  if (raw == null || raw === "") return "";
  let k = raw.replace(/\r\n/g, "\n").trim();
  k = k.replace(/\\n/g, "\n");
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim().replace(/\\n/g, "\n");
  }
  return k.trim();
}

/** GA4 Data API (service account). Server-side only; never send to the client. */
export function readGa4Env(): {
  propertyId: string;
  clientEmail: string;
  privateKey: string;
} {
  return {
    propertyId: (process.env.GA4_PROPERTY_ID ?? "").trim(),
    clientEmail: (process.env.GA4_CLIENT_EMAIL ?? "").trim(),
    privateKey: normalizeGa4PrivateKey(process.env.GA4_PRIVATE_KEY),
  };
}

export function isGa4EnvConfigured(): boolean {
  const e = readGa4Env();
  return Boolean(e.propertyId && e.clientEmail && e.privateKey);
}

/** PayPal REST — read from `process.env` at call time (Vercel injects these at runtime, not from local `.env` in production). */
export function readPayPalRuntimeEnv(): {
  clientId: string;
  secret: string;
  apiMode: "live" | "sandbox";
} {
  const r = (process.env.PAYPAL_ENV ?? "sandbox").trim().toLowerCase();
  const apiMode =
    r === "live" || r === "production" || r === "prod" ? "live" : "sandbox";
  return {
    clientId: (process.env.PAYPAL_CLIENT_ID ?? "").trim(),
    secret: (process.env.PAYPAL_SECRET ?? "").trim(),
    apiMode,
  };
}
