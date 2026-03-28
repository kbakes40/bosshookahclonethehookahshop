/**
 * OAuth and email-link redirects must match Supabase → Authentication → URL Configuration
 * (Additional Redirect URLs). When unset, we use the current browser origin so local dev works.
 */
export function getAuthRedirectOrigin(): string {
  const fromEnv = (import.meta.env.VITE_SITE_ORIGIN as string | undefined)?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

export function getAuthCallbackUrl(): string {
  return `${getAuthRedirectOrigin()}/auth/callback`;
}
