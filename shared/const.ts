/** Default Supabase project URL. Override with `VITE_SUPABASE_URL` in env. */
export const DEFAULT_SUPABASE_URL =
  "https://pahukiygqfdxinpwoeee.supabase.co";

/**
 * Google Cloud Console → OAuth 2.0 client → Authorized redirect URIs (add exactly this).
 * Flow: Google → this URL (Supabase) → then your app `redirectTo` in signInWithOAuth.
 */
export const SUPABASE_OAUTH_REDIRECT_URI = `${DEFAULT_SUPABASE_URL}/auth/v1/callback`;

export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/** Admin inventory table page size (dashboard + inventory pages). */
export const ADMIN_INVENTORY_PAGE_SIZE = 50;
