import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import type { AuthRequest } from "../types"

const JWT_SECRET = process.env.JWT_SECRET || ''

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Access token required" })
  }

  try {
    // Verify token with explicit algorithm requirement to avoid "none" or unexpected algorithms
    const tokenPayload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { id: number; username?: string; role?: string }
    if (!tokenPayload?.id) return res.status(403).json({ error: 'Invalid token payload' })
    try {
      const db = await import('../config/database')
      // Try a permissive fetch of the user row and then map columns safely
      const r = await db.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [tokenPayload.id])
      if (r.rows.length === 0) return res.status(401).json({ error: 'User not found' })
      const u = r.rows[0]

      // Normalize fields: prefer username, fall back to email or name
      const username = u.username || u.email || u.name || null
      const role = u.role || u.user_role || 'member'
      const tenant_id = ('tenant_id' in u) ? u.tenant_id : (u.tenant || null)

      req.user = { id: u.id, username, role, tenant_id }
      next()
    } catch (dbErr: any) {
      console.error('Auth DB error:', dbErr && dbErr.message ? dbErr.message : dbErr)
      return res.status(500).json({ error: 'Auth verification failed' })
    }
  } catch (error: any) {
    console.error('Auth verify error:', error && (error.message || error))
    return res.status(403).json({ error: "Invalid or expired token" })
  }
}

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" })
  }
  next()
}

export const isManager = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!(req.user && (req.user.role === 'manager' || req.user.role === 'admin'))) {
    return res.status(403).json({ error: 'Manager access required' })
  }
  next()
}
