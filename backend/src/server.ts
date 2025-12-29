import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import dotenv from "dotenv"
import authRoutes from "./routes/auth"
import documentRoutes from "./routes/documents"
import userRoutes from "./routes/users"
import barcodeRoutes from "./routes/barcodes"
import reportRoutes from "./routes/reports"
import tenantRoutes from "./routes/tenants"
import snapshotRoutes from "./routes/snapshots"
import versionRoutes from './routes/version'
import { errorHandler } from "./middleware/errorHandler"
import { query } from "./config/database"

dotenv.config()

// Validate required environment variables (fail fast for critical secrets)
try {
  // throws if missing or weak
  require('./config/validateEnv').validateEnv()
} catch (err: any) {
  // do not log secret values; log only the problem and exit in non-test environments
  console.error('ENV error: JWT_SECRET missing/weak')
  if (process.env.NODE_ENV !== 'test') process.exit(1)
}

// Show only presence/absence of optional sensitive configs (do NOT print lengths or snippets)
import { USE_R2_ONLY } from './config/storage'
const SUPABASE_CONFIGURED = USE_R2_ONLY ? false : (!!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.SUPABASE_URL && !!process.env.SUPABASE_BUCKET)
console.info('CONFIG: supabase configured=', Boolean(SUPABASE_CONFIGURED))
const R2_CONFIGURED = !!process.env.CF_R2_ACCESS_KEY_ID && !!process.env.CF_R2_SECRET_ACCESS_KEY && !!process.env.CF_R2_ENDPOINT && !!process.env.CF_R2_BUCKET
console.info('CONFIG: r2 configured=', Boolean(R2_CONFIGURED))

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "https://zaco.sa",
    credentials: true,
  }),
)
app.use(morgan("dev"))

// Inject a small polyfill into HTML responses for /archive/* so MessageChannel/CustomEvent are defined
import injectHtmlPolyfill from './middleware/injectHtmlPolyfill'
app.use(injectHtmlPolyfill)

// Capture logs into an in-memory buffer to show in admin UI
import { logBuffer } from './lib/logBuffer'
const origLog = console.log; const origWarn = console.warn; const origError = console.error; const origInfo = console.info
console.log = (...args: any[]) => { try { logBuffer.push('log', args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) } catch(e){}; origLog.apply(console, args) }
console.warn = (...args: any[]) => { try { logBuffer.push('warn', args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) } catch(e){}; origWarn.apply(console, args) }
console.error = (...args: any[]) => { try { logBuffer.push('error', args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) } catch(e){}; origError.apply(console, args) }
console.info = (...args: any[]) => { try { logBuffer.push('info', args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')) } catch(e){}; origInfo.apply(console, args) }

import cookieParser from 'cookie-parser'

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
// cookie parser for refresh token cookies
app.use(cookieParser())

// Mount API routes
app.use('/api/auth', authRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/users', userRoutes)
// New module routes
app.use('/api/barcodes', barcodeRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/tenants', tenantRoutes)
app.use('/api/snapshots', snapshotRoutes)
// lightweight endpoint used by clients to detect deployed app version and notify users
app.use('/api/version', versionRoutes)
// Client-side error logging (used by the head-script to report severe errors like Illegal constructor)
import clientLogRoutes from './routes/clientLog'
app.use('/api/client-log', clientLogRoutes)

// Uploads route (accepts PDF via multipart/form-data)
import uploadRoutes from './routes/uploads'
import stampRoutes from './routes/stamp'
import * as pathModule from 'path'
import * as fsModule from 'fs'
const uploadsDirStartup = pathModule.resolve(process.cwd(), 'uploads')
if (!fsModule.existsSync(uploadsDirStartup)) fsModule.mkdirSync(uploadsDirStartup, { recursive: true })
app.use('/api/uploads', uploadRoutes)
app.use('/uploads', express.static(uploadsDirStartup))

// Stamp endpoint
app.use('/api/documents', stampRoutes)

// Serve a small wp-emoji loader stub to avoid JS parse errors when clients request /wp-includes/js/wp-emoji-loader.min.js
app.get('/wp-includes/js/wp-emoji-loader.min.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript')
  return res.send(`/* wp-emoji-loader stub - served by backend to avoid HTML 404 */
;(function(){
  if (typeof window === 'undefined') return;
  window._wpemojiSettings = window._wpemojiSettings || {};
})();`)
})

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "zaco-backend",
    uptime: process.uptime()
  })
})

// Simple health endpoint for hosting health checks
app.get("/health", (_req, res) => {
  res.send("ok")
})

// Debug DB check (restricted: ENABLE_DEBUG_ENDPOINTS=true or localhost or admin with auth)
const DEBUG_SECRET = process.env.DEBUG_SECRET || ""
app.get("/debug/db", async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (allowDebugAccess(req)) {
    try {
      const result = await query("SELECT COUNT(*)::int as cnt FROM users")
      const cols = await query("SELECT column_name FROM information_schema.columns WHERE table_name='users'")
      // sample user row for debugging — DO NOT include secrets
      let sampleUser: any = null
      try {
        const u = await query("SELECT id, username, full_name, role, created_at FROM users LIMIT 5")
        if (u.rows.length > 0) {
          sampleUser = u.rows.map((row: any) => ({
            id: row.id,
            username: row.username || null,
            full_name: row.full_name || null,
            role: row.role || null,
          }))
        }
      } catch (e) {
        console.error("Debug sample user error:", e)
      }
      // audit log of access
      console.info('[debug] /debug/db accessed', { ip: req.ip, byUser: (req as any).user?.id || null })
      res.json({ users: result.rows[0].cnt, columns: cols.rows.map((r: any) => r.column_name), sampleUser })
    } catch (err: any) {
      console.error("Debug DB error:", err)
      res.status(500).json({ error: err.message || String(err) })
    }
  } else {
    res.status(404).send("Not found")
  }
})

// Debug: hash plaintext passwords for users that are not bcrypt hashes
app.post("/debug/hash-passwords", async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, true)) {
    return res.status(404).send('Not found')
  }

  try {
    const usersRes = await query("SELECT id, password FROM users")
    const toUpdate: Array<{ id: any; old: string; newHash?: string }> = []
    for (const row of usersRes.rows) {
      const p = String(row.password || "")
      if (!p.startsWith("$2")) {
        // not a bcrypt hash
        toUpdate.push({ id: row.id, old: p })
      }
    }

    const updated: Array<{ id: any }> = []
    for (const u of toUpdate) {
      const hashed = await (await import("bcrypt")).hash(u.old, 10)
      await query("UPDATE users SET password = $1 WHERE id = $2", [hashed, u.id])
      updated.push({ id: u.id })
    }

    res.json({ updatedCount: updated.length, updated })
  } catch (err: any) {
    console.error("Hash passwords error:", err)
    res.status(500).json({ error: err.message || String(err) })
  }
})

// Debug: list registered routes (protected)
app.get("/debug/routes", (req, res) => {
  const { allowDebugAccess } = require('./config/validateEnv')
  if (!allowDebugAccess(req, true)) {
    return res.status(404).send('Not found')
  }

  try {
    // extract route info from Express stack
    const routes: Array<{ method: string; path: string }> = []
    ;(app as any)._router.stack.forEach((middleware: any) => {
      if (middleware.route) {
        // routes registered directly on the app
        const m = Object.keys(middleware.route.methods)[0].toUpperCase()
        routes.push({ method: m, path: middleware.route.path })
      } else if (middleware.name === "router") {
        // router middleware
        middleware.handle.stack.forEach((handler: any) => {
          const route = handler.route
          if (route) {
            const method = Object.keys(route.methods)[0].toUpperCase()
            routes.push({ method, path: route.path })
          }
        })
      }
    })

    res.json({ routes })
  } catch (err: any) {
    console.error("Debug routes error:", err)
    res.status(500).json({ error: err.message || String(err) })
  }
})

// Debug: verbose route stack (shows mount regexp and handler names)
app.get("/debug/routes-full", (req, res) => {
  const { allowDebugAccess } = require('./config/validateEnv')
  if (!allowDebugAccess(req, true)) {
    return res.status(404).send('Not found')
  }

  try {
    const stack = (app as any)._router.stack.map((layer: any) => {
      const info: any = {
        name: layer.name,
        // route paths if present
        path: layer.route ? layer.route.path : undefined,
        methods: layer.route ? Object.keys(layer.route.methods) : undefined,
        // mount regexp (string) for routers
        regexp: layer.regexp ? String(layer.regexp) : undefined,
      }
      // if router, include the nested handlers brief info
      if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        info.children = layer.handle.stack.map((l: any) => ({ name: l.name, path: l.route ? l.route.path : undefined, methods: l.route ? Object.keys(l.route.methods) : undefined }))
      }
      return info
    })

    res.json({ stack })
  } catch (err: any) {
    console.error("Debug routes-full error:", err)
    res.status(500).json({ error: err.message || String(err) })
  }
})

// Debug: set sequence start value (protected). Body: { name: 'doc_in_seq'|'doc_out_seq', value: number }
app.post('/debug/set-sequence', async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, true)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  try {
    const { name, value } = req.body || {}
    if (!name || !value) return res.status(400).json({ error: 'name and value are required' })
    if (!['doc_in_seq','doc_out_seq'].includes(name)) return res.status(400).json({ error: 'unsupported sequence' })
    const v = Number(value)
    if (!Number.isFinite(v) || v < 1) return res.status(400).json({ error: 'invalid value' })
    // set sequence so nextval yields 'value' by setting current value to value-1
    await query(`SELECT setval('${name}', $1)`, [v - 1])
    const next = await query(`SELECT nextval('${name}') as n`)
    return res.json({ ok: true, next: next.rows[0].n })
  } catch (err: any) {
    console.error('Set sequence error:', err)
    res.status(500).json({ error: 'Failed to set sequence' })
  }
})

// Debug: backfill document statuses based on barcode prefixes
app.post('/debug/backfill-document-status', async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, true)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  try {
    const outUpdated = await query("UPDATE documents SET status = 'صادر' WHERE barcode ILIKE 'OUT-%' AND status != 'صادر' RETURNING id, barcode, status")
    const inUpdated = await query("UPDATE documents SET status = 'وارد' WHERE barcode ILIKE 'IN-%' AND status != 'وارد' RETURNING id, barcode, status")

    return res.json({ ok: true, outUpdated: outUpdated.rows.length, inUpdated: inUpdated.rows.length, outSamples: outUpdated.rows.slice(0,5), inSamples: inUpdated.rows.slice(0,5) })
  } catch (err: any) {
    console.error('Backfill status error:', err)
    res.status(500).json({ error: 'Backfill failed' })
  }
})

// Debug: reset the entire public schema and re-run SQL migration + seed scripts
app.post("/debug/reset-db", async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, true)) {
    return res.status(404).send('Not found')
  }

  try {
    console.log("Reset DB: starting DROP/CREATE schema public")
    await query("DROP SCHEMA public CASCADE")
    await query("CREATE SCHEMA public")

    // Ensure doc sequences exist after migrations (safe to run multiple times)
    try {
      await query("CREATE SEQUENCE IF NOT EXISTS doc_in_seq START 1")
      await query("CREATE SEQUENCE IF NOT EXISTS doc_out_seq START 1")
      console.log('Ensured doc_in_seq and doc_out_seq exist')
    } catch (seqErr) {
      console.warn('Failed to ensure document sequences during reset:', seqErr)
    }

    const fs = await import("fs")
    const path = await import("path")
    // Support multiple possible locations for the SQL scripts depending on build/runtime layout
    const candidates = [
      path.resolve(__dirname, "..", "scripts"),        // backend/scripts (when running from dist)
      path.resolve(__dirname, "..", "..", "scripts"), // project-root/scripts (when dist is in backend/dist)
      path.resolve(process.cwd(), "scripts"),            // working directory scripts
    ]

    // helper: check candidate has both SQL files
    const hasBoth = (dir: string) => {
      try {
        return fs.existsSync(path.join(dir, "01_create_tables.sql")) && fs.existsSync(path.join(dir, "02_seed_data.sql"))
      } catch (e) {
        return false
      }
    }

    let base: string | null = null
    for (const c of candidates) {
      if (hasBoth(c)) {
        base = c
        break
      }
    }

    // If not found yet, walk up from current dir to find a scripts folder with the files
    if (!base) {
      let cur = path.resolve(process.cwd())
      for (let i = 0; i < 6; i++) {
        const candidate = path.join(cur, "scripts")
        if (hasBoth(candidate)) {
          base = candidate
          break
        }
        const parent = path.dirname(cur)
        if (parent === cur) break
        cur = parent
      }
    }

    if (!base) {
      // helpful debug info
      const tried = candidates.concat([path.resolve(process.cwd())]).join(", ")
      throw new Error("SQL scripts not found. Searched: " + tried + "; __dirname=" + __dirname + " cwd=" + process.cwd())
    }

    console.log("Reset DB: using scripts dir:", base)
    const createSql = fs.readFileSync(path.join(base, "01_create_tables.sql"), "utf8")
    const seedSql = fs.readFileSync(path.join(base, "02_seed_data.sql"), "utf8")

    console.log("Reset DB: running 01_create_tables.sql")
    await query(createSql)
    console.log("Reset DB: running 02_seed_data.sql")
    await query(seedSql)

    // quick verification
    const usersCount = await query("SELECT COUNT(*)::int as cnt FROM users")

    res.json({ status: "ok", users: usersCount.rows[0].cnt })
  } catch (err: any) {
    console.error("Reset DB error:", err)
    res.status(500).json({ error: err.message || String(err) })
  }
})

// Debug: set admin password to known value (admin123) - protected
app.post("/debug/set-admin-password", async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, true)) {
    return res.status(404).send('Not found')
  }

  try {
    // check if email column exists
    const colRes = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email' LIMIT 1")
    const hasEmail = colRes.rows.length > 0

    const bcrypt = await import("bcrypt")
    const hashed = await bcrypt.hash("admin123", 10)

    let upd: any
    if (hasEmail) {
      upd = await query("UPDATE users SET password = $1 WHERE username = $2 OR email = $2 RETURNING id, username", [hashed, "admin@zaco.sa"])
    } else {
      upd = await query("UPDATE users SET password = $1 WHERE username = $2 RETURNING id, username", [hashed, "admin@zaco.sa"])
    }

    console.log("Set admin password: updated", upd.rowCount)
    res.json({ updated: upd.rowCount, rows: upd.rows })
  } catch (err: any) {
    console.error("Set admin password error:", err)
    res.status(500).json({ error: err.message || String(err) })
  }
})

// Debug: run a single migration SQL file (protected). Accepts file param (filename) limited to known scripts.
app.post("/debug/run-migration", async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, true)) {
    return res.status(404).send('Not found')
  }

  try {
    const filename = String(req.query.file || req.body?.file || "").trim()
    const allowed = new Set(["01_create_tables.sql", "02_seed_data.sql", "03_create_modules_tables.sql", "04_seed_modules.sql", "05_create_indexes.sql", "06_add_documents_tenant.sql", "07_create_sequences.sql", "08_change_date_to_timestamp.sql", "09_create_doc_seq.sql", "10_expand_user_roles.sql"])
    if (!allowed.has(filename)) {
      return res.status(400).json({ error: "Invalid or unsupported migration file" })
    }

    const fs = await import("fs")
    const path = await import("path")

    // find scripts dir (reuse logic)
    const candidates = [
      path.resolve(__dirname, "..", "scripts"),
      path.resolve(__dirname, "..", "..", "scripts"),
      path.resolve(process.cwd(), "scripts"),
    ]

    let base: string | null = null
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, filename))) {
        base = c
        break
      }
    }

    if (!base) {
      // try walking up
      let cur = path.resolve(process.cwd())
      for (let i = 0; i < 6; i++) {
        const candidate = path.join(cur, "scripts")
        if (fs.existsSync(path.join(candidate, filename))) {
          base = candidate
          break
        }
        const parent = path.dirname(cur)
        if (parent === cur) break
        cur = parent
      }
    }

    if (!base) return res.status(404).json({ error: "Migration file not found" })

    const sql = fs.readFileSync(path.join(base, filename), "utf8")

    await query("BEGIN")
    try {
      await query(sql)
      await query("COMMIT")
      res.json({ status: "ok", file: filename })
    } catch (err: any) {
      await query("ROLLBACK")
      console.error("Migration execution error:", err)
      return res.status(500).json({ error: err.message || String(err) })
    }
  } catch (err: any) {
    console.error("Run migration error:", err)
    res.status(500).json({ error: err.message || String(err) })
  }
})

// Debug: preview rows that would be affected by the backfill (read-only, safe)
app.get('/debug/preview-backfill-doc-dates', async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, false)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const samples = await query("SELECT id, barcode, date, created_at FROM documents WHERE to_char(date, 'HH24:MI:SS') = '00:00:00' ORDER BY id LIMIT 50")
    const count = await query("SELECT COUNT(*)::int as cnt FROM documents WHERE to_char(date, 'HH24:MI:SS') = '00:00:00'")
    return res.json({ ok: true, count: count.rows[0].cnt, samples: samples.rows })
  } catch (err: any) {
    console.error('preview-backfill-doc-dates error:', err)
    return res.status(500).json({ error: String(err.message || err) })
  }
})

// Debug: backfill documents that have midnight-only dates to use created_at's time (safe, idempotent)
app.post('/debug/backfill-doc-dates', async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, false)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    // Update documents where date is midnight (00:00:00) to combine original date with created_at time
    const affected = await query("UPDATE documents SET date = (date::date + (created_at::time)) WHERE to_char(date, 'HH24:MI:SS') = '00:00:00' RETURNING id, barcode, date, created_at")
    return res.json({ ok: true, updatedCount: affected.rows.length, samples: affected.rows.slice(0,5) })
  } catch (err: any) {
    console.error('backfill-doc-dates error:', err)
    res.status(500).json({ error: 'Backfill failed' })
  }
})

// Debug: fix zeroed UUID timestamps by adding a uuid7_fixed column and populating it for affected rows
app.post('/debug/fix-zero-uuid', async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, false)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    // add columns if missing
    await query("ALTER TABLE IF NOT EXISTS documents ADD COLUMN IF NOT EXISTS uuid7_fixed TEXT")
    await query("ALTER TABLE IF NOT EXISTS barcodes ADD COLUMN IF NOT EXISTS uuid7_fixed TEXT")

    // find affected documents and barcodes (heuristic: contain large zero-segments)
    const docs = await query("SELECT id, barcode FROM documents WHERE barcode LIKE $1", ["%0000000%"])
    const bcs = await query("SELECT id, barcode FROM barcodes WHERE barcode LIKE $1", ["%0000000%"])

    // local uuidv7 generator (avoid cross-import issues during build)
    const generateUUIDv7 = (): string => {
      const timestamp = Date.now() || (new Date()).getTime();
      let hexTimestamp = Math.floor(timestamp).toString(16).padStart(12, '0');
      if (!hexTimestamp || /^0+$/.test(hexTimestamp)) hexTimestamp = Math.floor(Date.now() / 1).toString(16).padStart(12, '0');
      const crypto = (() => {
        try { return require('crypto') } catch(e){ return null }
      })()
      const rand = crypto ? Array.from((crypto as any).randomBytes(10)) : Array.from({length:10}, () => Math.floor(Math.random()*256))
      const randomPart = (rand as number[]).map((b: number) => b.toString(16).padStart(2,'0')).join('')
      return `${hexTimestamp.slice(0,8)}-${hexTimestamp.slice(8,12)}-7${randomPart.slice(0,3)}-${(parseInt(randomPart.slice(3,4),16) & 0x3 | 0x8).toString(16)}${randomPart.slice(4,7)}-${randomPart.slice(7,19)}`
    }

    const updatedDocs: any[] = []
    for (const row of docs.rows) {
      const newUuid = generateUUIDv7()
      await query("UPDATE documents SET uuid7_fixed = $1 WHERE id = $2", [newUuid, row.id])
      updatedDocs.push({ id: row.id, old: row.barcode, uuid7_fixed: newUuid })
    }

    const updatedBcs: any[] = []
    for (const row of bcs.rows) {
      const newUuid = generateUUIDv7()
      await query("UPDATE barcodes SET uuid7_fixed = $1 WHERE id = $2", [newUuid, row.id])
      updatedBcs.push({ id: row.id, old: row.barcode, uuid7_fixed: newUuid })
    }

    res.json({ ok: true, updatedDocs, updatedBcs })
  } catch (err: any) {
    console.error('fix-zero-uuid error:', err)
    res.status(500).json({ error: 'Failed to run fix-zero-uuid' })
  }
})

// Debug: ensure doc_seq exists (safe, idempotent)
app.post('/debug/apply-doc-seq', async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, false)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    await query("CREATE SEQUENCE IF NOT EXISTS doc_seq START 1")
    // Use information_schema for broader Postgres compatibility
    const resSample = await query("SELECT sequence_name FROM information_schema.sequences WHERE sequence_name = 'doc_seq'")
    res.json({ ok: true, created: resSample.rows.length > 0, seq: resSample.rows[0] || null })
  } catch (err: any) {
    console.error('apply-doc-seq error:', err)
    res.status(500).json({ error: 'Failed to create doc_seq' })
  }
})

// Debug: list sequences that look like document sequences
app.get('/debug/list-sequences', async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, false)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const q = "SELECT sequence_schema, sequence_name FROM information_schema.sequences WHERE sequence_name LIKE 'doc%';"
    const rows = await query(q)
    res.json({ ok: true, sequences: rows.rows })
  } catch (err: any) {
    console.error('list-sequences error:', err)
    res.status(500).json({ error: err.message || String(err) })
  }
})

// Debug: verify a JWT token (protected) - returns decoded payload or verification error
app.post('/debug/verify-token', async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, false)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const token = String(req.body?.token || req.query?.token || '')
    if (!token) return res.status(400).json({ error: 'token is required in body.token or ?token' })
    try {
      const { verify } = await import('jsonwebtoken')
      const secretKey = process.env.JWT_SECRET || ''
      try {
        const payload = verify(token, secretKey)
        return res.json({ ok: true, verified: true, payload })
      } catch (e: any) {
        return res.json({ ok: false, verified: false, error: String(e.message || e) })
      }
    } catch (e: any) {
      return res.json({ ok: false, verified: false, error: String(e.message || e) })
    }
  } catch (err: any) {
    console.error('verify-token error:', err)
    res.status(500).json({ error: err.message || String(err) })
  }
})

// Optional: run allowed migrations automatically on startup when AUTO_RUN_MIGRATIONS=true
async function runAllowedMigrationsOnStartup() {
  try {
    if (String(process.env.AUTO_RUN_MIGRATIONS || '').toLowerCase() !== 'true') return

    const allowed = ["01_create_tables.sql", "02_seed_data.sql", "03_create_modules_tables.sql", "04_seed_modules.sql", "05_create_indexes.sql", "06_add_documents_tenant.sql", "07_create_sequences.sql", "09_create_doc_seq.sql", "11_add_statement_column.sql", "12_create_backups_table.sql"]

    const fs = await import('fs')
    const path = await import('path')

    const candidates = [
      path.resolve(__dirname, '..', 'scripts'),
      path.resolve(__dirname, '..', '..', 'scripts'),
      path.resolve(process.cwd(), 'scripts'),
    ]

    // Collect existing script roots from candidates
    const roots: string[] = []
    for (const c of candidates) {
      if (fs.existsSync(c)) roots.push(c)
    }

    // If we didn't find any candidate directories, try walking up the tree to find any scripts dir
    if (roots.length === 0) {
      let cur = path.resolve(process.cwd())
      for (let i = 0; i < 6; i++) {
        const candidate = path.join(cur, 'scripts')
        if (fs.existsSync(candidate)) { roots.push(candidate); break }
        const parent = path.dirname(cur)
        if (parent === cur) break
        cur = parent
      }
    }

    if (roots.length === 0) {
      console.log('No scripts directory found; skipping startup migrations')
      return
    }

    // For each allowed filename, check all roots and apply the first match found
    for (const filename of allowed) {
      let filePath: string | null = null
      for (const root of roots) {
        const candidate = path.join(root, filename)
        if (fs.existsSync(candidate)) { filePath = candidate; break }
      }

      if (!filePath) { console.log('Skipping missing migration', filename); continue }

      const sql = fs.readFileSync(filePath, 'utf8')
      console.log('Applying startup migration:', filename, 'from', filePath)
      try {
        await query('BEGIN')
        await query(sql)
        await query('COMMIT')
        console.log('Applied migration:', filename)
      } catch (e: any) {
        await query('ROLLBACK')
        console.error('Failed to apply startup migration', filename, e.message || e)
        // continue to next file (do not abort entire startup)
      }
    }

    // After attempting migrations, ensure sequences exist
    try {
      await query("CREATE SEQUENCE IF NOT EXISTS doc_in_seq START 1")
      await query("CREATE SEQUENCE IF NOT EXISTS doc_out_seq START 1")
      await query("CREATE SEQUENCE IF NOT EXISTS doc_seq START 1")
      console.log('Ensured document sequences exist on startup')
    } catch (errSeq: any) {
      console.warn('Failed to ensure document sequences on startup:', errSeq)
    }
  } catch (err: any) {
    console.error('Startup migration runner failed:', err)
  }
}

// Kick off startup migration runner (non-blocking)
runAllowedMigrationsOnStartup().catch(err => console.error('Startup migrations error:', err))

// Start backup scheduler (if enabled)
import { startBackupScheduler } from './lib/backup-scheduler'
startBackupScheduler()

// Debug: stream a pg_dump of the database for backup (protected)
app.get("/debug/backup-db", async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, true)) {
    return res.status(404).send('Not found')
  }

  try {
    const { spawn } = await import("child_process")
    const os = await import("os")
    const path = await import("path")

    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      return res.status(500).json({ error: "DATABASE_URL not configured" })
    }

    const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.dump`
    res.setHeader("Content-Type", "application/octet-stream")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)

    // Use pg_dump if available; stream output to client
    const args = ["--format=custom", `--dbname=${dbUrl}`]
    const child = spawn("pg_dump", args)

    child.stdout.pipe(res)
    child.stderr.on("data", (d) => console.error("pg_dump stderr:", String(d)))

    child.on("exit", (code) => {
      if (code !== 0) console.error("pg_dump exited with", code)
    })
  } catch (err: any) {
    console.error("Backup DB error:", err)
    res.status(500).json({ error: err.message || String(err) })
  }
})

// Admin backups endpoints (protected)
import backupsRouter from './routes/backups'
// mount under /api to match client API_BASE_URL
app.use('/api/admin/backups', backupsRouter)
import adminStatusRouter from './routes/adminStatus'
app.use('/api/admin/status', adminStatusRouter)

// Debug: list available font files on server (protected)
app.get('/debug/list-fonts', async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, true)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const fontDirs = [
      pathModule.resolve(process.cwd(), 'backend', 'assets', 'fonts'),
      pathModule.resolve(process.cwd(), 'assets', 'fonts'),
      pathModule.resolve(process.cwd(), 'assets'),
      pathModule.resolve(process.cwd(), 'fonts'),
      pathModule.resolve(__dirname, '..', '..', 'assets', 'fonts'),
      pathModule.resolve(__dirname, '..', '..', 'assets'),
      pathModule.resolve(__dirname, '..', '..', '..', 'assets', 'fonts'),
      pathModule.resolve(__dirname, '..', '..', '..', 'backend', 'assets', 'fonts'),
    ]

    const results: any = {}
    for (const d of fontDirs) {
      try {
        if (fsModule.existsSync(d)) {
          const files = fsModule.readdirSync(d).filter((f: string) => /(\.ttf|\.otf|\.woff2?|\.woff)$/i.test(f)).map((f: string) => {
            try {
              const p = pathModule.join(d, f)
              const s = fsModule.statSync(p)
              const headBuf = fsModule.readFileSync(p)
              const head = headBuf.slice(0, 16)
              const crypto = require('crypto')
              const sha = crypto.createHash('sha256').update(headBuf).digest('hex')
              return { name: f, size: s.size, head: Buffer.from(head).toString('hex'), sha256: sha }
            } catch (e) { return { name: f, error: String(e) } }
          })
          results[d] = files
        } else {
          results[d] = []
        }
      } catch (e) {
        results[d] = { error: String(e) }
      }
    }

    return res.json({ ok: true, results })
  } catch (err: any) {
    console.error('list-fonts error:', err)
    return res.status(500).json({ error: String(err.message || err) })
  }
})

// Debug: attempt to fix fonts by downloading latest Noto Sans Arabic into known font paths (protected)
app.post('/debug/fix-fonts', async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, true)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  try {
    const targets = [
      pathModule.resolve(process.cwd(), 'backend', 'assets', 'fonts', 'NotoSansArabic-Regular.ttf'),
      pathModule.resolve(process.cwd(), 'backend', 'assets', 'fonts', 'NotoSansArabic-Bold.ttf'),
      pathModule.resolve(process.cwd(), 'backend', 'assets', 'fonts', 'NotoSansArabic-Regular.woff2'),
      pathModule.resolve(process.cwd(), 'backend', 'assets', 'fonts', 'NotoSansArabic-Bold.woff2'),
      pathModule.resolve(__dirname, '..', '..', 'backend', 'assets', 'fonts', 'NotoSansArabic-Regular.ttf'),
      pathModule.resolve(__dirname, '..', '..', 'backend', 'assets', 'fonts', 'NotoSansArabic-Bold.ttf'),
      pathModule.resolve(__dirname, '..', '..', 'backend', 'assets', 'fonts', 'NotoSansArabic-Regular.woff2'),
      pathModule.resolve(__dirname, '..', '..', 'backend', 'assets', 'fonts', 'NotoSansArabic-Bold.woff2'),
    ]
    const urls: any = {
      regular_ttf: 'https://github.com/googlefonts/noto-fonts/raw/main/phaseIII_only/unhinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf',
      bold_ttf: 'https://github.com/googlefonts/noto-fonts/raw/main/phaseIII_only/unhinted/ttf/NotoSansArabic/NotoSansArabic-Bold.ttf',
      // reliable CDN sources (woff2)
      regular_woff2: 'https://unpkg.com/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff2',
      bold_woff2: 'https://unpkg.com/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff2'
    }

    const written: any = []
    for (const t of targets) {
      try {
        const dir = pathModule.dirname(t)
        if (!fsModule.existsSync(dir)) fsModule.mkdirSync(dir, { recursive: true })
        const which = t.toLowerCase().includes('bold') ? 'bold' : 'regular'
        // pick URL for this target: prefer woff2 CDN when target ends with .woff2
        let url = null
        if (t.toLowerCase().endsWith('.woff2')) url = urls[which + '_woff2'] || urls[which]
        else url = urls[which + '_ttf'] || urls[which]
        if (!url) { written.push({ target: t, ok: false, error: 'no url' }); continue }
        const r = await fetch(url)
        if (!r.ok) { written.push({ target: t, ok: false, status: r.status }); continue }
        const contentType = String(r.headers.get('content-type') || '')
        if (!/font|octet|application|woff/i.test(contentType)) {
          // still write but log warning
          console.warn('fix-fonts: downloaded content-type', contentType)
        }
        const buf = Buffer.from(await r.arrayBuffer())
        fsModule.writeFileSync(t, buf)
        const crypto = require('crypto')
        const sha = crypto.createHash('sha256').update(buf).digest('hex')
        written.push({ target: t, ok: true, size: buf.length, sha256: sha, contentType })
      } catch (e) {
        written.push({ target: t, ok: false, error: String(e) })
      }
    }

    return res.json({ ok: true, written })
  } catch (err: any) {
    console.error('fix-fonts error:', err)
    return res.status(500).json({ error: String(err.message || err) })
  }
})

// Debug: test Supabase storage upload using env vars (protected)
app.get("/debug/test-supabase-upload", async (req, res) => {
  const { allowDebugAccess } = await import('./config/validateEnv')
  if (!allowDebugAccess(req, true)) {
    return res.status(404).send('Not found')
  }

  const { USE_R2_ONLY } = await import('./config/storage')
  // This debug endpoint is disabled when the server is running in R2-only mode
  if (USE_R2_ONLY) return res.status(404).send('Not found')

  const SUPABASE_URL = process.env.SUPABASE_URL || ''
  const SUPABASE_KEY_RAW = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const SUPABASE_KEY = String(SUPABASE_KEY_RAW).trim()
  const BUCKET = process.env.SUPABASE_BUCKET || process.env.S3_BUCKET || ''

  console.debug('DEBUG: /debug/test-supabase-upload supabase configured=', !!SUPABASE_URL && !!SUPABASE_KEY && !!BUCKET)

  if (!SUPABASE_URL || !SUPABASE_KEY || !BUCKET) {
    return res.status(500).json({ error: 'Missing SUPABASE env vars', SUPABASE_URL: !!SUPABASE_URL, SUPABASE_KEY: !!SUPABASE_KEY, BUCKET })
  }

  // Accept either traditional JWT-like service role keys OR the newer sb_secret_ prefix keys
  const jwtLike = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(SUPABASE_KEY)
  const sbPrefixed = SUPABASE_KEY.startsWith('sb_secret_')
  if (!jwtLike && !sbPrefixed) {
    const snippet = String(SUPABASE_KEY).slice(0, 6) + '…' + String(SUPABASE_KEY).slice(-6)
    return res.status(400).json({ error: 'SUPABASE_SERVICE_ROLE_KEY does not look like a valid Service Role JWT or sb_secret_ key. Please confirm you copied the Service Role Key (Settings → API → Service Role Key) for the same Supabase project.', keySnippet: snippet })
  }

  if (sbPrefixed && !jwtLike) {
    console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY appears to start with sb_secret_. Proceeding to test upload — server will attempt an upload to verify if this key is accepted at runtime.')
  }

  // Supabase debug upload disabled — project migrated to R2-only
  return res.status(501).json({ error: 'Supabase debug upload disabled: project is R2-only' })
})



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
  console.log(`DEPLOY_HEARTBEAT ${new Date().toISOString()}`)
})

export default app;

// noop: ensure file ends with a clean newline to avoid parser issues on CI

