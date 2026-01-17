import express from "express"
import type { Request, Response } from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { body, validationResult } from "express-validator"
import { query } from "../config/database"
import { logAudit } from "../services/auditService"

const router = express.Router()
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || ""

// Verify reCAPTCHA token
async function verifyRecaptcha(token: string): Promise<boolean> {
  if (!RECAPTCHA_SECRET_KEY) return true // Skip if not configured
  
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${RECAPTCHA_SECRET_KEY}&response=${token}`
    })
    const data = await response.json() as { success: boolean }
    return data.success === true
  } catch (error) {
    console.error('reCAPTCHA verification failed:', error)
    return false
  }
}

// Login
const loginLimiterMiddleware = (req: any, res: any, next: any) => {
  try { const l = req.app && req.app.locals && req.app.locals.loginLimiter; if (l) return l(req, res, next) } catch (e) {}
  next()
}

router.post(
  "/login",
  loginLimiterMiddleware,
  [
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    try {
      const { username, password, recaptchaToken } = req.body

      // Verify reCAPTCHA if secret key is configured
      if (RECAPTCHA_SECRET_KEY && recaptchaToken) {
        const isValidCaptcha = await verifyRecaptcha(recaptchaToken)
        if (!isValidCaptcha) {
          return res.status(400).json({ error: "reCAPTCHA verification failed" })
        }
      }

      // Optimized: Assume email column exists or just query by username if that's the standard.
      // For better performance, we try to match username first.
      // If you need email login, ensure the column exists via migration, don't check at runtime.
      const result = await query("SELECT * FROM users WHERE username = $1 LIMIT 1", [username])


      if (result.rows.length === 0) {
        await logAudit({ action: 'LOGIN_FAILED', details: `User not found: ${username}`, ipAddress: req.ip || req.socket.remoteAddress, userAgent: req.headers['user-agent'] })
        return res.status(401).json({ error: "Invalid credentials" })
      }

      const user = result.rows[0]
      const isValidPassword = await bcrypt.compare(password, user.password) // password column exists as 'password'

      if (!isValidPassword) {
        await logAudit({ userId: user.id, action: 'LOGIN_FAILED', details: 'Incorrect password', ipAddress: req.ip || req.socket.remoteAddress, userAgent: req.headers['user-agent'] })
        return res.status(401).json({ error: "Invalid credentials" })
      }

      await logAudit({ userId: user.id, action: 'LOGIN_SUCCESS', ipAddress: req.ip || req.socket.remoteAddress, userAgent: req.headers['user-agent'] })

      const jwtSecret = String(process.env.JWT_SECRET || '')
      if (!jwtSecret) return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET is missing' })

      const refreshSecret = String(process.env.REFRESH_TOKEN_SECRET || '')
      if (!refreshSecret) return res.status(500).json({ error: 'Server misconfigured: REFRESH_TOKEN_SECRET is missing' })

      const accessToken = jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret, {
        expiresIn: "1h",
        algorithm: 'HS256'
      })
      const refreshToken = jwt.sign({ id: user.id }, refreshSecret, {
        expiresIn: "7d",
        algorithm: 'HS256'
      })

      res.json({
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.email || user.name,
          full_name: user.name || user.full_name,
          role: user.role,
        },
      })
    } catch (error) {
      console.error("Login error:", error)
      res.status(500).json({ error: "Login failed" })
    }
  },
)

// Register (admin only) - protected
import { authenticateToken, isAdmin } from "../middleware/auth"

router.post(
  "/register",
  authenticateToken,
  isAdmin,
  [
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("full_name").trim().notEmpty().withMessage("Full name is required"),
    body("role").optional().isIn(["admin", "manager", "supervisor", "member"]).withMessage("Invalid role"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    try {
      const { username, password, full_name, role } = req.body

      // Check if user exists
      const existingUser = await query("SELECT id FROM users WHERE username = $1", [username])

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: "Username already exists" })
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10)

      // Insert user (only admin can assign roles here)
      const assignedRole = role || 'member'
      const result = await query(
        "INSERT INTO users (username, password, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, role",
        [username, hashedPassword, full_name, assignedRole],
      )

      res.status(201).json({
        message: "User created successfully",
        user: result.rows[0],
      })
    } catch (error) {
      console.error("Registration error:", error)
      res.status(500).json({ error: "Registration failed" })
    }
  },
)

// Apply login rate limiting on the login route (middleware-aware)
const loginLimiter = (req: any, res: any, next: any) => {
  try {
    const limiter = req.app && req.app.locals && req.app.locals.loginLimiter
    if (limiter) return limiter(req, res, next)
  } catch (e) {}
  next()
}

// Login route should apply loginLimiter at call site via router.post('/login', loginLimiter, ...), ensure it's used in server startup when mounting router.
// If server doesn't mount it, the loginLimiter above will gracefully no-op.

// Refresh token endpoint
router.post("/refresh", (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return res.status(401).json({ error: "Refresh token required" })

    const refreshSecret = String(process.env.REFRESH_TOKEN_SECRET || '')
    if (!refreshSecret) return res.status(500).json({ error: 'Server misconfigured: REFRESH_TOKEN_SECRET is missing' })
    let decoded: any
    try {
      decoded = jwt.verify(refreshToken, refreshSecret)
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired refresh token" })
    }

    const jwtSecret = String(process.env.JWT_SECRET || '')
    if (!jwtSecret) return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET is missing' })

    const accessToken = jwt.sign({ id: decoded.id }, jwtSecret, {
      expiresIn: "1h",
      algorithm: 'HS256'
    })

    res.json({ token: accessToken })
  } catch (error) {
    console.error("Refresh error:", error)
    res.status(500).json({ error: "Refresh failed" })
  }
})

export default router
