"use client"

import type React from "react"

import { useState, useRef } from "react"
import type { Correspondence } from "@/types"
import { Save, X, MousePointer2, Scan, Layers, FileSearch, Eye } from "lucide-react"
import { useLoading } from './ui/loading-context'
import SignedPdfPreview from './SignedPdfPreview'

interface PdfStamperProps {
  doc: Correspondence
  onClose: () => void
}

export default function PdfStamper({ doc, onClose }: PdfStamperProps) {
  const [pos, setPos] = useState({ x: 400, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [stampWidth, setStampWidth] = useState<number>(160)
  const [compact, setCompact] = useState<boolean>(false)
  const [pageIndex, setPageIndex] = useState<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${
    doc.barcodeId || doc.barcode
  }&scale=1.2&height=12&rotate=N&includetext=true&textsize=10`

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    e.preventDefault()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()

    const newX = Math.max(0, Math.min(e.clientX - rect.left - 85, rect.width - 170))
    const newY = Math.max(0, Math.min(e.clientY - rect.top - 40, rect.height - 80))

    setPos({ x: newX, y: newY })
  }

  const handleMouseUp = () => setIsDragging(false)

  let loading: any = null
  try {
    loading = useLoading()
  } catch (e) {
    loading = { show: () => {}, hide: () => {} }
  }

  const handleFinalize = async () => {
    setIsSaving(true)
    loading.show()
    try {
      const container = containerRef.current
      const rect = container?.getBoundingClientRect()
      const containerWidth = rect?.width || 800
      const containerHeight = rect?.height || 1131
      const payload = {
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        containerWidth: Math.round(containerWidth),
        containerHeight: Math.round(containerHeight),
        stampWidth: Math.round(stampWidth),
        page: pageIndex,
        compact: !!compact,
      }

      const api = (await import("@/lib/api-client")).apiClient
      const res = await api.stampDocument(doc.barcode || doc.barcodeId, payload)

      // If server supplied a previewUrl (signed or cache-busted), open it immediately
      if (res && (res.previewUrl || res.url)) {
        const openUrl = res.previewUrl || res.url
        window.open(openUrl, '_blank')
        alert('تم الختم وفتح نسخة العرض المدمجة — إذا لم ترى التغيّر، افتح المعاينة الموقعة أو امسح الكاش.')
      } else {
        alert('تم الختم بنجاح — يُرجى تحديث الصفحة أو فتح المعاينة الموقعة إذا لم ترى التغيّر.')
      }

      // Refresh document list to pick up updated attachments (some caches may delay immediate visibility)
      setTimeout(() => {
        window.location.reload()
      }, 1200)
    } catch (e: any) {
      console.error('Stamp failed', e)
      alert('فشل ختم المستند: ' + (e?.message || e))
    } finally {
      setIsSaving(false)
      loading.hide()
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-4 lg:p-10">
      <div className="bg-white w-full max-w-7xl rounded-[3rem] overflow-hidden flex flex-col h-full shadow-3xl border border-white/20 animate-in zoom-in-95 duration-500">
        <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-5">
            <div className="bg-slate-900 p-4 rounded-3xl text-white shadow-2xl shadow-blue-900/20">
              <Layers size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 font-heading">تطبيق ختم المستند الرقمي</h3>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
                <MousePointer2 size={12} /> قم بسحب الختم لوضعه في المكان المناسب على المستند
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 text-blue-700 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-2">
              <Eye size={14} /> وضع المعاينة والدمغ
            </div>
            <button
              onClick={onClose}
              className="p-3 hover:bg-red-50 text-red-500 rounded-full transition-all group active:scale-90"
            >
              <X size={32} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-[#F1F5F9] p-8 lg:p-16 flex justify-center relative shadow-inner">
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full max-w-4xl min-h-[60vh] bg-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] relative cursor-crosshair border border-slate-200 overflow-hidden"
          >
            {doc.pdfFile ? (
              // Use signed preview URL from server (avoid opening raw storage URL which may be private)
              <SignedPdfPreview barcode={doc.barcode || doc.barcodeId} fallbackUrl={doc.pdfFile.url} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-300 flex flex-col gap-4">
                <FileSearch size={100} className="opacity-10" />
                <p className="font-black opacity-20 text-2xl">المستند غير متوفر للمعاينة</p>
              </div>
            )}

            <div
              onMouseDown={handleMouseDown}
              style={{ left: pos.x, top: pos.y, width: stampWidth, maxWidth: 'calc(100% - 40px)' }}
              className={`absolute p-4 bg-white border-2 ${
                isDragging
                  ? "border-blue-600 ring-4 ring-blue-500/10 scale-105 rotate-1 cursor-grabbing"
                  : "border-slate-300 shadow-2xl"
              } cursor-grab rounded-2xl flex flex-col items-center group z-50 transition-all duration-75`}
            >
              <div className="w-10 h-1 bg-slate-100 rounded-full mb-3 opacity-50"></div>
              <img
                src={barcodeUrl || "/placeholder.svg"}
                style={{ maxHeight: `${Math.round(stampWidth * 0.45)}px`, objectFit: 'contain' }}
                className="w-full pointer-events-none select-none"
                alt="barcode"
              />
              <div className="text-[11px] font-extrabold font-mono mt-2.5 text-slate-900 select-none tracking-tight uppercase">
                {doc.barcodeId || doc.barcode}
              </div>

              <div className="absolute -top-3 -left-3 w-8 h-8 bg-emerald-600 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white text-xs font-black">
                {doc.attachmentCount ?? 0}
              </div>

              <div className="absolute -top-3 -right-3 w-7 h-7 bg-blue-600 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-white">
                <Scan size={12} />
              </div>
            </div>

            {isDragging && <div className="absolute inset-0 z-40"></div>}
          </div>
        </div>

        <footer className="p-8 bg-white border-t border-slate-100 flex justify-between items-center px-12">
          <div className="flex gap-14">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                الإحداثي السيني (X)
              </span>
              <span className="text-2xl font-black text-slate-900 tabular-nums">
                {Math.round(pos.x)}
                <span className="text-xs text-slate-300 ml-1">PX</span>
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                الإحداثي الصادي (Y)
              </span>
              <span className="text-2xl font-black text-slate-900 tabular-nums">
                {Math.round(pos.y)}
                <span className="text-xs text-slate-300 ml-1">PX</span>
              </span>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-tight mr-1">حجم الختم</label>
              <input type="range" min={120} max={260} value={stampWidth} onChange={(e) => setStampWidth(Number(e.target.value))} className="w-44" />
              <div className="text-sm font-black">{stampWidth}px</div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">عدد صفحات المرفق</span>
                <span className="text-2xl font-black text-slate-900 tabular-nums">{(doc.attachments && doc.attachments[0] && doc.attachments[0].pageCount) ? doc.attachments[0].pageCount : (doc.attachmentCount ?? 0)}</span>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-tight mr-1">صفحة</label>
                <select value={pageIndex} onChange={(e) => setPageIndex(Number(e.target.value))} className="p-3 rounded-xl border bg-white text-sm font-black">
                  {Array.from({length: Math.max(1, ((doc.attachments && doc.attachments[0] && doc.attachments[0].pageCount) ? doc.attachments[0].pageCount : (doc.attachmentCount ?? 1)))}, (_,i)=>i).map(i => (
                    <option key={i} value={i}>صفحة {i+1}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-tight mr-1">دقة X</label>
                <input type="number" value={Math.round(pos.x)} onChange={(e)=> setPos({...pos, x: Number(e.target.value)})} className="p-2 rounded-xl border w-20" />
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-tight mr-1">دقة Y</label>
                <input type="number" value={Math.round(pos.y)} onChange={(e)=> setPos({...pos, y: Number(e.target.value)})} className="p-2 rounded-xl border w-20" />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-tight mr-1">وضع ختام مدمج</label>
                <input type="checkbox" checked={compact} onChange={(e)=> setCompact(e.target.checked)} />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={onClose}
                className="px-10 py-5 rounded-[1.5rem] font-black text-lg text-slate-500 hover:bg-slate-50 transition-all"
              >
                إلغاء العملية
              </button>
              <button
                onClick={handleFinalize}
                disabled={isSaving}
                className="bg-slate-900 text-white px-14 py-5 rounded-[1.5rem] font-black text-lg flex items-center gap-4 hover:bg-black transition-all shadow-2xl hover:shadow-blue-500/20 active:scale-95 disabled:opacity-50 font-heading"
              >
                {isSaving ? (
                  <span className="animate-spin h-6 w-6 border-3 border-white border-t-transparent rounded-full"></span>
                ) : (
                  <Save size={24} />
                )}
                ختم وحفظ التغييرات النهائية
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
