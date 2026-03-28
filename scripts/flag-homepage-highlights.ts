/**
 * Reset bh_products trending/featured, then flag a curated starter set so
 * TRENDING / NEW ARRIVALS (listHomeHighlights) are balanced across hookahs, shisha, vapes, charcoal.
 *
 * Dry run (default): prints plan, no writes.
 * Apply: VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 *   pnpm exec tsx scripts/flag-homepage-highlights.ts
 *   pnpm exec tsx scripts/flag-homepage-highlights.ts --apply
 */

import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SUPABASE_URL } from "../shared/const";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
config({ path: path.join(ROOT, ".env") });
config({ path: path.join(ROOT, ".env.local"), override: true });

type Cat = "hookahs" | "shisha" | "vapes" | "charcoal";

type Row = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  trending: boolean | null;
  featured: boolean | null;
};

function catalogParentKeyFromSku(sku: string): string | null {
  const m = /^catalog:([^:]+)(?::.+)?$/.exec(sku.trim());
  return m ? m[1]! : null;
}

function groupKey(row: Row): string {
  const p = catalogParentKeyFromSku(row.sku);
  if (p) return `cat:${p}`;
  return `id:${row.id}`;
}

function extractVariantLabel(fullName: string): string {
  const idx = fullName.indexOf(" — ");
  return (idx === -1 ? fullName : fullName.slice(idx + 3)).trim();
}

function pickRepresentativeRow(rows: Row[]): Row {
  return [...rows].sort((a, b) =>
    extractVariantLabel(a.name).localeCompare(extractVariantLabel(b.name), undefined, {
      sensitivity: "base",
    })
  )[0]!;
}

function rowsByGroup(rows: Row[]): Map<string, Row[]> {
  const m = new Map<string, Row[]>();
  for (const r of rows) {
    const k = groupKey(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return m;
}

function groupsForCategory(all: Row[], category: Cat): Map<string, Row[]> {
  const filtered = all.filter(r => (r.category ?? "").toLowerCase() === category);
  return rowsByGroup(filtered);
}

/** Pick up to `count` group keys whose representative name matches one of the regexes (in order). */
function pickByMatchers(
  catGroups: Map<string, Row[]>,
  matchers: RegExp[],
  count: number,
  usedGroups: Set<string>
): { id: string; name: string; groupKey: string }[] {
  const out: { id: string; name: string; groupKey: string }[] = [];
  for (const re of matchers) {
    if (out.length >= count) break;
    const candidates = Array.from(catGroups.entries())
      .filter(([gk]) => !usedGroups.has(gk))
      .map(([gk, rows]) => ({ gk, rep: pickRepresentativeRow(rows) }))
      .filter(x => re.test(x.rep.name));
    candidates.sort((a, b) => a.rep.name.localeCompare(b.rep.name, undefined, { sensitivity: "base" }));
    const pick = candidates[0];
    if (!pick) continue;
    usedGroups.add(pick.gk);
    out.push({ id: pick.rep.id, name: pick.rep.name, groupKey: pick.gk });
  }
  return out;
}

/** Prefer THS catalog groups not yet used; stable alphabetical by rep name. */
function fillFallback(
  catGroups: Map<string, Row[]>,
  count: number,
  usedGroups: Set<string>
): { id: string; name: string; groupKey: string }[] {
  const out: { id: string; name: string; groupKey: string }[] = [];
  const entries = Array.from(catGroups.entries())
    .filter(([gk]) => !usedGroups.has(gk))
    .map(([gk, rows]) => ({ gk, rep: pickRepresentativeRow(rows) }))
    .sort((a, b) => a.rep.name.localeCompare(b.rep.name, undefined, { sensitivity: "base" }));
  for (const { gk, rep } of entries) {
    if (out.length >= count) break;
    if (!rep.sku.startsWith("catalog:ths-wp-")) continue;
    usedGroups.add(gk);
    out.push({ id: rep.id, name: rep.name, groupKey: gk });
  }
  return out;
}

const TRENDING: Record<Cat, RegExp[]> = {
  hookahs: [/^Starbuzz SB Mini\b/i, /^Phantom Hookah —/i],
  shisha: [/^Al Fakher Tobacco\b/i, /^Adalya Hookah Tobacco\b/i],
  vapes: [/Al Fakher Crown Bar 8000/i, /Starbuzz Super Max 15k Puff Vape/i],
  charcoal: [/CocoUrth/i, /Tom\s+Coco|Tomcoco/i],
};

const FEATURED: Record<Cat, RegExp[]> = {
  hookahs: [/^Starbuzz Challenger\b/i, /^MOB Spider\b/i],
  shisha: [/^Al Fakher Cookies Tobacco\b/i, /^Fumari Tobacco\b/i],
  vapes: [/North Vision 15,?000 Puff Vape/i, /Foger Switch Pro POD ONLY/i],
  charcoal: [/Titanium/i, /Prestige\b.*Charcoal|Charcoal.*Prestige/i],
};

const PER_CAT = 2;

async function fetchAllRows(client: SupabaseClient): Promise<Row[]> {
  const out: Row[] = [];
  const page = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from("bh_products")
      .select("id,sku,name,category,trending,featured")
      .order("name", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Row[];
    out.push(...batch);
    if (batch.length < page) break;
    from += page;
  }
  return out;
}

async function clearHighlightFlags(client: SupabaseClient): Promise<void> {
  const ids = (await fetchAllRows(client)).map(r => r.id);
  const CHUNK = 150;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { error } = await client
      .from("bh_products")
      .update({ trending: false, featured: false })
      .in("id", slice);
    if (error) throw new Error(error.message);
  }
}

async function setFlags(client: SupabaseClient, ids: string[], patch: { trending?: boolean; featured?: boolean }): Promise<void> {
  const CHUNK = 80;
  const unique = Array.from(new Set(ids));
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const { error } = await client.from("bh_products").update(patch).in("id", slice);
    if (error) throw new Error(error.message);
  }
}

type PickRow = { id: string; name: string; groupKey: string; category: Cat };

function buildPicks(all: Row[]): { trending: PickRow[]; featured: PickRow[] } {
  const categories: Cat[] = ["hookahs", "shisha", "vapes", "charcoal"];

  const trendingPicks: PickRow[] = [];
  const featuredPicks: PickRow[] = [];

  const trendingUsed = new Set<string>();

  for (const cat of categories) {
    const g = groupsForCategory(all, cat);
    let t = pickByMatchers(g, TRENDING[cat], PER_CAT, trendingUsed);
    if (t.length < PER_CAT) {
      t = [...t, ...fillFallback(g, PER_CAT - t.length, trendingUsed)];
    }
    for (const p of t) trendingPicks.push({ ...p, category: cat });
  }

  /** No duplicate storefront groups between Trending and New Arrivals. */
  const featuredUsed = new Set(trendingPicks.map(p => p.groupKey));

  for (const cat of categories) {
    const g = groupsForCategory(all, cat);
    let f = pickByMatchers(g, FEATURED[cat], PER_CAT, featuredUsed);
    if (f.length < PER_CAT) {
      f = [...f, ...fillFallback(g, PER_CAT - f.length, featuredUsed)];
    }
    for (const p of f) featuredPicks.push({ ...p, category: cat });
  }

  return { trending: trendingPicks, featured: featuredPicks };
}

async function main(): Promise<void> {
  const {
    values: { apply },
  } = parseArgs({
    options: { apply: { type: "boolean", default: false } },
    allowPositionals: false,
  });

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!serviceKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is required (set in .env.local)");
    process.exit(1);
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const all = await fetchAllRows(client);
  const { trending, featured } = buildPicks(all);

  console.log("\n=== TRENDING (flag trending=true, one row per grouped product) ===");
  for (const p of trending) {
    console.log(`  [${p.category}] ${p.name.slice(0, 72)}… → ${p.id}`);
  }
  console.log("\n=== NEW ARRIVALS / FEATURED (flag featured=true) ===");
  for (const p of featured) {
    console.log(`  [${p.category}] ${p.name.slice(0, 72)}… → ${p.id}`);
  }

  if (!apply) {
    console.log("\nDry run — no updates. Run with --apply to write.");
    return;
  }

  console.log("\nClearing trending/featured on all bh_products …");
  await clearHighlightFlags(client);

  await setFlags(
    client,
    trending.map(p => p.id),
    { trending: true }
  );
  await setFlags(
    client,
    featured.map(p => p.id),
    { featured: true }
  );

  console.log(
    `\nDone. Flagged trending=${trending.length} rows, featured=${featured.length} rows. Server cache (~45s) or redeploy to refresh listHomeHighlights.`
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
