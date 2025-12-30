import express from "express"
import { authenticateToken, isAdmin, isManager } from "../middleware/auth"
import { query } from "../config/database"
import { logAudit } from "../services/auditService"

const router = express.Router()

// Get audit logs (Admin/Manager only)
router.get("/", authenticateToken, isManager, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100
    const offset = parseInt(req.query.offset as string) || 0
    
    // Join with users table to get usernames
    const sql = `
      SELECT a.*, u.username, u.name as full_name, u.role 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
    `
    
    const result = await query(sql, [limit, offset])
    res.json(result.rows)
  } catch (error) {
    console.error("Error fetching audit logs:", error)
    res.status(500).json({ error: "Failed to fetch audit logs" })
  }
})

// Record an action (Called from frontend)
router.post("/", authenticateToken, async (req: any, res) => {
  try {
    const { action, entityType, entityId, details } = req.body
    const userId = req.user?.id
    const ipAddress = req.ip || req.socket.remoteAddress
    const userAgent = req.headers['user-agent']

    await logAudit({
      userId,
      action,
      entityType,
      entityId,
      details,
      ipAddress: String(ipAddress),
      userAgent
    })

    res.json({ success: true })
  } catch (error) {
    console.error("Error recording audit log:", error)
    res.status(500).json({ error: "Failed to record log" })
  }
})

export default router
