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

    // Enforce RBAC for stamping (stamp is an edit)
    const user = (req as any).user
    const { canAccessDocument } = await import('../lib/rbac')
    if (!canAccessDocument(user, doc)) return res.status(403).json({ error: 'Forbidden' })

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
      const useR2 = String(process.env.STORAGE_PROVIDER || '').toLowerCase() === 'r2' || Boolean(process.env.CF_R2_ENDPOINT)

      if (useR2 && pdf.key && (process.env.CF_R2_BUCKET || pdf.bucket)) {
        try {
          const { downloadToBuffer } = await import('../lib/r2-storage')
          pdfBytes = await downloadToBuffer(pdf.key)
        } catch (e) {
          console.error('Stamp: failed to download object from R2:', e)
          throw e
        }
      } else if (pdf.key && supabaseUrl && supabaseKey && supabaseBucket) {
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
      // Ensure pdf-lib can use fontkit to embed custom fonts
      let fontkitRegistered = false
      try {
        const fk = await import('@pdf-lib/fontkit')
        pdfDoc.registerFontkit((fk as any).default || fk)
        fontkitRegistered = true
      } catch (e1) {
        try {
          const fk2 = await import('fontkit')
          pdfDoc.registerFontkit((fk2 as any).default || fk2)
          fontkitRegistered = true
        } catch (e2) {
          console.warn('Stamp: fontkit not available; custom font embedding may fail')
        }
      }

      const fontDirs = [
        // dev repo layout
        path.resolve(process.cwd(), 'backend', 'assets', 'fonts'),
        path.resolve(process.cwd(), 'assets', 'fonts'),
        path.resolve(process.cwd(), 'assets'),
        path.resolve(process.cwd(), 'fonts'),
        // paths relative to compiled code (dist) on production
        path.resolve(__dirname, '..', '..', 'assets', 'fonts'),
        path.resolve(__dirname, '..', '..', 'assets'),
        path.resolve(__dirname, '..', '..', '..', 'assets', 'fonts'),
        path.resolve(__dirname, '..', '..', '..', 'backend', 'assets', 'fonts'),
      ]
      let fontFiles: string[] = []
      for (const d of fontDirs) {
        try {
          if (fs.existsSync(d)) {
            // include TTF/OTF/WOFF/WOFF2 files but validate magic bytes so we skip corrupted (HTML) files
            const list = fs.readdirSync(d).filter((f) => /(\.ttf|\.otf|\.woff2?|\.woff)$/i.test(f)).map((f) => path.join(d, f))
            const valid: string[] = []
            for (const p of list) {
              try {
                const headBuf = fs.readFileSync(p)
                const h = Buffer.from(headBuf.slice(0, 4))
                const isTTF = h.equals(Buffer.from([0x00, 0x01, 0x00, 0x00]))
                const isOTF = h.toString('ascii') === 'OTTO'
                const isTTC = h.toString('ascii') === 'ttcf'
                const isWOFF2 = h.toString('hex').startsWith('774f4632') // 'wOF2'
                const isWOFF = h.toString('ascii').toLowerCase().startsWith('wof') || h.toString('hex').startsWith('774f4630')
                if (isTTF || isOTF || isTTC || isWOFF || isWOFF2) {
                  valid.push(p)
                } else {
                  console.warn('Stamp: skipping invalid/corrupted font file:', p, 'head=', h.toString('hex'))
                }
              } catch (e) {
                // ignore read errors
              }
            }
            if (valid.length) {
              fontFiles = fontFiles.concat(valid)
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

      // debug: list discovered font files
      console.debug('Stamp: discovered font files:', fontFiles)

      if (chosen) {
        console.debug('Stamp: chosen font:', chosen)
        if (!fontkitRegistered) {
          console.error('Stamp: cannot embed custom font because fontkit is not registered')
          return res.status(500).json({ error: 'Server is missing the fontkit integration required to embed custom TTF/OTF fonts. Install and enable @pdf-lib/fontkit (or fontkit) on the server.' })
        }
        try {
          const fontBuf = fs.readFileSync(chosen)
          // basic sanity: check font magic bytes (TTF/OTF/ttcf)
          const head = Buffer.from(fontBuf.slice(0,4))
          const isTTF = head.equals(Buffer.from([0x00,0x01,0x00,0x00]))
          const isOTF = head.toString('ascii') === 'OTTO'
          const isTTC = head.toString('ascii') === 'ttcf'
          const isWOFF = head.toString('ascii') === 'wOFF'
          const isWOFF2 = head.toString('ascii') === 'wOF2'
          if (!isTTF && !isOTF && !isTTC && !isWOFF && !isWOFF2) {
            console.error('Stamp: chosen font file failed magic-byte check:', chosen, 'head=', head.toString('hex'))
            throw new Error('Unknown font format')
          }
          helv = await pdfDoc.embedFont(fontBuf)
        } catch (embedErr) {
          console.error('Stamp: failed to embed chosen font file:', chosen, embedErr)
          // attempt explicit known-file fallback (Noto files checked-in)
          try {
            const maybeNames = [
              'NotoSansArabic-Regular.ttf',
              'NotoSansArabic-Bold.ttf',
              'NotoSansArabic-Regular.woff2',
              'NotoSansArabic-Bold.woff2',
              'NotoSansArabic-Regular.woff',
              'NotoSansArabic-Bold.woff'
            ]
            const candidates: string[] = []
            for (const n of maybeNames) {
              const p1 = path.resolve(process.cwd(), 'backend', 'assets', 'fonts', n)
              const p2 = path.resolve(__dirname, '..', '..', 'backend', 'assets', 'fonts', n)
              if (fs.existsSync(p1)) candidates.push(p1)
              if (fs.existsSync(p2)) candidates.push(p2)
            }
            if (candidates.length) {
              console.debug('Stamp: attempting embed of checked-in Noto font at', candidates[0])
              const fb = fs.readFileSync(candidates[0])
              // magic check
              const h = Buffer.from(fb.slice(0,4))
              const isTTF_ = h.equals(Buffer.from([0x00,0x01,0x00,0x00]))
              const isOTF_ = h.toString('ascii') === 'OTTO'
              const isTTC_ = h.toString('ascii') === 'ttcf'
              const isWOFF_ = h.toString('ascii') === 'wOFF'
              const isWOFF2_ = h.toString('ascii') === 'wOF2'
              if (!isTTF_ && !isOTF_ && !isTTC_ && !isWOFF_ && !isWOFF2_) {
                console.error('Stamp: checked-in Noto font file is invalid/malformed:', candidates[0], 'head=', h.toString('hex'))
                throw new Error('Unknown font format')
              }
              helv = await pdfDoc.embedFont(fb)
            } else {
              throw embedErr
            }
          } catch (fallbackErr) {
            console.error('Stamp: fallback embed also failed:', fallbackErr)
            return res.status(500).json({ error: 'Failed to embed chosen font for stamping. Ensure a UTF-8 TTF/OTF font (e.g., NotoSansArabic) is present in backend/assets/fonts and that fontkit is installed.' })
          }
        }

        // try to find a bold variant nearby
        const boldCandidate = fontFiles.find(f => boldRe.test(path.basename(f)))
        if (boldCandidate) {
          try { helvBold = await pdfDoc.embedFont(fs.readFileSync(boldCandidate)) } catch(e) { helvBold = helv }
        } else {
          helvBold = helv
        }
      } else {
        // no local font found: attempt runtime download of Noto Sans Arabic as a fallback
        console.warn('Stamp: no local TTF/OTF font found in assets; attempting runtime download of Noto Sans Arabic')
        try {
          const notoCandidates = [
            { url: 'https://github.com/googlefonts/noto-fonts/raw/main/phaseIII_only/unhinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf' , name: 'regular.ttf' },
            { url: 'https://github.com/googlefonts/noto-fonts/raw/main/phaseIII_only/unhinted/ttf/NotoSansArabic/NotoSansArabic-Bold.ttf' , name: 'bold.ttf' },
            // fallback to packaged woff2 on unpkg (reliable CDN)
            { url: 'https://unpkg.com/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff2', name: 'regular.woff2' },
            { url: 'https://unpkg.com/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff2', name: 'bold.woff2' }
          ]
          try {
            for (const cand of notoCandidates) {
              try {
                const r = await fetch(cand.url)
                const ct = String(r.headers.get('content-type') || '')
                if (r.ok && /font|octet|application|woff/i.test(ct)) {
                  const buf = Buffer.from(await r.arrayBuffer())
                  try {
                    helv = helv || (fontkitRegistered ? await pdfDoc.embedFont(buf) : undefined)
                    if (cand.name.includes('bold')) helvBold = helvBold || (fontkitRegistered ? await pdfDoc.embedFont(buf) : undefined)
                    if (helv && helvBold) break
                  } catch (e) {
                    console.warn('Stamp: downloaded font candidate not embedable:', cand.url, String(e))
                  }
                } else {
                  console.warn('Stamp: runtime candidate returned non-font content-type', cand.url, ct)
                }
              } catch (e) {
                console.warn('Stamp: runtime candidate fetch failed', cand.url, String(e))
              }
            }
          } catch (e) {
            console.warn('Stamp: runtime font candidate loop failed', e)
          }
          // if download didn't produce fonts, fall back
          if (!helv) {
            console.warn('Stamp: runtime download failed or fonts not embedable; falling back to standard fonts')
            helv = await pdfDoc.embedFont(StandardFonts.Helvetica)
            helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
          }
          // if download didn't produce fonts, fall back
          if (!helv) {
            console.warn('Stamp: runtime download failed or fonts not embedable; falling back to standard fonts')
            helv = await pdfDoc.embedFont(StandardFonts.Helvetica)
            helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
          }
        } catch (e) {
          console.warn('Stamp: runtime font download failed:', e)
          helv = await pdfDoc.embedFont(StandardFonts.Helvetica)
          helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        }
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
    // Normalize and attempt to repair possible mojibake/mis-encoding for Arabic fields
    const rawCompany = String(doc.company || doc.sender || doc.user || '')
    function repairArabicEncoding(s: string) {
      if (!s) return s
      try {
        // If it already contains Arabic chars, assume it's OK
        const hasArabic = (s.match(/[\u0600-\u06FF]/g) || []).length > 0
        if (hasArabic) return s.normalize('NFC')
        const iconv = require('iconv-lite')
        const decoded = iconv.decode(Buffer.from(String(s), 'binary'), 'windows-1256')
        const decodedArabicCount = (decoded.match(/[\u0600-\u06FF]/g) || []).length
        if (decodedArabicCount > 0) return decoded.normalize('NFC')
      } catch (e) {
        // ignore
      }
      return s.normalize('NFC')
    }

    const companyName = repairArabicEncoding(rawCompany)

    // Smart date: if doc.date is date-only (YYYY-MM-DD) it becomes midnight; merge with created_at time when available
    const dateSource = doc.date || doc.created_at || new Date().toISOString()
    let dateStr = ''
    try {
      const ds = String(dateSource)
      let dateObj = new Date(ds)
      // treat midnight timestamps as date-only and merge with created_at time when available
      const isMidnight = dateObj.getHours() === 0 && dateObj.getMinutes() === 0 && dateObj.getSeconds() === 0
      if (isMidnight && doc.created_at) {
        const c = new Date(String(doc.created_at))
        if (!isNaN(c.getTime())) dateObj.setHours(c.getHours(), c.getMinutes(), c.getSeconds())
      }

      // Format in Arabic locale
      let formatted = dateObj.toLocaleString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      // Convert European digits to Arabic-Indic digits (0-9 -> ٠-٩)
      const arabicIndicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩']
      formatted = formatted.replace(/[0-9]/g, (d) => arabicIndicDigits[Number(d)])
      dateStr = formatted
    } catch (e) {
      dateStr = String(dateSource)
    }

    // Attempt Arabic shaping/bi-di for proper glyph forms when possible
    function shapeArabicText(s: string) {
      try {
        const reshaper = require('arabic-reshaper')
        let r = reshaper.reshape(String(s))
        try {
          const bidi = require('bidi-js')
          if (typeof bidi.get_display === 'function') {
            r = bidi.get_display(r)
          } else if (typeof bidi.getSorted === 'function') {
            r = (bidi.getSorted(r) || []).join('')
          } else {
            r = r.split('').reverse().join('')
          }
        } catch (e) {
          r = r.split('').reverse().join('')
        }
        return r
      } catch (e) {
        return String(s)
      }
    }

    const companySize = 11
    const barcodeSize = 9
    const dateSize = 9

    // Convert digits for display to Arabic-Indic numerals
    const arabicIndicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩']
    const displayBarcode = String(barcode || '').replace(/[0-9]/g, (d) => arabicIndicDigits[Number(d)])
    const displayDate = String(dateStr).replace(/[0-9]/g, (d) => arabicIndicDigits[Number(d)])
    const displayCompany = shapeArabicText(companyName)

    const companyWidth = helvBold.widthOfTextAtSize(displayCompany, companySize)
    const barcodeWidth = helv.widthOfTextAtSize(displayBarcode, barcodeSize)
    const dateWidth = helv.widthOfTextAtSize(displayDate, dateSize)

    const companyX = centerX - (companyWidth / 2)
    const barcodeX = centerX - (barcodeWidth / 2)
    const dateX = centerX - (dateWidth / 2)

    const companyY = yPdf - gap
    const barcodeY = companyY - companySize - 4
    const dateY = barcodeY - barcodeSize - 2

    if (companyName) {
      page.drawText(displayCompany, { x: companyX, y: companyY, size: companySize, font: helvBold, color: rgb(0,0,0) })
    }

    // barcode identifier centered below company
    page.drawText(displayBarcode, { x: barcodeX, y: barcodeY, size: barcodeSize, font: helv, color: rgb(0,0,0) })

    // timestamp centered below
    page.drawText(displayDate, { x: dateX, y: dateY, size: dateSize, font: helv, color: rgb(0,0,0) })

    const outBytes = await pdfDoc.save()
    // normalize to Buffer for consistency when uploading/verifying
    const outBuf = Buffer.from(outBytes)

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

          // verify uploaded content
          try {
            const downloadedBuf = await downloadToBuffer(finalKey)
            const crypto = require('crypto')
            const outHash = crypto.createHash('sha256').update(outBuf).digest('hex')
            const downHash = crypto.createHash('sha256').update(downloadedBuf).digest('hex')
            if (outHash !== downHash) {
              console.error('Stamp: verification mismatch after R2 upload', { outHash, downHash })
              throw new Error('Uploaded file verification failed (hash mismatch)')
            }
          } catch (verErr) {
            console.error('Stamp: R2 verification error:', verErr)
            return res.status(500).json({ error: 'Stamped file failed verification after upload. Try again or contact support.' })
          }

          const stampedAt = new Date().toISOString()
          attachments[0] = { ...(attachments[0] || {}), url: signedUrl || (getPublicUrl(finalKey) || ''), size: outBuf.length, key: finalKey, bucket: process.env.CF_R2_BUCKET || targetBucket, stampedAt }
          const upd = await query('UPDATE documents SET attachments = $1 WHERE id = $2 RETURNING *', [JSON.stringify(attachments), doc.id])
          const updatedDoc = upd.rows[0]
          const parsedAttachments = Array.isArray(updatedDoc.attachments) ? updatedDoc.attachments : JSON.parse(String(updatedDoc.attachments || '[]'))
          const pdfFile = parsedAttachments && parsedAttachments.length ? parsedAttachments[0] : null
          const previewUrl = signedUrl || `${attachments[0].url}?t=${Date.now()}`
          return res.json({ ...updatedDoc, attachments: parsedAttachments, pdfFile, previewUrl })
        } catch (e: any) {
          console.error('Stamp: R2 upload path failed:', e)
          return res.status(500).json({ error: 'R2 upload failed; check CF_R2 settings and try again.' })
        }
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
        attachments[0] = { ...(attachments[0] || {}), url: newUrl, size: outBuf.length, key: targetKey, bucket: targetBucket, stampedAt }
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
        fs.writeFileSync(fp, outBuf)
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
      fs.writeFileSync(outPath, outBuf)
      const url = `/uploads/${filename}`
      attachments[0] = { name: filename, url, size: outBuf.length, stampedAt: new Date().toISOString() }
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
