/**
 * Remove unused tables from MDLBEAST database
 * Run: node backend/scripts/remove-unused-tables.js
 */

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Set it in the environment before running this script.')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function removeUnusedTables() {
  const client = await pool.connect()
  
  try {
    console.log('🗑️  Removing unused tables from MDLBEAST database...\n')
    
    // Read the SQL script
    const sqlPath = path.join(__dirname, 'remove_unused_tables.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    
    console.log('📝 Executing SQL script...')
    await client.query(sql)
    
    console.log('✅ Tables removed successfully!\n')
    
    // Verify remaining tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)
    
    console.log('📋 Remaining tables in database:')
    result.rows.forEach(r => console.log(`   - ${r.table_name}`))
    
    console.log('\n✨ Database cleanup complete!')
    
  } catch (err) {
    console.error('❌ Error:', err.message)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

removeUnusedTables().catch(console.error)
