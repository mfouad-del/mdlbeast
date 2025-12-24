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
import { errorHandler } from "./middleware/errorHandler"
import { query } from "./config/database"

dotenv.config()

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
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Mount API routes
app.use('/api/auth', authRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/users', userRoutes)
// New module routes
app.use('/api/barcodes', barcodeRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/tenants', tenantRoutes)
app.use('/api/snapshots', snapshotRoutes)

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

// Debug DB check (enabled with DEBUG=true or with a secret via DEBUG_SECRET)
const DEBUG_SECRET = process.env.DEBUG_SECRET || ""
app.get("/debug/db", async (req, res) => {
  const secret = req.query.secret
  if (process.env.DEBUG === "true" || (typeof secret === "string" && secret === DEBUG_SECRET && DEBUG_SECRET !== "")) {
    try {
      const result = await query("SELECT COUNT(*)::int as cnt FROM users")
      const cols = await query("SELECT column_name FROM information_schema.columns WHERE table_name='users'")
      // sample user row for debugging (truncate password for safety)
      let sampleUser: any = null
      try {
        const u = await query("SELECT * FROM users LIMIT 5")
        if (u.rows.length > 0) {
          sampleUser = u.rows.map((row: any) => ({
            id: row.id,
            email: row.email || null,
            name: row.name || null,
            role: row.role || null,
            // show hashed password prefix if exists
            passwordStartsWith: row.password ? String(row.password).slice(0, 10) : null,
          }))
        }
      } catch (e) {
        console.error("Debug sample user error:", e)
      }
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
  const secret = req.query.secret
  if (!(process.env.DEBUG === "true" || (typeof secret === "string" && secret === DEBUG_SECRET && DEBUG_SECRET !== ""))) {
    return res.status(404).send("Not found")
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
  const secret = req.query.secret
  if (!(process.env.DEBUG === "true" || (typeof secret === "string" && secret === DEBUG_SECRET && DEBUG_SECRET !== ""))) {
    return res.status(404).send("Not found")
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
  const secret = req.query.secret
  if (!(process.env.DEBUG === "true" || (typeof secret === "string" && secret === DEBUG_SECRET && DEBUG_SECRET !== ""))) {
    return res.status(404).send("Not found")
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

// Debug: reset the entire public schema and re-run SQL migration + seed scripts
app.post("/debug/reset-db", async (req, res) => {
  const secret = req.query.secret
  if (!(process.env.DEBUG === "true" || (typeof secret === "string" && secret === DEBUG_SECRET && DEBUG_SECRET !== ""))) {
    return res.status(404).send("Not found")
  }

  try {
    console.log("Reset DB: starting DROP/CREATE schema public")
    await query("DROP SCHEMA public CASCADE")
    await query("CREATE SCHEMA public")

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
  const secret = req.query.secret
  if (!(process.env.DEBUG === "true" || (typeof secret === "string" && secret === DEBUG_SECRET && DEBUG_SECRET !== ""))) {
    return res.status(404).send("Not found")
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
  const secret = req.query.secret
  if (!(process.env.DEBUG === "true" || (typeof secret === "string" && secret === DEBUG_SECRET && DEBUG_SECRET !== ""))) {
    return res.status(404).send("Not found")
  }

  try {
    const filename = String(req.query.file || req.body?.file || "").trim()
    const allowed = new Set(["01_create_tables.sql", "02_seed_data.sql", "03_create_modules_tables.sql", "04_seed_modules.sql", "05_create_indexes.sql", "06_add_documents_tenant.sql", "07_create_sequences.sql"])
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

// Optional: run allowed migrations automatically on startup when AUTO_RUN_MIGRATIONS=true
async function runAllowedMigrationsOnStartup() {
  try {
    if (String(process.env.AUTO_RUN_MIGRATIONS || '').toLowerCase() !== 'true') return

    const allowed = ["01_create_tables.sql", "02_seed_data.sql", "03_create_modules_tables.sql", "04_seed_modules.sql", "05_create_indexes.sql", "06_add_documents_tenant.sql"]

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
  } catch (err: any) {
    console.error('Startup migration runner failed:', err)
  }
}

// Kick off startup migration runner (non-blocking)
runAllowedMigrationsOnStartup().catch(err => console.error('Startup migrations error:', err))

// Debug: stream a pg_dump of the database for backup (protected)
app.get("/debug/backup-db", async (req, res) => {
  const secret = req.query.secret
  if (!(process.env.DEBUG === "true" || (typeof secret === "string" && secret === DEBUG_SECRET && DEBUG_SECRET !== ""))) {
    return res.status(404).send("Not found")
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

// Debug: test Supabase storage upload using env vars (protected)
app.get("/debug/test-supabase-upload", async (req, res) => {
  const secret = req.query.secret
  if (!(process.env.DEBUG === "true" || (typeof secret === "string" && secret === DEBUG_SECRET && DEBUG_SECRET !== ""))) {
    return res.status(404).send("Not found")
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || ''
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const BUCKET = process.env.SUPABASE_BUCKET || process.env.S3_BUCKET || ''

  if (!SUPABASE_URL || !SUPABASE_KEY || !BUCKET) {
    return res.status(500).json({ error: 'Missing SUPABASE env vars', SUPABASE_URL: !!SUPABASE_URL, SUPABASE_KEY: !!SUPABASE_KEY, BUCKET })
  }

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
    const key = `debug/test-${Date.now()}.txt`
    const body = Buffer.from('debug upload')
    const { data, error } = await supabase.storage.from(BUCKET).upload(key, body, { contentType: 'text/plain' })
    if (error) {
      // try listing to get more context
      let listInfo
      try { listInfo = await supabase.storage.from(BUCKET).list('debug') } catch (e) { listInfo = String(e) }
      return res.status(500).json({ error, listInfo })
    }

    const pub = supabase.storage.from(BUCKET).getPublicUrl(key)
    return res.json({ data, publicUrl: (pub as any)?.data || null })
  } catch (err: any) {
    console.error('Debug Supabase upload error:', err)
    return res.status(500).json({ error: err.message || String(err) })
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
  console.log(`DEPLOY_HEARTBEAT ${new Date().toISOString()}`)
})

export default app
