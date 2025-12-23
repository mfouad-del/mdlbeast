"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { LayoutDashboard, FilePlus, FileMinus, Search, Users, LogOut } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import type { Correspondence, User, SystemSettings } from "@/types"
import Dashboard from "@/components/Dashboard"
import DocumentForm from "@/components/DocumentForm"
import DocumentList from "@/components/DocumentList"

export default function DashboardPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [docs, setDocs] = useState<Correspondence[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [settings] = useState<SystemSettings>({
    primaryColor: "#0f172a",
    footerText: "نظام الأرشفة الموحد - جميع الحقوق محفوظة © 2025",
    showStamp: true,
    orgName: "زوايا البناء للإستشارات الهندسية",
    orgNameEn: "ZAWAYA ALBINA ENGINEERING",
    logoUrl: "https://www.zaco.sa/logo2.png",
    companies: [],
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        const user = await apiClient.getCurrentUser()
        setCurrentUser(user)

        const documents = await apiClient.getDocuments()
        const mappedDocs = documents.map((doc: any) => ({
          ...doc,
          barcodeId: doc.barcode,
          title: doc.subject,
          recipient: doc.receiver,
          documentDate: doc.date,
        }))
        setDocs(mappedDocs)
      } catch (error) {
        console.error("Failed to load data:", error)
        router.push("/")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [router])

  const handleSaveDoc = async (data: any) => {
    try {
      const docToSave = {
        barcode: data.barcodeId,
        type: data.type,
        sender: data.sender,
        receiver: data.recipient,
        date: data.documentDate || new Date().toISOString().split("T")[0],
        subject: data.title,
        priority: data.priority,
        status: data.type === "INCOMING" ? "وارد" : "صادر",
        classification: data.security,
        notes: data.description,
        attachments: data.pdfFile ? [data.pdfFile] : [],
      }

      const savedDoc = await apiClient.createDocument(docToSave)

      const mappedDoc = {
        ...savedDoc,
        barcodeId: savedDoc.barcode,
        title: savedDoc.subject,
        recipient: savedDoc.receiver,
        documentDate: savedDoc.date,
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-slate-900 font-black text-xl">جاري تحميل البيانات...</div>
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
          </div>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-1.5 overflow-y-auto">
          <NavItem id="dashboard" label="لوحة التحكم" icon={LayoutDashboard} />
          <div className="h-px bg-slate-100 my-4 mx-4"></div>
          <NavItem id="incoming" label="قيد وارد جديد" icon={FilePlus} />
          <NavItem id="outgoing" label="قيد صادر جديد" icon={FileMinus} />
          <NavItem id="list" label="الأرشيف والبحث" icon={Search} />
          <div className="h-px bg-slate-100 my-4 mx-4"></div>
          <NavItem id="users" label="إدارة المستخدمين" icon={Users} adminOnly />
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
          {activeTab === "dashboard" && <Dashboard docs={docs} />}
          {activeTab === "incoming" && <DocumentForm type="INCOMING" onSave={handleSaveDoc} />}
          {activeTab === "outgoing" && <DocumentForm type="OUTGOING" onSave={handleSaveDoc} />}
          {activeTab === "list" && <DocumentList docs={docs} settings={settings} />}
        </div>
      </main>
    </div>
  )
}
