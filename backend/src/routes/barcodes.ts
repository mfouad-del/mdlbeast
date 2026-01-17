import express from "express"
import { query } from "../config/database"
import type { Request, Response } from "express"
const router = express.Router()

// Get barcode details
router.get("/:barcode", async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params
    // Use case-insensitive match for barcode lookups
    let q = await query("SELECT * FROM barcodes WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
    // Fallback: try normalized forms (In-/Out-) if not found
    if (q.rows.length === 0) {
      const candidateIn = String(barcode).replace(/^IN-/i, 'In-')
      const candidateOut = String(barcode).replace(/^OUT-/i, 'Out-')
      const try1 = await query("SELECT * FROM barcodes WHERE lower(barcode) = lower($1) LIMIT 1", [candidateIn])
      if (try1.rows.length > 0) q = try1
      else {
        const try2 = await query("SELECT * FROM barcodes WHERE lower(barcode) = lower($1) LIMIT 1", [candidateOut])
        if (try2.rows.length > 0) q = try2
      }
    }

    if (q.rows.length === 0) {
      // fallback: check documents (existing older entries) and synthesize a response
      const d = await query('SELECT * FROM documents WHERE lower(barcode) = lower($1) LIMIT 1', [barcode])
      if (d.rows.length > 0) {
        const doc = d.rows[0]
        const synth = {
          barcode: doc.barcode,
          type: doc.type,
          status: doc.status,
          priority: doc.priority,
          subject: doc.subject,
          attachments: doc.attachments,
          user_id: doc.user_id,
          created_at: doc.created_at,
        }
        // try to insert into barcodes table for caching
        try {
          await query('INSERT INTO barcodes (barcode, type, status, priority, subject, attachments, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7)', [synth.barcode, synth.type, synth.status, synth.priority, synth.subject, JSON.stringify(synth.attachments || []), synth.user_id])
        } catch (e) {
          // ignore unique constraint etc
        }
        const pdfFile = Array.isArray(synth.attachments) && synth.attachments.length ? synth.attachments[0] : null
        return res.json({ ...synth, pdfFile })
      }
      return res.status(404).json({ error: 'Not found' })
    }
    // Ensure response includes pdfFile shortcut for UI
    const row = q.rows[0]
    try {
      const attachments = Array.isArray(row.attachments) ? row.attachments : (typeof row.attachments === 'string' ? JSON.parse(row.attachments || '[]') : [])
      row.attachments = attachments
      row.pdfFile = attachments.length ? attachments[0] : null
    } catch (e) {
      row.pdfFile = null
    }

    // Enrich with sender/receiver from documents table if available (helps when barcodes table lacks these fields)
    try {
      const docRes = await query('SELECT sender, receiver, date FROM documents WHERE lower(barcode) = lower($1) LIMIT 1', [barcode])
      if (docRes.rows.length > 0) {
        const d = docRes.rows[0]
        row.sender = row.sender || d.sender || null
        row.receiver = row.receiver || d.receiver || null
        row.date = row.date || d.date || null
      }
    } catch (e) {
      // ignore enrichment errors
    }

    res.json(row)
  } catch (err: any) {
    console.error("Get barcode error:", err)
    res.status(500).json({ error: "Failed to fetch barcode" })
  }
})

// Search (manual)
router.get("/", async (req: Request, res: Response) => {
  try {
    const qstr = (req.query.q as string) || ""
    const q = await query("SELECT * FROM barcodes WHERE barcode ILIKE $1 OR subject ILIKE $1 ORDER BY created_at DESC LIMIT 50", [`%${qstr}%`])
    // normalize attachments and add pdfFile shortcut
    const rows = q.rows.map((r: any) => {
      try {
        const attachments = Array.isArray(r.attachments) ? r.attachments : (typeof r.attachments === 'string' ? JSON.parse(r.attachments || '[]') : [])
        r.attachments = attachments
        r.pdfFile = attachments.length ? attachments[0] : null
      } catch (e) {
        r.pdfFile = null
      }
      return r
    })
    res.json(rows)
  } catch (err: any) {
    console.error("Search barcodes error:", err)
    res.status(500).json({ error: "Search failed" })
  }
})

// Get timeline for barcode
router.get("/:barcode/timeline", async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params
    const bc = await query("SELECT id FROM barcodes WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
    if (bc.rows.length === 0) return res.status(404).json({ error: "Not found" })
    const bcId = bc.rows[0].id
    const t = await query("SELECT id, actor_id, action, meta, created_at FROM barcode_timeline WHERE barcode_id = $1 ORDER BY created_at DESC", [bcId])
    res.json(t.rows)
  } catch (err: any) {
    console.error("Get timeline error:", err)
    res.status(500).json({ error: "Failed to fetch timeline" })
  }
})

// Add timeline entry
router.post("/:barcode/timeline", async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params
    const { action, actor_id, meta } = req.body

    // Find barcode entry; if missing, try to synthesize from documents (fallback)
    let bc = await query("SELECT id FROM barcodes WHERE barcode = $1 LIMIT 1", [barcode])
    if (bc.rows.length === 0) {
      console.warn('Barcode not found in barcodes table for timeline; attempting synth from documents for', barcode)
      const d = await query('SELECT * FROM documents WHERE lower(barcode) = lower($1) LIMIT 1', [barcode])
      if (d.rows.length > 0) {
        const doc = d.rows[0]
        try {
          const r = await query(
            `INSERT INTO barcodes (barcode, type, status, priority, subject, attachments, user_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
            [doc.barcode, doc.type, doc.status || null, doc.priority || null, doc.subject || null, JSON.stringify(doc.attachments || []), doc.user_id || null]
          )
          if (r.rows.length) bc = r
        } catch (e) {
          console.warn('Failed to synthesize barcode row from document:', e)
        }
      }
    }

    if (bc.rows.length === 0) return res.status(404).json({ error: "Not found" })

    const bcId = bc.rows[0].id
    console.log('Adding timeline entry', { barcode, bcId, action, actor_id })
    const ins = await query("INSERT INTO barcode_timeline (barcode_id, actor_id, action, meta) VALUES ($1,$2,$3,$4) RETURNING *", [bcId, actor_id, action, meta || {}])
    console.log('Inserted timeline id=', ins.rows[0].id)
    res.status(201).json(ins.rows[0])
  } catch (err: any) {
    console.error("Add timeline error:", err)
    res.status(500).json({ error: "Failed to add timeline" })
  }
})

export default router
