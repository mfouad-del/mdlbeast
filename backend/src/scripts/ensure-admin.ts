
import { query } from "../config/database";
import bcrypt from "bcrypt";

export async function ensureAdminUser() {
  // 1. Ensure Super Admin
  await ensureUser(
    process.env.SUPER_ADMIN_EMAIL,
    process.env.SUPER_ADMIN_PASSWORD,
    process.env.SUPER_ADMIN_NAME || "Administrator",
    'admin'
  );

  // 2. Ensure Test User
  await ensureUser(
    process.env.TEST_USER_EMAIL,
    process.env.TEST_USER_PASSWORD,
    process.env.TEST_USER_NAME || "MDLBEAST Staff",
    'member'
  );
}

async function ensureUser(email: string | undefined, password: string | undefined, name: string, role: string) {
  if (!email || !password) {
    console.log(`[Startup] Skipping ${role} ensure: Email or Password missing`);
    return;
  }

  try {
    const existing = await query("SELECT id FROM users WHERE username = $1 OR email = $1", [email]);
    const hash = await bcrypt.hash(password, 10);

    if (existing.rows.length === 0) {
      console.log(`[Startup] Creating ${role}: ${email}`);
      await query(
        "INSERT INTO users (username, email, password, full_name, role, is_active, created_at) VALUES ($1, $1, $2, $3, $4, true, NOW())",
        [email, hash, name, role]
      );
    } else {
      console.log(`[Startup] Updating ${role} password: ${email}`);
      await query("UPDATE users SET password = $1, full_name = $2, role = $3 WHERE id = $4", [hash, name, role, existing.rows[0].id]);
    }
  } catch (err) {
    console.error(`[Startup] Failed to ensure ${role}:`, err);
  }
}
