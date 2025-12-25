import express from "express"
import type { Request, Response } from "express"
import { query } from "../config/database"
import { authenticateToken, isAdmin, isManager } from "../middleware/auth"
import type { AuthRequest } from "../types"

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// Get all users (manager or admin only)
router.get("/", isManager, async (req: AuthRequest, res: Response) => {
  try {
    // detect schema columns and pick safe select
    const hasEmail = (await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email' LIMIT 1")).rows.length > 0
    const hasName = (await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'name' LIMIT 1")).rows.length > 0

    let select = "id, username AS username, full_name AS full_name, role, created_at"
    if (hasEmail && hasName) select = "id, email AS username, name AS full_name, role, created_at"
    else if (hasEmail) select = "id, email AS username, full_name AS full_name, role, created_at"
    else if (hasName) select = "id, username AS username, name AS full_name, role, created_at"

    const result = await query(`SELECT ${select} FROM users ORDER BY created_at DESC`)
    res.json(result.rows)
  } catch (error) {
    console.error("Get users error:", error)
    res.status(500).json({ error: "Failed to fetch users" })
  }
})

// Create user (manager or admin only)
router.post("/", isManager, async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, full_name, role } = req.body
    if (!username || !password || !full_name || !role) return res.status(400).json({ error: 'Missing fields' })

    const exists = await query('SELECT id FROM users WHERE username = $1 LIMIT 1', [username])
    if (exists.rows.length) return res.status(400).json({ error: 'Username exists' })

    const hashed = await import('bcrypt').then(b => b.hash(password, 10))
    const ins = await query('INSERT INTO users (username, password, full_name, role) VALUES ($1,$2,$3,$4) RETURNING id, username, full_name, role, created_at', [username, hashed, full_name, role])
    res.status(201).json(ins.rows[0])
  } catch (err: any) {
    console.error('Create user error:', err)
    res.status(500).json({ error: 'Failed to create user' })
  }
})

// Update user (manager or admin only)
router.put('/:id', isManager, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { full_name, role, password } = req.body
    const parts: string[] = []
    const values: any[] = []
    let idx = 1
    if (full_name) { parts.push(`full_name = $${idx++}`); values.push(full_name) }
    if (role) { parts.push(`role = $${idx++}`); values.push(role) }
    if (password) { const h = await import('bcrypt').then(b => b.hash(password, 10)); parts.push(`password = $${idx++}`); values.push(h) }
    if (!parts.length) return res.status(400).json({ error: 'No updates provided' })
    values.push(id)
    const q = `UPDATE users SET ${parts.join(', ')} WHERE id = $${idx} RETURNING id, username, full_name, role, created_at`
    const r = await query(q, values)
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' })
    res.json(r.rows[0])
  } catch (err: any) {
    console.error('Update user error:', err)
    res.status(500).json({ error: 'Failed to update user' })
  }
})

// Delete user (manager or admin only)
router.delete('/:id', isManager, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const r = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id])
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' })
    res.json({ deleted: 1 })
  } catch (err: any) {
    console.error('Delete user error:', err)
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

// Get current user
router.get("/me", async (req: AuthRequest, res: Response) => {
  try {
    const authReq = req

    const hasEmail = (await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email' LIMIT 1")).rows.length > 0
    const hasName = (await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'name' LIMIT 1")).rows.length > 0

    let select = "id, username AS username, full_name AS full_name, role, created_at"
    if (hasEmail && hasName) select = "id, email AS username, name AS full_name, role, created_at"
    else if (hasEmail) select = "id, email AS username, full_name AS full_name, role, created_at"
    else if (hasName) select = "id, username AS username, name AS full_name, role, created_at"

    const result = await query(`SELECT ${select} FROM users WHERE id = $1`, [authReq.user?.id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error("Get user error:", error)
    res.status(500).json({ error: "Failed to fetch user" })
  }
})

export default router
