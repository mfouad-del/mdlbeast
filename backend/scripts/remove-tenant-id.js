/**
 * Remove tenant_id columns from remaining tables
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Set it in the environment before running this script.');
  process.exit(1);
}

async function removeTenantIdColumns() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    console.log('🗑️  Removing tenant_id columns...\n');

    // Drop tenant_id from approval_requests
    try {
      await client.query('ALTER TABLE approval_requests DROP COLUMN IF EXISTS tenant_id CASCADE');
      console.log('✓ Removed tenant_id from approval_requests');
    } catch (err) {
      console.log(`⚠️  approval_requests: ${err.message}`);
    }

    // Drop tenant_id from barcodes
    try {
      await client.query('ALTER TABLE barcodes DROP COLUMN IF EXISTS tenant_id CASCADE');
      console.log('✓ Removed tenant_id from barcodes');
    } catch (err) {
      console.log(`⚠️  barcodes: ${err.message}`);
    }

    console.log('\n✅ Cleanup complete!\n');

    // Verify
    const result = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE column_name = 'tenant_id'
      AND table_schema = 'public'
    `);

    if (result.rows.length === 0) {
      console.log('✓ No tenant_id columns remain in database');
    } else {
      console.log('⚠️  Still found tenant_id in:');
      result.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

removeTenantIdColumns().catch(console.error);
