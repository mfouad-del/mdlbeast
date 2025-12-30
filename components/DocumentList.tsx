"use client"

import { useState, useRef, useEffect } from "react"
import type { Correspondence, SystemSettings } from "@/types"
import { Search, ArrowRightLeft, FileSpreadsheet, AlertCircle, FileText, Calendar, ScanText, Edit3, Check, X, Trash2 } from "lucide-react"
import AsyncButton from "./ui/async-button"
import StatementModal from "./StatementModal"
import { exportToCSV } from "@/lib/barcode-service"
import BarcodePrinter from "./BarcodePrinter"
import OfficialReceipt from "./OfficialReceipt"
import PdfStamper from "./PdfStamper"
import { apiClient } from "@/lib/api-client"
import { Spinner } from "./ui/spinner"

interface DocumentListProps {
  docs: Correspondence[]
  settings: SystemSettings
  currentUser?: any
  users?: any[]
  tenants?: any[]
}

export default function DocumentList({ docs, settings, currentUser, users, tenants }: DocumentListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'INCOMING' | 'OUTGOING'>('ALL')
  const [stamperDoc, setStamperDoc] = useState<Correspondence | null>(null)
  const [statementOpenDoc, setStatementOpenDoc] = useState<Correspondence | null>(null)
  const [statementText, setStatementText] = useState<string>('')
  const [statementLoading, setStatementLoading] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Correspondence | null>(null)
  const [editFormData, setEditFormData] = useState<any>({})
  const [editPending, setEditPending] = useState(false)
  const [uploadingAttachmentFor, setUploadingAttachmentFor] = useState<string | null>(null)

  const addAttachmentInputRef = useRef<HTMLInputElement | null>(null)
  const [localDocs, setLocalDocs] = useState(docs)

  useEffect(() => { setLocalDocs(docs) }, [docs])

  // Listen for stamped document events and update local list entry when triggered
  useEffect(() => {
    const handler = async (e: any) => {
      try {
        const barcode = e?.detail?.barcode
        if (!barcode) return
        const updated = await apiClient.getDocumentByBarcode(barcode).catch(() => null)
        if (updated) setLocalDocs((prev:any[]) => prev.map((d:any) => (d.barcode === barcode ? updated : d)))
      } catch (err) { console.warn('document:stamped handler failed', err) }
    }
    window.addEventListener('document:stamped', handler)
    return () => window.removeEventListener('document:stamped', handler)
  }, [])

  const handleAddAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const targetBarcode = (e.target as any)?._targetBarcode || ''
    if (!file || !targetBarcode) return
    
    setUploadingAttachmentFor(targetBarcode)
    try {
      const uploaded = await apiClient.uploadFile(file)
      await apiClient.addAttachment(targetBarcode, uploaded)
      // Fetch updated document and update local state (avoid full page reload)
      const updated = await apiClient.getDocumentByBarcode(targetBarcode)
      if (updated) {
        setLocalDocs((prev:any[]) => prev.map((d:any) => (d.barcode === targetBarcode ? updated : d)))
      }
    } catch (err: any) {
      console.error('Add attachment failed', err)
      alert('فشل إضافة المرفق: ' + (err?.message || err))
    } finally {
      setUploadingAttachmentFor(null)
      if (e.target) (e.target as any).value = ''
    }
  }

  const filtered = (localDocs || []).filter((doc) => {
    const title = doc.title || doc.subject || ""
    const barcode = doc.barcode || ""
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <input id="addAttachmentInput" ref={addAttachmentInputRef} type="file" accept=".pdf" className="hidden" onChange={handleAddAttachment} />
      {stamperDoc && <PdfStamper doc={stamperDoc} settings={settings} onClose={() => setStamperDoc(null)} />}

      {/* Search & Filter Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-300 shadow-md">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {/* Search Input */}
          <div className="lg:col-span-4 space-y-2">
            <label className="text-xs font-bold text-slate-500 mr-2">بحث سريع</label>
            <div className="relative group">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input
                type="text"
                placeholder="الباركود، الموضوع، الجهة..."
                className="w-full pr-12 pl-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Date Filters */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1">
                <Calendar size={12} /> من تاريخ
              </label>
              <input
                type="date"
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:bg-white focus:border-blue-500 transition-all text-slate-600"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1">
                <Calendar size={12} /> إلى تاريخ
              </label>
              <input
                type="date"
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:bg-white focus:border-blue-500 transition-all text-slate-600"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Type Filter */}
          <div className="lg:col-span-2 space-y-2">
            <label className="text-xs font-bold text-slate-500 mr-2">نوع القيد</label>
            <div className="relative">
              <select
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:bg-white focus:border-blue-500 transition-all appearance-none cursor-pointer text-slate-700"
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value as any)}
              >
                <option value="ALL">الكل</option>
                <option value="INCOMING">وارد</option>
                <option value="OUTGOING">صادر</option>
              </select>
              <ArrowRightLeft className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>

          {/* Actions */}
          <div className="lg:col-span-2 flex gap-2">
            <button
              onClick={() => { setSearchTerm(""); setStartDate(""); setEndDate(""); setDirectionFilter("ALL"); }}
              className="p-3.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 hover:text-slate-700 transition-all"
              title="إعادة تعيين الفلاتر"
            >
              <ArrowRightLeft size={20} />
            </button>
            <button
              onClick={() => exportToCSV(filtered, "Registry_Report")}
              className="flex-1 bg-slate-900 text-white px-4 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              <FileSpreadsheet size={18} />
              <span>تصدير</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="bg-white rounded-3xl border border-slate-300 shadow-md overflow-hidden">
        {filtered.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="px-6 py-4 text-[11px] font-black text-slate-700 uppercase tracking-wider text-center w-48">
                      المعرف الموحد
                    </th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-700 uppercase tracking-wider">
                      تفاصيل القيد
                    </th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-700 uppercase tracking-wider w-64">
                      البيانات الإضافية
                    </th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-700 uppercase tracking-wider text-left w-48">
                      الإجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.map((doc) => (
                    <tr key={doc.id} className="hover:bg-blue-50 transition-colors group">
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col items-center gap-2">
                          <span className="font-mono text-xs font-black text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg tracking-wider whitespace-nowrap">
                            {doc.barcode}
                          </span>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                            doc.type === 'INCOMING' 
                              ? 'bg-blue-50 text-blue-600 border-blue-100' 
                              : 'bg-purple-50 text-purple-600 border-purple-100'
                          }`}>
                            {doc.type === 'INCOMING' ? 'وارد' : 'صادر'}
                          </span>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 align-top">
                        <div className="space-y-2">
                          <h3 className="font-black text-slate-900 text-base leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
                            {doc.title || doc.subject}
                          </h3>
                          
                          <div className="flex flex-wrap gap-y-1 gap-x-4 text-xs text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-400">من:</span>
                              <span className="font-medium text-slate-700">{doc.sender || '—'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-400">إلى:</span>
                              <span className="font-medium text-slate-700">
                                {doc.recipient || (
                                  doc.type === 'INCOMING' && doc.companyId && tenants 
                                    ? (tenants.find(t => String(t.id) === String(doc.companyId))?.name || '—')
                                    : '—'
                                )}
                              </span>
                            </div>
                          </div>

                          {(doc.date || doc.documentDate || (doc as any).displayDate) && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-50 w-fit px-2 py-1 rounded-md">
                              <Calendar size={12} />
                              <span dir="ltr" className="font-mono">
                                {(() => {
                                  try {
                                    const d = new Date((doc as any).displayDate || doc.date || doc.documentDate || '');
                                    if (isNaN(d.getTime())) return '---';
                                    // Format: DD/MM/YYYY HH:mm
                                    return d.toLocaleString('en-GB', { 
                                      day: '2-digit', 
                                      month: '2-digit', 
                                      year: 'numeric', 
                                      hour: '2-digit', 
                                      minute: '2-digit',
                                      hour12: true 
                                    }).replace(',', '');
                                  } catch (e) { return '---' }
                                })()}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-slate-400">المرفقات:</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1.5">
                            {(doc.attachments || []).length > 0 ? (
                              (doc.attachments || []).map((_, idx) => (
                                <button
                                  key={idx}
                                  onClick={async () => {
                                    try {
                                      const url = await apiClient.getPreviewUrl(doc.barcode, idx)
                                      if (url) window.open(url, '_blank')
                                      else alert('لا يوجد ملف لعرضه')
                                    } catch(e) { alert('فشل فتح المرفق') }
                                  }}
                                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 text-[10px] font-black flex items-center justify-center transition-all border border-slate-200 shadow-sm"
                                  title={`عرض المرفق ${idx + 1}`}
                                >
                                  {idx + 1}
                                </button>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-300 font-bold">—</span>
                            )}
                            
                            {uploadingAttachmentFor === doc.barcode ? (
                              <div className="w-7 h-7 flex items-center justify-center">
                                <Spinner className="text-blue-600" />
                              </div>
                            ) : (
                              <button 
                                className="w-7 h-7 rounded-lg bg-white border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 flex items-center justify-center transition-all"
                                title="إضافة مرفق"
                                onClick={() => {
                                  const el = document.getElementById('addAttachmentInput') as HTMLInputElement | null
                                  if (!el) return
                                  ;(el as any)._targetBarcode = doc.barcode
                                  el.click()
                                }}
                              >
                                <span className="text-lg leading-none mb-0.5">+</span>
                              </button>
                            )}
                          </div>
                          
                          {doc.statement && (
                            <div className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1.5 rounded-lg leading-relaxed line-clamp-2 mt-2">
                              {doc.statement}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-middle">
                        <div className="flex flex-col gap-3 items-end">
                          <button
                            onClick={() => setStamperDoc(doc)}
                            className="px-3 h-7 rounded-lg bg-slate-900 text-white hover:bg-black flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95"
                            title="ختم المستند"
                          >
                            <ScanText size={14} />
                            <span className="text-[10px] font-bold">ختم المستند</span>
                          </button>

                          <div className="flex items-center gap-1 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                            <BarcodePrinter doc={doc} settings={settings} />
                            <OfficialReceipt doc={doc} settings={settings} />

                            {currentUser?.role === 'admin' && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingDoc(doc)
                                    setEditFormData({
                                      subject: doc.subject || doc.title,
                                      sender: doc.sender,
                                      recipient: doc.recipient || doc.receiver,
                                      type: doc.type,
                                      date: doc.date
                                    })
                                  }}
                                  className="w-7 h-7 flex items-center justify-center bg-blue-50 border border-blue-100 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                  title="تعديل"
                                >
                                  <Edit3 size={14} />
                                </button>

                                <AsyncButton
                                  className="w-7 h-7 flex items-center justify-center bg-red-50 border border-red-100 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                  onClickAsync={async () => {
                                    if (!confirm('هل أنت متأكد من حذف هذا المستند؟')) return
                                    await apiClient.deleteDocument(doc.barcode)
                                    setLocalDocs(prev => prev.filter(d => d.barcode !== doc.barcode))
                                  }}
                                >
                                  <Trash2 size={14} />
                                </AsyncButton>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 p-4 bg-slate-50">
              {filtered.map((doc) => (
                <div key={doc.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs font-black text-slate-700 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg w-fit">
                        {doc.barcode}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border w-fit ${
                        doc.type === 'INCOMING' 
                          ? 'bg-blue-50 text-blue-600 border-blue-100' 
                          : 'bg-purple-50 text-purple-600 border-purple-100'
                      }`}>
                        {doc.type === 'INCOMING' ? 'وارد' : 'صادر'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStamperDoc(doc)}
                        className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-md active:scale-95"
                        title="ختم المستند"
                      >
                        <ScanText size={16} />
                      </button>
                      <BarcodePrinter doc={doc} settings={settings} />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-black text-slate-900 text-sm leading-snug mb-2">
                      {doc.title || doc.subject}
                    </h3>
                    <div className="flex flex-col gap-1 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-slate-400">من:</span>
                        <span>{doc.sender || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-slate-400">إلى:</span>
                        <span>{doc.recipient || '—'}</span>
                      </div>
                      {(doc.date || doc.documentDate || (doc as any).displayDate) && (
                        <div className="flex items-center gap-1 mt-1">
                          <Calendar size={12} className="text-slate-400" />
                          <span dir="ltr" className="font-mono text-[10px]">
                            {(() => {
                              try {
                                const d = new Date((doc as any).displayDate || doc.date || doc.documentDate || '');
                                if (isNaN(d.getTime())) return '---';
                                return d.toLocaleString('en-GB', { 
                                  day: '2-digit', 
                                  month: '2-digit', 
                                  year: 'numeric', 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  hour12: true 
                                }).replace(',', '');
                              } catch (e) { return '---' }
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                    <div className="flex gap-1">
                      {(doc.attachments || []).length > 0 ? (
                        (doc.attachments || []).map((_, idx) => (
                          <button
                            key={idx}
                            onClick={async () => {
                              try {
                                const url = await apiClient.getPreviewUrl(doc.barcode, idx)
                                if (url) window.open(url, '_blank')
                                else alert('لا يوجد ملف لعرضه')
                              } catch(e) { alert('فشل فتح المرفق') }
                            }}
                            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 text-xs font-black flex items-center justify-center border border-slate-200"
                          >
                            {idx + 1}
                          </button>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-300 font-bold">لا يوجد مرفقات</span>
                      )}
                      <button 
                        className="w-8 h-8 rounded-lg bg-white border border-dashed border-slate-300 text-slate-400 flex items-center justify-center"
                        onClick={() => {
                          const el = document.getElementById('addAttachmentInput') as HTMLInputElement | null
                          if (!el) return
                          ;(el as any)._targetBarcode = doc.barcode
                          el.click()
                        }}
                      >
                        <span className="text-lg leading-none mb-0.5">+</span>
                      </button>
                    </div>

                    {currentUser?.role === 'admin' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingDoc(doc)
                            setEditFormData({
                              subject: doc.subject || doc.title,
                              sender: doc.sender,
                              recipient: doc.recipient || doc.receiver,
                              type: doc.type,
                              date: doc.date
                            })
                          }}
                          className="p-2 bg-blue-50 text-blue-600 rounded-lg"
                        >
                          <FileText size={16} />
                        </button>
                        <AsyncButton
                          className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"
                          onClickAsync={async () => {
                            if (!confirm('هل أنت متأكد من حذف هذا المستند؟')) return
                            await apiClient.deleteDocument(doc.barcode)
                            setLocalDocs(prev => prev.filter(d => d.barcode !== doc.barcode))
                          }}
                        >
                          <Trash2 size={16} />
                        </AsyncButton>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Search size={32} className="opacity-20" />
            </div>
            <p className="font-bold text-lg text-slate-600">لا توجد نتائج</p>
            <p className="text-sm">جرب تغيير معايير البحث أو الفلاتر</p>
            <button 
              onClick={() => { setSearchTerm(""); setStartDate(""); setEndDate(""); setDirectionFilter("ALL"); }}
              className="mt-4 text-blue-600 text-sm font-bold hover:underline"
            >
              إعادة تعيين الفلاتر
            </button>
          </div>
        )}
      </div>
      <StatementModal open={Boolean(statementOpenDoc)} onClose={() => { setStatementOpenDoc(null); setStatementText('') }} statement={statementText} />
      
      {/* Edit Record Modal */}
      {editingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-2xl font-black text-slate-900">تعديل القيد</h2>
                <p className="text-sm text-slate-500 mt-1">الباركود: {editingDoc.barcode}</p>
              </div>
              <button 
                onClick={() => setEditingDoc(null)} 
                className="text-slate-400 hover:text-slate-700 transition-colors p-2"
              >
                ✕
              </button>
            </div>

            <form 
              onSubmit={async (e) => {
                e.preventDefault()
                if (!editingDoc) return
                try {
                  setEditPending(true)
                  const payload = {
                    sender: editFormData.sender,
                    receiver: editFormData.receiver,
                    subject: editFormData.subject,
                    date: editFormData.date,
                    priority: editFormData.priority,
                    notes: editFormData.notes,
                    classification: editFormData.classification,
                  }
                  await apiClient.updateDocument(editingDoc.barcode, payload)
                  const updated = await apiClient.getDocumentByBarcode(editingDoc.barcode)
                  if (updated) {
                    setLocalDocs((prev:any[]) => prev.map((d:any) => (d.barcode === editingDoc.barcode ? updated : d)))
                  }
                  setEditingDoc(null)
                  alert('تم حفظ التعديلات بنجاح')
                } catch (err: any) {
                  console.error('Failed to update document', err)
                  alert('فشل حفظ التعديلات: ' + (err?.message || 'حدث خطأ'))
                } finally {
                  setEditPending(false)
                }
              }}
              className="p-8 space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 block">من (الجهة الأولى) *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.sender}
                    onChange={(e) => setEditFormData({...editFormData, sender: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold"
                    placeholder="اسم الجهة الأولى"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 block">إلى (الجهة الثانية) *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.receiver}
                    onChange={(e) => setEditFormData({...editFormData, receiver: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold"
                    placeholder="اسم الجهة الثانية"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 block">الموضوع/العنوان *</label>
                <input
                  type="text"
                  required
                  value={editFormData.subject}
                  onChange={(e) => setEditFormData({...editFormData, subject: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold"
                  placeholder="موضوع المعاملة"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 block">التاريخ *</label>
                  <input
                    type="date"
                    required
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 block">الأولوية</label>
                  <select
                    value={editFormData.priority}
                    onChange={(e) => setEditFormData({...editFormData, priority: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold cursor-pointer"
                  >
                    <option value="عاديه">عادي</option>
                    <option value="عاجله">عاجل</option>
                    <option value="عاجل">أولوية عالية</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 block">التصنيف</label>
                <select
                  value={editFormData.classification}
                  onChange={(e) => setEditFormData({...editFormData, classification: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold cursor-pointer"
                >
                  <option value="عادي">عادي</option>
                  <option value="سري">سري</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 block">ملاحظات</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold min-h-[100px]"
                  placeholder="ملاحظات إضافية"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={editPending}
                  className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black text-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20"
                >
                  {editPending ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  disabled={editPending}
                  className="flex-1 bg-slate-200 text-slate-700 py-4 rounded-xl font-black text-lg hover:bg-slate-300 disabled:opacity-60 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
