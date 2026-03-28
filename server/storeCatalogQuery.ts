import type { Product } from "../client/src/lib/products";

export type StorefrontSort = "best-selling" | "price-low" | "price-high" | "newest";

/** Normalize plural/singular or legacy slugs so filters match live DB category strings. */
const CATEGORY_SYNONYM_GROUPS: string[][] = [
  ["vapes", "vape"],
  ["bowls", "bowl"],
  ["hookahs", "hookah"],
];

function categorySynonymSet(filterLower: string): Set<string> | null {
  for (const g of CATEGORY_SYNONYM_GROUPS) {
    if (g.includes(filterLower)) return new Set(g);
  }
  return null;
}

/** Case-insensitive match so URL `/vapes` works even if a row has `Vapes` or `vape`. */
export function categoryMatches(productCategory: string, filterCategory: string): boolean {
  const f = filterCategory.trim().toLowerCase();
  if (f === "" || f === "all") return true;
  const p = productCategory.trim().toLowerCase();
  const syn = categorySynonymSet(f);
  if (syn) return syn.has(p);
  return p === f;
}

export function filterProductsForGrid(
  products: Product[],
  opts: {
    category: string;
    brand?: string;
    priceMin: number;
    priceMax: number;
    showInStock: boolean;
    showOutOfStock: boolean;
  }
): Product[] {
  let list =
    opts.category === "all" || opts.category.trim() === ""
      ? [...products]
      : products.filter(p => categoryMatches(p.category, opts.category));

  if (opts.brand?.trim()) {
    const b = opts.brand.trim().toLowerCase();
    list = list.filter(p => p.brand.toLowerCase() === b);
  }

  list = list.filter(p => {
    const price = p.salePrice ?? p.price;
    return price >= opts.priceMin && price <= opts.priceMax;
  });

  if (opts.showInStock || opts.showOutOfStock) {
    list = list.filter(
      p =>
        (opts.showInStock && p.inStock) ||
        (opts.showOutOfStock && !p.inStock)
    );
  }

  return list;
}

export function sortStorefrontProducts(list: Product[], sortBy: StorefrontSort): Product[] {
  const copy = [...list];
  switch (sortBy) {
    case "price-low":
      copy.sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price));
      break;
    case "price-high":
      copy.sort((a, b) => (b.salePrice ?? b.price) - (a.salePrice ?? a.price));
      break;
    case "newest":
      copy.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      break;
    default:
      copy.sort((a, b) => {
        const score = (p: Product) =>
          (p.trending ? 4 : 0) + (p.featured ? 2 : 0) + (p.inStock ? 1 : 0);
        const d = score(b) - score(a);
        if (d !== 0) return d;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
  }
  return copy;
}

export function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categorySearchAliases(cat: string): string {
  const c = cat.trim().toLowerCase();
  const map: Record<string, string> = {
    hookahs: "hookah hookahs water pipe stem base",
    shisha: "shisha tobacco flavor molasses blonde dark leaf",
    charcoal: "charcoal coal coals coconut quick light cocourth",
    vapes: "vape vapes disposable e cig ecig cigarette salt nic nicotine puff",
    accessories: "accessories parts foil paper hose grommet tongs brush wind cover burner torch",
    bowls: "bowl bowls phunnel clay glass silicon head",
  };
  return map[c] ?? "";
}

export function buildProductSearchHaystack(p: Product): string {
  const skuBits =
    p.catalogSkus?.flatMap(sk => {
      const plain = sk
        .replace(/^catalog:/i, "")
        .replace(/:/g, " ")
        .replace(/var-/gi, " ");
      return [sk, plain];
    }) ?? [];
  const parts = [
    p.name,
    p.brand,
    p.category,
    categorySearchAliases(p.category),
    p.description ?? "",
    p.badge ?? "",
    p.specs?.join(" ") ?? "",
    ...skuBits,
    ...(p.variants?.flatMap(v => [v.name, v.description ?? ""]) ?? []),
  ];
  return normalizeSearchText(parts.join(" "));
}

function sortTieBreak(a: Product, b: Product): number {
  const sa = (a.trending ? 4 : 0) + (a.featured ? 2 : 0) + (a.inStock ? 1 : 0);
  const sb = (b.trending ? 4 : 0) + (b.featured ? 2 : 0) + (b.inStock ? 1 : 0);
  if (sb !== sa) return sb - sa;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  if (m > 48 || n > 48 || Math.abs(m - n) > 6) return 99;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n]!;
}

function fuzzyTokenScore(hayTok: string, qTok: string): number {
  if (!qTok.length) return 0;
  if (hayTok === qTok) return 100;
  if (hayTok.startsWith(qTok)) return 88;
  if (hayTok.includes(qTok)) return 76;
  const dist = levenshtein(hayTok, qTok);
  const maxDist = qTok.length <= 3 ? 1 : qTok.length <= 6 ? 2 : 3;
  if (dist <= maxDist) return 58 - dist * 9;
  return 0;
}

/** Match a query token against any haystack word (handles typos like "sturbuz" → "starbuzz"). */
function fuzzyTokenInHaystack(qTok: string, hayArr: string[]): number {
  let best = 0;
  const compact = qTok.replace(/\s+/g, "");
  if (compact.length < 3) return 0;
  for (const w of hayArr) {
    if (w.length < 3) continue;
    if (Math.abs(w.length - compact.length) > 4) continue;
    const d = levenshtein(w, compact);
    const lim = compact.length <= 5 ? 2 : 3;
    if (d <= lim) best = Math.max(best, 78 - d * 14);
  }
  return best;
}

export type RankedSearchHit = { product: Product; score: number };

/**
 * Multi-field ranked search with per-token typo tolerance (Levenshtein on tokens).
 * Includes: name, brand, category +aliases, description, specs, variants, badge, catalog SKUs.
 */
export function rankProductsBySearch(
  products: Product[],
  query: string,
  opts?: { minScore?: number }
): RankedSearchHit[] {
  const nq = normalizeSearchText(query);
  if (!nq) return [];
  const qTokens = nq.split(" ").filter(t => t.length > 0);
  if (!qTokens.length) return [];

  const minScore = opts?.minScore ?? (qTokens.length <= 1 ? 58 : 72);
  const results: RankedSearchHit[] = [];

  for (const p of products) {
    const hayFull = buildProductSearchHaystack(p);
    const hayArr = hayFull.split(" ").filter(t => t.length > 0);

    const pn = normalizeSearchText(p.name);
    const pb = normalizeSearchText(p.brand);
    const pcat = normalizeSearchText(p.category);
    const aliases = normalizeSearchText(categorySearchAliases(p.category));

    let score = 0;

    if (hayFull.includes(nq)) score += 440;
    if (pn.startsWith(nq)) score += 320;
    else if (pn.includes(nq)) score += 210;
    if (pb.includes(nq)) score += 160;
    if (pcat.includes(nq) || aliases.includes(nq)) score += 120;

    let tokenSum = 0;
    let tokensWeak = false;
    for (const qt of qTokens) {
      let best = 0;
      if (hayFull.includes(qt)) best = 90;
      else {
        for (const ht of hayArr) {
          best = Math.max(best, fuzzyTokenScore(ht, qt));
        }
        best = Math.max(best, fuzzyTokenInHaystack(qt, hayArr));
      }
      if (best < 40) tokensWeak = true;
      tokenSum += best;
    }

    if (!tokensWeak) score += tokenSum;
    else if (score < 140) continue;

    score += (p.trending ? 8 : 0) + (p.featured ? 5 : 0) + (p.inStock ? 3 : 0);

    if (score < minScore) continue;

    results.push({ product: p, score });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return sortTieBreak(a.product, b.product);
  });

  return results;
}

export function searchProductsByQuery(products: Product[], q: string): Product[] {
  const term = q.trim();
  if (!term) return [];
  return rankProductsBySearch(products, term).map(r => r.product);
}

export type CategorySearchNavHit = {
  id: string;
  label: string;
  href: string;
  score: number;
};

const CATEGORY_NAV_INDEX: {
  id: string;
  label: string;
  href: string;
  keywords: string[];
}[] = [
  { id: "vapes", label: "Vapes", href: "/vapes", keywords: ["vape", "vapes", "disposable", "nicotine", "puff", "ecig"] },
  { id: "hookahs", label: "Hookahs", href: "/hookahs", keywords: ["hookah", "hookahs", "pipe"] },
  { id: "shisha", label: "Shisha", href: "/shisha", keywords: ["shisha", "tobacco", "flavor", "molasses"] },
  { id: "charcoal", label: "Charcoal", href: "/charcoal", keywords: ["charcoal", "coal", "coals", "coconut"] },
  { id: "accessories", label: "Accessories", href: "/accessories", keywords: ["accessories", "foil", "hose", "tongs", "torch"] },
  { id: "bowls", label: "Hookah Bowls", href: "/bowls", keywords: ["bowl", "bowls", "phunnel", "head"] },
];

export function matchCategoryNavHits(query: string, limit = 4): CategorySearchNavHit[] {
  const nq = normalizeSearchText(query);
  if (!nq) return [];
  const tok = nq.split(" ").filter(Boolean);
  const out: CategorySearchNavHit[] = [];
  for (const c of CATEGORY_NAV_INDEX) {
    let score = 0;
    const labelN = normalizeSearchText(c.label);
    if (labelN.includes(nq) || nq.includes(labelN)) score += 200;
    for (const k of c.keywords) {
      if (nq.includes(k) || k.includes(nq)) score += 120;
      for (const t of tok) {
        if (t.length >= 2 && (k.includes(t) || t.includes(k))) score += 40;
        if (fuzzyTokenScore(k, t) >= 45) score += 35;
      }
    }
    if (score > 0) out.push({ id: c.id, label: c.label, href: c.href, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
