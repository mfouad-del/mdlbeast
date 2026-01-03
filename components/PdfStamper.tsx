"use client"

import type React from "react"

import { useState, useRef } from "react"
import type { Correspondence, SystemSettings } from "@/types"
import { Save, X, MousePointer2, Scan, Layers, FileSearch, Eye } from "lucide-react"
import { useLoading } from './ui/loading-context'
import SignedPdfPreview from './SignedPdfPreview'

interface PdfStamperProps {
  doc: Correspondence
  settings?: SystemSettings
  onClose: () => void
}

export default function PdfStamper({ doc, settings, onClose }: PdfStamperProps) {
  const BASE_STAMP_WIDTH = 220
  const [pos, setPos] = useState({ x: 400, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isSaving, setIsSaving] = useState(false)
  // stampWidth is the *visual* target width in px (we scale a fixed base layout to this value)
  const [stampWidth, setStampWidth] = useState<number>(180)
  const [zoom, setZoom] = useState<number>(1)
  const [pageIndex, setPageIndex] = useState<number>(0)
  const [attachmentIndex, setAttachmentIndex] = useState<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const stampRef = useRef<HTMLDivElement>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  
  const currentAttachment = doc.attachments && doc.attachments[attachmentIndex] ? doc.attachments[attachmentIndex] : doc.attachments?.[0]
  const pagesCount = ((currentAttachment && (currentAttachment as any).pageCount) ? (currentAttachment as any).pageCount : (doc.attachmentCount ?? 1))

  // Cleaner barcode URL - text rendered manually
  const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${doc.barcode}&scale=2&rotate=N&includetext=false`

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const mouseXInContainer = e.clientX - containerRect.left
      const mouseYInContainer = e.clientY - containerRect.top
      
      setDragOffset({
          x: mouseXInContainer - pos.x,
          y: mouseYInContainer - pos.y
      })
    }
    e.preventDefault()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()

    const stampRect = stampRef.current?.getBoundingClientRect()
    const stampW = stampRect?.width ?? stampWidth
    const stampH = stampRect?.height ?? Math.max(60, stampWidth * 0.45)

    const newX = Math.max(0, Math.min(e.clientX - rect.left - dragOffset.x, rect.width - stampW))
    const newY = Math.max(0, Math.min(e.clientY - rect.top - dragOffset.y, rect.height - stampH))

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
      
      const actualX = pos.x
      const actualY = pos.y
      
      const payload = {
        x: Math.round(actualX),
        y: Math.round(actualY),
        containerWidth: Math.round(containerWidth),
        containerHeight: Math.round(containerHeight),
        stampWidth: Math.round(stampWidth),
        page: pageIndex,
        attachmentIndex: attachmentIndex,
        compact: false,
      }

      const api = (await import("@/lib/api-client")).apiClient
      const res = await api.stampDocument(doc.barcode, payload)

      if (res && (res.previewUrl || res.url)) {
        const openUrl = res.previewUrl || res.url
        // window.open(openUrl, '_blank') // Optional: auto-open
      }

      // Dispatch event to update list without reload
      window.dispatchEvent(new CustomEvent('document:stamped', { detail: { barcode: doc.barcode } }))
      
      alert('تم ختم المستند بنجاح')
      onClose()
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
          <div className="relative w-full max-w-[800px]">
            <div
              ref={containerRef}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="w-full aspect-[1/1.414] bg-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] relative cursor-crosshair border border-slate-200 overflow-hidden"
            >
            {doc.pdfFile ? (
              <SignedPdfPreview barcode={doc.barcode} fallbackUrl={doc.pdfFile.url} attachmentIndex={attachmentIndex} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-300 flex flex-col gap-4">
                <FileSearch size={100} className="opacity-10" />
                <p className="font-black opacity-20 text-2xl">المستند غير متوفر للمعاينة</p>
              </div>
            )}

            {/* Professional Stamp Design - با حجم وتناسق أفضل */}
            <div
              ref={stampRef}
              onMouseDown={handleMouseDown}
              style={{
                left: pos.x,
                top: pos.y,
                width: BASE_STAMP_WIDTH,
                transform: `scale(${Math.max(0.3, Math.min(2.5, stampWidth / BASE_STAMP_WIDTH))})`,
                transformOrigin: 'top left',
                willChange: 'transform',
              }}
              className={`absolute bg-white border-[3px] ${
                isDragging
                  ? "border-blue-600 ring-4 ring-blue-500/20 cursor-grabbing shadow-2xl"
                  : "border-slate-900 shadow-xl"
              } cursor-grab rounded-xl flex flex-col items-center justify-center p-3 z-50 transition-[border-color,box-shadow] duration-100 select-none`}
            >
              {/* Header - اسم الشركة بحجم مناسب */}
              <div className="text-[7px] font-black text-slate-900 mb-1 text-center leading-tight w-full border-b-2 border-slate-200 pb-1 overflow-hidden text-ellipsis whitespace-nowrap px-1">
                {settings?.orgName || "نظام الأرشفة الإلكتروني"}
              </div>

              {/* Barcode */}
              <img
                src={barcodeUrl}
                style={{ height: '28px', objectFit: 'contain' }}
                className="w-full pointer-events-none select-none mix-blend-multiply my-1"
                alt="barcode"
              />

              {/* Footer - رقم المعرف */}
              <div className="text-[9px] font-black font-mono mt-1 text-slate-900 tracking-wider">
                {doc.barcode}
              </div>
              
              {/* التاريخ والوقت بحجم متناسق */}
              <div className="w-full flex justify-between items-center mt-1 pt-1 border-t-2 border-slate-200 text-[6px] text-slate-600 font-bold px-1">
                 <span>{new Date().toLocaleDateString('en-GB')}</span>
                 <span>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {/* Drag Handle Indicator */}
              <div className="absolute -top-3 -right-3 w-6 h-6 bg-blue-600 rounded-full border-3 border-white shadow-lg flex items-center justify-center text-white">
                <Scan size={12} />
              </div>
            </div>

            {isDragging && <div className="absolute inset-0 z-40"></div>}
          </div>
          </div>
        </div>

        <footer className="p-8 bg-white border-t border-slate-100 flex justify-between items-center px-12">
          <div className="flex gap-14">
             <div className="flex items-center gap-4 text-slate-400 text-xs font-bold">
                <span>X: {Math.round(pos.x)}</span>
                <span>Y: {Math.round(pos.y)}</span>
             </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 group hover:border-blue-200 transition-colors">
                <Scan size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                <div className="flex flex-col">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">حجم الختم</label>
                    <input 
                      type="range" 
                      min={80} 
                      max={400} 
                      step={10}
                      value={stampWidth} 
                      onChange={(e) => setStampWidth(Number(e.target.value))} 
                      className="w-40 h-2 bg-gradient-to-r from-slate-200 via-blue-100 to-slate-200 rounded-full appearance-none cursor-pointer accent-slate-900 hover:accent-blue-600 transition-all" 
                    />
                </div>
                <span className="text-xs font-black text-slate-700 w-10 text-center bg-slate-100 px-2 py-1 rounded-lg">{stampWidth}</span>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-tight mr-1">المرفق</label>
                <select value={attachmentIndex} onChange={(e) => { setAttachmentIndex(Number(e.target.value)); setPageIndex(0); }} className="p-2.5 rounded-xl border bg-white text-sm font-black outline-none focus:ring-2 focus:ring-blue-500/20">
                  {(doc.attachments || []).map((_, i) => (
                    <option key={i} value={i}>مرفق {i+1}</option>
                  ))}
                  {(!doc.attachments || doc.attachments.length === 0) && <option value={0}>مرفق 1</option>}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-tight mr-1">صفحة</label>
                <select value={pageIndex} onChange={(e) => setPageIndex(Number(e.target.value))} className="p-2.5 rounded-xl border bg-white text-sm font-black outline-none focus:ring-2 focus:ring-blue-500/20">
                  {Array.from({ length: Math.max(1, pagesCount) }, (_, i) => i).map((i) => (
                    <option key={i} value={i}>صفحة {i+1}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="h-10 w-px bg-slate-200 mx-2"></div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all"
              >
                إلغاء
              </button>
              <button
                onClick={handleFinalize}
                disabled={isSaving}
                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-sm flex items-center gap-3 hover:bg-black transition-all shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                ) : (
                  <Save size={16} />
                )}
                ختم وحفظ
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
