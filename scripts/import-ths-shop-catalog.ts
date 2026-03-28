/**
 * Import thehookahshop.com /shop/ catalog (WooCommerce Store API, paginated) into bh_products.
 * Excludes Candy & Drinks / food / beverage categories and heuristic edible titles.
 *
 * Dry run (default — no DB writes):
 *   pnpm exec tsx scripts/import-ths-shop-catalog.ts
 *   pnpm exec tsx scripts/import-ths-shop-catalog.ts --report ./reports/ths-shop-import.json
 *
 * Apply inserts + enrichment patches (needs VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
 *   pnpm exec tsx scripts/import-ths-shop-catalog.ts --apply --report ./reports/ths-shop-import-apply.json
 *
 * Prerequisites: run supabase/migrations/011_bh_products_import_source.sql so source_product_url + import_meta exist.
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
  fetchAllShopParentProducts,
  fetchVariations,
  findDuplicateForRow,
  mapThsCategoriesToSiteCategory,
  patchHasEnrichment,
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
  siteCategory?: string;
  outcome:
    | "excluded"
    | "skipped_duplicate"
    | "would_insert"
    | "inserted"
    | "would_enrich"
    | "enriched"
    | "error"
    | "unsupported_type";
  detail?: string;
  duplicateReason?: string;
  sku?: string;
};

async function main(): Promise<void> {
  const {
    values: { apply, report },
  } = parseArgs({
    options: {
      apply: { type: "boolean", default: false },
      report: { type: "string" },
    },
    allowPositionals: false,
  });

  const logs: ProductLog[] = [];
  const excludedList: { name: string; wpId: number; url: string; reason: string }[] = [];
  const skippedDuplicates: { name: string; sku?: string; reason: string; existingId: string }[] = [];
  const wouldInsert: { name: string; sku: string; category: string }[] = [];
  const enrichCandidates: { name: string; sku: string; existingId: string; reason: string }[] = [];
  const errors: { wpId: number; message: string }[] = [];

  console.log("Fetching THS Store API catalog (paginated)…");
  let listed: WcProduct[] = [];
  try {
    listed = await fetchAllShopParentProducts();
  } catch (e) {
    console.error("Failed to fetch products:", e);
    process.exit(1);
  }
  console.log(`Crawled ${listed.length} parent products (${THS_STORE_BASE}/products).`);

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  let existing: ExistingBhRow[] = [];
  if (serviceKey && supabaseUrl) {
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
    } else {
      existing = (res.data ?? []).map(r => {
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
      console.log(`Loaded ${existing.length} existing bh_products rows for duplicate checks.`);
    }
  } else {
    console.warn("No Supabase service key — duplicate/enrichment stats use an empty catalog (set SUPABASE_SERVICE_ROLE_KEY).");
  }

  const now = new Date().toISOString();
  const defaultStock = 50;

  const preparedRows: BhProductInsert[] = [];
  const rowMeta: { wpId: number; permalink: string; categoriesLabel: string }[] = [];

  for (const wp of listed) {
    const permalink = wp.permalink ?? "";
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

    const siteCategory = mapThsCategoriesToSiteCategory(wp.categories ?? []);
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
          siteCategory,
          outcome: "error",
          detail: msg,
        });
        errors.push({ wpId: wp.id, message: msg });
        continue;
      }
    }

    const rows = wcProductToBhRows(wp, siteCategory, variations, { defaultStock, now });
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
        siteCategory: row.category,
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
      siteCategory: row.category,
      outcome: "would_insert",
      sku: row.sku,
    });
  }

  const summary = {
    generatedAt: now,
    source: `${THS_STORE_BASE}/products`,
    shopLanding: "https://thehookahshop.com/shop/",
    totalCrawledParentProducts: listed.length,
    totalExcludedByCategoryOrHeuristic: excludedList.length,
    totalSkuRowsPrepared: preparedRows.length,
    totalMatchedExistingSkus: matchedExisting,
    totalNewSkuRowsToInsert: newInsertRows.length,
    totalExistingRowsToEnrich: enrichPatches.length,
    errors: errors.length,
  };

  console.log("\n--- Dry-run summary ---");
  console.log(JSON.stringify(summary, null, 2));

  const reportPayload = {
    summary,
    excludedProducts: excludedList,
    skippedDuplicates,
    wouldInsert,
    enrichCandidates,
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
    console.log("\nNo --apply: database unchanged.");
    console.log("To run inserts + enrichment patches:");
    console.log("  pnpm exec tsx scripts/import-ths-shop-catalog.ts --apply --report ./reports/ths-shop-apply.json");
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
      "Cannot --apply: run supabase/migrations/011_bh_products_import_source.sql in the Supabase SQL editor first (source_product_url + import_meta required)."
    );
    process.exit(1);
  }

  const insertedNames: string[] = [];
  const updatedNames: string[] = [];
  const skippedNames = skippedDuplicates.map(s => s.name);
  const excludedNames = excludedList.map(e => e.name);
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
        totalCrawled: listed.length,
        totalExcluded: excludedList.length,
        totalSkippedAsExisting: skippedDuplicates.length,
        totalInserted: insertedNames.length,
        totalUpdated: updatedNames.length,
        failedItems: failed,
        insertedProductNames: insertedNames,
        updatedProductNames: updatedNames,
        skippedDuplicateProductNames: skippedNames,
        excludedFoodAndDrinkProductNames: excludedNames,
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
