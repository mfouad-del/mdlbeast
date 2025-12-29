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
    const { full_name, role, password, email } = req.body

    // Only admins may change email addresses
    if (typeof email !== 'undefined' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required to change email' })
    }

    const parts: string[] = []
    const values: any[] = []
    let idx = 1
    if (full_name) { parts.push(`full_name = $${idx++}`); values.push(full_name) }
    if (role) { parts.push(`role = $${idx++}`); values.push(role) }
    if (typeof email !== 'undefined') {
      // basic validation
      if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ error: 'invalid_email' })
      }
      // ensure uniqueness
      const exists = await query('SELECT id FROM users WHERE (email = $1 OR username = $1) AND id != $2 LIMIT 1', [email, id])
      if (exists.rows.length) return res.status(400).json({ error: 'email_in_use' })
      parts.push(`email = $${idx++}`); values.push(email)
      // keep username in sync if present
      parts.push(`username = $${idx++}`); values.push(email)
    }
    if (password) { const h = await import('bcrypt').then(b => b.hash(password, 10)); parts.push(`password = $${idx++}`); values.push(h) }
    if (!parts.length) return res.status(400).json({ error: 'No updates provided' })
    values.push(id)
    const q = `UPDATE users SET ${parts.join(', ')} WHERE id = $${idx} RETURNING id, username, full_name, role, email, created_at`
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

// Change own password
router.post('/me/password', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    const { current_password, new_password } = req.body
    if (!userId) return res.status(401).json({ error: 'unauthorized' })
    if (!new_password || typeof new_password !== 'string' || new_password.length < 6) return res.status(400).json({ error: 'invalid_new_password' })
    if (!current_password || typeof current_password !== 'string') return res.status(400).json({ error: 'current_password_required' })

    const r = await query('SELECT id, password FROM users WHERE id = $1 LIMIT 1', [userId])
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' })
    const user = r.rows[0]

    const bcrypt = await import('bcrypt')
    const ok = await bcrypt.compare(current_password, user.password)
    if (!ok) return res.status(401).json({ error: 'invalid_current_password' })

    const hashed = await bcrypt.hash(new_password, 10)
    await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, userId])
    res.json({ ok: true })
  } catch (err: any) {
    console.error('Change password error:', err)
    res.status(500).json({ error: 'Failed to change password' })
  }
})

// Admin/manager: set another user's password without current password
router.post('/:id/password', isManager, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { new_password } = req.body
    if (!new_password || typeof new_password !== 'string' || new_password.length < 6) return res.status(400).json({ error: 'invalid_new_password' })

    const bcrypt = await import('bcrypt')
    const hashed = await bcrypt.hash(new_password, 10)
    const r = await query('UPDATE users SET password = $1 WHERE id = $2 RETURNING id, username', [hashed, id])
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' })
    res.json({ ok: true })
  } catch (err: any) {
    console.error('Admin set password error:', err)
    res.status(500).json({ error: 'Failed to set password' })
  }
})

export default router
