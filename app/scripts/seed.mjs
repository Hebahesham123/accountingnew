// Creates the admin user "abdelrahman" and promotes them to role=admin.
// Usage:  node scripts/seed.mjs
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Optional overrides: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- tiny .env.local loader (no extra dependency) ---
function loadEnv() {
  try {
    const txt = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local — rely on real env */
  }
}
loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "abdelrahman@admin.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@12345";
const ADMIN_NAME = process.env.ADMIN_NAME || "abdelrahman";

if (!URL || !SERVICE) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  console.log(`→ Ensuring admin user: ${ADMIN_EMAIL}`);

  // find existing user (paginate)
  let existing = null;
  for (let page = 1; page <= 20 && !existing; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    existing = data.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    if (data.users.length < 1000) break;
  }

  let userId;
  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME },
    });
    console.log("  user already existed → password reset & confirmed");
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log("  user created");
  }

  // promote to admin (profile row is auto-created by the DB trigger)
  const { error: upErr } = await admin
    .from("profiles")
    .upsert({ id: userId, email: ADMIN_EMAIL, full_name: ADMIN_NAME, role: "admin" }, { onConflict: "id" });
  if (upErr) throw upErr;

  console.log("\n✓ Admin ready. Sign in with:");
  console.log(`   email:    ${ADMIN_EMAIL}`);
  console.log(`   password: ${ADMIN_PASSWORD}`);
  console.log("\n   (override via ADMIN_EMAIL / ADMIN_PASSWORD env vars, then change it in-app.)");
}

main().catch((e) => {
  console.error("✗ Failed:", e.message ?? e);
  process.exit(1);
});
