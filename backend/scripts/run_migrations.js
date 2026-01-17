#!/usr/bin/env node
/**
 * Run all pending SQL migrations on Render database
 * Usage: node backend/scripts/run_migrations.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Add your Render database URL here or use environment variable
const DATABASE_URL = process.env.DATABASE_URL || 
  // Use a non-credential dummy URL to avoid secret scanners flagging example credentials.
  'postgresql://localhost:5432/mdlbeastdb';

const migrations = [
  'scripts/03_create_modules_tables.sql',
  'scripts/15_add_tenant_signature.sql', 
  'scripts/14_create_approvals_system.sql',
  'scripts/19_add_attachment_count.sql'
];

async function runMigrations() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    for (const migration of migrations) {
      const filePath = path.join(__dirname, '..', migration);
      const fileName = path.basename(filePath);
      
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipping ${fileName} (file not found)`);
        continue;
      }

      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`📝 Running ${fileName}...`);
      await client.query('BEGIN');
      
      try {
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`✅ ${fileName} applied successfully\n`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Error in ${fileName}:`, err.message);
        throw err;
      }
    }

    console.log('🎉 All migrations completed successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
