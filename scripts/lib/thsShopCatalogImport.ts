/**
 * Reusable helpers: thehookahshop.com WooCommerce Store API → bh_products-shaped rows,
 * with category filters (no candy/food/beverages), dedup rules, and enrichment patches.
 *
 * Listing uses the same pagination as /shop/ inventory: GET /wc/store/v1/products
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BhProductInsert } from "../../server/siteCatalogSync";

export const THS_STORE_BASE = "https://thehookahshop.com/wp-json/wc/store/v1";
export const THS_SITE_ORIGIN = "https://thehookahshop.com";
const FETCH_UA = "BossHookah-catalog-import/1.1";

export type WcCategory = { id: number; name: string; slug: string; link?: string };

export type WcPriceBlock = {
  price: string;
  regular_price: string;
  sale_price?: string;
  currency_minor_unit?: number;
};

export type WcProduct = {
  id: number;
  name: string;
  slug: string;
  parent: number;
  type: string;
  variation?: string;
  sku?: string;
  permalink?: string;
  description?: string;
  short_description?: string;
  on_sale?: boolean;
  prices?: WcPriceBlock;
  images?: { src: string }[];
  brands?: { name: string }[];
  categories?: WcCategory[];
  attributes?: unknown[];
  tags?: { name: string; slug: string }[];
  is_in_stock?: boolean;
  stock_availability?: { text?: string; class?: string };
};

export type ThsImportMeta = {
  source: "thehookahshop-woo-store-api";
  wp_product_id: number;
  wp_variation_id?: number;
  wc_slug: string;
  wc_sku: string;
  permalink: string;
  short_description_plain?: string;
  description_html?: string;
  gallery_urls: string[];
  attributes?: unknown[];
  categories: { id: number; slug: string; name: string }[];
  stock_availability?: { text?: string; class?: string };
};

export type ExistingBhRow = {
  id: string;
  name: string;
  sku: string | null;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  description: string | null;
  price: number | null;
  sale_price: number | null;
  source_product_url: string | null;
  import_meta: Record<string, unknown> | null;
};

/** Candy & Drinks and similar — Woo category ids observed on THS */
export const EXCLUDED_CATEGORY_IDS = new Set<number>([559, 560]);

const EXCLUDED_SLUG_EXACT = new Set(
  [
    "candy",
    "candy-drinks",
    "candy-and-drinks",
    "food",
    "foods",
    "beverages",
    "beverage",
    "drinks",
    "drink",
    "snacks",
    "snack",
    "grocery",
    "groceries",
    "soda",
    "juice",
    "edibles",
    "edible",
  ].map(s => s.toLowerCase())
);

const SAFE_CATEGORY_SLUG_RES = [
  /charcoal/i,
  /coal/i,
  /tobacco/i,
  /shisha-tobacco/i,
  /vape/i,
  /e-cig/i,
  /disposable/i,
  /hookah/i,
  /bowl/i,
  /foil/i,
  /hose/i,
  /grommet/i,
  /torch/i,
  /tongs/i,
  /heat-management/i,
  /accessories/i,
  /lighters/i,
  /burners/i,
  /fumari/i,
  /starbuzz/i,
];

const EDIBLE_TITLE_RE =
  /\b(kinder\b|mars bar|snickers|reeses|\bm\s*&\s*m\b|skittles|twix|oreo|nutella|candy bar|chocolate bar|gummy bears?|potato chips|corn chips|fruit snacks|snack pack|juice box|trail mix|mixed nuts\b|nuts bag\b|pumpkin seeds|melon seeds|large tin can\b|soft drink|soda can|granola bar)\b/i;

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeProductName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2019'`"]/g, "")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function baseTitleFromName(fullName: string): string {
  const idx = fullName.indexOf(" — ");
  return (idx === -1 ? fullName : fullName.slice(0, idx)).trim();
}

export function normalizeSourceUrl(raw: string | undefined | null): string {
  const u = (raw ?? "").trim();
  if (!u) return "";
  try {
    const url = new URL(u);
    url.hash = "";
    const path = url.pathname.replace(/\/$/, "") || "/";
    return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`.replace(/\/$/, "");
  } catch {
    return u.replace(/\/$/, "").toLowerCase();
  }
}

function minorDiv(p?: WcPriceBlock): number {
  const u = p?.currency_minor_unit ?? 2;
  return 10 ** u;
}

export function usdFromWoo(p: WcProduct): { price: number; salePrice?: number } {
  const pr = p.prices;
  if (!pr) return { price: 0 };
  const div = minorDiv(pr);
  const regular = Number(pr.regular_price) / div;
  const current = Number(pr.price) / div;
  const saleNum = pr.sale_price ? Number(pr.sale_price) / div : null;
  const onSale = Boolean(p.on_sale && saleNum != null && regular > 0 && saleNum < regular);
  if (onSale && saleNum != null) {
    return { price: regular, salePrice: saleNum };
  }
  return { price: current > 0 ? current : regular, salePrice: undefined };
}

export function guessBrand(p: WcProduct): string {
  const b = p.brands?.[0]?.name?.trim();
  if (b) return b;
  const words = p.name.trim().split(/\s+/);
  if (words.length >= 2 && words[0]!.toLowerCase() === "al" && words[1]!.toLowerCase() === "fakher") {
    return "Al Fakher";
  }
  return words[0] ?? "The Hookah Shop";
}

export function variationLabel(raw: string): string {
  const t = raw.trim();
  const idx = t.indexOf(":");
  return (idx === -1 ? t : t.slice(idx + 1).trim()) || t;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": FETCH_UA },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}: ${await res.text().catch(() => "")}`);
  return (await res.json()) as T;
}

/** All parent products visible in the Store API (same catalog drivers as /shop/). */
export async function fetchAllShopParentProducts(perPage = 100): Promise<WcProduct[]> {
  const out: WcProduct[] = [];
  let page = 1;
  let totalPages = 1;
  for (;;) {
    const url = `${THS_STORE_BASE}/products?per_page=${perPage}&page=${page}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": FETCH_UA },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}: ${await res.text().catch(() => "")}`);
    if (page === 1) {
      const tp = res.headers.get("X-WP-TotalPages");
      if (tp) totalPages = Math.max(1, parseInt(tp, 10) || 1);
    }
    const batch = (await res.json()) as WcProduct[];
    out.push(...batch);
    if (batch.length < perPage || page >= totalPages) break;
    page += 1;
  }
  return out.filter(p => p.parent === 0);
}

type WcCategoryTree = WcCategory & { parent?: number };

/**
 * Woo Store API category list (single page — THS uses &lt;100 taxonomy terms).
 * `slug` query param is ignored by this endpoint on many installs; filter client-side.
 */
export async function fetchAllStoreCategories(perPage = 100): Promise<WcCategoryTree[]> {
  const url = `${THS_STORE_BASE}/products/categories?per_page=${perPage}`;
  return fetchJson<WcCategoryTree[]>(url);
}

/** Resolve top-level Woo category id, e.g. `vapes` → 338 on thehookahshop.com. */
export async function resolveWooCategoryRootIdBySlug(slug: string): Promise<number> {
  const want = slug.replace(/&amp;/g, "&").trim().toLowerCase();
  const all = await fetchAllStoreCategories();
  const found = all.find(c => decodeSlug(c.slug) === want && (c.parent === 0 || c.parent == null));
  if (!found) {
    const any = all.find(c => decodeSlug(c.slug) === want);
    if (any) return any.id;
    throw new Error(`Woo category slug not found in Store API: "${slug}"`);
  }
  return found.id;
}

/** BFS: root id + every descendant category id (for archives like /product-category/vapes/). */
export async function fetchWooCategoryTreeIds(rootId: number): Promise<number[]> {
  const all = await fetchAllStoreCategories();
  const byParent = new Map<number, number[]>();
  for (const c of all) {
    const p = typeof c.parent === "number" ? c.parent : 0;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(c.id);
  }
  const out = new Set<number>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const ch of byParent.get(id) ?? []) {
      if (!out.has(ch)) {
        out.add(ch);
        stack.push(ch);
      }
    }
  }
  const idList: number[] = [];
  out.forEach(id => idList.push(id));
  return idList;
}

/** Paginate `GET /products?category=` for one Woo category id (parent products only). */
export async function fetchParentProductsForWooCategory(
  wooCategoryId: number,
  perPage = 100
): Promise<WcProduct[]> {
  const out: WcProduct[] = [];
  let page = 1;
  let totalPages = 1;
  for (;;) {
    const url = `${THS_STORE_BASE}/products?category=${wooCategoryId}&per_page=${perPage}&page=${page}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": FETCH_UA },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}: ${await res.text().catch(() => "")}`);
    if (page === 1) {
      const tp = res.headers.get("X-WP-TotalPages");
      if (tp) totalPages = Math.max(1, parseInt(tp, 10) || 1);
    }
    const batch = (await res.json()) as WcProduct[];
    out.push(...batch);
    if (batch.length < perPage || page >= totalPages) break;
    page += 1;
  }
  return out.filter(p => p.parent === 0);
}

/**
 * All parent products assigned to a Woo category **or any of its descendants**, de-duplicated by WP id.
 * Matches behavior of /product-category/{slug}/ archives that include child terms.
 */
export async function fetchAllParentProductsInWooCategoryTree(
  rootWooCategoryId: number,
  perPage = 100
): Promise<WcProduct[]> {
  const treeIds = await fetchWooCategoryTreeIds(rootWooCategoryId);
  const idSet = new Set(treeIds);
  const seen = new Set<number>();
  const merged: WcProduct[] = [];

  for (const catId of treeIds) {
    const batch = await fetchParentProductsForWooCategory(catId, perPage);
    for (const p of batch) {
      if (!p.categories?.some(c => idSet.has(c.id))) continue;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }
  }

  return merged;
}

export async function fetchVariations(parentId: number): Promise<WcProduct[]> {
  const url = `${THS_STORE_BASE}/products?type=variation&parent=${parentId}&per_page=100`;
  return fetchJson<WcProduct[]>(url);
}

function decodeSlug(s: string): string {
  return s.replace(/&amp;/g, "&").toLowerCase();
}

function isExcludedCategory(cat: WcCategory): boolean {
  if (EXCLUDED_CATEGORY_IDS.has(cat.id)) return true;
  const s = decodeSlug(cat.slug);
  if (EXCLUDED_SLUG_EXACT.has(s)) return true;
  if (/\bcandy-drinks\b/i.test(s) || s === "candy-drinks") return true;
  if (s === "candy" || s.startsWith("candy-")) return true;
  if (/\b(food|beverage|snacks?|groceries|grocery|drinks?|soda|juice)\b/i.test(cat.name)) return true;
  return false;
}

function categoriesLookSafe(cats: WcCategory[]): boolean {
  const slugBlob = cats.map(c => c.slug).join(" ");
  return SAFE_CATEGORY_SLUG_RES.some(re => re.test(slugBlob));
}

export function titleLooksEdible(name: string, cats: WcCategory[]): boolean {
  if (categoriesLookSafe(cats)) return false;
  return EDIBLE_TITLE_RE.test(name);
}

export type ExclusionResult =
  | { excluded: false }
  | { excluded: true; reason: string };

export function classifyProductExclusion(wp: WcProduct): ExclusionResult {
  const cats = wp.categories ?? [];
  for (const c of cats) {
    if (isExcludedCategory(c)) {
      return { excluded: true, reason: `category_excluded:${c.slug}(${c.id})` };
    }
  }
  if (titleLooksEdible(wp.name, cats)) {
    return { excluded: true, reason: "title_edible_keyword" };
  }
  return { excluded: false };
}

function categorySlugsNames(cats: WcCategory[]): { slugs: string[]; names: string[] } {
  return {
    slugs: cats.map(c => decodeSlug(c.slug)),
    names: cats.map(c => c.name.toLowerCase()),
  };
}

/** Map Woo product categories → storefront category ids used in bh_products.category */
export function mapThsCategoriesToSiteCategory(cats: WcCategory[]): string {
  const { slugs, names } = categorySlugsNames(cats);
  const blob = `${slugs.join(" ")} ${names.join(" ")}`;

  if (/(charcoal|charcoals|coal\b|coconut coals|quick light)/i.test(blob)) return "charcoal";
  if (/(tobacco|shisha tobacco|ror tobacco|fumari|nakhla|adalya|eternal smoke|malaki|mazaya)/i.test(blob) && !/hookah(?! tobacco)/i.test(blob)) {
    if (/bowl/i.test(blob) && !/tobacco/i.test(blob)) return "bowls";
    return "shisha";
  }
  if (/(vape|e-cigarette|disposable|puffs|crown bar|booma|foger|kang vape|breeze smoke|shmizz|ek6000|vision 15|max 15k)/i.test(blob)) {
    return "vapes";
  }
  if (/hookah/i.test(blob) && !/bowl|tobacco|foil|hose|grommet|tongs/i.test(blob)) {
    if (/bowl/i.test(blob)) return "bowls";
    return "hookahs";
  }
  if (/(bowl|shisha-bowl|clay bowl|glass bowl|oblako|eastern nights|eltahan|mob-hookah-bowl)/i.test(blob)) {
    return "bowls";
  }
  return "accessories";
}

export function buildImportMeta(
  wp: WcProduct,
  galleryUrls: string[],
  extra: Partial<ThsImportMeta> = {}
): ThsImportMeta {
  const fromWp = (wp.categories ?? []).map(c => ({ id: c.id, slug: c.slug, name: c.name }));
  return {
    source: "thehookahshop-woo-store-api",
    wp_product_id: wp.parent || wp.id,
    wp_variation_id: wp.type === "variation" ? wp.id : undefined,
    wc_slug: wp.slug,
    wc_sku: (wp.sku ?? "").trim(),
    permalink: (wp.permalink ?? "").trim(),
    gallery_urls: galleryUrls,
    attributes: wp.attributes,
    stock_availability: wp.stock_availability,
    ...extra,
    categories: extra.categories ?? fromWp,
  };
}

function galleryFromImages(images: { src: string }[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const im of images ?? []) {
    const s = im.src?.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function wcProductToBhRows(
  wp: WcProduct,
  siteCategory: string,
  variations: WcProduct[] | null,
  opts: { defaultStock: number; now: string }
): BhProductInsert[] {
  const descHtml = wp.description ?? "";
  const shortHtml = wp.short_description ?? "";
  const descPlain = [stripHtml(shortHtml), stripHtml(descHtml)].filter(Boolean).join("\n\n").trim();
  const parentGallery = galleryFromImages(wp.images);
  const baseMeta = buildImportMeta(wp, parentGallery, {
    description_html: descHtml || undefined,
    short_description_plain: stripHtml(shortHtml) || undefined,
  });

  const inStock = wp.is_in_stock !== false;

  if (wp.type === "simple") {
    const { price, salePrice } = usdFromWoo(wp);
    const mainImage = wp.images?.[0]?.src?.trim() || "";
    const sku = `catalog:ths-wp-${wp.id}`;
    return [
      {
        name: wp.name.trim(),
        brand: guessBrand(wp),
        category: siteCategory,
        price: price > 0 ? price : 0.01,
        cost: null,
        sale_price: salePrice ?? null,
        stock: opts.defaultStock,
        low_stock_threshold: 10,
        sku,
        badge: null,
        in_stock: inStock,
        image_url: mainImage || `https://thehookahshop.com/wp-content/uploads/woocommerce-placeholder.png`,
        description: descPlain || null,
        featured: false,
        trending: false,
        weight_lb: null,
        created_at: opts.now,
        updated_at: opts.now,
        source_product_url: normalizeSourceUrl(wp.permalink) || null,
        import_meta: { ...baseMeta, wc_sku: (wp.sku ?? "").trim() } as Record<string, unknown>,
      },
    ];
  }

  if (wp.type !== "variable") {
    return [];
  }

  const vars = variations ?? [];
  const baseImage = wp.images?.[0]?.src?.trim() || "";

  if (!vars.length) {
    const { price, salePrice } = usdFromWoo(wp);
    const sku = `catalog:ths-wp-${wp.id}`;
    return [
      {
        name: wp.name.trim(),
        brand: guessBrand(wp),
        category: siteCategory,
        price: price > 0 ? price : 0.01,
        cost: null,
        sale_price: salePrice ?? null,
        stock: opts.defaultStock,
        low_stock_threshold: 10,
        sku,
        badge: null,
        in_stock: inStock,
        image_url: baseImage || `https://thehookahshop.com/wp-content/uploads/woocommerce-placeholder.png`,
        description: descPlain || null,
        featured: false,
        trending: false,
        weight_lb: null,
        created_at: opts.now,
        updated_at: opts.now,
        source_product_url: normalizeSourceUrl(wp.permalink) || null,
        import_meta: baseMeta as Record<string, unknown>,
      },
    ];
  }

  const rows: BhProductInsert[] = [];
  const sorted = [...vars].sort((a, b) =>
    variationLabel(a.variation || a.name || "").localeCompare(
      variationLabel(b.variation || b.name || ""),
      undefined,
      { sensitivity: "base" }
    )
  );

  for (const v of sorted) {
    const vLabel = variationLabel(v.variation || v.name || "Option");
    const { price, salePrice } = usdFromWoo(v);
    const vImg = v.images?.[0]?.src?.trim();
    const vGallery = galleryFromImages(v.images);
    const mergedGallery = Array.from(new Set([...vGallery, ...parentGallery]));
    const meta = buildImportMeta(v, mergedGallery, {
      description_html: descHtml || undefined,
      short_description_plain: stripHtml(shortHtml) || undefined,
      categories: (wp.categories ?? []).map(c => ({ id: c.id, slug: c.slug, name: c.name })),
    });

    rows.push({
      name: `${wp.name.trim()} — ${vLabel}`,
      brand: guessBrand(wp),
      category: siteCategory,
      price: price > 0 ? price : 0.01,
      cost: null,
      sale_price: salePrice ?? null,
      stock: opts.defaultStock,
      low_stock_threshold: 10,
      sku: `catalog:ths-wp-${wp.id}:var-${v.id}`,
      badge: null,
      in_stock: v.is_in_stock !== false,
      image_url:
        vImg ||
        baseImage ||
        parentGallery[0] ||
        `https://thehookahshop.com/wp-content/uploads/woocommerce-placeholder.png`,
      description: descPlain || null,
      featured: false,
      trending: false,
      weight_lb: null,
      created_at: opts.now,
      updated_at: opts.now,
      source_product_url: normalizeSourceUrl(v.permalink || wp.permalink) || null,
      import_meta: meta as Record<string, unknown>,
    });
  }

  return rows;
}

function normSku(s: string | null | undefined): string {
  return (s ?? "").trim();
}

export function parseThsCatalogSku(sku: string): { parent: number; variation?: number } | null {
  const m = /^catalog:ths-wp-(\d+)(?::var-(\d+))?$/.exec(sku.trim());
  if (!m) return null;
  return { parent: Number(m[1]), variation: m[2] ? Number(m[2]) : undefined };
}

export type DedupeMatch =
  | { kind: "none" }
  | { kind: "duplicate"; existing: ExistingBhRow; reason: string };

function metaSlugVar(meta: Record<string, unknown> | null | undefined): { slug?: string; vId?: number } {
  if (!meta || typeof meta !== "object") return {};
  const slug = typeof meta.wc_slug === "string" ? meta.wc_slug : undefined;
  const vId = typeof meta.wp_variation_id === "number" ? meta.wp_variation_id : undefined;
  return { slug, vId };
}

export function findDuplicateForRow(
  insert: BhProductInsert,
  existing: ExistingBhRow[]
): { match: DedupeMatch; meta: ThsImportMeta | null } {
  const rawMeta = insert.import_meta;
  const meta = rawMeta && typeof rawMeta === "object" ? (rawMeta as unknown as ThsImportMeta) : null;

  const insSku = normSku(insert.sku);
  const insUrl = normalizeSourceUrl(insert.source_product_url ?? meta?.permalink);
  const insName = normalizeProductName(baseTitleFromName(insert.name));
  const insNameFullNorm = normalizeProductName(insert.name);
  const insBrand = normalizeProductName(insert.brand ?? "");
  const insCat = (insert.category ?? "").toLowerCase();
  const insParsed = parseThsCatalogSku(insSku);
  const isVariantRow = Boolean(insParsed?.variation);

  // 1) Source URL
  if (insUrl) {
    for (const ex of existing) {
      const exU = normalizeSourceUrl(ex.source_product_url);
      if (exU && exU === insUrl) {
        return { match: { kind: "duplicate", existing: ex, reason: "same_source_product_url" }, meta };
      }
    }
  }

  // 2) WooCommerce slug (import_meta)
  if (meta?.wc_slug) {
    for (const ex of existing) {
      const exM = metaSlugVar(ex.import_meta);
      if (exM.slug === meta.wc_slug) {
        const exVid = exM.vId;
        const insVid = meta.wp_variation_id;
        if (exVid != null && insVid != null && exVid !== insVid) continue;
        if (exVid == null && insVid != null) continue;
        if (exVid != null && insVid == null) continue;
        return { match: { kind: "duplicate", existing: ex, reason: "same_wc_slug" }, meta };
      }
    }
  }

  // 3) SKU — catalog pattern or raw Woo SKU
  const wooSku = (meta?.wc_sku ?? "").trim();
  if (wooSku) {
    for (const ex of existing) {
      if (normSku(ex.sku).toLowerCase() === wooSku.toLowerCase()) {
        return { match: { kind: "duplicate", existing: ex, reason: "same_woo_sku" }, meta };
      }
    }
  }
  if (insSku) {
    for (const ex of existing) {
      const exSku = normSku(ex.sku);
      if (exSku && exSku.toLowerCase() === insSku.toLowerCase()) {
        return { match: { kind: "duplicate", existing: ex, reason: "same_sku" }, meta };
      }
      const insParsed = parseThsCatalogSku(insSku);
      const exParsed = parseThsCatalogSku(exSku);
      if (insParsed && exParsed && insParsed.parent === exParsed.parent && insParsed.variation === exParsed.variation) {
        return { match: { kind: "duplicate", existing: ex, reason: "same_catalog_ths_wp_id" }, meta };
      }
    }
  }

  // 4) Full row name (best for variants)
  for (const ex of existing) {
    const exFull = normalizeProductName(ex.name);
    if (exFull === insNameFullNorm) {
      return { match: { kind: "duplicate", existing: ex, reason: "same_normalized_full_name" }, meta };
    }
  }

  // 5–7) Fuzzy name matches — unsafe for variant rows (many SKUs share one base title)
  if (!isVariantRow) {
    for (const ex of existing) {
      const exBase = normalizeProductName(baseTitleFromName(ex.name));
      if (exBase === insName) {
        return { match: { kind: "duplicate", existing: ex, reason: "same_normalized_name" }, meta };
      }
    }

    if (insBrand) {
      for (const ex of existing) {
        const exBase = normalizeProductName(baseTitleFromName(ex.name));
        const exBrand = normalizeProductName(ex.brand ?? "");
        if (exBase === insName && exBrand === insBrand) {
          return { match: { kind: "duplicate", existing: ex, reason: "same_normalized_name_and_brand" }, meta };
        }
      }
    }

    if (!insBrand) {
      for (const ex of existing) {
        const exBase = normalizeProductName(baseTitleFromName(ex.name));
        const exBrand = normalizeProductName(ex.brand ?? "");
        const exCat = (ex.category ?? "").toLowerCase();
        if (!exBrand && exBase === insName && exCat === insCat) {
          return { match: { kind: "duplicate", existing: ex, reason: "same_normalized_name_and_category_no_brand" }, meta };
        }
      }
    }
  }

  return { match: { kind: "none" }, meta };
}

export function buildEnrichmentPatch(ex: ExistingBhRow, ins: BhProductInsert, nowIso: string): Record<string, unknown> {
  const patch: Record<string, unknown> = { updated_at: nowIso };
  const insMeta = ins.import_meta;

  if (!(ex.image_url?.trim()) && ins.image_url?.trim()) patch.image_url = ins.image_url;
  if (!(ex.description?.trim()) && ins.description?.trim()) patch.description = ins.description;
  if (!(ex.brand?.trim()) && ins.brand?.trim()) patch.brand = ins.brand;

  const exPrice = ex.price != null ? Number(ex.price) : 0;
  if ((!exPrice || exPrice <= 0) && ins.price > 0) patch.price = ins.price;

  const exSale = ex.sale_price != null ? Number(ex.sale_price) : null;
  if ((exSale == null || exSale <= 0) && ins.sale_price != null && ins.sale_price > 0) patch.sale_price = ins.sale_price;

  if (!(ex.source_product_url?.trim()) && ins.source_product_url?.trim()) {
    patch.source_product_url = ins.source_product_url;
  }

  if (insMeta && typeof insMeta === "object") {
    const prev =
      ex.import_meta && typeof ex.import_meta === "object" ? { ...ex.import_meta } : ({} as Record<string, unknown>);
    let changed = false;
    for (const [k, v] of Object.entries(insMeta)) {
      if (prev[k] == null || prev[k] === "" || (Array.isArray(prev[k]) && !(prev[k] as unknown[]).length)) {
        if (v != null && v !== "") {
          prev[k] = v;
          changed = true;
        }
      }
    }
    if (changed) patch.import_meta = prev;
  }

  return patch;
}

export function patchHasEnrichment(patch: Record<string, unknown>): boolean {
  return Object.keys(patch).some(k => k !== "updated_at");
}

export async function upsertNewRowsBySku(client: SupabaseClient, rows: BhProductInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const skus = rows.map(r => r.sku);
  const { data: existing, error: selErr } = await client.from("bh_products").select("id,sku").in("sku", skus);
  if (selErr) throw new Error(selErr.message);
  const idBySku = new Map((existing ?? []).map(r => [String(r.sku), String((r as { id: string }).id)]));

  const toInsert: BhProductInsert[] = [];
  for (const row of rows) {
    if (!idBySku.has(row.sku)) toInsert.push(row);
  }

  const CHUNK = 80;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const batch = toInsert.slice(i, i + CHUNK);
    const { error } = await client.from("bh_products").insert(batch);
    if (error) throw new Error(error.message);
  }
}
