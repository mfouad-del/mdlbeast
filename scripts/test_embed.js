const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
(async ()=>{
  try{
    const fontPath = 'backend/assets/fonts/NotoSansArabic-Regular.woff2'
    const fontBuf = fs.readFileSync(fontPath)
    const pdfDoc = await PDFDocument.create()
    const fk = require(require('path').resolve('backend','node_modules','fontkit'))
    // Register the raw fontkit implementation with pdf-lib
    pdfDoc.registerFontkit(fk)
    const embedded = await pdfDoc.embedFont(fontBuf)
    const page = pdfDoc.addPage([400, 200])
    page.drawText('مرحبا بالعالم', { x: 10, y: 150, size: 24, font: embedded })
    const out = await pdfDoc.save()
    fs.writeFileSync('test-embedded.pdf', out)
    console.log('ok wrote test-embedded.pdf')
  }catch(e){ console.error('error', e && e.message, e) }
})()
