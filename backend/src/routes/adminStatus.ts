import express from 'express'
import type { Request, Response } from 'express'
import { isAdmin, authenticateToken } from '../middleware/auth'
import { query } from '../config/database'
import fs from 'fs'
import path from 'path'
import { logBuffer } from '../lib/logBuffer'

const router = express.Router()

router.use(authenticateToken)
router.use(isAdmin)

router.get('/', async (req: Request, res: Response) => {
  try {
    // basic health
    const uptime = process.uptime()
    let dbOk = false
    try {
      const r = await query('SELECT 1 as ok')
      dbOk = !!(r && r.rows && r.rows.length)
    } catch (e) {
      dbOk = false
    }

    const pkg = (() => {
      try { return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) } catch(e) { return { version: 'unknown' } }
    })()

    const info = {
      healthy: dbOk,
      uptime_seconds: uptime,
      version: pkg.version || 'unknown',
      env: {
        r2_configured: !!(process.env.CF_R2_ACCESS_KEY_ID && process.env.CF_R2_SECRET_ACCESS_KEY && process.env.CF_R2_BUCKET),
        supabase_configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
        backups_enabled: !!(process.env.BACKUPS_ENABLED && process.env.BACKUPS_ENABLED !== 'false')
      },
      logs: logBuffer.tail(500),
      at: new Date().toISOString(),
    }

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.json(info)
  } catch (err: any) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.status(500).json({ error: err?.message || String(err) })
  }
})

// Clear logs (admin only)
router.post('/clear', async (req: Request, res: Response) => {
  try {
    logBuffer.clear()
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) })
  }
})

export default router
