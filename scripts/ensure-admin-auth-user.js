/**
 * One-time: create (or update password for) a Supabase Auth user for admin login.
 * Requires service role. Run locally with .env.local or in CI with env vars.
 *
 *   node scripts/ensure-admin-auth-user.js <email> <password>
 *
 * Example:
 *   node scripts/ensure-admin-auth-user.js admin@thehookahshop.com 'YourSecurePass'
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });
const { createClient } = require("@supabase/supabase-js");

const url =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const email = (process.argv[2] || "").trim().toLowerCase();
const password = process.argv[3] || "";

async function main() {
  if (!url || !serviceKey) {
    console.error("Missing VITE_SUPABASE_URL / SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!email || !password) {
    console.error("Usage: node scripts/ensure-admin-auth-user.js <email> <password>");
    process.exit(1);
  }

  const supabase = createClient(url.trim(), serviceKey.trim(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Site Admin" },
  });

  if (!createErr && created?.user) {
    console.log("Created auth user:", created.user.id, email);
    return;
  }

  const msg = createErr?.message || "";
  if (!msg.toLowerCase().includes("already") && !msg.toLowerCase().includes("registered")) {
    console.error("createUser failed:", createErr);
    process.exit(1);
  }

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) {
    console.error("listUsers failed:", listErr);
    process.exit(1);
  }
  const user = list.users.find(u => u.email?.toLowerCase() === email);
  if (!user) {
    console.error("User exists but could not be found to update password.");
    process.exit(1);
  }

  const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, { password });
  if (updErr) {
    console.error("updateUserById failed:", updErr);
    process.exit(1);
  }
  console.log("Updated password for:", user.id, email);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
