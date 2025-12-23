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
      res.json({ users: result.rows[0].cnt, columns: cols.rows.map((r: any) => r.column_name) })
    } catch (err: any) {
      console.error("Debug DB error:", err)
      res.status(500).json({ error: err.message || String(err) })
    }
  } else {
    res.status(404).send("Not found")
  }
})

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/documents", documentRoutes)
app.use("/api/users", userRoutes)

// Error handling
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

export default app
