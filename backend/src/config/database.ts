import { Pool } from "pg"
import dotenv from "dotenv"

dotenv.config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
  allowExitOnIdle: false
})

// Log pool configuration
console.log('🗄️  Database Pool Configuration:')
console.log(`  - Max connections: ${pool.options.max}`)
console.log(`  - Min connections: ${pool.options.min}`)
console.log(`  - Idle timeout: ${pool.options.idleTimeoutMillis}ms`)
console.log(`  - Connection timeout: ${pool.options.connectionTimeoutMillis}ms`)

pool.on("error", (err: Error) => {
  console.error("Unexpected error on idle client", err)
  process.exit(-1)
})

export const query = async (text: string, params?: any[]) => {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    console.log("Executed query", { text, duration, rows: res.rowCount })
    return res
  } catch (error) {
    console.error("Database query error:", error)
    throw error
  }
}

export default pool
