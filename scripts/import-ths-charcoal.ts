/**
 * Import Charcoal category products from thehookahshop.com (WooCommerce Store API)
 * into Supabase `bh_products` (category: charcoal), using SKUs catalog:ths-wp-{id} / :var-{vid}.
 *
 * Usage:
 *   pnpm exec tsx scripts/import-ths-charcoal.ts --dry-run
 *   pnpm exec tsx scripts/import-ths-charcoal.ts --apply --report ./reports/ths-charcoal-import.json
 *
 * Env (--apply): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import type { Product, ProductVariant } from "../client/src/lib/products";
import { siteProductsToBhRows, type BhProductInsert } from "../server/siteCatalogSync";
import { DEFAULT_SUPABASE_URL } from "../shared/const";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const STORE_BASE = "https://thehookahshop.com/wp-json/wc/store/v1";
const CHARCOAL_CAT_ID = 308;

config({ path: path.join(ROOT, ".env") });
// `.env` may define empty placeholders; `.env.local` must win (dotenv default is no override).
config({ path: path.join(ROOT, ".env.local"), override: true });

type WcPriceBlock = {
  price: string;
  regular_price: string;
  sale_price?: string;
  currency_minor_unit?: number;
};

type WcProduct = {
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
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[—–]/g, "-")
    .trim();
}

/** Base product title without " — Variant" suffix (matches DB row names). */
function baseTitleFromAnyName(fullName: string): string {
  const idx = fullName.indexOf(" — ");
  return (idx === -1 ? fullName : fullName.slice(0, idx)).trim();
}

function minorDiv(p?: WcPriceBlock): number {
  const u = p?.currency_minor_unit ?? 2;
  return 10 ** u;
}

/** Map Woo prices → Product.price (regular) + salePrice (promo). */
function usdFromWoo(p: WcProduct): { price: number; salePrice?: number } {
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

function guessBrand(p: WcProduct): string {
  const b = p.brands?.[0]?.name?.trim();
  if (b) return b;
  const words = p.name.trim().split(/\s+/);
  if (words.length >= 2 && words[0]!.toLowerCase() === "al" && words[1]!.toLowerCase() === "fakher") {
    return "Al Fakher";
  }
  return words[0] ?? "Charcoal";
}

function variationLabel(raw: string): string {
  const t = raw.trim();
  const idx = t.indexOf(":");
  return (idx === -1 ? t : t.slice(idx + 1).trim()) || t;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "BossHookah-catalog-import/1.0" },
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

async function fetchAllCategoryProducts(): Promise<WcProduct[]> {
  const out: WcProduct[] = [];
  let page = 1;
  for (;;) {
    const url = `${STORE_BASE}/products?category=${CHARCOAL_CAT_ID}&per_page=100&page=${page}`;
    const batch = await fetchJson<WcProduct[]>(url);
    out.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return out.filter(p => p.parent === 0);
}

async function fetchVariations(parentId: number): Promise<WcProduct[]> {
  const url = `${STORE_BASE}/products?type=variation&parent=${parentId}&per_page=100`;
  return fetchJson<WcProduct[]>(url);
}

async function wcToProduct(p: WcProduct, review: string[]): Promise<Product | null> {
  const slugId = `ths-wp-${p.id}`;
  const desc = stripHtml(p.description || p.short_description || "");
  const { price, salePrice } = usdFromWoo(p);
  const mainImage = p.images?.[0]?.src?.trim() || "";
  if (!mainImage) review.push(`Missing image: ${p.name} (wp ${p.id})`);
  if (!price || price <= 0) review.push(`Missing/zero price: ${p.name} (wp ${p.id})`);

  if (p.type === "simple") {
    return {
      id: slugId,
      name: p.name.trim(),
      brand: guessBrand(p),
      category: "charcoal",
      price: price || 0.01,
      salePrice,
      image: mainImage || "https://thehookahshop.com/wp-content/uploads/woocommerce-placeholder.png",
      inStock: true,
      description: desc || undefined,
    };
  }

  if (p.type !== "variable") {
    review.push(`Unsupported type "${p.type}": ${p.name} (wp ${p.id})`);
    return null;
  }

  let vars: WcProduct[];
  try {
    vars = await fetchVariations(p.id);
  } catch {
    review.push(`Failed to load variations: ${p.name} (wp ${p.id})`);
    return null;
  }

  if (!vars.length) {
    const pr = usdFromWoo(p);
    review.push(`Variable product with no variations from API: ${p.name} (wp ${p.id}) — imported as single SKU`);
    return {
      id: slugId,
      name: p.name.trim(),
      brand: guessBrand(p),
      category: "charcoal",
      price: pr.price || 0.01,
      salePrice: pr.salePrice,
      image: mainImage || "https://thehookahshop.com/wp-content/uploads/woocommerce-placeholder.png",
      inStock: true,
      description: desc || undefined,
    };
  }

  const variants: ProductVariant[] = vars
    .map(v => {
      const { price: vr, salePrice: vs } = usdFromWoo(v);
      const vimg = v.images?.[0]?.src?.trim();
      return {
        id: `var-${v.id}`,
        name: variationLabel(v.variation || v.name || "Option"),
        image: vimg || undefined,
        price: vr,
        salePrice: vs,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const first = variants[0]!;
  return {
    id: slugId,
    name: p.name.trim(),
    brand: guessBrand(p),
    category: "charcoal",
    price: first.price ?? price ?? 0.01,
    salePrice: first.salePrice ?? salePrice,
    image: mainImage || variants.find(v => v.image)?.image || "https://thehookahshop.com/wp-content/uploads/woocommerce-placeholder.png",
    inStock: true,
    description: desc || undefined,
    variants,
  };
}

type ExistingRow = {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  price: number | null;
  sale_price: number | null;
  description: string | null;
  brand: string | null;
};

/**
 * Insert or update by SKU without requiring a UNIQUE constraint on `sku` (some DBs skip migration 003).
 */
async function upsertBhRowsBySku(
  client: ReturnType<typeof createClient>,
  rows: BhProductInsert[]
): Promise<void> {
  if (rows.length === 0) return;
  const skus = rows.map(r => r.sku);
  const { data: existing, error: selErr } = await client.from("bh_products").select("id,sku").in("sku", skus);
  if (selErr) throw new Error(selErr.message);
  const idBySku = new Map((existing ?? []).map(r => [String(r.sku), String(r.id)]));

  const toInsert: BhProductInsert[] = [];
  for (const row of rows) {
    if (idBySku.has(row.sku)) continue;
    toInsert.push(row);
  }

  const INSERT_CHUNK = 80;
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const batch = toInsert.slice(i, i + INSERT_CHUNK);
    const { error } = await client.from("bh_products").insert(batch);
    if (error) throw new Error(error.message);
  }

  type UpdatePatch = Omit<BhProductInsert, "created_at">;
  for (const row of rows) {
    const id = idBySku.get(row.sku);
    if (!id) continue;
    const { created_at: _omit, ...patch }: BhProductInsert & { created_at?: string } = row;
    const { error } = await client.from("bh_products").update(patch as UpdatePatch).eq("id", id);
    if (error) throw new Error(error.message);
  }
}

async function main(): Promise<void> {
  const {
    values: { "dry-run": dryRun, apply, report },
  } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      apply: { type: "boolean", default: false },
      report: { type: "string" },
    },
    allowPositionals: false,
  });

  const imported: string[] = [];
  const skippedDuplicates: string[] = [];
  const updatedExisting: string[] = [];
  const needsReview: string[] = [];

  console.log("Fetching thehookahshop.com charcoal category (Store API)…");
  const listed = await fetchAllCategoryProducts();
  console.log(`Found ${listed.length} parent products in category ${CHARCOAL_CAT_ID}.`);

  const products: Product[] = [];
  for (const wp of listed) {
    const prod = await wcToProduct(wp, needsReview);
    if (prod) {
      products.push(prod);
      imported.push(`${prod.name} → id=${prod.id} (${wp.type})`);
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const supabaseClient =
    key && supabaseUrl
      ? createClient(supabaseUrl, key, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

  let existing: ExistingRow[] = [];
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from("bh_products")
      .select("id,name,sku,image_url,price,sale_price,description,brand")
      .eq("category", "charcoal");
    if (error) console.warn("Could not load existing charcoal rows:", error.message);
    else existing = (data ?? []) as ExistingRow[];
  }

  const toUpsert: Product[] = [];

  for (const p of products) {
    const keyn = normalizeName(p.name);
    const legacyMatch = existing.find(
      r =>
        normalizeName(baseTitleFromAnyName(r.name)) === keyn &&
        !String(r.sku ?? "").startsWith("catalog:ths-wp-")
    );

    if (legacyMatch) {
      if (apply && supabaseClient) {
        const rows = siteProductsToBhRows([p], { defaultStock: 50 });
        const sample = rows[0];
        if (sample) {
          const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (!legacyMatch.image_url?.trim() && sample.image_url) patch.image_url = sample.image_url;
          if ((!legacyMatch.price || Number(legacyMatch.price) <= 0) && sample.price)
            patch.price = sample.price;
          if ((legacyMatch.sale_price == null || Number(legacyMatch.sale_price) <= 0) && sample.sale_price != null)
            patch.sale_price = sample.sale_price;
          if (!legacyMatch.description?.trim() && sample.description) patch.description = sample.description;
          if (!legacyMatch.brand?.trim() && sample.brand) patch.brand = sample.brand;
          if (Object.keys(patch).length > 1) {
            const { error: uerr } = await supabaseClient.from("bh_products").update(patch).eq("id", legacyMatch.id);
            if (uerr) needsReview.push(`Update failed ${legacyMatch.name}: ${uerr.message}`);
            else updatedExisting.push(`${legacyMatch.name} (id ${legacyMatch.id}) patched from THS`);
          } else {
            skippedDuplicates.push(`${p.name} — legacy ${legacyMatch.sku ?? legacyMatch.id} already complete, no THS row added`);
          }
        }
      } else {
        skippedDuplicates.push(
          `${p.name} — matches legacy row ${legacyMatch.sku ?? legacyMatch.id} (patch with --apply; no duplicate THS insert)`
        );
      }
      continue;
    }

    toUpsert.push(p);
  }

  const rows = siteProductsToBhRows(toUpsert, { defaultStock: 50 });
  console.log(`\nPrepared ${rows.length} bh_products rows (from ${toUpsert.length} products after dedup logic).`);

  const reportPayload = {
    generatedAt: new Date().toISOString(),
    source: `${STORE_BASE}/products?category=${CHARCOAL_CAT_ID}`,
    summary: {
      sourceParentProducts: listed.length,
      productsBuilt: products.length,
      bhRows: rows.length,
      importedLabels: imported.length,
      skippedDuplicates: skippedDuplicates.length,
      updatedExisting: updatedExisting.length,
      needsReviewCount: needsReview.length,
    },
    imported,
    skippedDuplicates,
    updatedExisting,
    needsReview,
    skuSample: rows.slice(0, 5),
  };

  if (report) {
    const out = path.isAbsolute(report) ? report : path.join(ROOT, report);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(reportPayload, null, 2), "utf8");
    console.log(`Wrote report → ${out}`);
  }

  if (dryRun) {
    console.log("\n--dry-run: no database writes.");
    console.log(JSON.stringify(reportPayload.summary, null, 2));
    return;
  }

  if (!apply) {
    console.log("\nPass --apply to upsert into bh_products (needs SUPABASE_SERVICE_ROLE_KEY).");
    console.log(JSON.stringify(reportPayload.summary, null, 2));
    return;
  }

  if (!key || !supabaseClient) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY or Supabase URL for --apply");
    process.exit(1);
  }

  const UPSERT_CHUNK = 80;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const batch = rows.slice(i, i + UPSERT_CHUNK);
    try {
      await upsertBhRowsBySku(supabaseClient, batch);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(msg);
      console.error("If this is a duplicate sku error, run supabase/migrations/003_bh_products_sku_unique_fix.sql or remove duplicate rows.");
      process.exit(1);
    }
    console.log(`Applied batch ${i / UPSERT_CHUNK + 1} (${batch.length} rows by SKU)`);
  }

  console.log("\nDone. Charcoal collection page reads from Supabase `bh_products` where category = 'charcoal'.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
