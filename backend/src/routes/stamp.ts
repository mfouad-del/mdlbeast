import express from 'express'
import { query } from '../config/database'
import fetch from 'node-fetch'
import { PDFDocument, degrees } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import { authenticateToken } from '../middleware/auth'
import { generateStampImage } from '../lib/stamp-image-generator'

const router = express.Router()
router.use(authenticateToken)

const BIDI_CONTROL_RE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/u

function isSkippableBidiControl(cluster: string): boolean {
  if (!cluster) return true
  return cluster.replace(BIDI_CONTROL_RE, '') === ''
}

// Split string into grapheme-ish clusters: base + combining marks.
// This avoids separating Arabic marks/diacritics during measuring and drawing.
function splitClusters(str: string): string[] {
  if (!str) return []
  const chars = Array.from(String(str).normalize('NFC'))
  const clusters: string[] = []
  const combiningRe = /\p{M}/u

  for (const ch of chars) {
    if (clusters.length === 0) {
      clusters.push(ch)
      continue
    }
    // Append combining marks or joiners (ZWJ/ZWNJ) to the previous cluster
    if (combiningRe.test(ch) || ch === '\u200D' || ch === '\u200C') clusters[clusters.length - 1] += ch
    else clusters.push(ch)
  }
  return clusters
}

/**
 * Optional: anchor neutral punctuation with RLM (U+200F) when Arabic is present.
 * This reduces “migration” of neutral marks like : " ( ) when rendering mixed runs.
 */
function anchorNeutralPunctuationForArabic(s: string): string {
  if (!s) return s
  const text = String(s).normalize('NFC')
  if (!/[\u0600-\u06FF]/.test(text)) return text
  // NOTE: We intentionally do NOT anchor ':' because it can render as duplicated ": :" in some PDF flows.
  return text.replace(/([,"\.\?\!;\,\(\)\[\]])/g, '\u200F$1\u200F')
}

function measureRtlTextWidth(text: string, size: number, font: any): number {
  const s = String(text || '').normalize('NFC')
  const clusters = splitClusters(s)
  let total = 0
  for (const cluster of clusters) {
    if (isSkippableBidiControl(cluster)) continue
    try {
      total += font.widthOfTextAtSize(cluster, size)
    } catch {
      total += Math.max(size * 0.45, cluster.length * (size * 0.5))
    }
  }
  return total
}

/**
 * Draw visual-order text:
 * - expects `text` to already be in visual-ready order (shaped + BiDi applied by processArabicText)
 * - removes BiDi control characters for clean rendering
 * - draws entire text at once to preserve Arabic letter connections
 */
function drawVisualText(page: any, text: string, xLeft: number, y: number, size: number, font: any, color: any) {
  if (!text) return
  const s = String(text).normalize('NFC')
  
  // Remove BiDi control characters but keep text intact
  let cleanText = ''
  const clusters = splitClusters(s)
  for (const cluster of clusters) {
    if (!isSkippableBidiControl(cluster)) {
      cleanText += cluster
    }
  }
  
  // Draw entire text at once (not cluster by cluster) to preserve Arabic letter connections
  if (cleanText) {
    page.drawText(cleanText, { x: xLeft, y, size, font, color })
  }
}

// POST /:barcode/stamp { x, y, containerWidth, containerHeight, stampWidth, preview }
router.post('/:barcode/stamp', async (req, res) => {
  try {
    const stampCodeMarker = 'STAMP_ARABIC_ANCHOR_v2'
    const stampCodeCommit = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || process.env.SOURCE_VERSION || null
    const { barcode } = req.params
    const {
      x = 20,
      y = 20,
      containerWidth,
      containerHeight,
      stampWidth = 180,
      page: pageIndex = 0,
      attachmentIndex = 0,
      preview = false,
      pageRotation,
    } = req.body || {}

    const d = await query('SELECT * FROM documents WHERE barcode = $1 LIMIT 1', [barcode])
    if (d.rows.length === 0) return res.status(404).json({ error: 'Document not found' })
    const doc = d.rows[0]

    // Check if user can stamp (document owner, manager, or admin)
    const user = (req as any).user
    const isOwner = doc.user_id && user?.id && Number(doc.user_id) === Number(user.id)
    const isAdmin = user?.role === 'admin'
    const isManager = user?.role === 'manager'
    
    if (!isOwner && !isAdmin && !isManager) {
      return res.status(403).json({ error: 'Only document owner, manager, or administrator can stamp this document' })
    }

    // find pdf url in attachments (use the specified attachment index)
    const attachments = doc.attachments || []
    const targetIndex = Math.min(Math.max(0, attachmentIndex), attachments.length - 1)
    const pdf = Array.isArray(attachments) && attachments.length > targetIndex ? attachments[targetIndex] : null
    if (!pdf || !pdf.url) return res.status(400).json({ error: 'No PDF attached to stamp' })

    // fetch pdf bytes (support R2, local uploads, or external URL)
    let pdfBytes: Buffer
    const supabaseUrl = (await import('../config/storage')).USE_R2_ONLY ? '' : process.env.SUPABASE_URL
    const supabaseKeyRaw = (await import('../config/storage')).USE_R2_ONLY ? '' : (process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    const supabaseKey = String(supabaseKeyRaw).trim()
    const supabaseBucket = (await import('../config/storage')).USE_R2_ONLY ? '' : (process.env.SUPABASE_BUCKET || '')

    // Load storage config: USE_R2_ONLY defaults to true for one-step migration
    const { USE_R2_ONLY, preferR2, R2_CONFIGURED } = await import('../config/storage')

    console.debug('Stamp request start:', { stampCodeMarker, stampCodeCommit, barcode, pdfUrl: pdf?.url, pdfKey: pdf?.key, USE_R2_ONLY, R2_CONFIGURED })

    try {
      const useR2 = preferR2()

      if (useR2 && (pdf.key || (pdf.url && String(pdf.url).startsWith((process.env.CF_R2_ENDPOINT || '').replace(/\/$/, ''))))) {
        try {
          const { downloadToBuffer, getPublicUrl } = await import('../lib/r2-storage')
          // Derive key from pdf.url when key not present
          let key = pdf.key
          if (!key && pdf.url) {
            try {
              const u = new URL(String(pdf.url))
              const endpoint = (process.env.CF_R2_ENDPOINT || '').replace(/\/$/, '')
              // If url matches endpoint pattern, extract path segments after /<bucket>/
              const pathname = u.pathname.replace(/^\//, '')
              const bucket = (process.env.CF_R2_BUCKET || pdf.bucket || '').replace(/\/$/, '')
              if (bucket && pathname.startsWith(bucket + '/')) {
                key = decodeURIComponent(pathname.slice(bucket.length + 1))
              } else {
                // fallback: if endpoint includes the bucket in path (/bucket/key)
                const ep = endpoint.replace(/^https?:\/\//, '')
                if (u.href.indexOf(endpoint) === 0) {
                  const parts = pathname.split('/')
                  if (parts.length > 1) {
                    // assume first part is bucket
                    key = decodeURIComponent(parts.slice(1).join('/'))
                  }
                }
              }
            } catch (e) {
              // ignore
            }
          }

          if (!key) throw new Error('Missing R2 key for object')

          pdfBytes = await downloadToBuffer(key)
          // ensure we keep key for later upload/verification
          pdf.key = pdf.key || key
          pdf.bucket = pdf.bucket || process.env.CF_R2_BUCKET || ''
        } catch (e) {
          console.error('Stamp: failed to download object from R2:', e)
          throw e
        }
      } else if (!USE_R2_ONLY && pdf.key && supabaseUrl && supabaseKey && supabaseBucket) {
        // Supabase download path removed: project migrated to R2-only.
        console.error('Stamp: Supabase download requested but Supabase support has been removed')
        return res.status(500).json({ error: 'Supabase storage support has been removed. Use R2-hosted objects or contact the administrator.' })
      } else if (pdf.url && String(pdf.url).startsWith('/uploads/')) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads')
        const fp = path.join(uploadsDir, pdf.url.replace('/uploads/', ''))
        pdfBytes = fs.readFileSync(fp)
      } else {
        // If we're in R2-only mode but no R2 match was found, return an error instead of silently fetching external content
        if (USE_R2_ONLY && !useR2) {
          console.error('Stamp: server is configured USE_R2_ONLY but R2 is not configured or URL does not match R2 endpoint')
          return res.status(500).json({ error: 'R2 storage not configured. Contact the administrator.' })
        }

        const r = await fetch(pdf.url)
        if (!r.ok) return res.status(500).json({ error: 'Failed to fetch PDF' })
        pdfBytes = Buffer.from(await r.arrayBuffer())
      }
    } catch (e: any) {
      console.error('Failed to load PDF bytes:', e)
      return res.status(500).json({ error: 'Failed to load PDF for stamping' })
    }

    // Find Arabic font for canvas
    const fontDirs = [
      path.resolve(process.cwd(), 'backend', 'assets', 'fonts'),
      path.resolve(process.cwd(), 'assets', 'fonts'),
      path.resolve(__dirname, '..', '..', 'assets', 'fonts'),
      path.resolve(__dirname, '..', '..', '..', 'backend', 'assets', 'fonts'),
    ]
    let fontPath: string | null = null
    for (const d of fontDirs) {
      try {
        if (fs.existsSync(d)) {
          const list = fs.readdirSync(d).filter((f) => /NotoSansArabic.*Bold\.ttf$/i.test(f))
          if (list.length) {
            fontPath = path.join(d, list[0])
            break
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (!fontPath) {
      console.error('Stamp: NotoSansArabic-Bold.ttf not found')
      return res.status(500).json({ error: 'Missing Arabic font. Place NotoSansArabic-Bold.ttf in backend/assets/fonts' })
    }

    console.debug('Stamp: found font for canvas:', fontPath)

    // Load PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()
    const page = pages[Math.max(0, Math.min(pageIndex, pages.length - 1))]

    // Optional page rotation (metadata). Useful for scanned PDFs that are sideways.
    if (pageRotation === 0 || pageRotation === 90 || pageRotation === 180 || pageRotation === 270) {
      try {
        page.setRotation(degrees(pageRotation))
      } catch (e) {
        console.warn('Stamp: failed to set page rotation', e)
      }
    }
    const { width: pageWidth, height: pageHeight } = page.getSize()

    // compute stamp image size in PDF units based on provided stampWidth (px)
    // The PNG stamp will be generated with the exact dimensions we need
    let widthPdf: number
    let heightPdf: number

    if (containerWidth && containerHeight) {
      const cw = Number(containerWidth)
      widthPdf = (Number(stampWidth) / cw) * pageWidth
      // Height will be determined by the PNG's aspect ratio after generation
      // For now, use a placeholder (will be recalculated after stamp generation)
      heightPdf = widthPdf * 0.8  // temporary aspect ratio estimate
    } else {
      // Direct placement without container scaling
      widthPdf = Number(stampWidth) * 0.75  // convert px to PDF points (approximate)
      heightPdf = widthPdf * 0.8  // temporary aspect ratio estimate
    }

    // compute coordinates: x,y are in pixels from top-left of preview; convert to PDF coords
    let xPdf: number
    let yPdf: number
    if (containerWidth && containerHeight) {
      xPdf = (Number(x) / Number(containerWidth)) * pageWidth
      const topFraction = Number(y) / Number(containerHeight)
      yPdf = pageHeight - (topFraction * pageHeight) - heightPdf
    } else {
      xPdf = Number(x)
      yPdf = pageHeight - Number(y) - heightPdf
    }

    // clamp coordinates
    xPdf = Math.max(0, Math.min(xPdf, pageWidth - 1))
    yPdf = Math.max(0, Math.min(yPdf, pageHeight - 1))

    // Prepare data for stamp image generation
    const fixedCompanyName = 'زوايا البناء للإستشارات الهندسيه'
    
    // Get attachment count/description from attachment_count (can be text like "1 اسطوانة")
    const attachmentTextRaw = String(doc.attachment_count || '0')
    const attachmentLabel = `نوعية المرفقات: ${attachmentTextRaw}`
    
    // Format English date for stamp
    const dateSource = doc.date || doc.created_at || new Date().toISOString()
    let dateObjForLabel: Date
    try { 
      dateObjForLabel = new Date(String(dateSource)) 
    } catch (e) { 
      dateObjForLabel = new Date() 
    }
    
    // If date was stored as date-only at midnight, merge with created_at time
    if (dateObjForLabel.getHours() === 0 && dateObjForLabel.getMinutes() === 0 && dateObjForLabel.getSeconds() === 0 && doc.created_at) {
      const c = new Date(String(doc.created_at))
      if (!isNaN(c.getTime())) {
        dateObjForLabel.setHours(c.getHours(), c.getMinutes(), c.getSeconds())
      }
    }
    
    const engFmt = new Intl.DateTimeFormat('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    }).format(dateObjForLabel)
    const englishDate = String(engFmt)
    
    console.debug('Stamp: generating PNG image', { 
      barcode, 
      companyName: fixedCompanyName, 
      attachmentLabel, 
      englishDate, 
      stampWidth,
      fontPath 
    })
    
    // Generate stamp as PNG using canvas (native RTL/BiDi support)
    const stampImageBuffer = await generateStampImage(
      String(barcode || ''),
      fixedCompanyName,
      attachmentLabel,
      englishDate,
      Number(stampWidth),
      fontPath
    )
    
    // Embed the PNG stamp image in the PDF
    const stampImage = await pdfDoc.embedPng(stampImageBuffer)
    const stampDims = stampImage.scale(1)
    
    // Calculate dimensions maintaining aspect ratio
    const desiredWidth = widthPdf
    const aspectRatio = stampDims.height / stampDims.width
    const desiredHeight = desiredWidth * aspectRatio
    
    console.debug('Stamp: embedding PNG', { 
      xPdf, 
      yPdf, 
      desiredWidth, 
      desiredHeight,
      originalWidth: stampDims.width,
      originalHeight: stampDims.height
    })
    
    // Draw the stamp image on the PDF page
    page.drawImage(stampImage, {
      x: xPdf,
      y: yPdf,
      width: desiredWidth,
      height: desiredHeight,
    })

    const outBytes = await pdfDoc.save()
    // normalize to Buffer for consistency when uploading/verifying
    const outBuf = Buffer.from(outBytes)

    // If preview mode, return the stamped PDF without saving to storage
    if (preview) {
      const base64Pdf = outBuf.toString('base64')
      return res.json({ 
        preview: true, 
        previewData: `data:application/pdf;base64,${base64Pdf}`,
        message: 'Preview generated - not saved to storage'
      })
    }

    // Otherwise, save to storage (original behavior)
    // Overwrite original file when possible (Supabase key or local file), otherwise create a new local file and replace the first attachment
    try {
      // If pdf.key not present, try to extract key and bucket from a Supabase public URL
      let targetBucket = supabaseBucket || ''
      let targetKey = pdf.key
      if ((!targetKey || !targetBucket) && pdf.url && typeof pdf.url === 'string') {
        try {
          const u = new URL(pdf.url)
          // match /storage/v1/object/public/{bucket}/{key...}
          const m = u.pathname.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/)
          if (m) {
            targetBucket = m[1]
            targetKey = decodeURIComponent(m[2])
            // If this is a Supabase public URL but the server lacks a service role key, refuse to silently localize
            if ((!!m) && !(supabaseUrl && supabaseKey)) {
              console.error('Stamp: Supabase public URL detected but SUPABASE_SERVICE_ROLE_KEY not configured on server')
              return res.status(500).json({ error: 'Cannot overwrite Supabase object: server is not configured with SUPABASE_SERVICE_ROLE_KEY. Configure the Service Role key to allow overwriting files in storage.' })
            }
          }
        } catch (e) {
          // ignore URL parsing errors
        }
      }

      // If we have a Supabase key/bucket, attempt to overwrite the same object
      const useR2 = String(process.env.STORAGE_PROVIDER || '').toLowerCase() === 'r2' || Boolean(process.env.CF_R2_ENDPOINT)

      if (useR2 && targetKey && (process.env.CF_R2_BUCKET || targetBucket)) {
        try {
          const { uploadBuffer, getSignedDownloadUrl, downloadToBuffer, getPublicUrl } = await import('../lib/r2-storage')
          const finalKey = targetKey
          // attempt upload with retries
          let uploadErr: any = null
          const maxAttempts = 3
          let newUrl = ''
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              newUrl = await uploadBuffer(finalKey, outBuf, 'application/pdf', '0')
              uploadErr = null
              break
            } catch (e: any) {
              uploadErr = e
              console.warn(`Stamp: R2 upload attempt ${attempt} failed:`, String(e?.message || e))
              await new Promise((res) => setTimeout(res, attempt * 300))
            }
          }
          if (uploadErr) {
            console.error('Stamp: R2 upload final failure:', uploadErr)
            throw uploadErr
          }

          // try to create signed URL
          let signedUrl: string | null = null
          try {
            signedUrl = await getSignedDownloadUrl(finalKey, 60 * 60)
          } catch (e) {
            console.warn('Stamp: failed to create signed URL for R2 object:', e)
          }

          // verify uploaded content if VERIFY_UPLOADS=true; otherwise skip synchronous verification
          const VERIFY_UPLOADS = String(process.env.VERIFY_UPLOADS || '').toLowerCase() === 'true'
          if (VERIFY_UPLOADS) {
            const crypto = require('crypto')
            const outHash = crypto.createHash('sha256').update(outBuf).digest('hex')
            let downHash = ''
            const maxVerifyAttempts = 3
            let verified = false
            for (let attempt = 1; attempt <= maxVerifyAttempts; attempt++) {
              try {
                const downloadedBuf = await downloadToBuffer(finalKey)
                downHash = crypto.createHash('sha256').update(downloadedBuf).digest('hex')
                if (outHash === downHash) { verified = true; break }
                console.warn(`Stamp: verification mismatch attempt ${attempt} (R2)`)
              } catch (e) {
                console.warn(`Stamp: verification attempt ${attempt} failed:`, String((e as any)?.message || e))
              }
              await new Promise((r) => setTimeout(r, attempt * 500))
            }
            if (!verified) {
              console.error('Stamp: R2 verification final mismatch', { outHash, downHash })
              return res.status(500).json({ error: 'Stamped file failed verification after upload. Try again or contact support.' })
            }
          } else {
            console.info('Stamp: VERIFY_UPLOADS not enabled — skipping synchronous verification for R2 upload')
          }

          const stampedAt = new Date().toISOString()
          attachments[targetIndex] = { ...(attachments[targetIndex] || {}), url: signedUrl || (getPublicUrl(finalKey) || ''), size: outBuf.length, key: finalKey, bucket: process.env.CF_R2_BUCKET || targetBucket, stampedAt }
          const upd = await query('UPDATE documents SET attachments = $1 WHERE id = $2 RETURNING *', [JSON.stringify(attachments), doc.id])
          const updatedDoc = upd.rows[0]
          const parsedAttachments = Array.isArray(updatedDoc.attachments) ? updatedDoc.attachments : JSON.parse(String(updatedDoc.attachments || '[]'))
          const pdfFile = parsedAttachments && parsedAttachments.length > targetIndex ? parsedAttachments[targetIndex] : null
          const previewUrl = signedUrl || `${attachments[targetIndex].url}?t=${Date.now()}`
          return res.json({ ...updatedDoc, attachments: parsedAttachments, pdfFile, previewUrl })
        } catch (e: any) {
          console.error('Stamp: R2 upload path failed:', e)
          return res.status(500).json({ error: 'R2 upload failed; check CF_R2 settings and try again.' })
        }
      }

      const { USE_R2_ONLY } = await import('../config/storage')
      if (USE_R2_ONLY) {
        console.error('Stamp: server is configured for R2-only and will not attempt to overwrite non-R2 objects')
        return res.status(500).json({ error: 'Server is configured for R2-only storage and cannot overwrite Supabase objects.' })
      }

      if (targetKey && targetBucket && supabaseUrl && supabaseKey) {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
        // attempt upload with retries (helps transient network errors)
        let uploadErr: any = null
        const maxAttempts = 3
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const uploadOptions: any = { contentType: 'application/pdf', upsert: true, cacheControl: '0' }
        const r = await supabase.storage.from(targetBucket).upload(targetKey, outBytes, uploadOptions)
        console.debug('Stamp: supabase.upload response attempt', attempt, r)
        uploadErr = r.error
        if (!uploadErr) break
          console.warn(`Stamp: supabase upload attempt ${attempt} failed:`, uploadErr?.message || uploadErr)
          await new Promise((res) => setTimeout(res, attempt * 300))
        }
        if (uploadErr) {
          console.error('Stamp: supabase upload final failure:', { message: uploadErr.message || uploadErr, details: uploadErr })
          throw uploadErr
        }
        // refresh public URL
        const publicRes = supabase.storage.from(targetBucket).getPublicUrl(targetKey) as any
        const newUrl = publicRes?.data?.publicUrl || pdf.url
        // create a signed URL so the client can immediately fetch the updated content (bypasses CDN caches)
        let signedUrl: string | null = null
        try {
          const { data: signedData, error: signedErr } = await supabase.storage.from(targetBucket).createSignedUrl(targetKey, 60 * 60)
          if (!signedErr && signedData?.signedUrl) signedUrl = signedData.signedUrl
        } catch (e) {
          console.warn('Failed to create signed URL for stamped object:', e)
        }

        // verify uploaded content by downloading it back and comparing SHA-256 (safety check) if enabled
        const VERIFY_UPLOADS = String(process.env.VERIFY_UPLOADS || '').toLowerCase() === 'true'
        if (VERIFY_UPLOADS) {
          const crypto = require('crypto')
          const outHash = crypto.createHash('sha256').update(outBytes).digest('hex')
          let downHash = ''
          let verified = false
          const maxVerifyAttempts = 3
          for (let attempt = 1; attempt <= maxVerifyAttempts; attempt++) {
            try {
              const { data: downloadedData, error: downloadErr } = await supabase.storage.from(targetBucket).download(targetKey)
              if (downloadErr) {
                console.warn('Stamp: verification download attempt failed:', attempt, downloadErr)
                await new Promise((r) => setTimeout(r, attempt * 500))
                continue
              }
              const downloadedBuf = Buffer.from(await (downloadedData as any).arrayBuffer())
              downHash = crypto.createHash('sha256').update(downloadedBuf).digest('hex')
              if (outHash === downHash) { verified = true; break }
              console.warn(`Stamp: verification mismatch attempt ${attempt} (Supabase)`)
            } catch (e) {
              console.warn('Stamp: verification attempt error:', e)
            }
            await new Promise((r) => setTimeout(r, attempt * 500))
          }
          if (!verified) {
            console.error('Stamp: verification final mismatch after upload', { outHash, downHash })
            return res.status(500).json({ error: 'Stamped file failed verification after upload. Try again or contact support.' })
          }
        } else {
          console.info('Stamp: VERIFY_UPLOADS not enabled — skipping synchronous verification for Supabase upload')
        }

        // update attachments[targetIndex] url, size, key and mark stamp time
        const stampedAt = new Date().toISOString()
        attachments[targetIndex] = { ...(attachments[targetIndex] || {}), url: newUrl, size: outBuf.length, key: targetKey, bucket: targetBucket, stampedAt }
        const upd = await query('UPDATE documents SET attachments = $1 WHERE id = $2 RETURNING *', [JSON.stringify(attachments), doc.id])
        const updatedDoc = upd.rows[0]
        // attach pdfFile convenience property
        const parsedAttachments = Array.isArray(updatedDoc.attachments) ? updatedDoc.attachments : JSON.parse(String(updatedDoc.attachments || '[]'))
        const pdfFile = parsedAttachments && parsedAttachments.length > targetIndex ? parsedAttachments[targetIndex] : null
        // provide signedUrl and a short-lived preview URL to the client so they can open the fresh copy immediately
        const previewUrl = signedUrl || `${newUrl}?t=${Date.now()}`
        return res.json({ ...updatedDoc, attachments: parsedAttachments, pdfFile, previewUrl })
      }

      // If original was local uploads path, overwrite it
      if (pdf.url && String(pdf.url).startsWith('/uploads/')) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads')
        const fp = path.join(uploadsDir, pdf.url.replace('/uploads/', ''))
        fs.writeFileSync(fp, outBuf)
        // update size and mark stamp time
        attachments[targetIndex] = { ...(attachments[targetIndex] || {}), size: outBytes.length, stampedAt: new Date().toISOString() }
        const upd = await query('UPDATE documents SET attachments = $1 WHERE id = $2 RETURNING *', [JSON.stringify(attachments), doc.id])
        const updatedDoc = upd.rows[0]
        const parsedAttachments = Array.isArray(updatedDoc.attachments) ? updatedDoc.attachments : JSON.parse(String(updatedDoc.attachments || '[]'))
        const pdfFile = parsedAttachments && parsedAttachments.length > targetIndex ? parsedAttachments[targetIndex] : null
        const previewUrl = pdfFile?.url ? `${pdfFile.url}?t=${Date.now()}` : null
        return res.json({ ...updatedDoc, attachments: parsedAttachments, pdfFile, previewUrl })
      }

      // fallback: create new local file and replace first attachment
      const uploadsDir = path.resolve(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
      const filename = `stamped-${Date.now()}-${encodeURIComponent(barcode)}.pdf`
      const outPath = path.join(uploadsDir, filename)
      fs.writeFileSync(outPath, outBuf)
      const url = `/uploads/${filename}`
      attachments[targetIndex] = { name: filename, url, size: outBuf.length, stampedAt: new Date().toISOString() }
      const upd = await query('UPDATE documents SET attachments = $1 WHERE id = $2 RETURNING *', [JSON.stringify(attachments), doc.id])
      const updatedDoc = upd.rows[0]
      const parsedAttachments = Array.isArray(updatedDoc.attachments) ? updatedDoc.attachments : JSON.parse(String(updatedDoc.attachments || '[]'))
      const pdfFile = parsedAttachments && parsedAttachments.length > targetIndex ? parsedAttachments[targetIndex] : null
      const previewUrl = pdfFile?.url ? `${pdfFile.url}?t=${Date.now()}` : null
      return res.json({ ...updatedDoc, attachments: parsedAttachments, pdfFile, previewUrl })
    } catch (e: any) {
      console.error('Failed to save stamped file:', e)
      return res.status(500).json({ error: 'Failed to save stamped file' })
    }
  } catch (err: any) {
    console.error('Stamp error:', err)
    res.status(500).json({ error: err.message || 'Stamp failed' })
  }
})

export default router
