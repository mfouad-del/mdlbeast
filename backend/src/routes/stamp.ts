import express from 'express'
import { query } from '../config/database'
import fetch from 'node-fetch'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import { authenticateToken } from '../middleware/auth'

const router = express.Router()
router.use(authenticateToken)

// POST /:barcode/stamp { x, y, containerWidth, containerHeight, stampWidth }
router.post('/:barcode/stamp', async (req, res) => {
  try {
    const { barcode } = req.params
    const { x = 20, y = 20, containerWidth, containerHeight, stampWidth = 180, page: pageIndex = 0 } = req.body || {}

    const d = await query('SELECT * FROM documents WHERE barcode = $1 LIMIT 1', [barcode])
    if (d.rows.length === 0) return res.status(404).json({ error: 'Document not found' })
    const doc = d.rows[0]

    // find pdf url in attachments (first attachment)
    const attachments = doc.attachments || []
    const pdf = Array.isArray(attachments) && attachments.length ? attachments[0] : null
    if (!pdf || !pdf.url) return res.status(400).json({ error: 'No PDF attached to stamp' })

    // fetch pdf bytes (support Supabase key, local uploads, or external URL)
    let pdfBytes: Buffer
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabaseKey = String(supabaseKeyRaw).trim()
    const supabaseBucket = process.env.SUPABASE_BUCKET || ''

    console.debug('Stamp request start:', { barcode, pdfUrl: pdf?.url, pdfKey: pdf?.key, supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey, supabaseBucket })

    try {
      if (pdf.key && supabaseUrl && supabaseKey && supabaseBucket) {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })
        const { data: downloadData, error: downloadErr } = await supabase.storage.from(supabaseBucket).download(pdf.key)
        if (downloadErr) {
          console.error('Stamp: failed to download object from Supabase:', downloadErr)
          throw downloadErr
        }
        pdfBytes = Buffer.from(await (downloadData as any).arrayBuffer())
      } else if (pdf.url && String(pdf.url).startsWith('/uploads/')) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads')
        const fp = path.join(uploadsDir, pdf.url.replace('/uploads/', ''))
        pdfBytes = fs.readFileSync(fp)
      } else {
        const r = await fetch(pdf.url)
        if (!r.ok) return res.status(500).json({ error: 'Failed to fetch PDF' })
        pdfBytes = Buffer.from(await r.arrayBuffer())
      }
    } catch (e: any) {
      console.error('Failed to load PDF bytes:', e)
      return res.status(500).json({ error: 'Failed to load PDF for stamping' })
    }

    // fetch barcode image (PNG) via bwipjs public API
    const bcUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(barcode)}&scale=2&includetext=false`
    const imgResp = await fetch(bcUrl)
    if (!imgResp.ok) return res.status(500).json({ error: 'Failed to generate barcode image' })
    const imgBytes = Buffer.from(await imgResp.arrayBuffer())

    // embed image and text into PDF
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pngImage = await pdfDoc.embedPng(imgBytes)
    // embed readable fonts for annotations (prefer a local TTF/OTF that supports Arabic)
    let helv: any
    let helvBold: any
    try {
      const fontDirs = [
        path.resolve(process.cwd(), 'backend', 'assets', 'fonts'),
        path.resolve(process.cwd(), 'assets', 'fonts'),
        path.resolve(process.cwd(), 'assets'),
        path.resolve(process.cwd(), 'fonts'),
      ]
      let fontFiles: string[] = []
      for (const d of fontDirs) {
        try {
          if (fs.existsSync(d)) {
            const list = fs.readdirSync(d).filter((f) => /(\.ttf|\.otf)$/i.test(f)).map((f) => path.join(d, f))
            if (list.length) {
              fontFiles = fontFiles.concat(list)
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // Prefer named Arabic-support fonts if present
      let chosen: string | null = null
      const preferRe = /(noto|arab|dejavu|arial|amiri|tajawal|uthman|scheherazade|sukar)/i
      const boldRe = /(bold|bld|-b|bd)/i
      if (fontFiles.length) {
        // try to find an Arabic-looking font first
        const prefer = fontFiles.find(f => preferRe.test(path.basename(f)))
        if (prefer) chosen = prefer
        else chosen = fontFiles[0]
      }

      if (chosen) {
        const fontBuf = fs.readFileSync(chosen)
        helv = await pdfDoc.embedFont(fontBuf)
        // try to find a bold variant nearby
        const boldCandidate = fontFiles.find(f => boldRe.test(path.basename(f)))
        if (boldCandidate) {
          try { helvBold = await pdfDoc.embedFont(fs.readFileSync(boldCandidate)) } catch(e) { helvBold = helv }
        } else {
          helvBold = helv
        }
      } else {
        // no local font found, fall back to standard fonts (may not support Arabic)
        console.warn('Stamp: no local TTF/OTF font found in assets; Arabic characters may not be renderable.')
        helv = await pdfDoc.embedFont(StandardFonts.Helvetica)
        helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      }
    } catch (e) {
      console.error('Stamp: failed to embed custom font:', e)
      // If embedding fails (or no font present) return a helpful error so user/admin can add a UTF-8 font file
      return res.status(500).json({ error: 'Failed to embed font for stamping. Ensure a UTF-8 TTF/OTF font (e.g., NotoSansArabic, DejaVuSans, Amiri) is present in backend/assets/fonts.' })
    }

    const pages = pdfDoc.getPages()
    const page = pages[Math.max(0, Math.min(pageIndex, pages.length - 1))]
    const { width: pageWidth, height: pageHeight } = page.getSize()

    // compute image size in PDF units based on provided stampWidth (px) and container size
    let widthPdf: number
    let heightPdf: number
    const imgWidth = pngImage.width || 200
    const imgHeight = pngImage.height || 50

    if (containerWidth && containerHeight) {
      const cw = Number(containerWidth)
      widthPdf = (Number(stampWidth) / cw) * pageWidth
      heightPdf = widthPdf * (imgHeight / imgWidth)
    } else {
      const scaled = pngImage.scale(0.6)
      widthPdf = scaled.width
      heightPdf = scaled.height
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

    // draw barcode image
    page.drawImage(pngImage, {
      x: xPdf,
      y: yPdf,
      width: widthPdf,
      height: heightPdf,
    })

    // draw centered, styled annotation (company name + barcode text + date)
    const centerX = xPdf + widthPdf / 2
    const gap = 6
    const companyName = String(doc.company || doc.sender || doc.user || '')
    const dateSource = doc.date || doc.created_at || new Date().toISOString()
    let dateStr = ''
    try {
      dateStr = new Date(dateSource).toLocaleString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch (e) {
      dateStr = String(dateSource)
    }

    const companySize = 11
    const barcodeSize = 9
    const dateSize = 9

    const companyWidth = helvBold.widthOfTextAtSize(companyName, companySize)
    const barcodeWidth = helv.widthOfTextAtSize(barcode, barcodeSize)
    const dateWidth = helv.widthOfTextAtSize(dateStr, dateSize)

    const companyX = centerX - (companyWidth / 2)
    const barcodeX = centerX - (barcodeWidth / 2)
    const dateX = centerX - (dateWidth / 2)

    const companyY = yPdf - gap
    const barcodeY = companyY - companySize - 4
    const dateY = barcodeY - barcodeSize - 2

    if (companyName) {
      page.drawText(companyName, { x: companyX, y: companyY, size: companySize, font: helvBold, color: rgb(0,0,0) })
    }

    // barcode identifier centered below company
    page.drawText(String(barcode || ''), { x: barcodeX, y: barcodeY, size: barcodeSize, font: helv, color: rgb(0,0,0) })

    // timestamp centered below
    page.drawText(dateStr, { x: dateX, y: dateY, size: dateSize, font: helv, color: rgb(0,0,0) })

    const outBytes = await pdfDoc.save()

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

        // verify uploaded content by downloading it back and comparing SHA-256 (safety check)
        try {
          const { data: downloadedData, error: downloadErr } = await supabase.storage.from(targetBucket).download(targetKey)
          if (downloadErr) {
            console.error('Stamp: verification download failed:', downloadErr)
            throw downloadErr
          }
          const downloadedBuf = Buffer.from(await (downloadedData as any).arrayBuffer())
          const crypto = require('crypto')
          const outHash = crypto.createHash('sha256').update(outBytes).digest('hex')
          const downHash = crypto.createHash('sha256').update(downloadedBuf).digest('hex')
          if (outHash !== downHash) {
            console.error('Stamp: verification mismatch after upload', { outHash, downHash })
            throw new Error('Uploaded file verification failed (hash mismatch)')
          }
        } catch (verErr) {
          console.error('Stamp: verification error:', verErr)
          // Do not silently continue; report failure so client knows stamp didn't actually persist
          return res.status(500).json({ error: 'Stamped file failed verification after upload. Try again or contact support.' })
        }

        // update attachments[0] url, size, key and mark stamp time
        const stampedAt = new Date().toISOString()
        attachments[0] = { ...(attachments[0] || {}), url: newUrl, size: outBytes.length, key: targetKey, bucket: targetBucket, stampedAt }
        const upd = await query('UPDATE documents SET attachments = $1 WHERE id = $2 RETURNING *', [JSON.stringify(attachments), doc.id])
        const updatedDoc = upd.rows[0]
        // attach pdfFile convenience property
        const parsedAttachments = Array.isArray(updatedDoc.attachments) ? updatedDoc.attachments : JSON.parse(String(updatedDoc.attachments || '[]'))
        const pdfFile = parsedAttachments && parsedAttachments.length ? parsedAttachments[0] : null
        // provide signedUrl and a short-lived preview URL to the client so they can open the fresh copy immediately
        const previewUrl = signedUrl || `${newUrl}?t=${Date.now()}`
        return res.json({ ...updatedDoc, attachments: parsedAttachments, pdfFile, previewUrl })
      }

      // If original was local uploads path, overwrite it
      if (pdf.url && String(pdf.url).startsWith('/uploads/')) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads')
        const fp = path.join(uploadsDir, pdf.url.replace('/uploads/', ''))
        fs.writeFileSync(fp, outBytes)
        // update size and mark stamp time
        attachments[0] = { ...(attachments[0] || {}), size: outBytes.length, stampedAt: new Date().toISOString() }
        const upd = await query('UPDATE documents SET attachments = $1 WHERE id = $2 RETURNING *', [JSON.stringify(attachments), doc.id])
        const updatedDoc = upd.rows[0]
        const parsedAttachments = Array.isArray(updatedDoc.attachments) ? updatedDoc.attachments : JSON.parse(String(updatedDoc.attachments || '[]'))
        const pdfFile = parsedAttachments && parsedAttachments.length ? parsedAttachments[0] : null
        const previewUrl = pdfFile?.url ? `${pdfFile.url}?t=${Date.now()}` : null
        return res.json({ ...updatedDoc, attachments: parsedAttachments, pdfFile, previewUrl })
      }

      // fallback: create new local file and replace first attachment
      const uploadsDir = path.resolve(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
      const filename = `stamped-${Date.now()}-${encodeURIComponent(barcode)}.pdf`
      const outPath = path.join(uploadsDir, filename)
      fs.writeFileSync(outPath, outBytes)
      const url = `/uploads/${filename}`
      attachments[0] = { name: filename, url, size: outBytes.length, stampedAt: new Date().toISOString() }
      const upd = await query('UPDATE documents SET attachments = $1 WHERE id = $2 RETURNING *', [JSON.stringify(attachments), doc.id])
      const updatedDoc = upd.rows[0]
      const parsedAttachments = Array.isArray(updatedDoc.attachments) ? updatedDoc.attachments : JSON.parse(String(updatedDoc.attachments || '[]'))
      const pdfFile = parsedAttachments && parsedAttachments.length ? parsedAttachments[0] : null
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
