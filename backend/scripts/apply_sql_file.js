/*
  Apply a .sql file to the configured Postgres database.

  Usage:
    node backend/scripts/apply_sql_file.js backend/scripts/15_add_tenant_signature.sql

  Notes:
  - Requires DATABASE_URL env var.
  - Uses SSL automatically for non-local hosts (Render-managed Postgres typically requires SSL).
*/

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

async function main() {
  const sqlFileArg = process.argv[2]
  if (!sqlFileArg) {
    console.error('Missing SQL file path. Example: node backend/scripts/apply_sql_file.js backend/scripts/15_add_tenant_signature.sql')
    process.exit(1)
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL env var (Render provides this on the service).')
    process.exit(1)
  }

  const sqlPath = path.resolve(process.cwd(), sqlFileArg)
  if (!fs.existsSync(sqlPath)) {
    console.error('SQL file not found:', sqlPath)
    process.exit(1)
  }

  const sql = fs.readFileSync(sqlPath, 'utf8')
  if (!sql.trim()) {
    console.error('SQL file is empty:', sqlPath)
    process.exit(1)
  }

  let ssl
  try {
    const parsed = new URL(databaseUrl)
    ssl = isLocalHost(parsed.hostname) ? undefined : { rejectUnauthorized: false }
  } catch {
    // If DATABASE_URL can't be parsed, default to no SSL to avoid breaking local dev.
    ssl = undefined
  }

  const client = new Client({ connectionString: databaseUrl, ssl })

  try {
    console.log('Connecting to database...')
    await client.connect()

    console.log('Applying SQL:', sqlFileArg)
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')

    console.log('Done.')
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore
    }
    console.error('Failed to apply SQL:', err && err.message ? err.message : err)
    process.exitCode = 1
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((e) => {
  console.error('Unhandled error:', e)
  process.exit(1)
})
