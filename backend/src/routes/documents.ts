import express from "express"
import type { Request, Response } from "express"
import { body, validationResult } from "express-validator"
import { query } from "../config/database"
import { authenticateToken } from "../middleware/auth"
import type { AuthRequest } from "../types"

const router = express.Router()

// Public JSON preview URL endpoint (no auth) - returns { previewUrl }
router.get('/:barcode/preview-url', async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params
    const r = await query("SELECT attachments FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    let attachments: any = r.rows[0].attachments
    try { if (typeof attachments === 'string') attachments = JSON.parse(attachments || '[]') } catch (e) { attachments = Array.isArray(attachments) ? attachments : [] }
    if (!attachments || !attachments.length) return res.status(404).json({ error: 'No attachment' })
    const pdf = attachments[0]

    const supabaseUrl = (await import('../config/storage')).USE_R2_ONLY ? '' : process.env.SUPABASE_URL
    const supabaseKeyRaw = (await import('../config/storage')).USE_R2_ONLY ? '' : (process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    const supabaseKey = String(supabaseKeyRaw).trim()

    // Prefer signed URL when possible
    const useR2 = String(process.env.STORAGE_PROVIDER || '').toLowerCase() === 'r2' || Boolean(process.env.CF_R2_ENDPOINT)

    if (useR2 && pdf.key && (process.env.CF_R2_BUCKET || '')) {
      try {
        const { getSignedDownloadUrl, getPublicUrl } = await import('../lib/r2-storage')
        try {
          const signed = await getSignedDownloadUrl(pdf.key, 60 * 5)
          return res.json({ previewUrl: signed })
        } catch (e) {
          // fallback to public URL
          try { return res.json({ previewUrl: getPublicUrl(pdf.key) }) } catch (err) {}
        }
      } catch (e) {
        console.warn('R2 preview-url error:', e)
      }
    }

    const { USE_R2_ONLY } = await import('../config/storage')
    if (USE_R2_ONLY && pdf.key && !(useR2 && (process.env.CF_R2_BUCKET || ''))) {
      // Server is configured to use R2-only storage but this attachment does not appear to be in R2
      return res.status(500).json({ error: 'Server is configured for R2-only storage and this object is not in R2. Contact the administrator.' })
    }

    if (pdf.key && supabaseUrl && supabaseKey && pdf.bucket) {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
        const { data: signedData, error: signedErr } = await supabase.storage.from(pdf.bucket).createSignedUrl(pdf.key, 60 * 5)
        if (!signedErr && signedData?.signedUrl) {
          return res.json({ previewUrl: signedData.signedUrl })
        }
        const publicRes = supabase.storage.from(pdf.bucket).getPublicUrl(pdf.key) as any
        if (publicRes && publicRes.data && publicRes.data.publicUrl) return res.json({ previewUrl: publicRes.data.publicUrl })
      } catch (e) {
        console.warn('Preview-url signed URL error:', e)
      }
    }

    if (pdf.url) return res.json({ previewUrl: pdf.url })

    res.status(404).json({ error: 'No attachment' })
  } catch (err: any) {
    console.error('Preview-url error:', err)
    res.status(500).json({ error: 'Preview failed' })
  }
})

// Public preview route (no auth) so browser can open attachment previews directly
router.get('/:barcode/preview', async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params
    const r = await query("SELECT attachments FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
    if (r.rows.length === 0) return res.status(404).send('Not found')
    let attachments: any = r.rows[0].attachments
    try { if (typeof attachments === 'string') attachments = JSON.parse(attachments || '[]') } catch (e) { attachments = Array.isArray(attachments) ? attachments : [] }
    if (!attachments || !attachments.length) return res.status(404).send('No attachment')
    const pdf = attachments[0]

    const supabaseUrl = (await import('../config/storage')).USE_R2_ONLY ? '' : process.env.SUPABASE_URL
    const supabaseKeyRaw = (await import('../config/storage')).USE_R2_ONLY ? '' : (process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    const supabaseKey = String(supabaseKeyRaw).trim()

    // Prefer Cloudflare R2 signed URLs when using R2
    const useR2 = String(process.env.STORAGE_PROVIDER || '').toLowerCase() === 'r2' || Boolean(process.env.CF_R2_ENDPOINT)
    if (useR2) {
      try {
        const { getSignedDownloadUrl, getPublicUrl } = await import('../lib/r2-storage')
        // If we have explicit key, use it. Otherwise attempt to derive key from pdf.url
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
          } catch (e) { /* ignore */ }
        }

        if (key) {
          try {
            const signed = await getSignedDownloadUrl(key, 60 * 5)
            if (req.path.endsWith('/preview-url')) return res.json({ previewUrl: signed })
            return res.redirect(signed)
          } catch (err) {
            // fallback to public URL
            try {
              const publicUrl = getPublicUrl(key)
              if (req.path.endsWith('/preview-url')) return res.json({ previewUrl: publicUrl })
              return res.redirect(publicUrl)
            } catch (err2) {}
          }
        }
      } catch (e) {
        console.warn('R2 preview redirect error:', e)
      }
    }

    const { USE_R2_ONLY } = await import('../config/storage')
    // If we have a bucket/key, try to create a signed URL first for supabase
    if (USE_R2_ONLY && pdf.key && !(useR2 && (process.env.CF_R2_BUCKET || ''))) {
      return res.status(500).send('Server is configured for R2-only storage and this object is not in R2. Contact the administrator.')
    }

    if (pdf.key && supabaseUrl && supabaseKey && pdf.bucket) {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
        const { data: signedData, error: signedErr } = await supabase.storage.from(pdf.bucket).createSignedUrl(pdf.key, 60 * 5)
        const newUrl = (signedData && signedData.signedUrl) ? signedData.signedUrl : (supabase.storage.from(pdf.bucket).getPublicUrl(pdf.key) as any)?.data?.publicUrl
        if (newUrl) {
          // Provide JSON endpoint for clients that prefer to open the signed URL directly
          if (req.path.endsWith('/preview-url')) return res.json({ previewUrl: newUrl })
          return res.redirect(newUrl)
        }
      } catch (e) {
        console.warn('Public preview signed URL error (continuing to public url):', e)
      }
    }

    // Fallback: use public URL with cache-busting query
    if (pdf.url) {
      const sep = pdf.url.includes('?') ? '&' : '?'
      const final = `${pdf.url}${sep}t=${Date.now()}`
      if (req.path.endsWith('/preview-url')) return res.json({ previewUrl: final })
      return res.redirect(final)
    }

    res.status(404).send('No attachment')
  } catch (err: any) {
    console.error('Public preview error:', err)
    res.status(500).send('Preview failed')
  }
})

// All routes require authentication
router.use(authenticateToken)

// Get all documents
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { status, type, search, limit = 100, offset = 0 } = req.query

    const user = (req as any).user

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

    // Scope results according to role: members see only their own docs; supervisors/managers see tenant docs; admin sees all
    if (!user) return res.status(401).json({ error: 'Not authenticated' })
    if (user.role === 'member') {
      queryText += ` AND user_id = $${paramCount}`
      queryParams.push(user.id)
      paramCount++
    } else if (user.role === 'supervisor' || user.role === 'manager') {
      queryText += ` AND tenant_id = $${paramCount}`
      queryParams.push(user.tenant_id)
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

      return { ...r, attachments, pdfFile, displayDate }
    })
    res.json(rows)
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

    // enforce read access on returned single doc
    const user = (req as any).user
    const { canAccessDocument } = await import('../lib/rbac')
    if (!canAccessDocument(user, row)) return res.status(403).json({ error: 'Forbidden' })

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

    res.json({ ...row, attachments, pdfFile, displayDate })
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
    // Ensure only allowed roles can create
    const allowed = ['member','supervisor','manager','admin']
    const user = req.user
    if (!user || !allowed.includes(String(user.role))) return res.status(403).json({ error: 'Insufficient role to create documents' })
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
      // Ensure date includes a timestamp (avoid midnight-only dates). If client sent only YYYY-MM-DD, append current time portion.
      let finalDate: string
      if (date) {
        // If client sent a date-only string (YYYY-MM-DD), append current time so timestamp is not midnight
        finalDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
          ? `${date}T${new Date().toISOString().split('T')[1]}`
          : date
      } else if (documentDate) {
        finalDate = typeof documentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(documentDate)
          ? `${documentDate}T${new Date().toISOString().split('T')[1]}`
          : documentDate
      } else {
        finalDate = new Date().toISOString()
      }

      // Determine direction from provided 'type' or barcode prefix (flexible)
      let direction: 'INCOMING' | 'OUTGOING' | null = null
      if (typeof type === 'string') {
        const t = String(type).toUpperCase().trim()
        if (t === 'INCOMING' || t.startsWith('IN')) direction = 'INCOMING'
        else if (t === 'OUTGOING' || t.startsWith('OUT')) direction = 'OUTGOING'
      }
      if (!direction && barcode && typeof barcode === 'string') {
        if (barcode.toUpperCase().startsWith('IN')) direction = 'INCOMING'
        else if (barcode.toUpperCase().startsWith('OUT')) direction = 'OUTGOING'
      }

      // Default status based on direction if not provided
      const finalStatus = status || (direction === 'INCOMING' ? 'وارد' : (direction === 'OUTGOING' ? 'صادر' : 'محفوظ'))

      // If no barcode provided, generate a numeric sequential barcode server-side
      if (!barcode) {
        // Generate numeric-only barcode (new behavior). Keep direction required for status only.
        if (!direction) return res.status(400).json({ error: 'Direction (type) is required to generate barcode' })
        const seqName = 'doc_seq'
        let n: number
        try {
          const seqRes = await query(`SELECT nextval('${seqName}') as n`)
          n = seqRes.rows[0].n
        } catch (seqErr: any) {
          console.warn('Sequence missing or nextval failed for doc_seq, creating sequences:', seqErr?.message || seqErr)
          try {
            await query("CREATE SEQUENCE IF NOT EXISTS doc_seq START 1")
            const seqRes2 = await query(`SELECT nextval('${seqName}') as n`)
            n = seqRes2.rows[0].n
          } catch (seqErr2: any) {
            console.error('Failed to create or get sequence value for doc_seq:', seqErr2)
            return res.status(500).json({ error: 'Failed to generate barcode sequence' })
          }
        }

        const padded = String(n).padStart(8, '0')
        const prefix = direction === 'INCOMING' ? '1' : '2'
        barcode = `${prefix}-${padded}`
      }

      // Enforce tenant/user scoping for created document: assign tenant_id and user_id from authenticated user
      const user = (req as any).user
      if (!user) return res.status(401).json({ error: 'Not authenticated' })
      tenant_id = user.tenant_id || null
      const creatorId = user.id

      // Check if barcode exists
      const existing = await query("SELECT id FROM documents WHERE barcode = $1", [barcode])

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: "Barcode already exists" })
      }

      // Ticket: ensure members cannot set tenant/user manually; tenant_id and user_id are set from authenticated user
      // (already enforced above by using creatorId and tenant_id variables)

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
          creatorId,
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
    const { type, sender, receiver, date, subject, priority, status, classification, notes, attachments: incomingAttachments } = req.body

    // Fetch existing to enforce access
    const existing = await query("SELECT * FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Document not found' })
    const doc = existing.rows[0]
    const authReq = req as any
    const user = authReq.user
    const { canAccessDocument } = await import('../lib/rbac')
    if (!canAccessDocument(user, doc)) return res.status(403).json({ error: 'Forbidden' })

    // Prevent changing tenant via update
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
        JSON.stringify(incomingAttachments),
        barcode,
      ],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" })
    }

    const row = result.rows[0]
    let attachments = row.attachments
    try {
      if (typeof attachments === 'string') attachments = JSON.parse(attachments || '[]')
    } catch (e) { attachments = Array.isArray(attachments) ? attachments : [] }
    const pdfFile = Array.isArray(attachments) && attachments.length ? attachments[0] : null

    res.json({ ...row, attachments, pdfFile })
  } catch (error) {
    console.error("Update document error:", error)
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

export default router
