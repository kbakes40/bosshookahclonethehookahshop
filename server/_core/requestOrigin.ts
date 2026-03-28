import type { Request } from "express";

function firstForwarded(value: string | undefined): string | undefined {
  return value?.split(",")[0]?.trim();
}

/**
 * Public site origin for OG URLs and APIs. Prefers proxy headers so shared links
 * keep the same hostname the visitor used (e.g. www vs apex).
 */
export function publicRequestOrigin(req: Request): string {
  const xfHost = firstForwarded(req.get("x-forwarded-host")) || firstForwarded(req.get("host"));
  let xfProto = firstForwarded(req.get("x-forwarded-proto"));

  if (!xfProto && xfHost && !xfHost.includes("localhost") && !xfHost.startsWith("127.")) {
    xfProto = "https";
  }
  const proto =
    xfProto || (req.secure ? "https" : req.protocol === "https" ? "https" : "http");

  if (xfHost) {
    return `${proto}://${xfHost}`;
  }

  const raw = process.env.PUBLIC_SITE_URL?.trim() || process.env.VITE_SITE_ORIGIN?.trim();
  if (raw) {
    const t = raw.replace(/\/+$/, "");
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    try {
      return new URL(withScheme).origin;
    } catch {
      /* fall through */
    }
  }

  return "http://localhost:3000";
}
