import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"
import dotenv from "dotenv"
import authRoutes from "./routes/auth"
import documentRoutes from "./routes/documents"
import userRoutes from "./routes/users"
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

export default app
