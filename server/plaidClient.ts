import { Configuration, PlaidApi } from "plaid";
import { readPlaidConfig } from "./plaidEnv";

let cached: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
  if (cached) return cached;
  const c = readPlaidConfig();
  if (!c.clientId || !c.secret) {
    throw new Error("Plaid is not configured (PLAID_CLIENT_ID / PLAID_SECRET).");
  }
  const configuration = new Configuration({
    basePath: c.basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": c.clientId,
        "PLAID-SECRET": c.secret,
      },
    },
  });
  cached = new PlaidApi(configuration);
  return cached;
}
