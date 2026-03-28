import { createClient } from "@supabase/supabase-js";
import { DEFAULT_SUPABASE_URL } from "@shared/const";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
  (process.env.NODE_ENV === "development"
    ? "__local_dev_missing_set_SUPABASE_SERVICE_ROLE_KEY__"
    : "");

if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
  console.warn(
    "[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY is not set — using a dev placeholder so the server can start; API calls that need the service role will fail until you add it to .env"
  );
}
if (!supabaseUrl) {
  console.warn("[Supabase Admin] Missing Supabase URL (VITE_SUPABASE_URL or default)");
}

/**
 * Supabase admin client — uses the service role key so it can verify JWTs
 * and manage users without RLS restrictions.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Verify a Supabase JWT access token and return the user's UID and email.
 * Returns null if the token is invalid or expired.
 */
export async function verifySupabaseToken(
  token: string
): Promise<{ id: string; email: string | null } | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? null,
    };
  } catch (err) {
    console.error("[Supabase Admin] Token verification failed:", err);
    return null;
  }
}
