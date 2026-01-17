import express from "express"
import type { Request, Response } from "express"
import { body, validationResult } from "express-validator"
import { query } from "../config/database"
import { authenticateToken } from "../middleware/auth"
import type { AuthRequest } from "../types"

const router = express.Router()

async function resolveAuthorizedPreviewUrl(params: { barcode: string; idx: number; user: any }): Promise<string> {
  const { barcode, idx, user } = params

  const docRes = await query("SELECT user_id, attachments FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
  if (docRes.rows.length === 0) {
    const err: any = new Error('Not found')
    err.status = 404
    throw err
  }

  const docRow = docRes.rows[0]
  const { canAccessDocument } = await import('../lib/rbac')
  if (!canAccessDocument(user, docRow)) {
    const err: any = new Error('Forbidden')
    err.status = 403
    throw err
  }

  let attachments: any = docRow.attachments
  try { if (typeof attachments === 'string') attachments = JSON.parse(attachments || '[]') } catch { attachments = Array.isArray(attachments) ? attachments : [] }
  if (!Array.isArray(attachments) || attachments.length === 0) {
    const err: any = new Error('No attachment')
    err.status = 404
    throw err
  }

  const pdf = attachments[idx] || attachments[0]
  if (!pdf) {
    const err: any = new Error('No attachment')
    err.status = 404
    throw err
  }

  const { USE_R2_ONLY } = await import('../config/storage')
  const supabaseUrl = USE_R2_ONLY ? '' : process.env.SUPABASE_URL
  const supabaseKeyRaw = USE_R2_ONLY ? '' : (process.env.SUPABASE_SERVICE_ROLE_KEY || '')
  const supabaseKey = String(supabaseKeyRaw).trim()
  const useR2 = String(process.env.STORAGE_PROVIDER || '').toLowerCase() === 'r2' || Boolean(process.env.CF_R2_ENDPOINT)

  if (useR2) {
    try {
      const { getSignedDownloadUrl } = await import('../lib/r2-storage')
      let key = pdf.key
      if (!key && pdf.url) {
        try {
          const u = new URL(String(pdf.url))
          const pathname = u.pathname.replace(/^\//, '')
          const bucket = (process.env.CF_R2_BUCKET || pdf.bucket || '').replace(/\/$/, '')
          if (bucket && pathname.startsWith(bucket + '/')) key = decodeURIComponent(pathname.slice(bucket.length + 1))
          else {
            const parts = pathname.split('/')
            if (parts.length > 1) key = decodeURIComponent(parts.slice(1).join('/'))
          }
        } catch { /* ignore */ }
      }
      if (key) return await getSignedDownloadUrl(String(key), 60 * 5)
    } catch (e) {
      console.warn('preview: R2 signed URL failed', e)
    }
  }

  if (USE_R2_ONLY && pdf.key && !useR2) {
    const err: any = new Error('R2-only storage configured but R2 is not configured')
    err.status = 500
    throw err
  }

  if (pdf.key && supabaseUrl && supabaseKey && pdf.bucket) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
      const { data: signedData, error: signedErr } = await supabase.storage.from(pdf.bucket).createSignedUrl(pdf.key, 60 * 5)
      if (!signedErr && signedData?.signedUrl) return signedData.signedUrl
    } catch (e) {
      console.warn('preview: supabase signed URL failed', e)
    }
  }

  if (pdf.url) return String(pdf.url)

  const err: any = new Error('No attachment')
  err.status = 404
  throw err
}

// All routes require authentication
router.use(authenticateToken)

// Authenticated JSON preview URL endpoint (returns { previewUrl })
router.get('/:barcode/preview-url', async (req: AuthRequest, res: Response) => {
  try {
    const { barcode } = req.params
    const idx = parseInt(String(req.query.idx || '0'), 10)
    const previewUrl = await resolveAuthorizedPreviewUrl({ barcode, idx, user: req.user })
    return res.json({ previewUrl })
  } catch (err: any) {
    const status = Number(err?.status) || 500
    if (status >= 500) console.error('preview-url error:', err)
    return res.status(status).json({ error: err?.message || 'Preview failed' })
  }
})

// Authenticated preview redirect route
router.get('/:barcode/preview', async (req: AuthRequest, res: Response) => {
  try {
    const { barcode } = req.params
    const idxNum = parseInt(String(req.query.idx || '0'), 10)
    const previewUrl = await resolveAuthorizedPreviewUrl({ barcode, idx: idxNum, user: req.user })
    return res.redirect(previewUrl)
  } catch (err: any) {
    const status = Number(err?.status) || 500
    if (status >= 500) console.error('preview error:', err)
    return res.status(status).send(err?.message || 'Preview failed')
  }
})

// Get all documents
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { status, type, search } = req.query
    const limitNum = Math.max(1, Math.min(1000, Number(req.query.limit ?? 100) || 100))
    const offsetNum = Math.max(0, Number(req.query.offset ?? 0) || 0)

    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'Not authenticated' })

    // Base WHERE clause and params shared by Count and Data queries
    let baseWhere = ` WHERE 1=1`
    const queryParams: any[] = []
    let paramCount = 1

    if (status) {
      baseWhere += ` AND status = $${paramCount}`
      queryParams.push(status)
      paramCount++
    }

    if (type) {
      baseWhere += ` AND type = $${paramCount}`
      queryParams.push(type)
      paramCount++
    }

    // Scope results based on user role (no tenant scoping exists in DB)
    if (user.role === 'admin' || user.role === 'manager' || user.role === 'supervisor') {
      // Can see all documents
    } else {
      // Member/other roles see their own documents only
      baseWhere += ` AND d.user_id = $${paramCount}`
      queryParams.push(user.id)
      paramCount++
    }

    if (search) {
      baseWhere += ` AND (barcode ILIKE $${paramCount} OR subject ILIKE $${paramCount} OR sender ILIKE $${paramCount} OR receiver ILIKE $${paramCount})`
      queryParams.push(`%${search}%`)
      paramCount++
    }

    // 1. Get Total Count
    // Note: We include the LEFT JOIN users just in case filter logic in future depends on it, although currently it depends on 'd'.
    // However, for pure performance if we only filter on 'd', we could omit the join. 
    // Given the simplicity, we keep the structure consistent.
    const countQuery = `SELECT COUNT(*) as total FROM documents d LEFT JOIN users u ON d.user_id = u.id ${baseWhere}`
    const countRes = await query(countQuery, queryParams)
    const total = parseInt(countRes.rows[0]?.total || '0', 10)

    // 2. Get Data
    const limitParamIndex = paramCount
    const offsetParamIndex = paramCount + 1
    const dataQueryParams = [...queryParams, limitNum, offsetNum]
    
    const dataQuery = `SELECT d.*, 
      u.full_name as created_by_name, 
      u.username as created_by_username 
      FROM documents d 
      LEFT JOIN users u ON d.user_id = u.id 
      ${baseWhere} 
      ORDER BY created_at DESC LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}`

    const result = await query(dataQuery, dataQueryParams)
    
    // attach pdfFile convenience property for UI convenience and compute a displayDate that merges date with creation time when date has midnight only
    const rows = result.rows.map((r: any) => {
      let attachments = r.attachments
      try {
        if (typeof attachments === 'string') attachments = JSON.parse(attachments || '[]')
      } catch (e) { attachments = Array.isArray(attachments) ? attachments : [] }
      const pdfFile = Array.isArray(attachments) && attachments.length ? attachments[0] : null

      // Compute displayDate: if date has time 00:00:00, combine date portion with created_at's time (safe, non-destructive)
      let displayDate = r.date
      try {
        if (r.date && r.created_at) {
          const d = new Date(r.date)
          if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
            const c = new Date(r.created_at)
            const combined = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), c.getUTCHours(), c.getUTCMinutes(), c.getUTCSeconds(), c.getUTCMilliseconds()))
            displayDate = combined.toISOString()
          }
        }
      } catch (e) { /* ignore and leave original date */ }

      return { ...r, attachments, pdfFile, displayDate, attachmentCount: r.attachment_count }
    })
    
    res.json({
      data: rows,
      meta: {
        total,
        page: Math.floor(offsetNum / limitNum) + 1,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    console.error("Get documents error:", error)
    res.status(500).json({ error: "Failed to fetch documents" })
  }
})

// Get document by barcode
router.get("/:barcode", async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params
    // case-insensitive lookup for barcode
    let result = await query("SELECT * FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])

    // Fallback: try normalized prefixes and legacy numeric forms if not found
    if (result.rows.length === 0) {
      const b = String(barcode || '')

      // If barcode looks like "1-00000001" or "2-00000001", try mapping to IN-/OUT- legacy prefix
      if (/^[12]-/.test(b)) {
        const mapped = b.replace(/^1-/, 'IN-').replace(/^2-/, 'OUT-')
        const tryMapped = await query("SELECT * FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [mapped])
        if (tryMapped.rows.length > 0) result = tryMapped
      }

      // If barcode is numeric-only (legacy), try padded and prefixed variants
      if (result.rows.length === 0 && /^\d+$/.test(b)) {
        const padded8 = String(b).padStart(8, '0')
        // try without prefix
        const tryPlain = await query("SELECT * FROM documents WHERE barcode = $1 LIMIT 1", [padded8])
        if (tryPlain.rows.length > 0) result = tryPlain
        // try with both prefixes
        if (result.rows.length === 0) {
          const tryIn = await query("SELECT * FROM documents WHERE barcode = $1 LIMIT 1", [`1-${padded8}`])
          if (tryIn.rows.length > 0) result = tryIn
        }
        if (result.rows.length === 0) {
          const tryOut = await query("SELECT * FROM documents WHERE barcode = $1 LIMIT 1", [`2-${padded8}`])
          if (tryOut.rows.length > 0) result = tryOut
        }
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" })
    }

    const row = result.rows[0]

    // Check if user can access this document using unified RBAC function
    const user = (req as any).user
    const { canAccessDocument } = await import('../lib/rbac')
    if (!canAccessDocument(user, row)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    let attachments = row.attachments
    try {
      if (typeof attachments === 'string') attachments = JSON.parse(attachments || '[]')
    } catch (e) { attachments = Array.isArray(attachments) ? attachments : [] }
    const pdfFile = Array.isArray(attachments) && attachments.length ? attachments[0] : null

    // Compute displayDate: if stored date is midnight-only, combine date's day with created_at's time
    let displayDate = row.date
    try {
      if (row.date && row.created_at) {
        const d = new Date(row.date)
        if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
          const c = new Date(row.created_at)
          const combined = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), c.getUTCHours(), c.getUTCMinutes(), c.getUTCSeconds(), c.getUTCMilliseconds()))
          displayDate = combined.toISOString()
        }
      }
    } catch (e) {}

    res.json({ ...row, attachments, pdfFile, displayDate, attachmentCount: row.attachment_count })
  } catch (error) {
    console.error("Get document error:", error)
    res.status(500).json({ error: "Failed to fetch document" })
  }
})

import { DocumentService } from '../services/documentService'
const docService = new DocumentService()

// Create document
router.post(
  "/",
  [
    // Accept both server-side 'type' (document type) and client-side direction flag (INCOMING/OUTGOING) as optional
    body("type").optional().trim(),
    body("sender").trim().notEmpty().withMessage("Sender is required"),
    body("receiver").optional().trim(),
    body("recipient").optional().trim(),
    body("documentDate").optional().isISO8601().withMessage("Valid documentDate is required"),
    body("date").optional().isISO8601().withMessage("Valid date is required"),
    body("subject").optional().trim(),
    body("title").optional().trim(),
    body("priority").optional().isIn(["عادي", "عاجل", "عاجل جداً"]).withMessage("Invalid priority"),
    body("status").optional().isIn(["وارد", "صادر", "محفوظ"]).withMessage("Invalid status"),
  ],
  async (req: AuthRequest, res: Response) => {
    // Ensure only allowed roles can create
    const allowed = ['member','supervisor','manager','admin']
    const user = req.user
    if (!user || !allowed.includes(String(user.role))) return res.status(403).json({ error: 'Insufficient role to create documents' })
    
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), message: 'Validation failed' })
    }

    try {
      let attachments = req.body.attachments
      // Accept pdfFile as a shortcut from client (if provided during create)
      if ((!attachments || !Array.isArray(attachments) || attachments.length === 0) && req.body.pdfFile) {
        req.body.attachments = [req.body.pdfFile]
      }

      const newDoc = await docService.create(req.body, user)

      // include attachments array as JSONB and return pdfFile shortcut for convenience
      let finalAttachments = newDoc.attachments
      try {
        if (typeof finalAttachments === 'string') finalAttachments = JSON.parse(finalAttachments)
      } catch (e) { finalAttachments = Array.isArray(finalAttachments) ? finalAttachments : [] }
      const pdfAttachment = (finalAttachments && Array.isArray(finalAttachments) && finalAttachments[0]) ? finalAttachments[0] : null
      const responseDoc = { ...newDoc, attachments: finalAttachments, pdfFile: pdfAttachment }

      res.status(201).json(responseDoc)
    } catch (error: any) {
      console.error("Create document error:", error)
      if (error.message === 'Barcode already exists') return res.status(400).json({ error: "Barcode already exists" })
         if (error.message === 'Direction (type) is required to generate barcode') return res.status(400).json({ error: "Direction (type) is required to generate barcode" })
      res.status(500).json({ error: "Failed to create document" })
    }
  },
)

// Update document
router.put("/:barcode", async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params
    const authReq = req as any
    const updated = await docService.update(barcode, req.body, authReq.user)

    let attachments = updated.attachments
    try {
      if (typeof attachments === 'string') attachments = JSON.parse(attachments || '[]')
    } catch (e) { attachments = Array.isArray(attachments) ? attachments : [] }
    const pdfFile = Array.isArray(attachments) && attachments.length ? attachments[0] : null

    res.json({ ...updated, attachments, pdfFile })
  } catch (error: any) {
    console.error("Update document error:", error)
    if (error.message === 'Document not found') return res.status(404).json({ error: "Document not found" })
    if (error.message === 'Forbidden') return res.status(403).json({ error: "You do not have permission to edit this document" })
    res.status(500).json({ error: "Failed to update document" })
  }
})

// Delete document
router.delete("/:barcode", async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params
    const existing = await query("SELECT * FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Document not found' })
    const doc = existing.rows[0]
    const authReq = req as any
    const user = authReq.user
    
    // Strict Admin-only check for deletion
    if (user?.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can delete documents' })
    }

    const { canAccessDocument } = await import('../lib/rbac')
    if (!canAccessDocument(user, doc)) return res.status(403).json({ error: 'Forbidden' })

    const result = await query("DELETE FROM documents WHERE lower(barcode) = lower($1) RETURNING *", [barcode])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" })
    }

    res.json({ message: "Document deleted successfully" })
  } catch (error) {
    console.error("Delete document error:", error)
    res.status(500).json({ error: "Failed to delete document" })
  }
})

// Get statistics
router.get("/stats/summary", async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'وارد' OR type ILIKE 'IN%' OR barcode ILIKE 'IN-%') as incoming,
        COUNT(*) FILTER (WHERE status = 'صادر' OR type ILIKE 'OUT%' OR barcode ILIKE 'OUT-%') as outgoing,
        COUNT(*) FILTER (WHERE status = 'محفوظ') as archived,
        COUNT(*) FILTER (WHERE priority = 'عاجل جداً') as urgent
      FROM documents
    `)

    res.json(result.rows[0])
  } catch (error) {
    console.error("Get stats error:", error)
    res.status(500).json({ error: "Failed to fetch statistics" })
  }
})

// Delete attachment - available to all authenticated users
router.delete("/:id/attachments/:index", async (req: AuthRequest, res: Response) => {
  const user = req.user
  if (!user) return res.status(401).json({ error: "Unauthorized" })

  const { id, index } = req.params
  const attachmentIndex = parseInt(index, 10)

  if (isNaN(attachmentIndex) || attachmentIndex < 0) {
    return res.status(400).json({ error: "Invalid attachment index" })
  }

  try {
    // Get current document
    const docResult = await query("SELECT * FROM documents WHERE id = $1", [id])
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" })
    }

    const doc = docResult.rows[0]
    const attachments = doc.attachments || []

    if (attachmentIndex >= attachments.length) {
      return res.status(404).json({ error: "Attachment not found" })
    }

    // Remove attachment from array
    const deletedAttachment = attachments[attachmentIndex]
    attachments.splice(attachmentIndex, 1)

    // Update document with new attachments array
    await query(
      "UPDATE documents SET attachments = $1, attachment_count = $2 WHERE id = $3",
      [JSON.stringify(attachments), attachments.length, id]
    )

    // Log in audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        "delete_attachment",
        "DOCUMENT",
        doc.barcode,
        JSON.stringify({
          document_id: id,
          barcode: doc.barcode,
          attachment_index: attachmentIndex,
          attachment_url: deletedAttachment,
          remaining_attachments: attachments.length
        })
      ]
    )

    res.json({ 
      message: "Attachment deleted successfully",
      attachments,
      attachmentCount: attachments.length
    })
  } catch (error) {
    console.error("Delete attachment error:", error)
    res.status(500).json({ error: "Failed to delete attachment" })
  }
})

export default router
