import express from "express"
import type { Request, Response } from "express"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { body, validationResult } from "express-validator"
import { query } from "../config/database"

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || ''
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || ''

// Login
router.post(
  "/login",
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
      const { username, password } = req.body

      // Accept either email or username in the login field to support different DB schemas.
      // Check whether the `email` column exists first to avoid SQL errors on DBs without it.
      const colRes = await query(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email' LIMIT 1",
      )
      const hasEmail = colRes.rows.length > 0

      let result: any
      if (hasEmail) {
        result = await query(
          "SELECT * FROM users WHERE email = $1 OR username = $1 LIMIT 1",
          [username],
        )
      } else {
        result = await query("SELECT * FROM users WHERE username = $1 LIMIT 1", [username])
      }

      if (result.rows.length === 0) {
        return res.status(401).json({ error: "Invalid credentials" })
      }

      const user = result.rows[0]
      const isValidPassword = await bcrypt.compare(password, user.password) // password column exists as 'password'

      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" })
      }

      const accessToken = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
        expiresIn: "15m",
        algorithm: 'HS256'
      })

      // create a refresh token (longer lived) and set as HttpOnly, Secure cookie
      const refreshToken = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: '30d', algorithm: 'HS256' })
      const cookieOptions: any = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      }

      res.cookie('refreshToken', refreshToken, cookieOptions)

      res.json({
        token: accessToken,
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

// Register (admin only)
router.post(
  "/register",
  [
    body("username").trim().notEmpty().withMessage("Username is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("full_name").trim().notEmpty().withMessage("Full name is required"),
    body("role").isIn(["admin", "user"]).withMessage("Invalid role"),
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

      // Insert user
      const result = await query(
        "INSERT INTO users (username, password, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, role",
        [username, hashedPassword, full_name, role],
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

// Refresh access token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = (req as any).cookies?.refreshToken || ''
    if (!refreshToken) return res.status(401).json({ error: 'no_refresh' })

    try {
      const payload = jwt.verify(refreshToken, REFRESH_SECRET, { algorithms: ['HS256'] }) as { id: number }
      const userId = payload.id
      // Verify user still exists
      const r = await query('SELECT id, username, role FROM users WHERE id = $1 LIMIT 1', [userId])
      if (r.rows.length === 0) return res.status(401).json({ error: 'invalid_refresh' })
      const user = r.rows[0]

      const accessToken = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '15m', algorithm: 'HS256' })

      // Optionally rotate refresh token: issue new cookie
      const newRefresh = jwt.sign({ id: user.id }, REFRESH_SECRET, { expiresIn: '30d', algorithm: 'HS256' })
      res.cookie('refreshToken', newRefresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })

      return res.json({ token: accessToken })
    } catch (e: any) {
      // token invalid or expired
      return res.status(401).json({ error: 'invalid_refresh' })
    }
  } catch (err: any) {
    console.error('Refresh token error:', err)
    return res.status(500).json({ error: 'Refresh failed' })
  }
})

// Logout: clear refresh cookie
router.post('/logout', async (_req: Request, res: Response) => {
  try {
    res.clearCookie('refreshToken', { path: '/api/auth' })
    res.json({ ok: true })
  } catch (err: any) {
    console.error('Logout error:', err)
    res.status(500).json({ error: 'Logout failed' })
  }
})

export default router
