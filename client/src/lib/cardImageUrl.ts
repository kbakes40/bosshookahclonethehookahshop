/** Max width requested for grid/card images (layout is ~256–384px wide on desktop). */
const CARD_MAX_W = 480;

/**
 * Best-effort smaller URLs for known CDNs. Unknown hosts return unchanged (browser still gets `sizes` + lazy).
 */
export function cardImageSrc(url: string): string {
  if (!url?.trim()) return url;

  // Cloudflare Images / similar (already transformed)
  if (url.includes("/cdn-cgi/image/")) return url;

  // Cloudinary
  const cu = "/upload/";
  const cIdx = url.indexOf(cu);
  if (cIdx !== -1 && !url.includes("f_auto") && !url.includes("/upload/f_")) {
    const base = url.slice(0, cIdx + cu.length);
    const rest = url.slice(cIdx + cu.length);
    return `${base}f_auto,q_auto,w_${CARD_MAX_W}/${rest}`;
  }

  // Cloudflare Image Delivery
  if (url.includes("imagedelivery.net/")) {
    if (url.includes("width=") || url.includes("w=")) return url;
    return url.includes("?") ? `${url}&width=${CARD_MAX_W}` : `${url}?width=${CARD_MAX_W}`;
  }

  return url;
}
