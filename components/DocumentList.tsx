"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import type { Correspondence, SystemSettings } from "@/types"
import { Search, ArrowRightLeft, FileSpreadsheet, FileText, Calendar, ScanText, Edit3, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import AsyncButton from "./ui/async-button"
import StatementModal from "./StatementModal"
import { exportToCSV } from "@/lib/barcode-service"
import BarcodePrinter from "./BarcodePrinter"
import OfficialReceipt from "./OfficialReceipt"
import PdfStamper from "./PdfStamper"
import { apiClient } from "@/lib/api-client"
import { Spinner } from "./ui/spinner"
import { useI18n } from "@/lib/i18n-context"

interface DocumentListProps {
  docs: Correspondence[]
  settings: SystemSettings
  currentUser?: any
  users?: any[]
  tenants?: any[]
  onRefresh?: () => void | Promise<void>
}

export default function DocumentList({ docs, settings, currentUser, users: _users, tenants, onRefresh }: DocumentListProps) {
  const { t, locale, dir } = useI18n()
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'INCOMING' | 'OUTGOING'>('ALL')
  const [stamperDoc, setStamperDoc] = useState<Correspondence | null>(null)
  const [statementOpenDoc, setStatementOpenDoc] = useState<Correspondence | null>(null)
  
  // Permissions - الصلاحيات المدمجة من الـ backend
  // NOTE: Backend uses 'archive' module, not 'documents' (legacy key mapping)
  const docPerms = currentUser?.permissions?.archive || {}
  
  // الصاحب دائماً يمكنه التعديل/الحذف، لكن الصلاحيات المخصصة تتحكم في الباقي
  const canEdit = (doc: any) => {
    if (doc?.user_id === currentUser?.id) return true // صاحب المستند
    return docPerms.edit === true
  }
  const canDelete = (doc: any) => {
    if (doc?.user_id === currentUser?.id) return true // صاحب المستند
    return docPerms.delete === true
  }
  const canStamp = docPerms.stamp === true
  const [statementText, setStatementText] = useState<string>('')
  const [_statementLoading, _setStatementLoading] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Correspondence | null>(null)
  const [editFormData, setEditFormData] = useState<any>({})
  const [editPending, setEditPending] = useState(false)
  const [uploadingAttachmentFor, setUploadingAttachmentFor] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

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
      const uploaded = await apiClient.uploadFile(file, 3, 'documents')
      
      const result = await apiClient.addAttachment(targetBarcode, uploaded)
      
      // Fetch updated document and update local state (avoid full page reload)
      const updated = await apiClient.getDocumentByBarcode(targetBarcode)
      
      if (updated) {
        setLocalDocs((prev: any[]) => {
          const updatedId = (updated as any).id
          const updatedBarcode = (updated as any).barcode
          const targetLower = String(targetBarcode).toLowerCase()
          
          return prev.map((d: any) => {
            if (updatedId && d?.id === updatedId) {
              return updated
            }
            if (d?.barcode && String(d.barcode).toLowerCase() === targetLower) {
              return updated
            }
            // Also match by updated barcode (in case format differs)
            if (updatedBarcode && d?.barcode && String(d.barcode).toLowerCase() === String(updatedBarcode).toLowerCase()) {
              return updated
            }
            return d
          })
        })
        alert(t('archive.attachment_added'))
      } else {
        alert(t('archive.attachment_view_error'))
      }
    } catch (err: any) {
      console.error('Add attachment failed', err)
      alert(t('archive.attachment_failed') + (err?.message || err))
    } finally {
      setUploadingAttachmentFor(null)
      if (e.target) (e.target as any).value = ''
    }
  }

  const filtered = (localDocs || []).filter((doc) => {
    const title = doc.title || doc.subject || ""
    const barcode = doc.barcode || ""
    const sender = doc.sender || ""
    const receiver = doc.receiver || doc.recipient || ""
    const description = doc.description || doc.notes || ""
    
    const searchLower = searchTerm.toLowerCase()
    
    const matchesSearch =
      title.toLowerCase().includes(searchLower) ||
      barcode.toLowerCase().includes(searchLower) ||
      sender.toLowerCase().includes(searchLower) ||
      receiver.toLowerCase().includes(searchLower) ||
      description.toLowerCase().includes(searchLower)

    // Use documentDate as authoritative date for filtering
    const docDate = (doc.documentDate || doc.date || '').split('T')?.[0]
    const matchesStartDate = !startDate || docDate >= startDate
    const matchesEndDate = !endDate || docDate <= endDate

    const matchesDirection = directionFilter === 'ALL' || (directionFilter === 'INCOMING' && (doc.status === 'وارد' || (doc.type === 'INCOMING'))) || (directionFilter === 'OUTGOING' && (doc.status === 'صادر' || (doc.type === 'OUTGOING')))

    return matchesSearch && matchesStartDate && matchesEndDate && matchesDirection
  })

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage, itemsPerPage])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, startDate, endDate, directionFilter])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <input id="addAttachmentInput" ref={addAttachmentInputRef} type="file" accept=".pdf" className="hidden" onChange={handleAddAttachment} />
      {stamperDoc && <PdfStamper doc={stamperDoc} settings={settings} onClose={() => setStamperDoc(null)} />}

      {/* Search & Filter Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-300 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-6 items-end">
        {/* Search Input */}
          <div className="md:col-span-6 lg:col-span-4 space-y-2">
            <label className="text-xs font-bold text-slate-500 mr-2">{t('archive.searchTitle')}</label>
            <div className="relative group">
              <Search className={`absolute ${dir==='rtl' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors`} size={20} />
              <input
                type="text"
                placeholder={t('archive.searchPlaceholder')}
                className={`w-full ${dir==='rtl' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-sm`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Date Filters */}
          <div className="md:col-span-6 lg:col-span-4 grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1">
                <Calendar size={12} /> {t('common.fromDate')}
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
                <Calendar size={12} /> {t('common.toDate')}
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
          <div className="md:col-span-3 lg:col-span-2 space-y-2">
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
          <div className="md:col-span-3 lg:col-span-2 flex gap-2">
            <button
              onClick={() => { setSearchTerm(""); setStartDate(""); setEndDate(""); setDirectionFilter("ALL"); }}
              className="p-3.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 hover:text-slate-700 transition-all"
              title="Reset Filters"
              aria-label="Reset Filters"
            >
              <ArrowRightLeft size={20} />
            </button>
            <button
              onClick={() => exportToCSV(filtered, "Registry_Report")}
              className="flex-1 bg-slate-900 text-white px-4 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
              aria-label={t('archive.extractReport')}
            >
              <FileSpreadsheet size={18} />
              <span>{t('archive.extractReport')}</span>
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
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="px-6 py-4 text-[11px] font-black text-slate-700 uppercase tracking-wider text-center w-48">
                      {t('archive.unifiedID')}
                    </th>
                    <th className={`px-6 py-4 text-[11px] font-black text-slate-700 uppercase tracking-wider ${dir==='rtl' ? 'text-right' : 'text-left'}`}>
                      {t('archive.docDetails')}
                    </th>
                    <th className={`px-6 py-4 text-[11px] font-black text-slate-700 uppercase tracking-wider w-64 ${dir==='rtl' ? 'text-right' : 'text-left'}`}>
                      {t('archive.addDetails')}
                    </th>
                    <th className={`px-6 py-4 text-[11px] font-black text-slate-700 uppercase tracking-wider w-48 ${dir==='rtl' ? 'text-left' : 'text-right'}`}>
                      {t('archive.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedDocs.map((doc) => (
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
                            {doc.type === 'INCOMING' ? t('archive.incoming') : t('archive.outgoing')}
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
                              <span className="font-bold text-slate-400">{t('archive.from')}:</span>
                              <span className="font-medium text-slate-700">{doc.sender || '—'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-400">{t('archive.to')}:</span>
                              <span className="font-medium text-slate-700">
                                {doc.recipient || '—'}
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
                                    return d.toLocaleString(locale === 'ar' ? 'en-GB' : 'en-US', { 
                                      day: '2-digit', month: '2-digit', year: 'numeric', 
                                      hour: '2-digit', minute: '2-digit', hour12: true 
                                    }).replace(',', '');
                                  } catch (_e) { return '---' }
                                })()}
                              </span>
                            </div>
                          )}

                          {/* Created By with Avatar */}
                          {(() => {
                             // Try to find creator in users list (best match)
                             const creatorId = doc.user_id || (doc as any).created_by
                             const creator = (_users || []).find(u => u.id === creatorId || u.id === Number(creatorId) || u.username === (doc as any).createdBy)
                             
                             // Fallback to text if user not found in list but name exists on doc
                             const creatorName = creator?.full_name || creator?.username || (doc as any).created_by_name || (doc as any).created_by_username || (doc as any).createdBy
                             
                             if (!creatorName) return null

                             return (
                               <div className="flex items-center gap-2 mt-2 p-1.5 pr-2 bg-gradient-to-l from-indigo-50 to-white border border-indigo-100 rounded-full w-fit shadow-sm">
                                  <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden border border-white shadow-sm shrink-0">
                                    {creator?.avatar_url ? (
                                      <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-[9px] font-black text-indigo-600">{creatorName.substring(0,1).toUpperCase()}</span>
                                    )}
                                  </div>
                                  <div className="flex flex-col leading-none pl-1">
                                    <span className="text-[9px] text-slate-400 font-bold mb-0.5">{t('archive.by')}</span>
                                    <span className="text-[10px] font-black text-indigo-700">{creatorName}</span>
                                  </div>
                               </div>
                             )
                          })()}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-slate-400">{t('archive.attachments')}:</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1.5">
                            {(doc.attachments || []).length > 0 ? (
                              (doc.attachments || []).map((_, idx) => (
                                <div key={idx} className="relative group">
                                  <button
                                    onClick={async () => {
                                      try {
                                        const url = await apiClient.getPreviewUrl(doc.barcode, idx)
                                        if (url) window.open(url, '_blank')
                                        else alert('لا يوجد ملف لعرضه')
                                      } catch(_e) { alert('فشل فتح المرفق') }
                                    }}
                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-600 text-[10px] font-black flex items-center justify-center transition-all border border-slate-200 shadow-sm"
                                    title={`Preview ${idx + 1}`}
                                  >
                                    {idx + 1}
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!confirm("Are you sure?")) return
                                      try {
                                        await apiClient.deleteAttachment(doc.id, idx)
                                        // Update local state immediately without refresh
                                        setLocalDocs((prev: any[]) => 
                                          prev.map((d: any) => {
                                            if (d.id === doc.id) {
                                              const newAttachments = [...(d.attachments || [])]
                                              newAttachments.splice(idx, 1)
                                              return {
                                                ...d,
                                                attachments: newAttachments,
                                                attachment_count: newAttachments.length,
                                                attachmentCount: newAttachments.length
                                              }
                                            }
                                            return d
                                          })
                                        )
                                      } catch(e: any) {
                                        alert('Error: ' + (e?.message || e))
                                      }
                                    }}
                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white text-[8px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    title="Delete Attachment"
                                  >
                                    ×
                                  </button>
                                </div>
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
                                title={t('common.create')}
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
                            title={t('archive.stamp')}
                          >
                            <ScanText size={14} />
                            <span className="text-[10px] font-bold">{t('archive.stamp')}</span>
                          </button>

                          <div className="flex items-center gap-1 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                            <BarcodePrinter doc={doc} settings={settings} />
                            <OfficialReceipt doc={doc} settings={settings} />

                            {canEdit(doc) && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingDoc(doc)
                                    setEditFormData({
                                      subject: doc.subject || doc.title || '',
                                      sender: doc.sender || '',
                                      receiver: doc.receiver || doc.recipient || '',
                                      type: doc.type || '',
                                      date: doc.date || '',
                                      priority: doc.priority || 'عادي',
                                      classification: doc.classification || doc.security || 'عادي',
                                      notes: doc.notes || '',
                                      attachmentCount: doc.attachmentCount || '0'
                                    })
                                  }}
                                  className="w-7 h-7 flex items-center justify-center bg-blue-50 border border-blue-100 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                  title={t('common.edit')}
                                >
                                  <Edit3 size={14} />
                                </button>

                                <AsyncButton
                                  className="w-7 h-7 flex items-center justify-center bg-red-50 border border-red-100 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                  onClickAsync={async () => {
                                    if (!confirm(t('common.confirm') + '?')) return
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
              {paginatedDocs.map((doc) => (
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
                        {doc.type === 'INCOMING' ? t('archive.incoming') : t('archive.outgoing')}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStamperDoc(doc)}
                        className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-md active:scale-95"
                        title={t('archive.stamp')}
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
                        <span className="font-bold text-slate-400">{t('archive.from')}:</span>
                        <span>{doc.sender || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-slate-400">{t('archive.to')}:</span>
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
                                return d.toLocaleString(locale === 'ar' ? 'en-GB' : 'en-US', { 
                                  day: '2-digit', 
                                  month: '2-digit', 
                                  year: 'numeric', 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  hour12: true 
                                }).replace(',', '');
                              } catch (_e) { return '---' }
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
                          <div key={idx} className="relative group">
                            <button
                              onClick={async () => {
                                try {
                                  const url = await apiClient.getPreviewUrl(doc.barcode, idx)
                                  if (url) {
                                    window.open(url, '_blank')
                                    apiClient.logAction('VIEW_DOCUMENT', `Opened attachment ${idx + 1} for document ${doc.barcode}`, 'DOCUMENT', doc.barcode)
                                  }
                                  else alert('لا يوجد ملف لعرضه')
                                } catch(_e) { alert('فشل فتح المرفق') }
                              }}
                              className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 text-xs font-black flex items-center justify-center border border-slate-200"
                            >
                              {idx + 1}
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`هل تريد حذف المرفق ${idx + 1}؟`)) return
                                try {
                                  await apiClient.deleteAttachment(doc.id, idx)
                                  // Update local state immediately without refresh
                                  setLocalDocs((prev: any[]) => 
                                    prev.map((d: any) => {
                                      if (d.id === doc.id) {
                                        const newAttachments = [...(d.attachments || [])]
                                        newAttachments.splice(idx, 1)
                                        return {
                                          ...d,
                                          attachments: newAttachments,
                                          attachment_count: newAttachments.length,
                                          attachmentCount: newAttachments.length
                                        }
                                      }
                                      return d
                                    })
                                  )
                                  alert('تم حذف المرفق بنجاح')
                                } catch(e: any) {
                                  alert('فشل حذف المرفق: ' + (e?.message || e))
                                }
                              }}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 hover:bg-red-600 text-white text-[8px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                              title="حذف المرفق"
                            >
                              ×
                            </button>
                          </div>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-300 font-bold">{t('archive.noAttachments')}</span>
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

                    {canEdit(doc) && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingDoc(doc)
                            setEditFormData({
                              subject: doc.subject || doc.title || '',
                              sender: doc.sender || '',
                              receiver: doc.receiver || doc.recipient || '',
                              type: doc.type || '',
                              date: doc.date || '',
                              priority: doc.priority || 'عادي',
                              classification: doc.classification || doc.security || 'عادي',
                              notes: doc.notes || '',
                              attachmentCount: doc.attachmentCount || doc.attachment_count || '0'
                            })
                          }}
                          className="p-2 bg-blue-50 text-blue-600 rounded-lg"
                        >
                          <FileText size={16} />
                        </button>
                        <AsyncButton
                          className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"
                          onClickAsync={async () => {
                            if (!confirm(t('common.confirm') + '?')) return
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

            {/* Pagination */}
            {filtered.length > 0 && (
              <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 border-t border-slate-200 ${dir==='rtl' ? 'flex-col-reverse sm:flex-row' : ''}`}>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500 font-bold">
                    {t('archive.pagination')} <span className="text-slate-900 font-black">{Math.min((currentPage - 1) * itemsPerPage + 1, filtered.length)}</span> - <span className="text-slate-900 font-black">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> {t('archive.paginationOf')} <span className="text-slate-900 font-black">{filtered.length}</span>
                  </span>
                  
                  <select
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-slate-200 outline-none"
                  >
                    <option value={10}>10 / {t('archive.page')}</option>
                    <option value={20}>20 / {t('archive.page')}</option>
                    <option value={50}>50 / {t('archive.page')}</option>
                    <option value={100}>100 / {t('archive.page')}</option>
                  </select>
                </div>

                {totalPages > 1 && (
                  <div className={`flex items-center gap-1 ${dir==='rtl' ? 'flex-row-reverse' : ''}`}>
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      {dir === 'rtl' ? <ChevronsRight size={16} className="text-slate-600" /> : <ChevronsLeft size={16} className="text-slate-600" />}
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      {dir === 'rtl' ? <ChevronRight size={16} className="text-slate-600" /> : <ChevronLeft size={16} className="text-slate-600" />}
                    </button>

                    <div className="flex items-center gap-1 px-2">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`min-w-[36px] h-9 px-3 rounded-xl text-sm font-bold transition-all ${
                              currentPage === pageNum
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-600 hover:bg-white hover:shadow-sm'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      {dir === 'rtl' ? <ChevronLeft size={16} className="text-slate-600" /> : <ChevronRight size={16} className="text-slate-600" />}
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      {dir === 'rtl' ? <ChevronsLeft size={16} className="text-slate-600" /> : <ChevronsRight size={16} className="text-slate-600" />}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Search size={32} className="opacity-20" />
            </div>
            <p className="font-bold text-lg text-slate-600">{t('archive.noResults')}</p>
            <p className="text-sm">{t('archive.tryChangingFilters')}</p>
            <button 
              onClick={() => { setSearchTerm(""); setStartDate(""); setEndDate(""); setDirectionFilter("ALL"); }}
              className="mt-4 text-blue-600 text-sm font-bold hover:underline"
            >
              {t('common.reset')}
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
                    attachmentCount: editFormData.attachmentCount,
                  }
                  await apiClient.updateDocument(editingDoc.barcode, payload)
                  const updated = await apiClient.getDocumentByBarcode(editingDoc.barcode)
                  if (updated) {
                    setLocalDocs((prev:any[]) => prev.map((d:any) => (d.barcode === editingDoc.barcode ? updated : d)))
                  }
                  // Also refresh the main documents list to ensure consistency
                  if (onRefresh) onRefresh()
                  setEditingDoc(null)
                  alert(t('archive.saveSuccess'))
                } catch (err: any) {
                  console.error('Failed to update document', err)
                  alert(t('archive.saveError') + ': ' + (err?.message || 'Error'))
                } finally {
                  setEditPending(false)
                }
              }}
              className="p-8 space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 block">{t('archive.from')} *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.sender}
                    onChange={(e) => setEditFormData({...editFormData, sender: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold"
                    placeholder={t('archive.sender')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 block">{t('archive.to')} *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.receiver}
                    onChange={(e) => setEditFormData({...editFormData, receiver: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold"
                    placeholder={t('archive.recipient')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 block">{t('archive.subject')} *</label>
                <input
                  type="text"
                  required
                  value={editFormData.subject}
                  onChange={(e) => setEditFormData({...editFormData, subject: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold"
                  placeholder={t('archive.subject')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 block">{t('archive.date')} *</label>
                  <input
                    type="date"
                    required
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({...editFormData, date: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 block">{t('archive.priority')}</label>
                  <select
                    value={editFormData.priority}
                    onChange={(e) => setEditFormData({...editFormData, priority: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold cursor-pointer"
                  >
                    <option value="عاديه">{t('archive.normal')}</option>
                    <option value="عاجله">{t('archive.urgent')}</option>
                    <option value="عاجل">{t('archive.topPriority')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 block">{t('archive.attachments')}</label>
                <input
                  type="text"
                  value={editFormData.attachmentCount || ''}
                  onChange={(e) => setEditFormData({...editFormData, attachmentCount: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold"
                  placeholder="e.g. 1 CD"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 block">{t('archive.classification')}</label>
                <select
                  value={editFormData.classification}
                  onChange={(e) => setEditFormData({...editFormData, classification: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold cursor-pointer"
                >
                  <option value="عادي">{t('archive.normal')}</option>
                  <option value="سري">{t('archive.secret')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 block">{t('archive.notes')}</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({...editFormData, notes: e.target.value})}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 transition-all font-bold min-h-[100px]"
                  placeholder={t('archive.notesPlaceholder')}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={editPending}
                  className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black text-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-600/20"
                >
                  {editPending ? t('common.saving') : t('common.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  disabled={editPending}
                  className="flex-1 bg-slate-200 text-slate-700 py-4 rounded-xl font-black text-lg hover:bg-slate-300 disabled:opacity-60 transition-all"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

