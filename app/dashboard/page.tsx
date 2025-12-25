"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { LayoutDashboard, FilePlus, FileMinus, Search, Users, LogOut, Scan, FileText, Briefcase, Database } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import AsyncButton from '@/components/ui/async-button'
import type { Correspondence, User, SystemSettings } from "@/types"
import { DocType } from '@/types'
import Dashboard from "@/components/Dashboard"
import DocumentForm from "@/components/DocumentForm"
import DocumentList from "@/components/DocumentList"
import BarcodeScanner from "@/components/BarcodeScanner"
import ReportGenerator from "@/components/ReportGenerator"
import UserManagement from "@/components/UserManagement"
import { Spinner } from "@/components/ui/spinner"

export default function DashboardPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [docs, setDocs] = useState<Correspondence[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStep, setLoadingStep] = useState<string | null>(null)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [loadStartedAt, setLoadStartedAt] = useState<number | null>(null)
  const [newTenant, setNewTenant] = useState({ name: '', slug: '', logo_url: '' })

  const [settings] = useState<SystemSettings>({
    primaryColor: "#0f172a",
    footerText: "نظام الأرشفة الموحد - جميع الحقوق محفوظة © 2025",
    showStamp: true,
    orgName: "زوايا البناء للإستشارات الهندسية",
    orgNameEn: "ZAWAYA ALBINA ENGINEERING",
    logoUrl: "https://www.zaco.sa/logo2.png",
    companies: [],
  })

  // Determine report settings based on selected tenant (show tenant logo/name if set)
  const currentTenant = tenants.find(t => Number(t.id) === Number(selectedTenantId));
  const reportSettings = {
    orgName: currentTenant?.name || (settings.orgName || ''),
    logoUrl: currentTenant?.logo_url || currentTenant?.logoUrl || (settings.logoUrl || '')
  }

  const handleExport = async () => {
    try {
      const [docsData, tenantsData, usersData] = await Promise.all([apiClient.getDocuments(), apiClient.getTenants(), apiClient.getUsers().catch(()=>[])]);
      const payload = { docs: docsData, tenants: tenantsData, users: usersData, generated_at: new Date().toISOString() }
      const blob = new Blob([JSON.stringify(payload,null,2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup-${new Date().toISOString().replace(/:/g,'-')}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (err) { console.error(err); alert('فشل التصدير') }
  }

  const loadData = React.useCallback(async () => {
    setLoadingError(null)
    setLoadStartedAt(Date.now())
    try {
      setIsLoading(true)
      setLoadingStep('جارٍ التحقق من بيانات المستخدم…')
      const user = await apiClient.getCurrentUser()
      if (!user) throw new Error('Unauthorized')
      setCurrentUser(user)

      // Fetch documents/tenants/users in parallel with per-call timeouts
      setLoadingStep('جارٍ تحميل المستندات...')
      const withTimeout = <T,>(p: Promise<T>, ms = 10_000) => {
        return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])
      }

      const docsP = withTimeout(apiClient.getDocuments(), 12_000)
      const tenantsP = withTimeout(apiClient.getTenants(), 10_000)
      const usersP = withTimeout(apiClient.getUsers(), 10_000)

      const [docsRes, tenantsRes, usersRes] = await Promise.allSettled([docsP, tenantsP, usersP])

      if (docsRes.status === 'fulfilled') {
        const documents = docsRes.value
        const mappedDocs = (documents || []).map((doc: any) => {
          const iso = doc.displayDate || doc.date || doc.documentDate || doc.created_at
          let date = ''
          let dateHijri = ''
          let dateGregorian = ''
          if (iso) {
            try {
              const dt = new Date(iso)
              dateHijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt)
              dateGregorian = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(dt)
              date = `${dateHijri} • ${dateGregorian}`
            } catch(e) {
              date = iso ? String(iso) : ''
              dateHijri = date
              dateGregorian = date
            }
          }

          return {
            ...doc,
            id: doc.id,
            barcode: doc.barcode || doc.barcodeId || '' ,
            barcodeId: doc.barcode || doc.barcodeId || '' ,
            title: doc.subject || doc.title || '',
            subject: doc.subject || doc.title || '',
            sender: doc.sender || doc.from || '',
            receiver: doc.receiver || doc.recipient || '',
            recipient: doc.receiver || doc.recipient || '',
            // Prefer server-supplied displayDate (merges date with created_at time when necessary) and show localized date+time
            documentDate: doc.date || doc.documentDate || '',
            date,
            dateHijri,
            dateGregorian,
            type: (String(doc.type || '').toLowerCase().startsWith('in') || String(doc.type) === 'وارد') ? DocType.INCOMING : DocType.OUTGOING,
            companyId: doc.companyId || doc.tenant_id || null,
          }
        })
        setDocs(mappedDocs)
      } else {
        console.warn('Documents load failed or timed out:', docsRes.reason || docsRes)
        setLoadingError('فشل تحميل المستندات أو استغرق وقتاً طويلاً')
      }

      setLoadingStep('جارٍ تحميل المؤسسات والمستخدمين…')
      if (tenantsRes.status === 'fulfilled') setTenants(tenantsRes.value || [])
      else console.warn('Tenants load failed:', tenantsRes.reason)

      if (usersRes.status === 'fulfilled') setUsers((usersRes.value || []).map((us: any) => ({ ...us, email: us.email || us.username || '' })))
      else console.warn('Users load failed:', usersRes.reason)

    } catch (error: any) {
      console.error("Failed to load data:", error)
      setLoadingError(error?.message || 'فشل في تحميل البيانات')
      // if authorization issue, go back to login
      if (String(error?.message || '').toLowerCase().includes('unauthorized')) {
        router.push('/')
        return
      }
    } finally {
      setIsLoading(false)
      setLoadingStep(null)
    }
  }, [router])

  useEffect(() => {
    loadData()
  }, [loadData])

  // When tenant selection changes, re-fetch docs scoped to that tenant
  useEffect(() => {
    const refetch = async () => {
      try {
        const documents = await apiClient.getDocuments(selectedTenantId ? { tenant_id: selectedTenantId } : undefined)
        const mappedDocs = (documents || []).map((doc: any) => {
          const iso = doc.displayDate || doc.date || doc.documentDate || doc.created_at
          let date = ''
          let dateHijri = ''
          let dateGregorian = ''
          if (iso) {
            try {
              const dt = new Date(iso)
              dateHijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt)
              dateGregorian = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(dt)
              date = `${dateHijri} • ${dateGregorian}`
            } catch(e) {
              date = iso ? String(iso) : ''
              dateHijri = date
              dateGregorian = date
            }
          }

          return {
            ...doc,
            id: doc.id,
            barcode: doc.barcode || doc.barcodeId || '' ,
            barcodeId: doc.barcode || doc.barcodeId || '' ,
            title: doc.subject || doc.title || '',
            subject: doc.subject || doc.title || '',
            sender: doc.sender || doc.from || '',
            receiver: doc.receiver || doc.recipient || '',
            recipient: doc.receiver || doc.recipient || '',
            // Prefer server-supplied displayDate (merges date with created_at time when necessary) and show localized date+time
            documentDate: doc.date || doc.documentDate || '',
            date,
            dateHijri,
            dateGregorian,
            type: (String(doc.type || '').toLowerCase().startsWith('in') || String(doc.type) === 'وارد') ? DocType.INCOMING : DocType.OUTGOING,
            companyId: doc.companyId || doc.tenant_id || null,
          }
        })
        setDocs(mappedDocs)
      } catch (e) {
        console.warn('Failed to refetch documents for tenant', e)
      }
    }
    refetch()
  }, [selectedTenantId])

  const handleSaveDoc = async (data: any) => {
    try {
      const docToSave = {
        type: data.type,
        sender: data.sender,
        receiver: data.recipient,
        date: data.date || data.documentDate || new Date().toISOString(),
        subject: data.title,
        priority: data.priority,
        status: data.type === "INCOMING" ? "وارد" : "صادر",
        classification: data.security,
        notes: data.description,
        attachments: data.pdfFile ? [data.pdfFile] : [],
        tenant_id: selectedTenantId,
      }

      const savedDoc = await apiClient.createDocument(docToSave)

      const mappedDoc = {
        ...savedDoc,
        barcodeId: savedDoc.barcode,
        title: savedDoc.subject,
        recipient: savedDoc.receiver,
        documentDate: savedDoc.date,
        companyId: savedDoc.tenant_id || savedDoc.companyId || selectedTenantId,
      }

      setDocs((prev) => [mappedDoc, ...prev])
      setActiveTab("list")
    } catch (error) {
      console.error("Failed to save document:", error)
      alert("فشل في حفظ المستند. الرجاء المحاولة مرة أخرى.")
    }
  }

  const handleLogout = () => {
    apiClient.clearToken()
    localStorage.removeItem("archivx_session_user")
    router.push("/")
  }

  if (isLoading) {
    const elapsed = loadStartedAt ? Math.floor((Date.now() - loadStartedAt) / 1000) : 0
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-md text-center">
          <div className="flex items-center gap-4">
            <Spinner className="h-8 w-8 text-slate-900" />
            <div className="text-slate-900 font-extrabold text-lg">جارٍ تشغيل النظام</div>
          </div>
          <div className="text-slate-500 text-sm">{loadingStep || 'جاري تحميل البيانات...'}{loadingError ? ` — ${loadingError}` : ''}</div>
          <div className="text-slate-400 text-xs">مر على المحاولة {elapsed} ثانية{elapsed !== 1 ? 'ً' : ''}</div>
          {loadingError && (
            <div className="flex gap-3">
              <button onClick={() => { setIsLoading(true); loadData() }} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold">إعادة المحاولة</button>
              <button onClick={() => window.location.reload()} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold">تحديث الصفحة</button>
            </div>
          )}
          {!loadingError && elapsed > 10 && (
            <div className="text-orange-500 text-xs">العملية تستغرق وقتًا أطول من المتوقع. إذا استمرت، جرِّب إعادة المحاولة أو التواصل مع الدعم.</div>
          )}
        </div>
      </div>
    )
  }

  if (!currentUser) return null

  const NavItem = ({ id, label, icon: Icon, adminOnly = false }: any) => {
    if (adminOnly && String(currentUser?.role || '').toLowerCase() !== 'admin') return null
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-sm font-black transition-all ${
          activeTab === id
            ? "bg-slate-900 text-white shadow-xl scale-[1.02]"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <Icon size={18} />
        <span>{label}</span>
      </button>
    )
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans">
      <aside className="w-72 bg-white border-l border-slate-200 flex flex-col shrink-0 z-20 shadow-sm no-print">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50">
          <img src={settings.logoUrl || "/placeholder.svg"} className="h-12 w-auto mb-5 object-contain" alt="Logo" />
          <div className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 leading-relaxed">
            مركز الأرشفة الرقمي الموحد
          </div>           <div className="mt-4 px-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">المؤسسة الحالية</label>
             <select className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs font-black" value={selectedTenantId ?? ''} onChange={(e) => setSelectedTenantId(e.target.value ? Number(e.target.value) : null)}>
               <option value="">جميع المؤسسات</option>
               {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
             </select>
           </div>        </div>

        <nav className="flex-1 px-4 py-8 space-y-1.5 overflow-y-auto">
          <NavItem id="dashboard" label="لوحة التحكم" icon={LayoutDashboard} />
          <div className="h-px bg-slate-100 my-4 mx-4"></div>
          <NavItem id="incoming" label="قيد وارد جديد" icon={FilePlus} />
          <NavItem id="outgoing" label="قيد صادر جديد" icon={FileMinus} />
          <NavItem id="list" label="الأرشيف والبحث" icon={Search} />
          <div className="h-px bg-slate-100 my-4 mx-4"></div>
          <NavItem id="scanner" label="تتبع الباركود" icon={Scan} />
          <NavItem id="reports" label="مركز التقارير" icon={FileText} />
          <NavItem id="users" label="إدارة المستخدمين" icon={Users} adminOnly />
          <NavItem id="companies" label="إدارة المؤسسات" icon={Briefcase} adminOnly />
          <NavItem id="backup" label="النسخ الاحتياطي" icon={Database} adminOnly />
        </nav>

        <div className="p-6 border-t border-slate-100 bg-slate-50/30">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black text-red-600 hover:bg-red-50 transition-all mb-4"
          >
            <LogOut size={16} /> تسجيل الخروج
          </button>
          <div className="p-4 bg-slate-900 rounded-[1.5rem] flex items-center gap-3 text-white shadow-2xl">
            <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center font-black text-sm">
              {(currentUser.full_name || currentUser.name || "U").substring(0, 1)}
            </div>
            <div className="overflow-hidden">
              <div className="text-[11px] font-black truncate leading-tight">
                {currentUser.full_name || currentUser.name}
              </div>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                {String(currentUser.role || '').toLowerCase() === 'admin' ? "مدير نظام" : "محرر"}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-8 lg:p-14 max-w-7xl mx-auto w-full">
          {activeTab === "dashboard" && <Dashboard docs={selectedTenantId ? docs.filter(d => Number(d.companyId) === selectedTenantId) : docs} />}
          {activeTab === "incoming" && <DocumentForm type="INCOMING" onSave={handleSaveDoc} />}
          {activeTab === "outgoing" && <DocumentForm type="OUTGOING" onSave={handleSaveDoc} />}
          {activeTab === "list" && <DocumentList docs={selectedTenantId ? docs.filter(d => Number(d.companyId) === selectedTenantId) : docs} settings={settings} currentUser={currentUser} users={users} />}
          {activeTab === "scanner" && <BarcodeScanner />}
          {activeTab === "reports" && <ReportGenerator docs={selectedTenantId ? docs.filter(d => Number(d.companyId) === Number(selectedTenantId)) : docs} settings={reportSettings} /> }
          {activeTab === "users" && <UserManagement users={users} onUpdateUsers={async () => { const u = await apiClient.getUsers().catch(()=>[]); setUsers(u); }} currentUserEmail={currentUser?.username || ''} />}
          {activeTab === 'companies' && (
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-3xl border border-slate-200">
                <h3 className="text-xl font-black mb-6">إدارة المؤسسات</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <input value={newTenant.name} onChange={e => setNewTenant({...newTenant, name: e.target.value})} placeholder="اسم المؤسسة" className="w-full p-3 border rounded" />
                    <input value={newTenant.logo_url} onChange={e => setNewTenant({...newTenant, logo_url: e.target.value})} placeholder="رابط الشعار" className="w-full p-3 border rounded" />
                    <AsyncButton className="bg-slate-900 text-white px-6 py-3 rounded" onClickAsync={async () => {
                      try {
                        const slug = (newTenant.name || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/--+/g,'-')
                        await apiClient.createTenant({ name: newTenant.name, slug, logo_url: newTenant.logo_url })
                        const t = await apiClient.getTenants(); setTenants(t)
                        setNewTenant({name:'',slug:'',logo_url:''})
                      } catch (err) { console.error(err); alert('فشل الإنشاء') }
                    }}>إنشاء مؤسسة</AsyncButton>
                    <div className="text-xs text-slate-500 mt-2">ملاحظة: <strong>اختر المؤسسة من الأعلى</strong> لتقييد عرض وإنشاء المعاملات لتلك المؤسسة.</div>
                  </div>
                  <div>
                    <div className="space-y-3 max-h-64 overflow-auto">
                      {tenants.map(t => (
                        <div key={t.id} className="p-3 border rounded flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img src={t.logo_url} className="w-10 h-10 object-contain" />
                            <div>
                              <div className="font-black">{t.name}</div>
                              <div className="text-xs text-slate-400">{t.slug}</div>
                            </div>
                          </div>
                          <div>
                            <AsyncButton className="text-red-500" variant="ghost" size="sm" onClickAsync={async () => { if (!confirm('حذف؟')) return; await apiClient.deleteTenant(t.id); setTenants(await apiClient.getTenants()); }}>حذف</AsyncButton>
                          </div>
                        </div>
                      ))}
                      {tenants.length === 0 && <div className="p-3 text-slate-400">لا توجد مؤسسات مسجلة</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-slate-200">
                <h3 className="text-xl font-black mb-4">تصدير البيانات</h3>
                <p className="text-sm text-slate-500 mb-4">يمكنك تنزيل نسخة JSON من البيانات الحالية (المستندات، المؤسسات، المستخدمين).</p>
                <div className="flex gap-3">
                  <div className="flex gap-3">
                  <AsyncButton className="bg-slate-900 text-white px-6 py-3 rounded" onClickAsync={handleExport}>تحميل JSON</AsyncButton>

                  <input type="file" id="importBackupFile" className="hidden" accept=".json" onChange={async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (!file) return
                    if (!confirm('تحذير: ستستبدل البيانات المحلية الحالية. تابع؟')) return
                    try {
                      const text = await file.text()
                      const svc = await import('@/services/api')
                      const ok = await svc.ApiService.importFullBackup(text)
                      if (ok) { alert('تم الاستعادة محلياً. سيتم إعادة تحميل الصفحة'); window.location.reload() }
                      else alert('فشل الاستعادة')
                    } catch (err) { console.error(err); alert('فشل الاستعادة') }
                  }} />
                  <button className="bg-blue-600 text-white px-6 py-3 rounded" onClick={async () => {
                    const el = document.getElementById('importBackupFile') as HTMLInputElement | null
                    el?.click()
                  }}>استعادة من ملف</button>
                </div>
                </div>
              </div>
            </div>
          )}        </div>
      </main>
    </div>
  )
}
