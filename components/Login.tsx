"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, ShieldCheck, RefreshCw, LogIn, Smartphone } from "lucide-react"
import { apiClient } from "@/lib/api-client"

export default function Login({ onLogin, logoUrl }: { onLogin?: (u: any) => void; logoUrl?: string }) {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [captcha, setCaptcha] = useState({ q: "", a: 0 })
  const [userAnswer, setUserAnswer] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 10) + 1
    const n2 = Math.floor(Math.random() * 10) + 1
    setCaptcha({ q: `${n1} + ${n2}`, a: n1 + n2 })
    setUserAnswer("")
  }

  useEffect(() => {
    generateCaptcha()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (Number.parseInt(userAnswer) !== captcha.a) {
        setError("حل الكابتشا غير صحيح")
        generateCaptcha()
        setIsLoading(false)
        return
      }

      const data = await apiClient.login(username, password)
      localStorage.setItem("archivx_session_user", JSON.stringify(data.user))
      if (onLogin) onLogin(data.user)
      router.push("/dashboard")
    } catch (err: any) {
      setError(err.message || "خطأ في اسم المستخدم أو كلمة المرور")
      generateCaptcha()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-slate-200 p-7 lg:p-9 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-full h-2 bg-slate-900"></div>

          <header className="text-center mb-6">
            <img
              src={logoUrl || '/mdlbeast/logo.png'}
              className="h-12 mx-auto mb-4 object-contain"
              alt="MDLBEAST Logo"
            />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight font-heading">MDLBEAST Communications</h1>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Enterprise Access Hub</p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase mr-1">اسم المستخدم</label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  required
                  type="text"
                  className="w-full pr-12 pl-4 py-3.5 bg-white border border-slate-300 rounded-2xl outline-none focus:border-slate-900 font-bold transition-all text-slate-900 text-sm"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase mr-1">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  required
                  type="password"
                  className="w-full pr-12 pl-4 py-3.5 bg-white border border-slate-300 rounded-2xl outline-none focus:border-slate-900 font-bold transition-all text-slate-900 text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                  تحقق بشري (Captcha)
                </span>
                <button
                  type="button"
                  onClick={generateCaptcha}
                  className="text-slate-300 hover:text-slate-900 transition-colors"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white border border-slate-300 py-2.5 text-center rounded-xl font-black text-lg text-slate-900">
                  {captcha.q}
                </div>
                <input
                  required
                  type="number"
                  className="w-20 p-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-slate-900 font-black text-center text-slate-900"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold text-center border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-black transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 font-heading"
            >
              {isLoading ? (
                "تأمين الجلسة..."
              ) : (
                <>
                  <LogIn size={20} /> دخول آمن للنظام
                </>
              )}
            </button>
          </form>

          <footer className="mt-6 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-300 mb-4">
              <ShieldCheck size={14} />
              <span className="text-[9px] font-bold uppercase tracking-widest">Enterprise Encrypted Session</span>
            </div>

            <div className="space-y-4 flex flex-col items-center">
              <a 
                href="https://zaco.sa/mdlbeast/clear-cache.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-black hover:bg-amber-200 transition-colors shadow-sm"
              >
                تواجه مشكلة؟
              </a>

              <a 
                href="https://zaco.sa/mdlbeast/app.apk"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-[10px] font-bold hover:bg-green-100 transition-colors"
              >
                <Smartphone size={14} />
                تحميل تطبيق الأندرويد
              </a>
              
              <p className="text-[10px] font-bold text-slate-400">
                جميع الحقوق محفوظه MDLBEAST Entertainment Company
              </p>
              
              <div className="pt-4 flex justify-center">
                <img 
                  src="/mdlbeast/dev.png" 
                  alt="Developer" 
                  className="h-14 opacity-90 hover:opacity-100 transition-all"
                />
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
