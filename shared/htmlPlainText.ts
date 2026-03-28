/** Common named character references (WordPress / WooCommerce / HTML). */
const NAMED_HTML_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ldquo: "\u201c",
  rdquo: "\u201d",
  lsquo: "\u2018",
  rsquo: "\u2019",
  sbquo: "\u201a",
  ndash: "\u2013",
  mdash: "\u2014",
  hellip: "\u2026",
  trade: "\u2122",
  copy: "\u00a9",
  reg: "\u00ae",
  euro: "\u20ac",
  pound: "\u00a3",
  cent: "\u00a2",
  yen: "\u00a5",
  deg: "\u00b0",
  plusmn: "\u00b1",
  frac12: "\u00bd",
  frac14: "\u00bc",
  frac34: "\u00be",
};

function charFromEntityCode(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return "\ufffd";
  if (n >= 0xd800 && n <= 0xdfff) return "\ufffd";
  return String.fromCodePoint(n);
}

/**
 * Decode HTML / XML character references, including double-encoded `&amp;#…;`
 * and malformed export fragments like `#8211;` or `#8211` (missing `&`).
 * Safe for product description plain text; does not execute HTML.
 */
export function decodeHtmlEntitiesDeep(raw: string): string {
  if (!raw) return "";
  let s = raw;

  for (let round = 0; round < 32; round++) {
    const before = s;

    s = s.replace(/&amp;/gi, "&");

    s = s.replace(/&#(\d{1,7});/g, (m, d: string) => {
      const n = parseInt(d, 10);
      return Number.isFinite(n) ? charFromEntityCode(n) : m;
    });

    s = s.replace(/&#x([0-9a-f]{1,6});/gi, (m, h: string) => {
      const n = parseInt(h, 16);
      return Number.isFinite(n) ? charFromEntityCode(n) : m;
    });

    s = s.replace(/&([a-z][a-z0-9]{0,49});/gi, (m, name: string) => {
      const v = NAMED_HTML_ENTITIES[name.toLowerCase()];
      return v !== undefined ? v : m;
    });

    // Malformed numeric refs: `#8211;` (no leading `&`)
    s = s.replace(/(?<![&#])#(\d{4,6});/g, (m, d: string) => {
      const n = parseInt(d, 10);
      if (!Number.isFinite(n) || n < 128 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff))
        return m;
      return charFromEntityCode(n);
    });
    // Same without semicolon — only 4–5 digits to avoid eating values like `#821100`
    s = s.replace(/(?<![&#])#(\d{4,5})(?=\s|[.,:!?)\]'’"\u201d]|$)/g, (m, d: string) => {
      const n = parseInt(d, 10);
      if (!Number.isFinite(n) || n < 128 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff))
        return m;
      return charFromEntityCode(n);
    });

    if (s === before) break;
  }

  return s;
}

/** Decode description text for storefront / API payloads (trim; empty → undefined). */
export function decodeProductDescriptionForDisplay(
  raw: string | null | undefined
): string | undefined {
  if (raw == null) return undefined;
  const decoded = decodeHtmlEntitiesDeep(String(raw));
  const t = decoded.trim();
  return t.length > 0 ? t : undefined;
}

/** Strip HTML / entities to a single-line plain string (Open Graph, SMS previews). */
export function stripHtmlToPlainText(html: string, maxLen: number): string {
  const raw = decodeHtmlEntitiesDeep(html.trim());
  if (!raw) return "";
  const stripped = raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= maxLen) return stripped;
  return `${stripped.slice(0, maxLen - 1).trim()}\u2026`;
}
