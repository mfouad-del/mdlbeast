"use client"

import type { Correspondence, SystemSettings } from "@/types"
import { Printer, ImageIcon } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { useI18n } from '@/lib/i18n-context'

interface BarcodePrinterProps {
  doc: Correspondence
  settings?: SystemSettings
}

export default function BarcodePrinter({ doc, settings }: BarcodePrinterProps) {
  const { t } = useI18n()
  const downloadAsPng = () => {
    apiClient.logAction('PRINT_STICKER_IMAGE', `Downloaded sticker image for ${doc.barcode}`, 'DOCUMENT', doc.barcode)
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
      ctx.fillText(settings?.orgName || "MDLBEAST Entertainment", 500, 70)

      ctx.drawImage(barcodeImg, 150, 110, 700, 220)

      ctx.font = "bold 52px Monospace"
      ctx.fillText(doc.barcode, 500, 390)

      ctx.font = "bold 26px Arial"
      ctx.fillStyle = "#666666"
      ctx.fillText(`${doc.date} | ${doc.type === "INCOMING" ? t('new.key.3mij8b') : t('new.key.5fsw78')}`, 500, 440)
      
      ctx.font = "bold 22px Arial"
      ctx.fillText(`المرفقات: ${doc.attachmentCount || '0'}`, 500, 470)

      const link = document.createElement("a")
      link.download = `STICKER-${doc.barcode}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    }
  }

  const handlePrint = () => {
    apiClient.logAction('PRINT_STICKER', `Printed sticker for ${doc.barcode}`, 'DOCUMENT', doc.barcode)
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
import { useI18n } from '../lib/i18n-context'
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
            .attachment-text { font-size: 10px; color: #666; margin-top: 6px; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="label-box">
            <div class="title">${settings?.orgName || "MDLBEAST Entertainment"}</div>
            <img class="barcode-img" src="${barcode}">
            <span class="id-text">${doc.barcode}</span>
            <div class="footer-text">${doc.date} | ${doc.type === "INCOMING" ? t('new.key.3mij8b') : t('new.key.5fsw78')}</div>
            <div class="attachment-text">المرفقات: ${doc.attachmentCount || '0'}</div>
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
        title={t('new.key.ld9qch')}
      >
        <Printer size={14} />
      </button>
      <button
        onClick={downloadAsPng}
        className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-400 flex items-center justify-center transition-all shadow-sm hover:shadow-md"
        title={t('new.key.slvsdb')}
      >
        <ImageIcon size={14} />
      </button>
    </div>
  )
}
