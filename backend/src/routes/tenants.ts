import express from "express"
import { query } from "../config/database"
import type { Request, Response } from "express"
const router = express.Router()

// Create tenant
router.post("/", isAdmin, async (req: Request, res: Response) => {
  try {
    const { name, slug, logo_url } = req.body
    const ins = await query("INSERT INTO tenants (name, slug, logo_url) VALUES ($1,$2,$3) RETURNING *", [name, slug, logo_url])
    res.status(201).json(ins.rows[0])
  } catch (err: any) {
    console.error("Create tenant error:", err)
    res.status(500).json({ error: "Failed to create tenant" })
  }
})

// List tenants
router.get("/", async (_req: Request, res: Response) => {
  try {
    const r = await query("SELECT * FROM tenants ORDER BY created_at DESC")
    res.json(r.rows)
  } catch (err: any) {
    console.error("List tenants error:", err)
    res.status(500).json({ error: "Failed to list tenants" })
  }
})

// Update tenant
router.put('/:id', isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, slug, logo_url } = req.body
    const r = await query('UPDATE tenants SET name = $1, slug = $2, logo_url = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *', [name, slug, logo_url, id])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Tenant not found' })
    res.json(r.rows[0])
  } catch (err: any) {
    console.error('Update tenant error:', err)
    res.status(500).json({ error: 'Failed to update tenant' })
  }
})

// Delete tenant
router.delete('/:id', isAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const r = await query('DELETE FROM tenants WHERE id = $1 RETURNING id', [id])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Tenant not found' })
    res.json({ deleted: 1 })
  } catch (err: any) {
    console.error('Delete tenant error:', err)
    res.status(500).json({ error: 'Failed to delete tenant' })
  }
})

export default router
