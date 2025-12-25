import type { Request } from 'express'

const WEAK_SECRETS = new Set(['', 'your-secret-key-change-this', 'secret', 'changeme', 'password'])

export function validateEnv() {
  const jwt = process.env.JWT_SECRET || ''
  if (!jwt || WEAK_SECRETS.has(jwt)) {
    throw new Error('JWT_SECRET missing/weak')
  }
}

export function allowDebugAccess(req: Request, requireAdmin = false) {
  // If explicit flag set, allow
  if (String(process.env.ENABLE_DEBUG_ENDPOINTS || '').toLowerCase() === 'true') return true

  // Allow from localhost (127.0.0.1 or ::1)
  const ip = (req.ip || (req as any).connection?.remoteAddress || '').replace('::ffff:', '')
  if (ip === '127.0.0.1' || ip === '::1') return true

  // If a secret is supplied and matches DEBUG_SECRET, allow (useful for CI/ops) — but prefer flag or localhost
  const qs = (req.query?.secret as string) || ''
  const debugSecret = process.env.DEBUG_SECRET || ''
  if (debugSecret && qs && qs === debugSecret) return true

  // If requireAdmin and the request is authenticated with admin role, allow
  // Note: caller must ensure authenticateToken ran before (if relying on req.user)
  const user = (req as any).user
  if (requireAdmin && user && String(user.role || '').toLowerCase() === 'admin') return true

  return false
}

export function redactedEnvPresent(key: string) {
  // Returns boolean indicating presence of env var without exposing value
  return Boolean(process.env[key])
}
