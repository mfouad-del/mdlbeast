"use client"

import type { Correspondence, SystemSettings } from "@/types"
import { Printer, ImageIcon } from "lucide-react"

interface BarcodePrinterProps {
  doc: Correspondence
  settings?: SystemSettings
}

export default function BarcodePrinter({ doc, settings }: BarcodePrinterProps) {
  const downloadAsPng = () => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = 1000
    canvas.height = 500
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const barcodeImg = new Image()
    barcodeImg.crossOrigin = "anonymous"
    barcodeImg.src = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${
      doc.barcode
    }&scale=6&rotate=N&includetext=false`

    barcodeImg.onload = () => {
      ctx.fillStyle = "#000000"
      ctx.textAlign = "center"

      ctx.font = "900 38px Arial"
      ctx.fillText(settings?.orgName || "ZAWAYA ALBINA", 500, 70)

      ctx.drawImage(barcodeImg, 150, 110, 700, 220)

      ctx.font = "bold 52px Monospace"
      ctx.fillText(doc.barcode, 500, 390)

      ctx.font = "bold 26px Arial"
      ctx.fillStyle = "#666666"
      ctx.fillText(`${doc.date} | ${doc.type === "INCOMING" ? "وارد" : "صادر"}`, 500, 450)

      const link = document.createElement("a")
      link.download = `STICKER-${doc.barcode}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    }
  }

  const handlePrint = () => {
    const p = window.open("", "_blank")
    if (!p) return
    const barcode = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${
      doc.barcode
    }&scale=4&rotate=N&includetext=false`

    p.document.write(`
      <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@700;900&display=swap');
            body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 10px; direction: rtl; }
            .label-box { 
               width: 320px; border: 4px solid #000; padding: 18px; 
               text-align: center; border-radius: 15px; 
               background: #fff;
            }
            .title { font-size: 15px; font-weight: 900; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 12px; text-transform: uppercase; }
            .barcode-img { width: 100%; height: auto; margin: 8px 0; }
            .id-text { font-family: monospace; font-size: 24px; font-weight: 900; margin-top: 8px; display: block; letter-spacing: 1px; }
            .footer-text { font-size: 11px; color: #000; margin-top: 12px; font-weight: 900; border-top: 1px solid #eee; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="label-box">
            <div class="title">${settings?.orgName || "ZAWAYA ALBINA ENGINEERING"}</div>
            <img class="barcode-img" src="${barcode}">
            <span class="id-text">${doc.barcode}</span>
            <div class="footer-text">${doc.date} | ${doc.type === "INCOMING" ? "وارد" : "صادر"}</div>
          </div>
          <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 600); }</script>
        </body>
      </html>
    `)
    p.document.close()
  }

  return (
    <div className="flex gap-1">
      <button
        onClick={handlePrint}
        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-400 flex items-center justify-center transition-all shadow-sm hover:shadow-md"
        title="طباعة ملصق حراري"
      >
        <Printer size={14} />
      </button>
      <button
        onClick={downloadAsPng}
        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-400 flex items-center justify-center transition-all shadow-sm hover:shadow-md"
        title="حفظ كصورة PNG"
      >
        <ImageIcon size={14} />
      </button>
    </div>
  )
}
