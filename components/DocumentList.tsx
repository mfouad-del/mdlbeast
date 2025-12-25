"use client"

import { useState } from "react"
import type { Correspondence, SystemSettings } from "@/types"
import { Search, ArrowRightLeft, FileSpreadsheet, AlertCircle, FileText, Calendar, ScanText } from "lucide-react"
import AsyncButton from "./ui/async-button"
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
  const [stamperDoc, setStamperDoc] = useState<Correspondence | null>(null)

  const filtered = docs.filter((doc) => {
    const title = doc.title || doc.subject || ""
    const barcode = doc.barcodeId || doc.barcode || ""
    const matchesSearch =
      title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.sender.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStartDate = !startDate || doc.date >= startDate
    const matchesEndDate = !endDate || doc.date <= endDate

    return matchesSearch && matchesStartDate && matchesEndDate
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
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
                            <span>📅 القيد:</span>
                            <span className="font-black">{doc.dateHijri || doc.date}</span>
                            <span className="text-[11px] text-slate-500">({doc.dateGregorian || doc.date})</span>
                          </span>
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            📂 أرشفة: {doc.archiveDate || doc.date}
                          </span>

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
                              doc.priority === "عادي" ? "bg-slate-100 text-slate-500" : "bg-red-50 text-red-600"
                            }`}
                          >
                            {doc.priority}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-7">
                      {doc.pdfFile ? (
                        <div className="flex gap-2 items-center">
                          <AsyncButton
                            onClickAsync={async () => {
                              try {
                                const url = await apiClient.getPreviewUrl(doc.barcode || doc.barcodeId)
                                if (!url) { alert('لا يوجد ملف لعرضه'); return }
                                window.open(url, '_blank')
                              } catch (e) { console.error(e); alert('فشل فتح الملف') }
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-xl border border-green-200 hover:bg-green-100 transition-all text-[11px] font-black group"
                          >
                            <FileText size={16} /> فتح المرفق
                          </AsyncButton>
                          <button
                            onClick={() => setStamperDoc(doc)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl border border-slate-900 hover:bg-black transition-all text-[11px] font-black shadow-lg shadow-slate-200"
                          >
                            <ScanText size={16} /> دمغ الملصق
                          </button>
                          <AsyncButton
                            variant="outline"
                            size="sm"
                            className="text-red-500 border-red-100"
                            onClickAsync={async () => {
                              if (!confirm('حذف المستند؟')) return
                              await (await import('@/lib/api-client')).apiClient.deleteDocument(doc.barcode || doc.barcodeId)
                              window.location.reload()
                            }}
                          >
                            حذف
                          </AsyncButton>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          <span className="text-[11px] font-black text-slate-300 italic flex items-center gap-1.5">
                            <AlertCircle size={14} /> لا يوجد مرفق
                          </span>
                          <AsyncButton
                            variant="outline"
                            size="sm"
                            className="text-red-500 border-red-100"
                            onClickAsync={async () => {
                              if (!confirm('حذف المستند؟')) return
                              await (await import('@/lib/api-client')).apiClient.deleteDocument(doc.barcode || doc.barcodeId)
                              window.location.reload()
                            }}
                          >
                            حذف
                          </AsyncButton>
                        </div>
                      )}
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
    </div>
  )
}
