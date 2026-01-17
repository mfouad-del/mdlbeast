
import { query } from "../config/database";
import bcrypt from "bcrypt";

export async function ensureAdminUser() {
  const adminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (!adminEmail) {
    console.log("[Startup] Skipping admin user check: SUPER_ADMIN_EMAIL not set");
    return;
  }

  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
  const adminName = process.env.SUPER_ADMIN_NAME || "Administrator";

  if (!adminPassword) {
    console.warn("[Startup] SUPER_ADMIN_EMAIL set but SUPER_ADMIN_PASSWORD missing. Cannot sync admin.");
    return;
  }

  try {
    const existing = await query("SELECT id, password FROM users WHERE username = $1 OR email = $1", [adminEmail]);
    
    // Hash the password from env
    const hash = await bcrypt.hash(adminPassword, 10);

    if (existing.rows.length === 0) {
      // Create new admin
      console.log(`[Startup] Creating super admin: ${adminEmail}`);
      await query(
        "INSERT INTO users (username, email, password, full_name, role, is_active, created_at) VALUES ($1, $1, $2, $3, 'admin', true, NOW())",
        [adminEmail, hash, adminName]
      );
    } else {
      // Update existing admin password (ensures env var always wins)
      console.log(`[Startup] Updating super admin password for: ${adminEmail}`);
      await query("UPDATE users SET password = $1, full_name = $2, role = 'admin' WHERE id = $3", [hash, adminName, existing.rows[0].id]);
    }
  } catch (err) {
    console.error("[Startup] Failed to ensure admin user:", err);
  }
}
