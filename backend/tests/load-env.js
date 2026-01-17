/**
 * ============================================================================
 * Load Environment Variables for Tests
 * ============================================================================
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// If .env doesn't exist, set from inline values
if (!process.env.DATABASE_URL) {
  process.env.AUTO_RUN_MIGRATIONS = 'true';
  process.env.BACKUPS_ENABLED = 'true';
  // Keep encryption disabled for local test defaults unless explicitly enabled.
  process.env.BACKUP_ENCRYPTION = process.env.BACKUP_ENCRYPTION || 'false';
  process.env.BACKUP_ENC_KEY = process.env.BACKUP_ENC_KEY || '';
  process.env.BACKUP_INTERVAL_DAYS = '15';
  process.env.BACKUP_RETENTION_COUNT = '6';
  // R2/Supabase credentials should be provided via env when needed.
  process.env.CF_R2_ACCESS_KEY_ID = process.env.CF_R2_ACCESS_KEY_ID || '';
  process.env.CF_R2_BUCKET = process.env.CF_R2_BUCKET || '';
  process.env.CF_R2_ENDPOINT = process.env.CF_R2_ENDPOINT || '';
  process.env.CF_R2_REGION = process.env.CF_R2_REGION || 'auto';
  process.env.CF_R2_SECRET_ACCESS_KEY = process.env.CF_R2_SECRET_ACCESS_KEY || '';
  // Local/dev default DB URL (override via env in CI/prod).
  // Use a non-credential dummy URL to avoid secret scanners flagging example credentials.
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/mdlbeastdb';
  process.env.DEBUG_SECRET = process.env.DEBUG_SECRET || 'dev-debug-secret-change-me';
  process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.PORT = '3001';
  process.env.R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL || '';
  process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-me';
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';
  process.env.STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'r2';
  process.env.SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@example.com';
  process.env.SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'Administrator';
  process.env.SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'admin123';
  process.env.TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'user@example.com';
  process.env.TEST_USER_NAME = process.env.TEST_USER_NAME || 'Test User';
  process.env.TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'user123';
}

console.log('✓ Environment variables loaded');
console.log(`✓ Database: ${process.env.DATABASE_URL?.split('@')[1] || 'configured'}`);
console.log(`✓ R2 Bucket: ${process.env.CF_R2_BUCKET}`);
