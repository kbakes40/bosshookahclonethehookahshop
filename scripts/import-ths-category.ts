/**
 * Import one THS Woo "product category" tree (e.g. /product-category/vapes/) into bh_products.
 * Uses the WooCommerce Store API with pagination + descendant categories — same image/row patterns as other THS importers.
 *
 * Defaults target Vapes only; reusable via --woo-root / --slug / --store-category.
 *
 * Dry run (no DB writes):
 *   pnpm exec tsx scripts/import-ths-category.ts
 *   pnpm exec tsx scripts/import-ths-category.ts --slug hookahs --store-category hookahs --report ./reports/ths-hookahs-dry-run.json
 *   pnpm exec tsx scripts/import-ths-category.ts --slug shisha-tobacco --store-category shisha --report ./reports/ths-shisha-dry-run.json
 *
 * Apply:
 *   pnpm exec tsx scripts/import-ths-category.ts --apply --report ./reports/ths-vapes-apply.json
 *   pnpm exec tsx scripts/import-ths-category.ts --slug hookahs --store-category hookahs --apply --report ./reports/ths-hookahs-apply.json
 *   pnpm exec tsx scripts/import-ths-category.ts --slug shisha-tobacco --store-category shisha --apply --report ./reports/ths-shisha-apply.json
 *
 * THS Woo top-level slugs (Store API): vapes, hookahs, shisha-tobacco, charcoal, hookah-accessories, …
 *
 * Row category: derived per product via `mapThsCategoriesToSiteCategory` (Woo terms), not the CLI bucket.
 *
 * Env (--apply): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Migration: supabase/migrations/011_bh_products_import_source.sql
 */

import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_SUPABASE_URL } from "../shared/const";
import type { BhProductInsert } from "../server/siteCatalogSync";
import {
  buildEnrichmentPatch,
  classifyProductExclusion,
  fetchAllParentProductsInWooCategoryTree,
  fetchWooCategoryTreeIds,
  fetchVariations,
  findDuplicateForRow,
  mapThsCategoriesToSiteCategory,
  patchHasEnrichment,
  resolveWooCategoryRootIdBySlug,
  THS_STORE_BASE,
  upsertNewRowsBySku,
  wcProductToBhRows,
  type ExistingBhRow,
  type WcProduct,
} from "./lib/thsShopCatalogImport";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

config({ path: path.join(ROOT, ".env") });
config({ path: path.join(ROOT, ".env.local"), override: true });

type ProductLog = {
  wpId: number;
  sourceUrl: string;
  title: string;
  detectedCategories: string;
  outcome:
    | "excluded"
    | "skipped_duplicate"
    | "would_insert"
    | "inserted"
    | "would_enrich"
    | "enriched"
    | "error"
    | "unsupported_type"
    | "outside_category_tree";
  detail?: string;
  duplicateReason?: string;
  sku?: string;
};

async function loadExistingRows(
  supabaseUrl: string,
  serviceKey: string
): Promise<ExistingBhRow[]> {
  const client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const fullSelect =
    "id,name,sku,brand,category,image_url,description,price,sale_price,source_product_url,import_meta";
  let res = await client.from("bh_products").select(fullSelect);
  if (
    res.error &&
    (/source_product_url|import_meta|does not exist/i.test(res.error.message) ||
      res.error.message.includes("42703"))
  ) {
    console.warn(
      "import columns missing — loading bh_products without source_product_url/import_meta (run migration 011)."
    );
    res = await client
      .from("bh_products")
      .select("id,name,sku,brand,category,image_url,description,price,sale_price");
  }
  if (res.error) {
    console.warn("Could not load bh_products for dedupe:", res.error.message);
    return [];
  }
  return (res.data ?? []).map(r => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      name: String(row.name ?? ""),
      sku: row.sku != null ? String(row.sku) : null,
      brand: row.brand != null ? String(row.brand) : null,
      category: row.category != null ? String(row.category) : null,
      image_url: row.image_url != null ? String(row.image_url) : null,
      description: row.description != null ? String(row.description) : null,
      price: row.price != null ? Number(row.price) : null,
      sale_price: row.sale_price != null ? Number(row.sale_price) : null,
      source_product_url: row.source_product_url != null ? String(row.source_product_url) : null,
      import_meta:
        row.import_meta && typeof row.import_meta === "object"
          ? (row.import_meta as Record<string, unknown>)
          : null,
    };
  });
}

async function main(): Promise<void> {
  const {
    values: { apply, report, slug, "woo-root": wooRootStr, "store-category": storeCategory },
  } = parseArgs({
    options: {
      apply: { type: "boolean", default: false },
      report: { type: "string" },
      slug: { type: "string", default: "vapes" },
      "woo-root": { type: "string" },
      "store-category": { type: "string", default: "vapes" },
    },
    allowPositionals: false,
  });

  /** CLI hint only (logging / report); each row uses `mapThsCategoriesToSiteCategory`. */
  const cliStoreCategoryHint = (storeCategory ?? "vapes").trim().toLowerCase();
  let wooRootId: number;
  if (wooRootStr != null && `${wooRootStr}`.trim() !== "") {
    wooRootId = parseInt(`${wooRootStr}`.trim(), 10);
    if (!Number.isFinite(wooRootId)) {
      console.error("--woo-root must be a number");
      process.exit(1);
    }
  } else {
    wooRootId = await resolveWooCategoryRootIdBySlug(slug ?? "vapes");
  }

  const logs: ProductLog[] = [];
  const excludedList: { name: string; wpId: number; url: string; reason: string }[] = [];
  const skippedDuplicates: { name: string; sku?: string; reason: string; existingId: string }[] = [];
  const wouldInsert: { name: string; sku: string; category: string }[] = [];
  const enrichCandidates: { name: string; sku: string; existingId: string; reason: string }[] = [];
  const errors: { wpId: number; message: string }[] = [];
  const outsideTree: { name: string; wpId: number; reason: string }[] = [];

  console.log(
    `Fetching THS Woo category tree root ${wooRootId} (slug=${slug ?? "vapes"}) — bh_products.category from Woo terms per product (CLI hint: ${cliStoreCategoryHint}) …`
  );

  const treeIdList = await fetchWooCategoryTreeIds(wooRootId);
  const allowedIdSet = new Set(treeIdList);

  let listed: WcProduct[] = [];
  try {
    listed = await fetchAllParentProductsInWooCategoryTree(wooRootId);
  } catch (e) {
    console.error("Failed to fetch products:", e);
    process.exit(1);
  }

  console.log(
    `Found ${listed.length} parent products (Store API, tree ids: ${treeIdList.length} categories under root ${wooRootId}).`
  );

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  let existing: ExistingBhRow[] = [];
  if (serviceKey && supabaseUrl) {
    existing = await loadExistingRows(supabaseUrl, serviceKey);
    console.log(`Loaded ${existing.length} existing bh_products rows for duplicate checks.`);
  } else {
    console.warn("No Supabase service key — dedupe/enrichment stats use an empty catalog.");
  }

  const now = new Date().toISOString();
  const defaultStock = 50;

  const preparedRows: BhProductInsert[] = [];
  const rowMeta: { wpId: number; permalink: string; categoriesLabel: string }[] = [];

  for (const wp of listed) {
    const permalink = wp.permalink ?? "";
    const inTree = (wp.categories ?? []).some(c => allowedIdSet.has(c.id));
    if (!inTree) {
      outsideTree.push({ name: wp.name, wpId: wp.id, reason: "product_categories_not_in_requested_tree" });
      logs.push({
        wpId: wp.id,
        sourceUrl: permalink,
        title: wp.name,
        detectedCategories: (wp.categories ?? []).map(c => `${c.slug}(${c.id})`).join(", "),
        outcome: "outside_category_tree",
        detail: "categories do not intersect importer tree",
      });
      continue;
    }

    const ex = classifyProductExclusion(wp);
    if (ex.excluded) {
      excludedList.push({ name: wp.name, wpId: wp.id, url: permalink, reason: ex.reason });
      logs.push({
        wpId: wp.id,
        sourceUrl: permalink,
        title: wp.name,
        detectedCategories: (wp.categories ?? []).map(c => `${c.slug}(${c.id})`).join(", "),
        outcome: "excluded",
        detail: ex.reason,
      });
      continue;
    }

    if (wp.type !== "simple" && wp.type !== "variable") {
      logs.push({
        wpId: wp.id,
        sourceUrl: permalink,
        title: wp.name,
        detectedCategories: (wp.categories ?? []).map(c => c.slug).join(", "),
        outcome: "unsupported_type",
        detail: wp.type,
      });
      errors.push({ wpId: wp.id, message: `Unsupported type ${wp.type}` });
      continue;
    }

    let variations: WcProduct[] | null = null;
    if (wp.type === "variable") {
      try {
        variations = await fetchVariations(wp.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logs.push({
          wpId: wp.id,
          sourceUrl: permalink,
          title: wp.name,
          detectedCategories: (wp.categories ?? []).map(c => c.slug).join(", "),
          outcome: "error",
          detail: msg,
        });
        errors.push({ wpId: wp.id, message: msg });
        continue;
      }
    }

    const rowCategory = mapThsCategoriesToSiteCategory(wp.categories ?? []);
    const rows = wcProductToBhRows(wp, rowCategory, variations, { defaultStock, now });
    for (const r of rows) {
      preparedRows.push(r);
      rowMeta.push({
        wpId: wp.id,
        permalink,
        categoriesLabel: (wp.categories ?? []).map(c => `${c.name} [${c.slug}]`).join("; "),
      });
    }
  }

  let matchedExisting = 0;
  let newInsertRows: BhProductInsert[] = [];
  let enrichPatches: { id: string; patch: Record<string, unknown>; name: string }[] = [];

  for (let i = 0; i < preparedRows.length; i++) {
    const row = preparedRows[i]!;
    const meta = rowMeta[i]!;
    const { match } = findDuplicateForRow(row, existing);

    if (match.kind === "duplicate") {
      matchedExisting += 1;
      const patch = buildEnrichmentPatch(match.existing, row, now);
      if (patchHasEnrichment(patch)) {
        enrichCandidates.push({
          name: row.name,
          sku: row.sku,
          existingId: match.existing.id,
          reason: match.reason,
        });
        enrichPatches.push({ id: match.existing.id, patch, name: row.name });
      }
      skippedDuplicates.push({
        name: row.name,
        sku: row.sku,
        reason: match.reason,
        existingId: match.existing.id,
      });
      const enrichPatch = buildEnrichmentPatch(match.existing, row, now);
      logs.push({
        wpId: meta.wpId,
        sourceUrl: row.source_product_url ?? meta.permalink,
        title: row.name,
        detectedCategories: meta.categoriesLabel,
        outcome: patchHasEnrichment(enrichPatch) ? "would_enrich" : "skipped_duplicate",
        duplicateReason: match.reason,
        sku: row.sku,
      });
      continue;
    }

    newInsertRows.push(row);
    wouldInsert.push({ name: row.name, sku: row.sku, category: row.category });
    logs.push({
      wpId: meta.wpId,
      sourceUrl: row.source_product_url ?? meta.permalink,
      title: row.name,
      detectedCategories: meta.categoriesLabel,
      outcome: "would_insert",
      sku: row.sku,
    });
  }

  const summary = {
    generatedAt: now,
    source: `${THS_STORE_BASE}/products?category=<tree:${wooRootId}>`,
    landingPage: `https://thehookahshop.com/product-category/${slug ?? "vapes"}/`,
    wooRootCategoryId: wooRootId,
    cliStoreCategoryHint,
    categoryAssignment: "per-product-woo-terms",
    totalProductsFound: listed.length,
    totalOutsideCategoryTree: outsideTree.length,
    totalExcluded: excludedList.length,
    totalSkuRowsPrepared: preparedRows.length,
    totalSkippedAsDuplicates: skippedDuplicates.length,
    totalNewSkuRowsToInsert: newInsertRows.length,
    totalRowsToEnrich: enrichPatches.length,
    errors: errors.length,
  };

  console.log("\n--- Dry-run summary ---");
  console.log(JSON.stringify(summary, null, 2));

  const skippedReport = skippedDuplicates.map(s => ({
    name: s.name,
    sku: s.sku,
    existingId: s.existingId,
    reason: s.reason,
  }));

  const reportPayload = {
    summary,
    excludedProducts: excludedList,
    outsideCategoryTree: outsideTree,
    skippedDuplicates: skippedReport,
    wouldInsert,
    enrichCandidates,
    insertedProductNamesPreview: newInsertRows.map(r => r.name),
    productLogs: logs,
    errors,
  };

  if (report) {
    const out = path.isAbsolute(report) ? report : path.join(ROOT, report);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(reportPayload, null, 2), "utf8");
    console.log(`\nWrote report → ${out}`);
  }

  if (!apply) {
    console.log("\nDry run only — no database writes.");
    const slugPart =
      slug != null && `${slug}`.trim() !== "" && `${slug}`.trim() !== "vapes"
        ? ` --slug ${`${slug}`.trim()}`
        : "";
    const catPart =
      cliStoreCategoryHint !== "vapes"
        ? ` --store-category ${cliStoreCategoryHint}`
        : "";
    console.log("Run import with:");
    console.log(
      `  pnpm exec tsx scripts/import-ths-category.ts${slugPart}${catPart} --apply --report ./reports/ths-${cliStoreCategoryHint}-apply.json`
    );
    return;
  }

  if (!serviceKey || !supabaseUrl) {
    console.error("SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL are required for --apply");
    process.exit(1);
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const probe = await client.from("bh_products").select("source_product_url,import_meta").limit(1);
  if (probe.error && /source_product_url|import_meta|does not exist|42703/i.test(probe.error.message)) {
    console.error(
      "Cannot --apply: run supabase/migrations/011_bh_products_import_source.sql first (source_product_url + import_meta)."
    );
    process.exit(1);
  }

  const insertedNames: string[] = [];
  const updatedNames: string[] = [];
  let failed = 0;

  try {
    if (newInsertRows.length) {
      await upsertNewRowsBySku(client, newInsertRows);
      insertedNames.push(...newInsertRows.map(r => r.name));
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Insert batch failed:", msg);
    failed += newInsertRows.length;
  }

  for (const { id, patch, name } of enrichPatches) {
    try {
      const { error } = await client.from("bh_products").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      updatedNames.push(name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Enrich failed ${name} (${id}):`, msg);
      failed += 1;
    }
  }

  console.log("\n========== APPLY COMPLETE ==========");
  console.log(
    JSON.stringify(
      {
        totalProductsFound: listed.length,
        totalSkippedAsDuplicates: skippedDuplicates.length,
        totalNewlyInserted: insertedNames.length,
        totalUpdated: updatedNames.length,
        failedItems: failed,
        insertedProductNames: insertedNames,
        updatedProductNames: updatedNames,
        skippedProductNamesWithReason: skippedReport,
      },
      null,
      2
    )
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
