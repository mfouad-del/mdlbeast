import express from 'express'
import { query } from '../config/database'
import fetch from 'node-fetch'
import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const router = express.Router()

// POST /:barcode/stamp { x, y }
router.post('/:barcode/stamp', async (req, res) => {
  try {
    const { barcode } = req.params
    const { x = 20, y = 20 } = req.body || {}

    const d = await query('SELECT * FROM documents WHERE barcode = $1 LIMIT 1', [barcode])
    if (d.rows.length === 0) return res.status(404).json({ error: 'Document not found' })
    const doc = d.rows[0]

    // find pdf url in attachments (first attachment)
    const attachments = doc.attachments || []
    const pdf = Array.isArray(attachments) && attachments.length ? attachments[0] : null
    if (!pdf || !pdf.url) return res.status(400).json({ error: 'No PDF attached to stamp' })

    // fetch pdf bytes
    let pdfBytes: Buffer
    if (pdf.url.startsWith('/uploads/')) {
      const uploadsDir = path.resolve(process.cwd(), 'uploads')
      const fp = path.join(uploadsDir, pdf.url.replace('/uploads/', ''))
      pdfBytes = fs.readFileSync(fp)
    } else {
      const r = await fetch(pdf.url)
      if (!r.ok) return res.status(500).json({ error: 'Failed to fetch PDF' })
      pdfBytes = Buffer.from(await r.arrayBuffer())
    }

    // fetch barcode image (PNG) via bwipjs public API
    const bcUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(barcode)}&scale=2&includetext=false`
    const imgResp = await fetch(bcUrl)
    if (!imgResp.ok) return res.status(500).json({ error: 'Failed to generate barcode image' })
    const imgBytes = Buffer.from(await imgResp.arrayBuffer())

    // embed image into PDF
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pngImage = await pdfDoc.embedPng(imgBytes)
    const pngDims = pngImage.scale(0.6)

    const pages = pdfDoc.getPages()
    const page = pages[0]
    const { width, height } = page.getSize()

    // place image at bottom-right by default if coordinates are relative
    const px = Number(x)
    const py = Number(y)

    page.drawImage(pngImage, {
      x: px,
      y: height - py - pngDims.height,
      width: pngDims.width,
      height: pngDims.height,
    })

    const outBytes = await pdfDoc.save()

    // save stamped file locally in uploads
    const uploadsDir = path.resolve(process.cwd(), 'uploads')
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
    const filename = `stamped-${Date.now()}-${encodeURIComponent(barcode)}.pdf`
    const outPath = path.join(uploadsDir, filename)
    fs.writeFileSync(outPath, outBytes)

    const url = `/uploads/${filename}`

    // update document attachments: push new stamped file as first attachment
    const newAttachments = [ { name: filename, url, size: outBytes.length }, ...(attachments || []) ]
    await query('UPDATE documents SET attachments = $1 WHERE id = $2', [JSON.stringify(newAttachments), doc.id])

    res.json({ url, name: filename, size: outBytes.length })
  } catch (err: any) {
    console.error('Stamp error:', err)
    res.status(500).json({ error: err.message || 'Stamp failed' })
  }
})

export default router
