import express from 'express'
import type { Response } from 'express'
import fetch from 'node-fetch'
import { PDFDocument, rgb } from 'pdf-lib'
import { query } from '../config/database'
import { authenticateToken } from '../middleware/auth'
import type { AuthRequest } from '../types'

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
    const endpoint = String(process.env.CF_R2_ENDPOINT || '').replace(/\/$/, '')
    const bucket = String(process.env.CF_R2_BUCKET || '').replace(/\/$/, '')
    if (!endpoint || !bucket) return { key: null, bucket: null }

    if (!u.href.startsWith(endpoint)) return { key: null, bucket: null }

    const pathname = u.pathname.replace(/^\//, '')
    // Expect: /<bucket>/<key>
    if (pathname.startsWith(bucket + '/')) {
      return { key: decodeURIComponent(pathname.slice(bucket.length + 1)), bucket }
    }

    // Some endpoints may include bucket implicitly; fallback: drop first segment
    const parts = pathname.split('/')
    if (parts.length > 1) {
      return { key: decodeURIComponent(parts.slice(1).join('/')), bucket }
    }

    return { key: null, bucket: null }
  } catch {
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

  const { width, height } = page.getSize()

  // Place signature bottom-left with fixed max width
  const margin = 36
  const maxW = Math.min(180, width * 0.35)
  const scale = maxW / sigImage.width
  const drawW = sigImage.width * scale
  const drawH = sigImage.height * scale

  const x = margin
  const y = Math.max(margin, margin) // keep above bottom margin

  // Optional baseline line + timestamp for traceability
  const lineY = y + drawH + 8
  page.drawLine({
    start: { x, y: lineY },
    end: { x: x + drawW, y: lineY },
    thickness: 1,
    color: rgb(0.15, 0.15, 0.15),
    opacity: 0.3,
  })

  page.drawImage(sigImage, { x, y, width: drawW, height: drawH })

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

    const ins = await query(
      'INSERT INTO approval_requests (requester_id, manager_id, title, description, attachment_url) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [requesterId, manager_id, title, description || null, attachment_url]
    )
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
    const { status, rejection_reason } = req.body || {}

    const existing = await query('SELECT * FROM approval_requests WHERE id = $1 LIMIT 1', [id])
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Approval request not found' })
    const row = existing.rows[0]

    // Only assigned manager (or admin) can act
    const isAdmin = roleLower(req) === 'admin'
    if (!isAdmin && Number(row.manager_id) !== actorId) return res.status(403).json({ error: 'Not allowed to approve this request' })

    if (status === 'REJECTED') {
      if (!rejection_reason) return res.status(400).json({ error: 'rejection_reason is required' })
      const upd = await query(
        "UPDATE approval_requests SET status='REJECTED', rejection_reason=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
        [rejection_reason, id]
      )
      return res.json(upd.rows[0])
    }

    if (status !== 'APPROVED') return res.status(400).json({ error: 'Invalid status' })

    // Resolve tenant signature first; fallback to manager signature
    let signatureUrl: string | null = null
    try {
      // requester tenant_id -> tenants.signature_url
      const requester = await query('SELECT tenant_id, signature_url FROM users WHERE id=$1 LIMIT 1', [row.requester_id])
      const tenantId = requester.rows[0]?.tenant_id
      if (tenantId) {
        const t = await query('SELECT signature_url FROM tenants WHERE id=$1 LIMIT 1', [tenantId])
        signatureUrl = t.rows[0]?.signature_url || null
      }
      // fallback: manager signature
      if (!signatureUrl) signatureUrl = requester.rows[0]?.signature_url || null
      if (!signatureUrl) {
        const mgr = await query('SELECT signature_url FROM users WHERE id=$1 LIMIT 1', [actorId])
        signatureUrl = mgr.rows[0]?.signature_url || null
      }
    } catch (e) {
      // ignore; will validate below
    }

    if (!signatureUrl) {
      return res.status(400).json({ error: 'No signature configured (tenant or user). Please upload a signature first.' })
    }

    const { signedUrl } = await signPdfAndUpload({ approvalId: id, attachmentUrl: row.attachment_url, signatureUrl })

    const upd = await query(
      "UPDATE approval_requests SET status='APPROVED', signed_attachment_url=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [signedUrl, id]
    )

    return res.json(upd.rows[0])
  } catch (err: any) {
    console.error('Update approval error:', err)
    return res.status(500).json({ error: String(err?.message || err) })
  }
})

export default router
