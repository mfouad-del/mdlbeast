"use client"

import { useState, useRef, useEffect } from "react"
import type { Correspondence, SystemSettings } from "@/types"
import { Search, ArrowRightLeft, FileSpreadsheet, AlertCircle, FileText, Calendar, ScanText } from "lucide-react"
import AsyncButton from "./ui/async-button"
import StatementModal from "./StatementModal"
import { exportToCSV } from "@/lib/barcode-service"
import BarcodePrinter from "./BarcodePrinter"
import OfficialReceipt from "./OfficialReceipt"
import PdfStamper from "./PdfStamper"
import { apiClient } from "@/lib/api-client"

interface DocumentListProps {
  docs: Correspondence[]
  settings: SystemSettings
  currentUser?: any
  users?: any[]
}

export default function DocumentList({ docs, settings, currentUser, users }: DocumentListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'INCOMING' | 'OUTGOING'>('ALL')
  const [stamperDoc, setStamperDoc] = useState<Correspondence | null>(null)
  const [statementOpenDoc, setStatementOpenDoc] = useState<Correspondence | null>(null)
  const [statementText, setStatementText] = useState<string>('')
  const [statementLoading, setStatementLoading] = useState(false)

  const addAttachmentInputRef = useRef<HTMLInputElement | null>(null)
  const [localDocs, setLocalDocs] = useState(docs)

  useEffect(() => { setLocalDocs(docs) }, [docs])

  const handleAddAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const targetBarcode = (e.target as any)?._targetBarcode || ''
    if (!file || !targetBarcode) return
    try {
      const uploaded = await apiClient.uploadFile(file)
      await apiClient.addAttachment(targetBarcode, uploaded)
      // Fetch updated document and update local state (avoid full page reload)
      const updated = await apiClient.getDocumentByBarcode(targetBarcode)
      if (updated) {
        setLocalDocs((prev:any[]) => prev.map((d:any) => ((d.barcode === targetBarcode || d.barcodeId === targetBarcode) ? updated : d)))
      }
    } catch (err: any) {
      console.error('Add attachment failed', err)
      alert('فشل إضافة المرفق: ' + (err?.message || err))
    } finally {
      if (e.target) (e.target as any).value = ''
    }
  }

  const filtered = (localDocs || []).filter((doc) => {
    const title = doc.title || doc.subject || ""
    const barcode = doc.barcodeId || doc.barcode || ""
    const matchesSearch =
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.sender || '').toLowerCase().includes(searchTerm.toLowerCase())

    // Use documentDate as authoritative date for filtering
    const docDate = (doc.documentDate || doc.date || '').split('T')?.[0]
    const matchesStartDate = !startDate || docDate >= startDate
    const matchesEndDate = !endDate || docDate <= endDate

    const matchesDirection = directionFilter === 'ALL' || (directionFilter === 'INCOMING' && (doc.status === 'وارد' || (doc.type === 'INCOMING'))) || (directionFilter === 'OUTGOING' && (doc.status === 'صادر' || (doc.type === 'OUTGOING')))

    return matchesSearch && matchesStartDate && matchesEndDate && matchesDirection
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <input id="addAttachmentInput" ref={addAttachmentInputRef} type="file" accept=".pdf" className="hidden" onChange={handleAddAttachment} />
      {stamperDoc && <PdfStamper doc={stamperDoc} onClose={() => setStamperDoc(null)} />}

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
        <div className="relative">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" size={22} />
          <input
            type="text"
            placeholder="البحث بالباركود، الموضوع، أو اسم الجهة..."
            className="w-full pr-14 pl-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-slate-900 transition-all font-bold text-sm shadow-inner"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-5 items-end">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-1.5">
              <Calendar size={12} /> من تاريخ
            </label>
            <input
              type="date"
              className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-slate-900 transition-all"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-1.5">
              <Calendar size={12} /> إلى تاريخ
            </label>
            <input
              type="date"
              className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-slate-900 transition-all"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="space-y-2 min-w-[160px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-1.5">
              فلتر: وارد / صادر
            </label>
            <select
              className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-slate-900 transition-all cursor-pointer"
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as any)}
            >
              <option value="ALL">الكل</option>
              <option value="INCOMING">وارد</option>
              <option value="OUTGOING">صادر</option>
            </select>
          </div>
          <button
            onClick={() => {
              setSearchTerm("")
              setStartDate("")
              setEndDate("")
            }}
            className="p-4 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-all group"
            title="إعادة تعيين"
          >
            <ArrowRightLeft size={20} className="group-active:rotate-180 transition-transform" />
          </button>
          <button
            onClick={() => exportToCSV(filtered, "Registry_Report")}
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs flex items-center gap-2.5 shadow-xl hover:bg-black transition-all active:scale-95"
          >
            <FileSpreadsheet size={18} /> تصدير السجل CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">
                  المعرف الموحد
                </th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  تفاصيل القيد المؤسسي
                </th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                  الأرشفة والدمغ
                </th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest text-left">
                  إجراءات الطباعة
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? (
                filtered.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-all group">
                    <td className="px-8 py-7 text-center">
                        <span className="font-mono text-[13px] font-black text-slate-900 bg-white border border-slate-300 px-4 py-2 rounded-xl shadow-sm tracking-wider whitespace-nowrap overflow-hidden text-ellipsis max-w-[220px] inline-block">
                        {doc.barcodeId || doc.barcode}
                      </span>
                    </td>
                    <td className="px-8 py-7">
                      <div className="space-y-1.5">
                        <div className="font-black text-slate-900 text-lg leading-tight font-heading">
                          {doc.title || doc.subject}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded uppercase">
                            من: {doc.sender}
                          </span>
                          <span className="text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded uppercase">
                            إلى: {doc.receiver || doc.recipient}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
                            <span>📅 تاريخ:</span>
                            <span className="font-black">{(doc.documentDate || doc.date || '').split('T')?.[0]}</span>
                          </span>

                          {/* Badge when no statement exists */}
                          {!(doc.statement || '').trim() && (
                            <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded uppercase">بدون بيان</span>
                          )}

                          {/* Show creator to admin/supervisor */}
                          {(currentUser && (String(currentUser.role || '').toLowerCase() === 'admin' || String(currentUser.role || '').toLowerCase() === 'supervisor')) && (
                            <span className="text-[10px] font-bold text-slate-500">أصدر: {(() => {
                              // Resolve createdBy: prefer lookup via users list
                              const cb = (doc as any).createdBy || (doc as any).created_by || (doc as any).user_id || ''
                              if (!cb) return '—'
                              const cbStr = String(cb)
                              const u = (users || []).find((x: any) => String(x.id) === cbStr || String(x.username || x.email || '') === cbStr)
                              if (u) return (u.full_name || u.name || u.username || u.email || cbStr)
                              return cbStr
                            })()}</span>
                          )}
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                              doc.priority === "عاديه" ? "bg-slate-100 text-slate-500" : "bg-red-50 text-red-600"
                            }`}
                          >
                            {doc.priority}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-7">
                      <div className="flex gap-3 items-center">
                        <div className="text-[11px] font-black px-3 py-1 rounded bg-slate-50 border border-slate-100">مرفقات: <span className="font-extrabold mr-2">{(doc.attachments || []).length}</span></div>

                        {/* Numbered attachment buttons */}
                        {(doc.attachments || []).length > 0 && (
                          <div className="flex items-center gap-2">
                            {(doc.attachments || []).map((a: any, idx: number) => (
                              <button
                                key={idx}
                                title={`فتح المرفق ${idx + 1}`}
                                onClick={async () => {
                                  try {
                                    const url = await apiClient.getPreviewUrl(doc.barcode || doc.barcodeId, idx)
                                    if (!url) { alert('لا يوجد ملف لعرضه'); return }
                                    window.open(url, '_blank')
                                  } catch (e) { console.error(e); alert('فشل فتح المرفق') }
                                }}
                                className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm border border-slate-200"
                              >
                                {idx + 1}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Action buttons - standardized size */}
                        <button onClick={() => setStamperDoc(doc)} className="h-9 px-3 flex items-center gap-2 rounded-md text-[11px] font-black bg-slate-900 text-white border border-slate-900 hover:bg-black transition-all shadow"> 
                          <ScanText size={16} /> ختم المستند
                        </button>

                        <button className="h-9 px-3 flex items-center gap-2 rounded-md bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all text-[11px] font-black" onClick={() => {
                          const el = document.getElementById('addAttachmentInput') as HTMLInputElement | null
                          if (!el) return
                          ;(el as any)._targetBarcode = doc.barcode || doc.barcodeId
                          el.click()
                        }}>
                          إضافة مرفق
                        </button>

                        <button onClick={async () => { if (!confirm('حذف المستند؟')) return; await (await import('@/lib/api-client')).apiClient.deleteDocument(doc.barcode || doc.barcodeId); setLocalDocs((prev:any[]) => prev.filter((d:any) => d.barcode !== doc.barcode && d.barcodeId !== doc.barcodeId)) }} className="h-9 px-3 flex items-center gap-2 rounded-md bg-white text-red-500 border border-red-100 hover:bg-red-50 transition-all text-[11px] font-black">
                          حذف
                        </button>

                        {/* Button to open the statement for quick reading (fetches JSON and opens inline modal). Keep PDF download accessible via long-press or secondary action. */}
                        <button onClick={async () => {
                          try {
                            setStatementLoading(true)
                            const res = await apiClient.getStatement(doc.barcode || doc.barcodeId)
                            setStatementText(res?.statement || '')
                            setStatementOpenDoc(doc)
                          } catch (e:any) {
                            console.error('Fetch statement failed', e)
                            alert('فشل جلب البيان: ' + (e?.message || JSON.stringify(e)))
                          } finally { setStatementLoading(false) }
                        }} className="h-9 px-3 flex items-center gap-2 rounded-md bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all text-[11px] font-black">
                          <FileText size={16} /> عرض ملخص
                          {statementLoading && <span className="ml-1 text-xs text-slate-400">...</span>}
                        </button>

                      </div>
                    </td>
                    <td className="px-8 py-7">
                      <div className="flex justify-end gap-3">
                        <BarcodePrinter doc={doc} settings={settings} />
                        <OfficialReceipt doc={doc} settings={settings} />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-200">
                      <Search size={40} />
                    </div>
                    <p className="text-2xl font-black text-slate-300 font-heading">لم يتم العثور على نتائج مطابقة</p>
                    <p className="text-slate-400 text-sm mt-1">
                      تأكد من كتابة الرقم بشكل صحيح أو تغيير نطاق البحث التاريخي
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
+      <StatementModal open={Boolean(statementOpenDoc)} onClose={() => { setStatementOpenDoc(null); setStatementText('') }} statement={statementText} />
    </div>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-200">
                      <Search size={40} />
                    </div>
                    <p className="text-2xl font-black text-slate-300 font-heading">لم يتم العثور على نتائج مطابقة</p>
                    <p className="text-slate-400 text-sm mt-1">
                      تأكد من كتابة الرقم بشكل صحيح أو تغيير نطاق البحث التاريخي
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
