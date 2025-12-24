import express from "express"
import type { Request, Response } from "express"
import { body, validationResult } from "express-validator"
import { query } from "../config/database"
import { authenticateToken } from "../middleware/auth"
import type { AuthRequest } from "../types"

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// Get all documents
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { status, type, search, limit = 100, offset = 0, tenant_id } = req.query

    let queryText = "SELECT * FROM documents WHERE 1=1"
    const queryParams: any[] = []
    let paramCount = 1

    if (status) {
      queryText += ` AND status = $${paramCount}`
      queryParams.push(status)
      paramCount++
    }

    if (type) {
      queryText += ` AND type = $${paramCount}`
      queryParams.push(type)
      paramCount++
    }

    if (tenant_id) {
      queryText += ` AND tenant_id = $${paramCount}`
      queryParams.push(Number(tenant_id))
      paramCount++
    }

    if (search) {
      queryText += ` AND (barcode ILIKE $${paramCount} OR subject ILIKE $${paramCount} OR sender ILIKE $${paramCount} OR receiver ILIKE $${paramCount})`
      queryParams.push(`%${search}%`)
      paramCount++
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`
    queryParams.push(limit, offset)

    const result = await query(queryText, queryParams)
    res.json(result.rows)
  } catch (error) {
    console.error("Get documents error:", error)
    res.status(500).json({ error: "Failed to fetch documents" })
  }
})

// Get document by barcode
router.get("/:barcode", async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params
    const result = await query("SELECT * FROM documents WHERE barcode = $1", [barcode])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error("Get document error:", error)
    res.status(500).json({ error: "Failed to fetch document" })
  }
})

// Create document
router.post(
  "/",
  [
    // Accept both server-side 'type' (document type) and client-side direction flag (INCOMING/OUTGOING) as optional
    body("type").optional().trim(),
    // Accept aliases from the client form (title -> subject, recipient -> receiver, documentDate -> date)
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
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      // Log request body and validation errors to help debugging
      try { console.warn('Create document request body:', JSON.stringify(req.body).slice(0, 1000)) } catch(e) {}
      console.warn('Create document validation failed:', errors.array())
      return res.status(400).json({ errors: errors.array(), message: 'Validation failed' })
    }

    try {
      const authReq = req
      let {
        barcode,
        type,
        sender,
        receiver,
        recipient,
        date,
        documentDate,
        title,
        subject,
        priority,
        status,
        classification,
        notes,
        attachments = [],
        tenant_id = null,
      } = req.body

      // Accept pdfFile as a shortcut from client (if provided during create)
      if ((!attachments || !Array.isArray(attachments) || attachments.length === 0) && req.body.pdfFile) {
        attachments = [req.body.pdfFile]
      }

      // Normalize aliases sent by the client
      const finalReceiver = receiver || recipient || ''
      const finalSubject = subject || title || ''
      const finalDate = date || documentDate || new Date().toISOString().split('T')[0]

      // Determine direction from provided 'type' or barcode prefix (flexible)
      let direction: 'INCOMING' | 'OUTGOING' | null = null
      if (typeof type === 'string') {
        if (String(type).toUpperCase() === 'INCOMING' || String(type).toLowerCase().includes('in')) direction = 'INCOMING'
        else if (String(type).toUpperCase() === 'OUTGOING' || String(type).toLowerCase().includes('out')) direction = 'OUTGOING'
      }
      if (!direction && barcode && typeof barcode === 'string') {
        if (barcode.toUpperCase().startsWith('IN')) direction = 'INCOMING'
        else if (barcode.toUpperCase().startsWith('OUT')) direction = 'OUTGOING'
      }

      // Default status based on direction if not provided
      const finalStatus = status || (direction === 'INCOMING' ? 'وارد' : (direction === 'OUTGOING' ? 'صادر' : 'محفوظ'))

      // If no barcode provided, generate a numeric sequential barcode server-side
      if (!barcode) {
        if (!direction) return res.status(400).json({ error: 'Direction (type) is required to generate barcode' })
        const seqName = direction === 'INCOMING' ? 'doc_in_seq' : 'doc_out_seq'
        // Try to get next value, if sequence is missing create it and retry
        let n: number
        try {
          const seqRes = await query(`SELECT nextval('${seqName}') as n`)
          n = seqRes.rows[0].n
        } catch (seqErr: any) {
          console.warn('Sequence missing or nextval failed:', seqErr?.message || seqErr)
          try {
            await query("CREATE SEQUENCE IF NOT EXISTS doc_in_seq START 1")
            await query("CREATE SEQUENCE IF NOT EXISTS doc_out_seq START 1")
            const seqRes2 = await query(`SELECT nextval('${seqName}') as n`)
            n = seqRes2.rows[0].n
          } catch (seqErr2: any) {
            console.error('Failed to create or get sequence value:', seqErr2)
            return res.status(500).json({ error: 'Failed to generate barcode sequence' })
          }
        }

        const dirIndex = direction === 'INCOMING' ? 0 : 1
        barcode = `${direction === 'INCOMING' ? 'In' : 'out'}-${dirIndex}-${String(n).padStart(7, '0')}`
      }

      // Check if barcode exists
      const existing = await query("SELECT id FROM documents WHERE barcode = $1", [barcode])

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "Barcode already exists" })
      }

      // Insert document with optional tenant_id
      const dbType = (typeof type === 'string' && type) ? type : (direction || 'UNKNOWN')
      const result = await query(
        `INSERT INTO documents (barcode, type, sender, receiver, date, subject, priority, status, classification, notes, attachments, user_id, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          barcode,
          dbType,
          sender,
          finalReceiver,
          finalDate,
          finalSubject,
          priority || 'عادي',
          finalStatus,
          classification,
          notes,
          JSON.stringify(attachments || []),
          authReq.user?.id,
          tenant_id,
        ],
      )

      // Ensure barcodes table has an entry for this barcode so scanner works
      try {
        const bc = await query("SELECT id FROM barcodes WHERE barcode = $1 LIMIT 1", [barcode])
        if (bc.rows.length === 0) {
          await query(
            `INSERT INTO barcodes (barcode, type, status, priority, subject, attachments, user_id, tenant_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [barcode, dbType, finalStatus || null, priority || null, finalSubject || null, JSON.stringify(attachments || []), authReq.user?.id, tenant_id || null],
          )
        }
      } catch (e) {
        console.warn('Failed to ensure barcode entry:', e)
      }

      // include attachments array as JSONB and return pdfFile shortcut
      const docRow = result.rows[0]
      const pdfAttachment = (docRow.attachments && Array.isArray(docRow.attachments) && docRow.attachments[0]) ? docRow.attachments[0] : null
      const responseDoc = { ...docRow, pdfFile: pdfAttachment }

      res.status(201).json(responseDoc)
    } catch (error) {
      console.error("Create document error:", error)
      res.status(500).json({ error: "Failed to create document" })
    }
  },
)

// Update document
router.put("/:barcode", async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params
    const { type, sender, receiver, date, subject, priority, status, classification, notes, attachments } = req.body

    const result = await query(
      `UPDATE documents 
       SET type = $1, sender = $2, receiver = $3, date = $4, subject = $5, 
           priority = $6, status = $7, classification = $8, notes = $9, attachments = $10
       WHERE barcode = $11
       RETURNING *`,
      [
        type,
        sender,
        receiver,
        date,
        subject,
        priority,
        status,
        classification,
        notes,
        JSON.stringify(attachments),
        barcode,
      ],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error("Update document error:", error)
    res.status(500).json({ error: "Failed to update document" })
  }
})

// Delete document
router.delete("/:barcode", async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params
    const result = await query("DELETE FROM documents WHERE barcode = $1 RETURNING *", [barcode])

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
        COUNT(*) FILTER (WHERE status = 'وارد' OR type ILIKE '%IN%' OR barcode ILIKE 'IN-%') as incoming,
        COUNT(*) FILTER (WHERE status = 'صادر' OR type ILIKE '%OUT%' OR barcode ILIKE 'OUT-%') as outgoing,
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

export default router
