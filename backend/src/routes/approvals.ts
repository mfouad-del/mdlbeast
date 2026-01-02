import express from 'express'
import type { Response } from 'express'
import fetch from 'node-fetch'
import { PDFDocument, rgb } from 'pdf-lib'
import { query } from '../config/database'
import { authenticateToken } from '../middleware/auth'
import type { AuthRequest } from '../types'
import { logAudit } from '../services/auditService'
import { sendEmail, generateApprovalRequestEmail } from '../services/emailService'

const router = express.Router()
router.use(authenticateToken)

function roleLower(req: AuthRequest) {
  return String(req.user?.role || '').toLowerCase()
}

function canApprove(req: AuthRequest) {
  const r = roleLower(req)
  return r === 'admin' || r === 'manager' || r === 'supervisor'
}

async function fetchBytes(url: string): Promise<Buffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to fetch: ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

function tryDeriveR2KeyFromUrl(rawUrl: string): { key: string | null; bucket: string | null } {
  try {
    const u = new URL(String(rawUrl))
    const bucket = String(process.env.CF_R2_BUCKET || 'zaco')
    
    // Extract pathname and remove leading slash
    let pathname = u.pathname.replace(/^\//, '')
    
    // If pathname starts with bucket name, remove it
    if (pathname.startsWith(bucket + '/')) {
      pathname = pathname.slice(bucket.length + 1)
    }
    
    // Decode and return
    const key = decodeURIComponent(pathname)
    console.log('Derived R2 key from URL:', { rawUrl, key })
    
    return { key: key || null, bucket }
  } catch (err) {
    console.error('Failed to derive R2 key from URL:', err)
    return { key: null, bucket: null }
  }
}

async function loadPdfBytesFromAttachmentUrl(attachmentUrl: string): Promise<Buffer> {
  const { preferR2 } = await import('../config/storage')
  const useR2 = preferR2()
  if (useR2) {
    const derived = tryDeriveR2KeyFromUrl(attachmentUrl)
    if (derived.key) {
      const { downloadToBuffer } = await import('../lib/r2-storage')
      return downloadToBuffer(derived.key)
    }
  }
  return fetchBytes(attachmentUrl)
}

async function loadImageBytes(signatureUrl: string): Promise<Buffer> {
  const { preferR2 } = await import('../config/storage')
  const useR2 = preferR2()
  if (useR2) {
    const derived = tryDeriveR2KeyFromUrl(signatureUrl)
    if (derived.key) {
      const { downloadToBuffer } = await import('../lib/r2-storage')
      return downloadToBuffer(derived.key)
    }
  }
  return fetchBytes(signatureUrl)
}

async function signPdfAndUpload(params: {
  approvalId: number
  attachmentUrl: string
  signatureUrl: string
  signaturePosition?: {
    x: number
    y: number
    width: number
    height: number
    containerWidth: number
    containerHeight: number
  }
}): Promise<{ signedUrl: string; key: string }>
{
  const pdfBytes = await loadPdfBytesFromAttachmentUrl(params.attachmentUrl)
  const sigBytes = await loadImageBytes(params.signatureUrl)

  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  if (!pages.length) throw new Error('PDF has no pages')
  const page = pages[0]

  // Embed signature image (try png then jpg)
  let sigImage: any
  try {
    sigImage = await pdfDoc.embedPng(sigBytes)
  } catch {
    sigImage = await pdfDoc.embedJpg(sigBytes)
  }

  const { width: pdfWidth, height: pdfHeight } = page.getSize()

  let x: number, y: number, drawW: number, drawH: number

  // If position data provided, use it (interactive mode)
  if (params.signaturePosition) {
    const pos = params.signaturePosition
    // Convert from container coordinates to PDF coordinates
    const scaleX = pdfWidth / pos.containerWidth
    const scaleY = pdfHeight / pos.containerHeight
    
    x = pos.x * scaleX
    // PDF coordinates are from bottom-left, so we need to flip Y
    y = pdfHeight - ((pos.y + pos.height) * scaleY)
    drawW = pos.width * scaleX
    drawH = pos.height * scaleY
    
    console.log('Using interactive signature placement:', { x, y, drawW, drawH, pdfWidth, pdfHeight })
  } else {
    // Fallback to default placement (bottom-left)
    const margin = 36
    const maxW = Math.min(180, pdfWidth * 0.35)
    const scale = maxW / sigImage.width
    drawW = sigImage.width * scale
    drawH = sigImage.height * scale
    x = margin
    y = margin
    
    console.log('Using default signature placement:', { x, y, drawW, drawH })
  }

  // Draw signature/stamp
  page.drawImage(sigImage, { x, y, width: drawW, height: drawH })

  // Optional: Add timestamp line (only for default placement)
  if (!params.signaturePosition) {
    const lineY = y + drawH + 8
    page.drawLine({
      start: { x, y: lineY },
      end: { x: x + drawW, y: lineY },
      thickness: 1,
      color: rgb(0.15, 0.15, 0.15),
      opacity: 0.3,
    })
  }

  const out = Buffer.from(await pdfDoc.save())

  const { uploadBuffer } = await import('../lib/r2-storage')
  const key = `uploads/approvals/signed/${params.approvalId}-${Date.now()}.pdf`
  const signedUrl = await uploadBuffer(key, out, 'application/pdf', '0')
  return { signedUrl, key }
}

// Create approval request
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const requesterId = Number(req.user?.id)
    const { title, description, attachment_url, manager_id } = req.body || {}
    if (!requesterId) return res.status(401).json({ error: 'Unauthorized' })
    if (!title || !attachment_url || !manager_id) return res.status(400).json({ error: 'Missing fields' })

    // Validate manager exists and has proper role
    const mgr = await query('SELECT id, role FROM users WHERE id=$1 LIMIT 1', [manager_id])
    if (mgr.rows.length === 0) return res.status(400).json({ error: 'المدير المحدد غير موجود' })
    const mgrRole = String(mgr.rows[0].role || '').toLowerCase()
    if (!['admin', 'manager', 'supervisor'].includes(mgrRole)) {
      return res.status(400).json({ error: 'المستخدم المحدد ليس مديراً' })
    }

    // Generate unique approval number
    const numResult = await query("SELECT 'APV-' || LPAD(nextval('approval_number_seq')::TEXT, 6, '0') AS approval_number")
    const approvalNumber = numResult.rows[0].approval_number

    const ins = await query(
      'INSERT INTO approval_requests (requester_id, manager_id, title, description, attachment_url, approval_number) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [requesterId, manager_id, title, description || null, attachment_url, approvalNumber]
    )
    
    // Audit log
    await logAudit({
      userId: requesterId,
      action: 'CREATE_APPROVAL_REQUEST',
      entityType: 'approval_request',
      entityId: String(ins.rows[0].id),
      details: `Created approval request: ${title} (${approvalNumber})`,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent')
    })
    
    // Send email notification to manager
    try {
      const requesterData = await query('SELECT full_name FROM users WHERE id=$1 LIMIT 1', [requesterId])
      const managerData = await query('SELECT full_name, email FROM users WHERE id=$1 LIMIT 1', [manager_id])
      
      if (managerData.rows[0]?.email) {
        const baseUrl = process.env.FRONTEND_URL || 'https://zaco.sa'
        const dashboardUrl = `${baseUrl}/dashboard`
        
        const emailHtml = generateApprovalRequestEmail({
          managerName: managerData.rows[0].full_name || 'المدير',
          requesterName: requesterData.rows[0]?.full_name || 'مستخدم',
          requestTitle: title,
          requestDescription: description || undefined,
          requestNumber: approvalNumber,
          dashboardUrl
        })
        
        await sendEmail({
          to: managerData.rows[0].email,
          subject: `طلب اعتماد جديد: ${title}`,
          html: emailHtml
        })
        
        console.log(`[Approvals] Email notification sent to manager ${manager_id}`)
      }
    } catch (emailErr) {
      // Don't fail the request if email fails
      console.error('[Approvals] Failed to send email notification:', emailErr)
    }
    
    return res.status(201).json(ins.rows[0])
  } catch (err: any) {
    console.error('Create approval error:', err)
    return res.status(500).json({ error: 'Failed to create approval request' })
  }
})

// My requests
router.get('/my-requests', async (req: AuthRequest, res: Response) => {
  try {
    const requesterId = Number(req.user?.id)
    const r = await query(
      `SELECT ar.*,
        json_build_object('id', reqU.id, 'username', reqU.username, 'full_name', reqU.full_name, 'role', reqU.role, 'signature_url', reqU.signature_url, 'stamp_url', reqU.stamp_url) AS requester,
        json_build_object('id', mgrU.id, 'username', mgrU.username, 'full_name', mgrU.full_name, 'role', mgrU.role, 'signature_url', mgrU.signature_url, 'stamp_url', mgrU.stamp_url) AS manager
      FROM approval_requests ar
      LEFT JOIN users reqU ON reqU.id = ar.requester_id
      LEFT JOIN users mgrU ON mgrU.id = ar.manager_id
      WHERE ar.requester_id = $1
      ORDER BY ar.created_at DESC`,
      [requesterId]
    )
    return res.json(r.rows)
  } catch (err: any) {
    console.error('My approvals error:', err)
    return res.status(500).json({ error: 'Failed to fetch approval requests' })
  }
})

// Pending approvals for current manager
router.get('/pending', async (req: AuthRequest, res: Response) => {
  try {
    if (!canApprove(req)) return res.status(403).json({ error: 'Forbidden' })
    const managerId = Number(req.user?.id)
    const r = await query(
      `SELECT ar.*,
        json_build_object('id', reqU.id, 'username', reqU.username, 'full_name', reqU.full_name, 'role', reqU.role, 'signature_url', reqU.signature_url, 'stamp_url', reqU.stamp_url) AS requester,
        json_build_object('id', mgrU.id, 'username', mgrU.username, 'full_name', mgrU.full_name, 'role', mgrU.role, 'signature_url', mgrU.signature_url, 'stamp_url', mgrU.stamp_url) AS manager
      FROM approval_requests ar
      LEFT JOIN users reqU ON reqU.id = ar.requester_id
      LEFT JOIN users mgrU ON mgrU.id = ar.manager_id
      WHERE ar.manager_id = $1 AND ar.status = 'PENDING'
      ORDER BY ar.created_at ASC`,
      [managerId]
    )
    return res.json(r.rows)
  } catch (err: any) {
    console.error('Pending approvals error:', err)
    return res.status(500).json({ error: 'Failed to fetch pending approvals' })
  }
})

// Update approval: approve/reject
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!canApprove(req)) return res.status(403).json({ error: 'Forbidden' })
    const id = Number(req.params.id)
    const actorId = Number(req.user?.id)
    const { status, rejection_reason, signature_type, signature_position } = req.body || {}

    console.log('[PUT /:id] Request received:', { id, actorId, status, signature_type, hasPosition: !!signature_position })

    const existing = await query('SELECT * FROM approval_requests WHERE id = $1 LIMIT 1', [id])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Approval request not found' })
    const row = existing.rows[0]

    // Only assigned manager (or admin) can act
    const isAdmin = roleLower(req) === 'admin'
    if (!isAdmin && Number(row.manager_id) !== actorId) return res.status(403).json({ error: 'Not allowed to approve this request' })

    if (status === 'REJECTED') {
      if (!rejection_reason) return res.status(400).json({ error: 'rejection_reason is required' })
      
      // Check if seen_by_requester column exists
      const hasSeenCol = await query(
        "SELECT 1 FROM information_schema.columns WHERE table_name='approval_requests' AND column_name='seen_by_requester' LIMIT 1"
      )
      
      const updateQuery = hasSeenCol.rows.length > 0
        ? "UPDATE approval_requests SET status='REJECTED', rejection_reason=$1, seen_by_requester=FALSE, updated_at=NOW() WHERE id=$2 RETURNING *"
        : "UPDATE approval_requests SET status='REJECTED', rejection_reason=$1, updated_at=NOW() WHERE id=$2 RETURNING *"
      
      const upd = await query(updateQuery, [rejection_reason, id])
      
      // Audit log
      await logAudit({
        userId: actorId,
        action: 'REJECT_APPROVAL_REQUEST',
        entityType: 'approval_request',
        entityId: String(id),
        details: `Rejected approval request: ${row.title}. Reason: ${rejection_reason}`,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent')
      })
      
      return res.json(upd.rows[0])
    }

    if (status !== 'APPROVED') return res.status(400).json({ error: 'Invalid status' })

    // Get manager's signature and stamp from database
    const managerData = await query(
      'SELECT signature_url, stamp_url FROM users WHERE id = $1',
      [actorId]
    )
    
    if (managerData.rows.length === 0) {
      return res.status(400).json({ error: 'لم يتم العثور على بيانات المدير' })
    }

    const manager = managerData.rows[0]
    
    // Determine which signature/stamp to use based on signature_type
    let signatureUrl: string | null = null
    
    if (signature_type === 'stamp' && manager.stamp_url) {
      signatureUrl = manager.stamp_url
    } else if (signature_type === 'signature' && manager.signature_url) {
      signatureUrl = manager.signature_url
    } else if (manager.signature_url) {
      // Fallback to signature if type not specified
      signatureUrl = manager.signature_url
    } else if (manager.stamp_url) {
      // Fallback to stamp if signature not available
      signatureUrl = manager.stamp_url
    }
    
    console.log('Signature selection for approval', id, ':', {
      actorId,
      signature_type,
      hasSignature: !!manager.signature_url,
      hasStamp: !!manager.stamp_url,
      selected: signatureUrl
    })

    if (!signatureUrl) {
      console.error('[PUT /:id] No signature/stamp available for manager', actorId)
      return res.status(400).json({ 
        error: 'لا يوجد توقيع أو ختم مُعد. الرجاء رفع توقيع أو ختم أولاً من صفحة الملف الشخصي.',
        needsSignature: true
      })
    }

    // Use transaction to ensure consistency
    await query('BEGIN')
    try {
      const { signedUrl } = await signPdfAndUpload({ 
        approvalId: id, 
        attachmentUrl: row.attachment_url, 
        signatureUrl,
        signaturePosition: signature_position
      })

      // Check if seen_by_requester column exists
      const hasSeenCol = await query(
        "SELECT 1 FROM information_schema.columns WHERE table_name='approval_requests' AND column_name='seen_by_requester' LIMIT 1"
      )
      
      const updateQuery = hasSeenCol.rows.length > 0
        ? "UPDATE approval_requests SET status='APPROVED', signed_attachment_url=$1, seen_by_requester=FALSE, updated_at=NOW() WHERE id=$2 RETURNING *"
        : "UPDATE approval_requests SET status='APPROVED', signed_attachment_url=$1, updated_at=NOW() WHERE id=$2 RETURNING *"

      const upd = await query(updateQuery, [signedUrl, id])

      // Audit log
      await logAudit({
        userId: actorId,
        action: 'APPROVE_REQUEST',
        entityType: 'approval_request',
        entityId: String(id),
        details: `Approved and signed approval request: ${row.title}`,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.get('user-agent')
      })

      await query('COMMIT')
      return res.json(upd.rows[0])
    } catch (err) {
      await query('ROLLBACK')
      console.error('[PUT /:id] Transaction error:', err)
      throw err
    }
  } catch (err: any) {
    console.error('[PUT /:id] Update approval error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Get signed URL for attachment preview
router.get('/:id/attachment-url', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    const userId = Number(req.user?.id)
    
    const r = await query('SELECT attachment_url, requester_id, manager_id FROM approval_requests WHERE id = $1 LIMIT 1', [id])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Request not found' })
    
    const row = r.rows[0]
    const isRequester = Number(row.requester_id) === userId
    const isManager = Number(row.manager_id) === userId
    const isAdmin = roleLower(req) === 'admin'
    
    // Only requester, manager, or admin can view
    if (!isRequester && !isManager && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to view this attachment' })
    }
    
    // Generate signed URL (5 min expiry)
    const { getSignedDownloadUrl } = await import('../lib/r2-storage')
    
    // Extract key from URL properly
    // URL format: https://xxx.r2.cloudflarestorage.com/bucket/uploads/approvals/file.pdf
    let key = String(row.attachment_url)
    
    // Remove protocol and domain
    if (key.includes('.com/')) {
      key = key.split('.com/')[1]
    }
    
    // Remove bucket name if present at the beginning
    const bucket = String(process.env.CF_R2_BUCKET || 'zaco')
    if (key.startsWith(bucket + '/')) {
      key = key.substring(bucket.length + 1)
    }
    
    console.log('Generating signed URL for key:', key)
    const signedUrl = await getSignedDownloadUrl(key, 300) // 5 minutes
    
    return res.json({ url: signedUrl })
  } catch (err: any) {
    console.error('Get attachment URL error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Get notifications count
router.get('/notifications/count', async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.user?.id)
    const userRole = roleLower(req)
    
    let count = 0
    
    // For managers/admins: count pending requests assigned to them
    if (['admin', 'manager', 'supervisor'].includes(userRole)) {
      const r = await query(
        "SELECT COUNT(*) as cnt FROM approval_requests WHERE manager_id = $1 AND status = 'PENDING'",
        [userId]
      )
      count = Number(r.rows[0]?.cnt || 0)
    } else {
      // For regular users: count requests with responses they haven't seen yet
      // We'll add seen_by_requester column via migration
      const hasSeenCol = await query(
        "SELECT 1 FROM information_schema.columns WHERE table_name='approval_requests' AND column_name='seen_by_requester' LIMIT 1"
      )
      
      if (hasSeenCol.rows.length > 0) {
        const r = await query(
          "SELECT COUNT(*) as cnt FROM approval_requests WHERE requester_id = $1 AND status != 'PENDING' AND seen_by_requester = FALSE",
          [userId]
        )
        count = Number(r.rows[0]?.cnt || 0)
      } else {
        // Fallback: count all non-pending requests (before migration)
        const r = await query(
          "SELECT COUNT(*) as cnt FROM approval_requests WHERE requester_id = $1 AND status != 'PENDING'",
          [userId]
        )
        count = Number(r.rows[0]?.cnt || 0)
      }
    }
    
    return res.json({ count })
  } catch (err: any) {
    console.error('Get notifications count error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

// Mark request as seen by requester
router.post('/:id/mark-seen', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id)
    const userId = Number(req.user?.id)
    
    // Verify requester
    const r = await query('SELECT requester_id FROM approval_requests WHERE id = $1 LIMIT 1', [id])
    if (r.rows.length === 0) return res.status(404).json({ error: 'Request not found' })
    if (Number(r.rows[0].requester_id) !== userId) {
      return res.status(403).json({ error: 'Not authorized' })
    }
    
    // Check if column exists
    const hasSeenCol = await query(
      "SELECT 1 FROM information_schema.columns WHERE table_name='approval_requests' AND column_name='seen_by_requester' LIMIT 1"
    )
    
    if (hasSeenCol.rows.length > 0) {
      await query('UPDATE approval_requests SET seen_by_requester = TRUE WHERE id = $1', [id])
    }
    
    return res.json({ success: true })
  } catch (err: any) {
    console.error('Mark seen error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

export default router
