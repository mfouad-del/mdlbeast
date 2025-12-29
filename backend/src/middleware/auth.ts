import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import type { AuthRequest } from "../types"

const JWT_SECRET = process.env.JWT_SECRET || ''

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).set('Cache-Control','no-store').json({ error: "Access token required" })
  }

  try {
    // Verify token with explicit algorithm requirement to avoid "none" or unexpected algorithms
    const tokenPayload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as { id: number; username?: string; role?: string }
    if (!tokenPayload?.id) return res.status(401).set('Cache-Control','no-store').json({ error: 'invalid_token' })
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
    // Handle expired token explicitly so clients can attempt refresh
    if (error && error.name === 'TokenExpiredError') {
      console.warn('Auth verify error: token expired')
      return res.status(401).set('Cache-Control', 'no-store').json({ error: 'token_expired' })
    }

    // Log details to aid debugging (do NOT log tokens)
    console.warn('Auth verify error:', error?.name || 'UnknownError', '-', error?.message || '')

    // If JWT secret is missing, return 500 so we can detect misconfiguration quickly
    if (!JWT_SECRET) {
      console.error('Auth verify failed: JWT_SECRET is not set')
      return res.status(500).json({ error: 'Server misconfiguration' })
    }

    // For known JWT errors (invalid signature, malformed), return 401 with a clear error code
    if (error && error.name === 'JsonWebTokenError') {
      // Do not include the raw message in production, but include a short code and set WWW-Authenticate to help some clients
      return res
        .status(401)
        .set('Cache-Control', 'no-store')
        .set('WWW-Authenticate', 'Bearer error="invalid_token"')
        .json({ error: 'invalid_token' })
    }

    // Fallback: treat as unauthorized and avoid caching
    return res.status(401).set('Cache-Control', 'no-store').json({ error: 'invalid_or_expired_token' })
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
