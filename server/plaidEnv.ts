import { PlaidEnvironments } from "plaid";

export type PlaidRuntimeConfig = {
  clientId: string;
  secret: string;
  basePath: string;
  /** OAuth / hosted Link return URL — must be listed in Plaid Dashboard. */
  redirectUri: string | null;
  /** Link customization name (Transfer UI requires "Account Select" = one account). */
  linkCustomizationName: string | null;
  /** Dashboard » Accounts » Account ID of your funding (origination) account. */
  fundingAccountId: string | null;
  /** Shown as `client_name` in Link (max 30 chars). */
  originatorDisplayName: string;
  /** Optional dashboard webhook for transfer events (Transfer often configured in Dashboard). */
  webhookUrl: string | null;
};

export function readPlaidConfig(): PlaidRuntimeConfig {
  const env = (process.env.PLAID_ENV ?? "sandbox").trim().toLowerCase();
  const basePath =
    env === "production" || env === "prod" || env === "live"
      ? PlaidEnvironments.production
      : PlaidEnvironments.sandbox;

  const originator =
    (process.env.PLAID_TRANSFER_ORIGINATOR_NAME ?? "The Hookah Shop").trim() || "The Hookah Shop";

  return {
    clientId: (process.env.PLAID_CLIENT_ID ?? "").trim(),
    secret: (process.env.PLAID_SECRET ?? "").trim(),
    basePath,
    redirectUri: trimOrNull(process.env.PLAID_REDIRECT_URI),
    linkCustomizationName: trimOrNull(process.env.PLAID_LINK_CUSTOMIZATION_NAME),
    fundingAccountId: trimOrNull(process.env.PLAID_FUNDING_ACCOUNT_ID),
    originatorDisplayName: originator.slice(0, 30),
    webhookUrl: trimOrNull(process.env.PLAID_WEBHOOK_URL),
  };
}

function trimOrNull(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length ? s : null;
}

export function isPlaidTransferConfigured(): boolean {
  const c = readPlaidConfig();
  return Boolean(c.clientId && c.secret);
}
