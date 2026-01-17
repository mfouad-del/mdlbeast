/**
 * Check actual database schema
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Set it in the environment before running this script.');
  process.exit(1);
}

async function checkSchema() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Get all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('📋 All tables in database:');
    console.log('='.repeat(50));
    tablesResult.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.table_name}`);
    });
    console.log('='.repeat(50));
    console.log(`\nTotal: ${tablesResult.rows.length} tables\n`);

    // Check for tenant_id columns
    const tenantIdResult = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE column_name = 'tenant_id'
      AND table_schema = 'public'
      ORDER BY table_name
    `);

    if (tenantIdResult.rows.length > 0) {
      console.log('⚠️  Tables with tenant_id column:');
      console.log('='.repeat(50));
      tenantIdResult.rows.forEach((row) => {
        console.log(`- ${row.table_name}.${row.column_name}`);
      });
      console.log('='.repeat(50) + '\n');
    } else {
      console.log('✓ No tenant_id columns found\n');
    }

    // Get documents table structure
    const docsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'documents'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    console.log('📄 Documents table structure:');
    console.log('='.repeat(50));
    docsResult.rows.forEach((row) => {
      const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(`- ${row.column_name}: ${row.data_type} (${nullable})`);
    });
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSchema().catch(console.error);
