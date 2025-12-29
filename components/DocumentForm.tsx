"use client"

import type React from "react"

import { useState, useRef, useCallback, memo, useEffect } from "react"
import {
  FilePlus,
  Send,
  Shield,
  MapPin,
  UserCheck,
  FileUp,
  X,
  CheckCircle2,
  User,
  Landmark,
  ClipboardList,
  Calendar,
} from "lucide-react"
import { generateBusinessBarcode } from "@/lib/barcode-service"
import AsyncButton from './ui/async-button'

const FormInput = memo(({ label, icon: Icon, name, value, type = "text", required = false, onChange }: any) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-black text-slate-500 uppercase tracking-tight flex items-center gap-1.5 mr-1">
      <Icon size={12} className="text-slate-400" /> {label}
    </label>
    <input
      required={required}
      type={type}
      name={name}
      className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all text-slate-900 font-bold text-sm placeholder:text-slate-300 shadow-sm"
      value={value}
      onChange={onChange}
    />
  </div>
))

FormInput.displayName = "FormInput"

interface DocumentFormProps {
  type: string
  onSave: (doc: any) => void
  companies?: { id: string; name?: string; nameAr?: string; logo_url?: string }[]
}

export default function DocumentForm({ type, onSave, companies }: DocumentFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<any>(undefined)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [filePageCount, setFilePageCount] = useState<number>(0)
  const [users, setUsers] = useState<any[]>([])
  const [formData, setFormData] = useState<any>({
    title: "",
    sender: "",
    recipient: "",
    referenceNumber: "",
    documentDate: new Date().toISOString().split("T")[0],
    description: "",
    statement: "",
    security: "عادي",
    priority: "عاديه",
    attachmentCount: 0,
  })

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target as any
    const parsed = (name === 'attachmentCount') ? (value === '' ? '' : Number(value)) : value
    setFormData((prev: any) => ({ ...prev, [name]: parsed }))
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile)
      const preview = URL.createObjectURL(selectedFile)
      setFilePreviewUrl(preview)

      // compute page count using pdf-lib in client
      try {
        const { PDFDocument } = await import('pdf-lib')
        const ab = await selectedFile.arrayBuffer()
        const pdfDoc = await PDFDocument.load(ab)
        const pc = pdfDoc.getPageCount()
        setFilePageCount(pc)
      } catch (err) {
        console.warn('Failed to compute page count', err)
        setFilePageCount(0)
      }
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [name]: value }))
  }

  // load users for signatory select
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const u = await (await import('@/lib/api-client')).apiClient.getUsers().catch(() => [])
        if (mounted) setUsers(u || [])
      } catch (e) {
        console.warn('DocumentForm: failed to load users', e)
      }
    })()
    return () => { mounted = false }
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()

    let pdfFile = undefined
    try {
      if (file) {
        // upload file to backend and get URL
        // import apiClient dynamically to avoid circular import issues in some builds
        const { apiClient } = await import("../lib/api-client")
        const uploaded = await apiClient.uploadFile(file as File)
        // Include key/bucket/storage when available so server can access the object directly (R2/Supabase)
        pdfFile = { name: uploaded.name, size: uploaded.size, url: uploaded.url, key: uploaded.key, bucket: uploaded.bucket, storage: uploaded.storage }
      }
    } catch (err) {
      console.error('Upload failed', err)
      alert('فشل رفع الملف. حاول لاحقاً.')
      return
    }

    // Ensure 'date' sent to server includes a time portion to avoid midnight-only timestamps
    const dateWithTime = (formData.documentDate && /^\d{4}-\d{2}-\d{2}$/.test(formData.documentDate))
      ? `${formData.documentDate}T${new Date().toISOString().split('T')[1]}`
      : formData.documentDate || new Date().toISOString()

    // Do not pre-generate barcode on client; backend will assign numeric sequence
    onSave({ ...formData, type, pdfFile, date: dateWithTime })
  }

  return (
    <div className="max-w-5xl mx-auto pb-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="bg-white p-10 lg:p-14 rounded-[3rem] border border-slate-200 shadow-xl shadow-slate-200/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-2 bg-slate-900"></div>

        <header className="flex items-center gap-6 mb-12">
          <div className="p-5 rounded-[1.5rem] bg-slate-900 text-white shadow-2xl shadow-slate-900/20">
            {type === "INCOMING" ? <FilePlus size={28} /> : <Send size={28} />}
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 font-heading tracking-tight">
              قيد {type === "INCOMING" ? "وارد" : "صادر"} جديد
            </h2>
            <p className="text-slate-400 font-bold text-[11px] uppercase tracking-[0.2em] mt-1">
              المؤسسة المستقلة: زوايا البناء
            </p>
            <p className="text-xs text-slate-500 mt-2">ملاحظة: سيُولد رقم المعاملة تلقائياً عند الحفظ بشكل رقمي متسلسل (مثال: 0000001).</p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <FormInput
                label="موضوع المعاملة"
                icon={ClipboardList}
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
              />
            </div>
            {/* Internal number removed per new requirements */}

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-tight flex items-center gap-1.5 mr-1">
                <Landmark size={12} className="text-slate-400" /> من جهة
              </label>
              { (typeof (companies || []) !== 'undefined') && (companies || []).length > 0 ? (
                <select
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 text-sm outline-none focus:border-slate-900 transition-all cursor-pointer"
                  value={formData.sender}
                  onChange={(e) => handleSelectChange('sender', e.target.value)}
                  required
                >
                  <option value="">اختر جهة</option>
                  {(companies || []).map((c: any) => (
                    <option key={c.id} value={c.nameAr || c.name || c.slug || c.id}>{c.nameAr || c.name || c.slug || c.id}</option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  type="text"
                  name="sender"
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all text-slate-900 font-bold text-sm placeholder:text-slate-300 shadow-sm"
                  value={formData.sender}
                  onChange={handleInputChange}
                />
              )}
            </div>
            <FormInput
              label="إلى جهة"
              icon={User}
              name="recipient"
              value={formData.recipient}
              onChange={handleInputChange}
              required
            />
            <FormInput
              label="تاريخ الصادر/الوارد"
              icon={ClipboardList}
              name="documentDate"
              value={formData.documentDate}
              onChange={handleInputChange}
              type="date"
              required
            />
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase mr-1 tracking-widest">
                عدد المرفقات
              </label>
              <input
                type="number"
                min={0}
                name="attachmentCount"
                value={formData.attachmentCount}
                onChange={(e) => handleInputChange(e as any)}
                className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all text-slate-900 font-bold text-sm placeholder:text-slate-300 shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase mr-1 tracking-widest">
                تصنيف السرية
              </label>
              <select
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 text-sm outline-none focus:border-slate-900 transition-all cursor-pointer"
                value={formData.security}
                onChange={(e) => handleSelectChange("security", e.target.value)}
              >
                <option value="عادي">عادي - متاح للجميع</option>
                <option value="سري">سري - محدود الوصول</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase mr-1 tracking-widest">
                أهمية المعاملة
              </label>
              <select
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-slate-900 text-sm outline-none focus:border-slate-900 transition-all cursor-pointer"
                value={formData.priority}
                onChange={(e) => handleSelectChange("priority", e.target.value)}
              >
                <option value="عاديه">معالجة اعتيادية</option>
                <option value="عاجله">معالجة عاجلة</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 uppercase mr-1 tracking-widest">البيان (اختياري)</label>
            <textarea
              name="statement"
              value={formData.statement}
              onChange={(e) => setFormData((prev:any) => ({ ...prev, statement: e.target.value }))}
              placeholder={`البيان والوصف الرسمي:\nتم قيد هذه المعاملة رقميًا وتوثيقها في السجل الموحد للمؤسسة، وتعتبر هذه النسخة أصلية بموجب\nالباركود المرجعي المسجل في أنظمة الحوكمة الرقمية`}
              className="w-full min-h-[120px] p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all text-slate-900 font-bold text-sm"
            />
          </div>

          <div className="p-12 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center hover:bg-slate-100/50 transition-all">
            <div className="mb-4 text-sm font-black text-slate-700">عدد صفحات المرفق: <span className="font-extrabold">{file ? filePageCount || 1 : 0}</span></div>

            {!file ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm">
                  <FileUp size={32} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base font-heading">
                    رفع المستند الأصلي لدمغه بالباركود
                  </h4>
                  <p className="text-[11px] text-slate-400 font-bold uppercase mt-1 tracking-widest">تنسيق PDF فقط</p>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-slate-900 text-white px-10 py-3.5 rounded-xl font-black text-xs hover:bg-black transition-all mt-4"
                >
                  اختيار ملف PDF
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
                <div className="flex items-center gap-4 text-right">
                  <div className="bg-green-100 p-3 rounded-2xl text-green-600">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <div className="font-black text-slate-900 text-sm">{file.name}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase">{(file.size/1024/1024).toFixed(2)} MB</div>
                    {filePreviewUrl && <a href={filePreviewUrl} target="_blank" className="text-xs text-blue-600 underline">عرض المعاينة</a>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setFile(undefined); setFilePreviewUrl(null); }}
                  className="text-red-400 p-3 hover:bg-red-50 hover:text-red-600 rounded-full transition-all"
                >
                  <X size={24} />
                </button>
              </div>
            )}
          </div>

          <AsyncButton
            showOverlay
            onClickAsync={async () => { await handleSubmit() }}
            className="w-full bg-slate-900 text-white py-6 rounded-[1.5rem] font-black text-xl shadow-2xl hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-4 font-heading group"
          >
            توليد الباركود الرقمي الموحد
            <Shield size={24} className="text-blue-500 group-hover:scale-110 transition-transform" />
          </AsyncButton>
        </form>
      </div>
    </div>
  )
}
