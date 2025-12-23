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
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, type, search, limit = 100, offset = 0 } = req.query

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
router.get("/:barcode", async (req, res) => {
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
    body("barcode").trim().notEmpty().withMessage("Barcode is required"),
    body("type").trim().notEmpty().withMessage("Type is required"),
    body("sender").trim().notEmpty().withMessage("Sender is required"),
    body("receiver").trim().notEmpty().withMessage("Receiver is required"),
    body("date").isISO8601().withMessage("Valid date is required"),
    body("subject").trim().notEmpty().withMessage("Subject is required"),
    body("priority").isIn(["عادي", "عاجل", "عاجل جداً"]).withMessage("Invalid priority"),
    body("status").isIn(["وارد", "صادر", "محفوظ"]).withMessage("Invalid status"),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    try {
      const authReq = req as AuthRequest
      const {
        barcode,
        type,
        sender,
        receiver,
        date,
        subject,
        priority,
        status,
        classification,
        notes,
        attachments = [],
      } = req.body

      // Check if barcode exists
      const existing = await query("SELECT id FROM documents WHERE barcode = $1", [barcode])

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "Barcode already exists" })
      }

      const result = await query(
        `INSERT INTO documents (barcode, type, sender, receiver, date, subject, priority, status, classification, notes, attachments, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          barcode,
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
          authReq.user?.id,
        ],
      )

      res.status(201).json(result.rows[0])
    } catch (error) {
      console.error("Create document error:", error)
      res.status(500).json({ error: "Failed to create document" })
    }
  },
)

// Update document
router.put("/:barcode", async (req, res) => {
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
router.delete("/:barcode", async (req, res) => {
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
router.get("/stats/summary", async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'وارد') as incoming,
        COUNT(*) FILTER (WHERE status = 'صادر') as outgoing,
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
