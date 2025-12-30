const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from the parent directory's .env file (if running from backend root)
// or from the current directory
dotenv.config({ path: path.join(__dirname, '../../.env') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '../.env') });
}

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not defined in .env file');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Connected to database...');
    
    const sqlPath = path.join(__dirname, '13_create_audit_logs.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log(`Running migration from ${sqlPath}...`);
    await client.query(sql);
    
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
