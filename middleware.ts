/**
 * Vercel Edge: inject product-specific Open Graph + Twitter meta into index.html for `/product/*`
 * so iMessage, Slack, etc. unfurl the real product image instead of the site default.
 *
 * Local `pnpm dev` does not run this; use `vercel dev` to test previews.
 */

export const config = {
  matcher: ["/product/:path*"],
};

type OgMeta = {
  title: string;
  description: string;
  image: string;
  url: string;
};

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2 || parts[0] !== "product") {
    return fetch(request);
  }
  const productId = decodeURIComponent(parts[1]!);

  const metaUrl = new URL("/api/og-meta", url.origin);
  metaUrl.searchParams.set("id", productId);
  const variant = url.searchParams.get("variant")?.trim();
  if (variant) metaUrl.searchParams.set("variant", variant);

  const fwdHeaders = new Headers();
  fwdHeaders.set("x-forwarded-host", url.host);
  fwdHeaders.set("x-forwarded-proto", url.protocol.replace(":", ""));

  let ogRes: Response;
  try {
    ogRes = await fetch(metaUrl.toString(), { headers: fwdHeaders });
  } catch {
    return fetch(new URL("/index.html", url.origin));
  }

  if (!ogRes.ok) {
    return fetch(new URL("/index.html", url.origin));
  }

  let meta: OgMeta;
  try {
    meta = (await ogRes.json()) as OgMeta;
  } catch {
    return fetch(new URL("/index.html", url.origin));
  }

  const indexRes = await fetch(new URL("/index.html", url.origin));
  if (!indexRes.ok) {
    return fetch(request);
  }

  let html = await indexRes.text();
  const t = escapeHtmlAttr(meta.title);
  const d = escapeHtmlAttr(meta.description);
  const im = escapeHtmlAttr(meta.image);
  const u = escapeHtmlAttr(meta.url);

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`);
  html = html.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${d}" />`
  );
  html = html.replace(
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${u}" />`
  );
  html = html.replace(
    /<meta property="og:type" content="[^"]*" \/>/,
    `<meta property="og:type" content="product" />`
  );
  html = html.replace(
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${u}" />`
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${t}" />`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${d}" />`
  );
  html = html.replace(
    /<meta property="og:image" content="[^"]*" \/>/,
    `<meta property="og:image" content="${im}" />`
  );
  html = html.replace(
    /<meta property="og:image:secure_url" content="[^"]*" \/>/,
    `<meta property="og:image:secure_url" content="${im}" />`
  );
  html = html.replace(
    /<meta property="og:image:alt" content="[^"]*" \/>/,
    `<meta property="og:image:alt" content="${t}" />`
  );
  html = html.replace(
    /<meta name="twitter:url" content="[^"]*" \/>/,
    `<meta name="twitter:url" content="${u}" />`
  );
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${t}" />`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${d}" />`
  );
  html = html.replace(
    /<meta name="twitter:image" content="[^"]*" \/>/,
    `<meta name="twitter:image" content="${im}" />`
  );
  html = html.replace(
    /<meta name="twitter:image:alt" content="[^"]*" \/>/,
    `<meta name="twitter:image:alt" content="${t}" />`
  );

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
