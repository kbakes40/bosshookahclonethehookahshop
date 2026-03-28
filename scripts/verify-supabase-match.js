/**
 * Verifies .env.local Supabase URL matches the JWT `ref` in the service key,
 * and that storefront-required tables/columns respond (no secrets printed).
 *
 * Usage: node scripts/verify-supabase-match.js
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const storefrontColumns =
  "id,name,brand,category,price,sale_price,sku,badge,in_stock,featured,trending,image_url,description,weight_lb,created_at";

function projectRefFromUrl(url) {
  if (!url) return null;
  const m = String(url).trim().match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return m ? m[1].toLowerCase() : null;
}

function projectRefFromJwt(jwt) {
  if (!jwt || typeof jwt !== "string") return null;
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return payload.ref ? String(payload.ref).toLowerCase() : null;
  } catch {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
      return payload.ref ? String(payload.ref).toLowerCase() : null;
    } catch {
      return null;
    }
  }
}

async function main() {
  console.log("--- SUPABASE MATCH CHECK ---\n");

  const url =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

  if (!url || !serviceKey) {
    console.log("❌ Set VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const urlRef = projectRefFromUrl(url);
  const serviceRef = projectRefFromJwt(serviceKey);
  const anonRef = anonKey ? projectRefFromJwt(anonKey) : null;

  console.log("Project ref from URL:     ", urlRef ?? "(could not parse URL)");
  console.log("Project ref in service JWT:", serviceRef ?? "(could not parse)");
  if (anonRef) console.log("Project ref in anon JWT:   ", anonRef);

  if (urlRef && serviceRef && urlRef === serviceRef) {
    console.log("\n✅ URL and service_role key refer to the SAME Supabase project.\n");
  } else {
    console.log("\n❌ URL and service_role key do NOT match — fix .env.local (wrong key or wrong URL).\n");
    process.exit(1);
  }

  if (anonRef && urlRef !== anonRef) {
    console.log("❌ anon key is for a different project than the URL.\n");
    process.exit(1);
  }

  const supabase = createClient(url.trim(), serviceKey.trim());

  const { data: products, error: pe } = await supabase
    .from("bh_products")
    .select(storefrontColumns)
    .limit(1);

  if (pe) {
    console.log("❌ bh_products storefront select failed:", pe.message);
    console.log("   → Run missing migrations (e.g. weight_lb) from supabase/migrations/");
    process.exit(1);
  }
  console.log("✅ bh_products: storefront columns OK (sample row:", products?.length ? "yes" : "empty table", ")");

  const { error: se } = await supabase.from("bh_store_settings").select("id,store_name").limit(1);
  if (se) {
    console.log("❌ bh_store_settings:", se.message);
    process.exit(1);
  }
  console.log("✅ bh_store_settings: readable");

  const { error: ce } = await supabase.from("bh_orders").select("id").limit(1);
  if (ce) {
    console.log("❌ bh_orders:", ce.message);
    process.exit(1);
  }
  console.log("✅ bh_orders: readable");

  console.log("\n✅ Supabase matches app expectations for catalog + settings + orders.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
