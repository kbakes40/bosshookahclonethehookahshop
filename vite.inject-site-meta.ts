import type { Plugin } from "vite";

function normalizeSiteOrigin(raw: string): string {
  const t = raw.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/\//, "")}`;
}

/**
 * Public HTTPS origin for canonical + Open Graph (no trailing slash).
 * Prefer VITE_SITE_ORIGIN so shared links (e.g. davincidynamics.site) match og:image host.
 */
function siteOrigin(): string {
  const explicit = process.env.VITE_SITE_ORIGIN?.trim();
  if (explicit) {
    return normalizeSiteOrigin(explicit);
  }
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) {
    return normalizeSiteOrigin(production);
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return normalizeSiteOrigin(vercel.includes("://") ? vercel : `https://${vercel}`);
  }
  return "https://www.thehookahshop.com";
}

/** Replaces %SITE_ORIGIN% in client/index.html during dev and build. */
export function injectSiteMeta(): Plugin {
  return {
    name: "inject-site-meta",
    transformIndexHtml(html) {
      const origin = siteOrigin();
      return html.split("%SITE_ORIGIN%").join(origin);
    },
  };
}
