import { DEFAULT_SUPABASE_URL } from "@shared/const";

/**
 * Project URL for server-side Supabase. Accepts common env names so Vercel setups
 * match Supabase docs (`SUPABASE_URL`) as well as this repo’s `VITE_SUPABASE_URL`.
 */
export function resolveSupabaseUrl(): string {
  return (
    process.env.VITE_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    DEFAULT_SUPABASE_URL
  );
}

export function resolveSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

/** True when the project URL is set via env (not falling back to `DEFAULT_SUPABASE_URL`). */
export function isSupabaseUrlExplicitlyConfigured(): boolean {
  return Boolean(
    process.env.VITE_SUPABASE_URL?.trim() ||
      process.env.SUPABASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  );
}

export function isSupabaseServiceRoleConfigured(): boolean {
  return resolveSupabaseServiceRoleKey().length > 0;
}

/** Fail fast in production when catalog queries would otherwise return an opaque PostgREST error. */
export function assertSupabaseServiceRoleForProduction(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (isSupabaseServiceRoleConfigured()) return;
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is not set. In Vercel: Settings → Environment Variables. In Supabase: Settings → API → service_role (secret). Must match the same project as your Supabase URL."
  );
}
