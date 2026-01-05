import { createCanvas, registerFont, loadImage } from 'canvas'
import bwipjs from 'bwip-js'

/**
 * Generate stamp as PNG image with proper RTL Arabic support.
 * Canvas natively supports RTL rendering via HarfBuzz.
 */
export async function generateStampImage(
  barcode: string,
  companyText: string,
  attachmentText: string,
  englishDate: string,
  stampWidth: number,
  fontPath: string
): Promise<Buffer> {
  const scaleFactor = stampWidth / 180
  const fontSizeCompany = Math.round(11 * scaleFactor)
  const fontSizeAttachment = Math.round(8 * scaleFactor)
  const fontSizeDate = Math.round(9 * scaleFactor)
  const fontSizeBarcode = Math.round(9 * scaleFactor)
  const gap = Math.round(4 * scaleFactor)
  const padding = Math.round(10 * scaleFactor)

  // Generate barcode image
  const barcodeBuffer = await new Promise<Buffer>((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: 'code128',
        text: barcode,
        scale: 2,
        height: Math.round(30 * scaleFactor),
        includetext: false,
      },
      (err, png) => {
        if (err) reject(err)
        else resolve(png as Buffer)
      }
    )
  })

  // Load barcode to get dimensions
  const barcodeImg = await loadImage(barcodeBuffer)
  const barcodeHeight = barcodeImg.height
  const barcodeWidth = barcodeImg.width

  // Calculate canvas height based on content
  const textHeight = fontSizeCompany + fontSizeAttachment + fontSizeDate + fontSizeBarcode + gap * 5
  const height = barcodeHeight + textHeight + padding * 2

  // Register Arabic font
  try {
    registerFont(fontPath, { family: 'NotoSansArabic', weight: 'bold' })
  } catch (e) {
    console.warn('Failed to register font for canvas:', e)
  }

  const canvas = createCanvas(stampWidth, height)
  const ctx = canvas.getContext('2d')

  // White background
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, stampWidth, height)

  // Draw barcode in center
  const barcodeX = (stampWidth - barcodeWidth) / 2
  const barcodeY = padding + fontSizeCompany + fontSizeAttachment + gap * 2
  ctx.drawImage(barcodeImg as any, barcodeX, barcodeY)

  // Setup text rendering
  ctx.fillStyle = 'black'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  // Draw company name (Arabic RTL)
  ctx.font = `bold ${fontSizeCompany}px NotoSansArabic, sans-serif`
  ctx.direction = 'rtl'
  ctx.fillText(companyText, stampWidth / 2, padding)

  // Draw attachment text (Arabic RTL)
  ctx.font = `bold ${fontSizeAttachment}px NotoSansArabic, sans-serif`
  ctx.direction = 'rtl'
  ctx.fillText(attachmentText, stampWidth / 2, padding + fontSizeCompany + gap)

  // Draw barcode number (LTR)
  ctx.font = `${fontSizeBarcode}px sans-serif`
  ctx.direction = 'ltr'
  ctx.fillText(barcode, stampWidth / 2, barcodeY + barcodeHeight + gap)

  // Draw English date (LTR)
  ctx.font = `${fontSizeDate}px sans-serif`
  ctx.direction = 'ltr'
  ctx.fillText(englishDate, stampWidth / 2, barcodeY + barcodeHeight + gap + fontSizeBarcode + gap)

  return canvas.toBuffer('image/png')
}
