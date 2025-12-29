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
    // Prevent client-side caching of preview URLs (helps managers/supervisors get fresh resources)
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    const { barcode } = req.params
    const r = await query("SELECT attachments FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    let attachments: any = r.rows[0].attachments
    try { if (typeof attachments === 'string') attachments = JSON.parse(attachments || '[]') } catch (e) { attachments = Array.isArray(attachments) ? attachments : [] }
    if (!attachments || !attachments.length) return res.status(404).json({ error: 'No attachment' })

    // Support selecting a specific attachment by index via ?index=N
    const idx = Math.max(0, parseInt(String(req.query?.index || '0'), 10) || 0)
    if (idx < 0 || idx >= attachments.length) return res.status(400).json({ error: 'invalid_index' })
    const pdf = attachments[idx]

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
    // Prevent client-side caching of the preview redirect response
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    const { barcode } = req.params
    const r = await query("SELECT attachments FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
    if (r.rows.length === 0) return res.status(404).send('Not found')
    let attachments: any = r.rows[0].attachments
    try { if (typeof attachments === 'string') attachments = JSON.parse(attachments || '[]') } catch (e) { attachments = Array.isArray(attachments) ? attachments : [] }
    if (!attachments || !attachments.length) return res.status(404).send('No attachment')

    // Support selecting a specific attachment by index via ?index=N
    const idx = Math.max(0, parseInt(String(req.query?.index || '0'), 10) || 0)
    if (idx < 0 || idx >= attachments.length) return res.status(400).send('invalid_index')
    const pdf = attachments[idx]

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
    // Ensure document listing responses are not cached by browsers or intermediate caches
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')
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
    // Avoid caching single document responses so UI reflects latest changes
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')
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

// Return the statement text as JSON (requires auth) - useful for quick in-app reading without PDF
router.get("/:barcode/statement", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    // Avoid caching the statement text
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    const { barcode } = req.params
    const r = await query("SELECT barcode, statement FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    const row = r.rows[0]

    const user = (req as any).user
    const { canAccessDocument } = await import('../lib/rbac')
    if (!canAccessDocument(user, row)) return res.status(403).json({ error: 'Forbidden' })

    const statement = String(row.statement || '')
    return res.json({ statement })
  } catch (err: any) {
    console.error('Statement text error:', err)
    res.status(500).json({ error: 'Failed to fetch statement' })
  }
})

// Generate a downloadable A4 PDF of the statement for the document (requires auth)
router.get("/:barcode/statement.pdf", async (req: AuthRequest, res: Response) => {
  try {
    // Ensure generated PDFs are not cached by clients
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate')
    const { barcode } = req.params
    const r = await query("SELECT barcode, sender, receiver, date, statement FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' })
    const row = r.rows[0]

    const user = (req as any).user
    const { canAccessDocument } = await import('../lib/rbac')
    if (!canAccessDocument(user, row)) return res.status(403).json({ error: 'Forbidden' })

    let statement = String(row.statement || '').trim()
    // If there's no stored statement, generate a small placeholder PDF instead of returning an error so clients can always download a PDF
    if (!statement) {
      // Use an ASCII fallback when no statement exists so a PDF can be generated even if font files are unavailable in the environment
      statement = 'No statement available for this document'
    }

    const { PDFDocument, StandardFonts } = await import('pdf-lib')
    const fontkit = (await import('@pdf-lib/fontkit')).default
    const fs = await import('fs')
    const path = await import('path')
    const fontPath = path.join(process.cwd(), 'backend', 'assets', 'fonts', 'NotoSansArabic-Regular.ttf')
    let fontBytes: Buffer | null = null
    try { fontBytes = fs.readFileSync(fontPath) } catch (e) { fontBytes = null }

    const pdfDoc = await PDFDocument.create()
    if (fontBytes) pdfDoc.registerFontkit(fontkit)
    const font = fontBytes ? await pdfDoc.embedFont(fontBytes) : await pdfDoc.embedFont(StandardFonts.Helvetica)

    const pageWidth = 595.28
    const pageHeight = 841.89
    let page = pdfDoc.addPage([pageWidth, pageHeight])
    const margin = 40
    let y = pageHeight - margin
    const headerFontSize = 16
    const bodyFontSize = 12

    // Draw header (right aligned for RTL). If we don't have an embedded Arabic font available, fall back to English headers
    const headerText = fontBytes ? `بيان القيد - ${row.barcode}` : `Statement - ${row.barcode}`
    const headerTextWidth = font.widthOfTextAtSize(headerText, headerFontSize)
    page.drawText(headerText, { x: pageWidth - margin - headerTextWidth, y, size: headerFontSize, font })
    y -= headerFontSize + 10

    const meta = fontBytes ? `التاريخ: ${(row.date || '').split('T')?.[0] || ''}  |  الجهة: ${row.sender || ''}` : `Date: ${(row.date || '').split('T')?.[0] || ''}`
    const metaWidth = font.widthOfTextAtSize(meta, 10)
    page.drawText(meta, { x: pageWidth - margin - metaWidth, y, size: 10, font })
    y -= 18

    // Wrap statement into lines based on width
    const maxWidth = pageWidth - margin * 2
    const words = statement.split(/\s+/)
    let line = ''
    for (const w of words) {
      const test = line ? (line + ' ' + w) : w
      const testWidth = font.widthOfTextAtSize(test, bodyFontSize)
      if (testWidth <= maxWidth) {
        line = test
      } else {
        const lineWidth = font.widthOfTextAtSize(line, bodyFontSize)
        if (y < margin + bodyFontSize) {
          page = pdfDoc.addPage([pageWidth, pageHeight])
          y = pageHeight - margin
        }
        page.drawText(line, { x: pageWidth - margin - lineWidth, y, size: bodyFontSize, font })
        y -= bodyFontSize + 6
        line = w
      }
    }
    if (line) {
      const lineWidth = font.widthOfTextAtSize(line, bodyFontSize)
      if (y < margin + bodyFontSize) {
        page = pdfDoc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }
      page.drawText(line, { x: pageWidth - margin - lineWidth, y, size: bodyFontSize, font })
      y -= bodyFontSize + 6
    }

    const pdfBytes = await pdfDoc.save()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${row.barcode}-statement.pdf"`)
    return res.send(Buffer.from(pdfBytes))
  } catch (err: any) {
    console.error('Statement PDF generation error:', err)
    res.status(500).json({ error: 'PDF generation failed' })
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
    body("classification").optional().isIn(["عادي", "سري"]).withMessage("Invalid classification"),
    // Accept both new UI labels (عاديه/عاجله) and legacy DB labels (عادي/عاجل/عاجل جداً) for compatibility
    body("priority").optional().isIn(["عاديه", "عاجله", "عادي", "عاجل", "عاجل جداً"]).withMessage("Invalid priority"),
    body("status").optional().isIn(["وارد", "صادر", "محفوظ"]).withMessage("Invalid status"),
    body("statement").optional().trim().isLength({ max: 2000 }).withMessage("Statement too long"),
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
        statement,
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

      // Map frontend priority labels to DB-safe values
      const dbPriority = (function(p: any) {
        if (!p) return 'عادي' // default DB priority
        if (p === 'عاديه' || p === 'عادي') return 'عادي'
        if (p === 'عاجله' || p === 'عاجل') return 'عاجل'
        if (p === 'عاجل جداً') return 'عاجل جداً'
        return 'عادي'
      })(priority)

      // Ensure 'statement' column exists (helps older DBs without running migration manually)
      try { await query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS statement TEXT") } catch (e) { /* ignore */ }
      try { await query("ALTER TABLE barcodes ADD COLUMN IF NOT EXISTS statement TEXT") } catch (e) { /* ignore */ }

      // If no barcode provided, generate a numeric sequential barcode server-side
      if (!barcode) {
        // Generate numeric-only barcode (new behavior). Keep direction required for status only.
        if (!direction) return res.status(400).json({ error: 'Direction (type) is required to generate barcode' })
        // Use per-direction sequences so incoming and outgoing numbering can be managed independently
        const seqName = (String(direction || '').toUpperCase().startsWith('IN')) ? 'doc_in_seq' : 'doc_out_seq'
        let n: number
        try {
          const seqRes = await query(`SELECT nextval('${seqName}') as n`)
          n = seqRes.rows[0].n
        } catch (seqErr: any) {
          console.warn(`Sequence missing or nextval failed for ${seqName}, attempting to create it:`, seqErr?.message || seqErr)
          try {
            await query(`CREATE SEQUENCE IF NOT EXISTS ${seqName} START 1`)
            const seqRes2 = await query(`SELECT nextval('${seqName}') as n`)
            n = seqRes2.rows[0].n
          } catch (seqErr2: any) {
            console.error(`Failed to create or get sequence value for ${seqName}:`, seqErr2)
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
        `INSERT INTO documents (barcode, type, sender, receiver, date, subject, priority, status, classification, notes, statement, attachments, user_id, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          barcode,
          dbType,
          sender,
          finalReceiver,
          finalDate,
          finalSubject,
          dbPriority,
          finalStatus,
          classification,
          notes,
          statement || null,
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
            `INSERT INTO barcodes (barcode, type, status, priority, subject, statement, attachments, user_id, tenant_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [barcode, dbType, finalStatus || null, dbPriority || null, finalSubject || null, statement || null, JSON.stringify(attachments || []), authReq.user?.id, tenant_id || null],
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

// Append attachment to an existing document (expects the file to have been uploaded via /uploads first)
router.post('/:barcode/attachments', async (req: AuthRequest, res: Response) => {
  try {
    const { barcode } = req.params
    const { attachment } = req.body || {}
    if (!attachment || !attachment.name || !attachment.url) return res.status(400).json({ error: 'Attachment metadata (name,url) is required' })

    const r = await query("SELECT * FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Document not found' })
    const doc = r.rows[0]

    const user = (req as any).user
    const { canAccessDocument } = await import('../lib/rbac')
    if (!canAccessDocument(user, doc)) return res.status(403).json({ error: 'Forbidden' })

    // Validate attachment origin: allow only internal uploads or configured storage objects (R2/Supabase)
    const url = String(attachment.url || '')
    const allowLocal = url.startsWith('/uploads/')
    const useR2 = String(process.env.STORAGE_PROVIDER || '').toLowerCase() === 'r2' || Boolean(process.env.CF_R2_ENDPOINT)
    let ok = false
    if (allowLocal) ok = true
    if (useR2 && (attachment.key || (attachment.url && String(attachment.url).includes((process.env.CF_R2_ENDPOINT || ''))))) ok = true
    const { USE_R2_ONLY } = await import('../config/storage')
    const supabaseUrl = USE_R2_ONLY ? '' : (process.env.SUPABASE_URL || '')
    if (!ok && attachment.bucket && attachment.key && supabaseUrl) ok = true

    if (!ok) return res.status(400).json({ error: 'Attachment must be uploaded to a supported storage provider or the local uploads folder' })

    // Parse existing attachments safely
    let attachments: any = doc.attachments
    try { if (typeof attachments === 'string') attachments = JSON.parse(attachments || '[]') } catch (e) { attachments = Array.isArray(attachments) ? attachments : [] }

    // Prevent abusive attachment counts
    if (Array.isArray(attachments) && attachments.length >= 50) return res.status(400).json({ error: 'Attachment limit reached' })

    attachments.push(attachment)

    const updated = await query("UPDATE documents SET attachments = $1 WHERE id = $2 RETURNING *", [JSON.stringify(attachments || []), doc.id])

    // Keep barcodes.attachments in sync when possible
    try {
      await query("UPDATE barcodes SET attachments = $1 WHERE barcode = $2", [JSON.stringify(attachments || []), barcode])
    } catch (e) { console.warn('Failed to update barcode attachments:', e) }

    const row = updated.rows[0]
    const pdfFile = Array.isArray(attachments) && attachments.length ? attachments[0] : null
    res.json({ ...row, attachments, pdfFile })
  } catch (err: any) {
    console.error('Add attachment error:', err)
    res.status(500).json({ error: 'Failed to add attachment' })
  }
})

// Update document
router.put("/:barcode", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params
    const { type, sender, receiver, date, subject, priority, status, classification, notes, statement, attachments: incomingAttachments } = req.body

    // Fetch existing to enforce access
    const existing = await query("SELECT * FROM documents WHERE lower(barcode) = lower($1) LIMIT 1", [barcode])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Document not found' })
    const doc = existing.rows[0]
    const authReq = req as any
    const user = authReq.user
    const { canAccessDocument } = await import('../lib/rbac')
    if (!canAccessDocument(user, doc)) return res.status(403).json({ error: 'Forbidden' })

    // Prevent changing tenant via update

    // If the client attempts to change the document type (incoming/outgoing), only allow admins to do so
    try {
      const requestedType = String(type || '').toUpperCase()
      const existingType = String(doc.type || '').toUpperCase()
      if (requestedType && requestedType !== existingType) {
        const role = String((req as any).user?.role || '').toLowerCase()
        if (role !== 'admin') {
          return res.status(403).json({ error: 'Only administrators may change the document direction/type' })
        }
      }
    } catch (e) { /* ignore */ }

    const result = await query(
      `UPDATE documents 
       SET type = $1, sender = $2, receiver = $3, date = $4, subject = $5, 
           priority = $6, status = $7, classification = $8, notes = $9, statement = $10, attachments = $11
       WHERE barcode = $12
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
        statement || null,
        JSON.stringify(incomingAttachments),
        barcode,
      ] )

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
router.delete("/:barcode", authenticateToken, async (req: Request, res: Response) => {
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
        COUNT(*) FILTER (WHERE priority = 'عاجل') as urgent
      FROM documents
    `)

    res.json(result.rows[0])
  } catch (error) {
    console.error("Get stats error:", error)
    res.status(500).json({ error: "Failed to fetch statistics" })
  }
})

export default router
