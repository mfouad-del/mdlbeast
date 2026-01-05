import express from 'express'
import { query } from '../config/database'
import fetch from 'node-fetch'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import { authenticateToken } from '../middleware/auth'
import { processArabicText } from '../lib/arabic-utils'

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

      // Prefer named Arabic-support fonts if present; prefer TTF/OTF (Noto Sans Arabic) when available
      let chosen: string | null = null
      const preferRe = /(noto|arab|dejavu|arial|amiri|tajawal|uthman|scheherazade|sukar)/i
      const boldRe = /(bold|bld|-b|bd)/i

      if (fontFiles.length) {
        // Prefer explicit NotoSansArabic TTF first
        const notoTtf = fontFiles.find(f => /NotoSansArabic.*\.ttf$/i.test(path.basename(f)))
        if (notoTtf) {
          chosen = notoTtf
        } else {
          // try to find an Arabic-looking font first
          const prefer = fontFiles.find(f => preferRe.test(path.basename(f)))
          if (prefer) chosen = prefer
          else chosen = fontFiles[0]
        }
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
          // basic sanity: check font magic bytes (TTF/OTF/ttcf/WOFF/WOFF2)
          const head = Buffer.from(fontBuf.slice(0,4))
          const isTTF = head.equals(Buffer.from([0x00,0x01,0x00,0x00]))
          const isOTF = head.toString('ascii') === 'OTTO'
          const isTTC = head.toString('ascii') === 'ttcf'
          const isWOFF = head.toString('ascii').toLowerCase().startsWith('wof') || head.toString('hex').startsWith('774f4630')
          const isWOFF2 = head.toString('hex').startsWith('774f4632') // 'wOF2'
          if (!isTTF && !isOTF && !isTTC && !isWOFF && !isWOFF2) {
            console.error('Stamp: chosen font file failed magic-byte check:', chosen, 'head=', head.toString('hex'))
            throw new Error('Unknown font format')
          }

          // Prefer embedding TTF/OTF; if chosen is woff/woff2, still attempt but log a warning
          if (isWOFF || isWOFF2) console.warn('Stamp: chosen font is WOFF/WOFF2; TTF/OTF preferred for reliable Arabic shaping')
          helv = await pdfDoc.embedFont(fontBuf)

          // If we embedded a WOFF/WOFF2, attempt to fetch a TTF Noto Sans Arabic as a better fallback
          if ((isWOFF || isWOFF2) && fontkitRegistered) {
            try {
              const ttfUrl = 'https://github.com/googlefonts/noto-fonts/raw/main/phaseIII_only/unhinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf'
              const boldUrl = 'https://github.com/googlefonts/noto-fonts/raw/main/phaseIII_only/unhinted/ttf/NotoSansArabic/NotoSansArabic-Bold.ttf'
              const r1 = await fetch(ttfUrl)
              if (r1.ok) {
                const buf1 = Buffer.from(await r1.arrayBuffer())
                try {
                  helv = await pdfDoc.embedFont(buf1)
                  console.debug('Stamp: replaced WOFF font with runtime downloaded NotoSansArabic-Regular.ttf')
                } catch (e) {
                  // ignore
                }
              }
              const r2 = await fetch(boldUrl)
              if (r2.ok) {
                const buf2 = Buffer.from(await r2.arrayBuffer())
                try {
                  helvBold = await pdfDoc.embedFont(buf2)
                  console.debug('Stamp: replaced WOFF bold with runtime downloaded NotoSansArabic-Bold.ttf')
                } catch (e) {
                  // ignore
                }
              }
            } catch (e) {
              console.warn('Stamp: runtime TTF replacement attempt failed', e)
            }
          }
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

        // try to find a bold TTF/OTF variant nearby (prefer TTF/OTF over WOFF)
        const boldTtf = fontFiles.find(f => boldRe.test(path.basename(f)) && /\.(ttf|otf|ttcf)$/i.test(f))
        const boldCandidate = boldTtf || fontFiles.find(f => boldRe.test(path.basename(f)))
        if (boldCandidate) {
          try { helvBold = await pdfDoc.embedFont(fs.readFileSync(boldCandidate)) } catch(e) { helvBold = helv }
        } else {
          helvBold = helv
        }
      } else {
        // No local TTF/OTF font found. By default we require local fonts to avoid flaky runtime downloads.
        const allowRuntime = String(process.env.ALLOW_RUNTIME_FONT_DOWNLOAD || '').toLowerCase() === 'true'
        if (!allowRuntime) {
          console.error('Stamp: no local TTF fonts found and runtime font download is disabled')
          return res.status(500).json({ error: 'Missing local fonts. Place NotoSansArabic-Regular.ttf and NotoSansArabic-Bold.ttf in backend/assets/fonts or enable runtime download by setting ALLOW_RUNTIME_FONT_DOWNLOAD=true' })
        }

        console.warn('Stamp: no local TTF/OTF font found in assets; ALLOW_RUNTIME_FONT_DOWNLOAD=true so attempting runtime TTF fetch')
        try {
          const notoCandidates = [
            { url: 'https://github.com/googlefonts/noto-fonts/raw/main/phaseIII_only/unhinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf' , name: 'regular.ttf' },
            { url: 'https://github.com/googlefonts/noto-fonts/raw/main/phaseIII_only/unhinted/ttf/NotoSansArabic/NotoSansArabic-Bold.ttf' , name: 'bold.ttf' }
          ]
          try {
            for (const cand of notoCandidates) {
              try {
                const r = await fetch(cand.url)
                const ct = String(r.headers.get('content-type') || '')
                if (r.ok && /font|octet|application/i.test(ct)) {
                  const buf = Buffer.from(await r.arrayBuffer())
                  try {
                    if (!helv && fontkitRegistered) helv = await pdfDoc.embedFont(buf)
                    if (cand.name.toLowerCase().includes('bold') && fontkitRegistered) helvBold = helvBold || await pdfDoc.embedFont(buf)
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

          // If we still don't have fonts, fail loudly so operator can add local files
          if (!helv) {
            console.error('Stamp: runtime font download did not produce embedable fonts')
            return res.status(500).json({ error: 'Failed to fetch usable font files at runtime. Place NotoSansArabic TTFs in backend/assets/fonts manually.' })
          }
        } catch (e) {
          console.warn('Stamp: runtime font download failed:', e)
          return res.status(500).json({ error: 'Runtime font download failed and no local fonts available.' })
        }
      }
    } catch (e) {
      console.error('Stamp: failed to embed custom font:', e)
      // If embedding fails (or no font present) return a helpful error so user/admin can add a UTF-8 font file
      return res.status(500).json({ error: 'Failed to embed font for stamping. Ensure a UTF-8 TTF/OTF font (e.g., NotoSansArabic, DejaVuSans, Amiri) is present in backend/assets/fonts.' })
    }
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

    // Reduce stamp/barcode height to make the overall stamp less tall.
    // Keep width unchanged; only scale vertically.
    const heightScale = 0.50
    heightPdf = heightPdf * heightScale

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

    // Prefer an English company name for the stamp when possible (avoid Arabic shaping issues)
    let companyNameEnglish = ''
    try {
      // first prefer explicit English fields if present
      companyNameEnglish = String(doc.company_en || doc.companyEn || doc.companyNameEn || '').trim()
      // if none, try to read tenant name (may be English)
      if (!companyNameEnglish && doc.tenant_id) {
        try {
          const t = await query('SELECT name FROM tenants WHERE id = $1 LIMIT 1', [doc.tenant_id])
          if (t.rows.length) companyNameEnglish = String(t.rows[0].name || '').trim()
        } catch (e) {
          // ignore
        }
      }
      // fallback to configured org name or a sensible default
      if (!companyNameEnglish) companyNameEnglish = process.env.ORG_NAME_EN || 'Zaco'
    } catch (e) {
      companyNameEnglish = process.env.ORG_NAME_EN || 'Zaco'
    }

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

    // Arabic rendering: pdf-lib doesn't do shaping/BiDi, so we pre-process via processArabicText.

    // Convert digits for display to Arabic-Indic numerals
    const arabicIndicDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩']
    const displayBarcode = String(barcode || '').replace(/[0-9]/g, (d) => arabicIndicDigits[Number(d)])

    // Recompute date object to format both Gregorian and Hijri representations
    let dateObjForLabel: Date
    try { dateObjForLabel = new Date(String(dateSource)) } catch (e) { dateObjForLabel = new Date() }

    // If date was stored as date-only at midnight, attempt to merge created_at time (same as earlier logic)
    if (dateObjForLabel.getHours() === 0 && dateObjForLabel.getMinutes() === 0 && dateObjForLabel.getSeconds() === 0 && doc.created_at) {
      const c = new Date(String(doc.created_at))
      if (!isNaN(c.getTime())) dateObjForLabel.setHours(c.getHours(), c.getMinutes(), c.getSeconds())
    }

    const gregFmt = new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(dateObjForLabel)
    const hijriFmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { day: '2-digit', month: 'short', year: 'numeric' }).format(dateObjForLabel)

    const displayGregorian = String(gregFmt).replace(/[0-9]/g, (d) => arabicIndicDigits[Number(d)])
    const displayHijri = String(hijriFmt).replace(/[0-9]/g, (d) => arabicIndicDigits[Number(d)])

    // Ensure there is an English date string for the sticker as well
    const engFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(dateObjForLabel)
    const displayEnglishDate = String(engFmt)
    // Ensure we have a Latin-digit barcode for machine-readability
    const displayBarcodeLatin = String(barcode || '')
    
    // Get attachment count/description from attachment_count (can be text like "1 اسطوانة")
    // Convert any Latin digits to Arabic-Indic digits to avoid mixed-direction rendering issues.
    const attachmentTextRaw = String(doc.attachment_count || '0')
    const attachmentText = attachmentTextRaw.replace(/[0-9]/g, (d) => arabicIndicDigits[Number(d)])
    // NOTE: For RTL manual drawing, a space AFTER ':' tends to show up as a space BEFORE ':' visually.
    // So we avoid the space after ':' here.
    const rawAttachmentLabel = `نوعية المرفقات: ${attachmentText}`
    
    // Use the new robust Arabic processing utility
    // const { processArabicText } = await import('../lib/arabic-utils')
    const anchoredAttachmentLabel = anchorNeutralPunctuationForArabic(rawAttachmentLabel)
    const displayAttachmentCount = processArabicText(anchoredAttachmentLabel)
    console.debug('Stamp: attachment text processed:', {
      raw: rawAttachmentLabel,
      anchored: anchoredAttachmentLabel,
      processed: displayAttachmentCount,
      anchoredHex: Array.from(anchoredAttachmentLabel).map(c => c.charCodeAt(0).toString(16)).join(' '),
      hex: Array.from(displayAttachmentCount).map(c => c.charCodeAt(0).toString(16)).join(' ')
    })

    // Use a fixed Arabic company name on the stamp (as requested)
    const fixedCompanyName = 'زوايا البناء للإستشارات الهندسيه'
    const anchoredCompanyName = anchorNeutralPunctuationForArabic(fixedCompanyName)
    const displayCompanyText = processArabicText(anchoredCompanyName)
    console.debug('Stamp: company text processed:', {
      companyName: fixedCompanyName,
      anchoredCompanyName,
      processed: displayCompanyText,
      anchoredHex: Array.from(anchoredCompanyName).map(c => c.charCodeAt(0).toString(16)).join(' '),
      hex: Array.from(displayCompanyText).map(c => c.charCodeAt(0).toString(16)).join(' ')
    })

    // Do not render Arabic incoming/outgoing label to avoid font/shaping issues; keep empty or English if required
    let docTypeText = ''
    // If you want an English direction label, enable the block below and adjust as needed
    // try {
    //   const t = String((doc.type || doc.direction || doc.kind || '').toLowerCase())
    //   if (t === 'incoming' || t === 'in') docTypeText = 'IN'
    //   else if (t === 'outgoing' || t === 'out') docTypeText = 'OUT'
    // } catch (e) {
    //   docTypeText = ''
    // }

    // sizes - scale proportionally with stampWidth
    const baseStampWidth = 180 // base size for font calculations
    const scaleFactor = Number(stampWidth || baseStampWidth) / baseStampWidth
    const companySize = Math.round(11 * scaleFactor)
    const typeSize = Math.round(10 * scaleFactor)
    const barcodeSize2 = Math.round(9 * scaleFactor)
    const dateSize2 = Math.round(9 * scaleFactor)
    const attachmentSize = Math.round(8 * scaleFactor)
    const gap = Math.round(4 * scaleFactor)

    // Recompute widths with chosen fonts
    const companyWidth = measureRtlTextWidth(displayCompanyText, companySize, helvBold)
    const typeWidth = helv.widthOfTextAtSize(docTypeText || '', typeSize)
    const barcodeWidth2 = helv.widthOfTextAtSize(displayBarcodeLatin, barcodeSize2)
    const dateWidth2 = helv.widthOfTextAtSize(displayEnglishDate, dateSize2)
    const attachmentWidth = measureRtlTextWidth(displayAttachmentCount, attachmentSize, helvBold)

    const centerX2 = xPdf + widthPdf / 2

    // Start stacking above the barcode image: company -> type (if any)
    let companyX = centerX2 - (companyWidth / 2)
    let companyY = yPdf + heightPdf + gap
    let typeX = centerX2 - (typeWidth / 2)
    let typeY = companyY - companySize - 2

    // Barcode text and date below image (preferred), but if there's no room, place them above image
    let barcodeX = centerX2 - (barcodeWidth2 / 2)
    let barcodeY = yPdf - barcodeSize2 - gap
    let dateX = centerX2 - (dateWidth2 / 2)
    let dateY = barcodeY - dateSize2 - 2
    let attachmentX = centerX2 - (attachmentWidth / 2)
    let attachmentY = dateY - attachmentSize - 2

    // If text is off-canvas at bottom, move barcode texts above the image (between company and image)
    if (barcodeY < 0 || attachmentY < 0) {
      // place barcode text immediately above image
      barcodeY = yPdf + heightPdf + gap + 2
      dateY = barcodeY + dateSize2 + 2
      attachmentY = dateY + attachmentSize + 2
      // if company or type would collide, push company up
      if (typeY <= attachmentY) {
        companyY = attachmentY + companySize + typeSize + gap + 4
        typeY = companyY - companySize - 2
      }
    }

    console.debug('Stamp: computed_text', { displayCompanyText, docTypeText, displayBarcodeLatin, displayEnglishDate })
    console.debug('Stamp: coords', { xPdf, yPdf, widthPdf, heightPdf, companyX, companyY, typeX, typeY, barcodeX, barcodeY, dateX, dateY })

    // Draw Arabic text in visual order (already shaped + BiDi processed)
    if (displayCompanyText) {
      const companyX = centerX2 - (companyWidth / 2)
      drawVisualText(page, displayCompanyText, companyX, companyY, companySize, helvBold, rgb(0,0,0))
    }
    if (docTypeText) {
      page.drawText(docTypeText, { x: typeX, y: typeY, size: typeSize, font: helv, color: rgb(0,0,0) })
    }

    // barcode identifier centered below (or near) the barcode image
    page.drawText(displayBarcodeLatin, { x: barcodeX, y: barcodeY, size: barcodeSize2, font: helv, color: rgb(0,0,0) })

    // Draw English Gregorian date centered near the barcode for readability
    page.drawText(displayEnglishDate, { x: dateX, y: dateY, size: dateSize2, font: helv, color: rgb(0,0,0) })

    // Draw Arabic attachment text in visual order (already shaped + BiDi processed)
    // (attachmentX already computed above as let variable)
    drawVisualText(page, displayAttachmentCount, attachmentX, attachmentY, attachmentSize, helvBold, rgb(0,0,0))

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
