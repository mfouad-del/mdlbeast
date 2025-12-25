import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import type { AuthRequest } from "../types"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this"

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Access token required" })
  }

  try {
    // Verify token and then load canonical user info from DB (ensures fresh role/tenant data)
    const tokenPayload = jwt.verify(token, JWT_SECRET) as { id: number; username?: string; role?: string }
    if (!tokenPayload?.id) return res.status(403).json({ error: 'Invalid token payload' })
    try {
      const db = await import('../config/database')
      const r = await db.query('SELECT id, username, role, tenant_id FROM users WHERE id = $1 LIMIT 1', [tokenPayload.id])
      if (r.rows.length === 0) return res.status(401).json({ error: 'User not found' })
      const u = r.rows[0]
      req.user = { id: u.id, username: u.username, role: u.role, tenant_id: u.tenant_id }
      next()
    } catch (dbErr: any) {
      console.error('Auth DB error:', dbErr)
      return res.status(500).json({ error: 'Auth verification failed' })
    }
  } catch (error) {
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
