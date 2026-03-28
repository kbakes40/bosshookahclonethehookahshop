import type { Plugin } from "vite";

/** Public HTTPS origin for canonical + Open Graph (no trailing slash). */
function siteOrigin(): string {
  const explicit = process.env.VITE_SITE_ORIGIN?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel}`;
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
