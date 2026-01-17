"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, ShieldCheck, LogIn, Smartphone, Globe } from "lucide-react"
import { apiClient, API_BASE_URL } from "@/lib/api-client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

// Translations
const translations = {
  en: {
    title: "MDLBEAST ERP SYSTEM",
    subtitle: "Enterprise Access Hub",
    username: "Username",
    password: "Password",
    usernamePlaceholder: "admin",
    passwordPlaceholder: "••••••••",
    login: "Secure Login",
    loggingIn: "Securing session...",
    captchaError: "Security verification failed. Please try again.",
    loginError: "Invalid username or password",
    securityNote: "Enterprise Encrypted Session",
    havingIssues: "Having issues?",
    downloadApp: "Download Android App",
    copyright: "All rights reserved MDLBEAST Entertainment Company",
    protectedBy: "Protected by reCAPTCHA",
  },
  ar: {
    title: "MDLBEAST ERP SYSTEM",
    subtitle: "بوابة الوصول المؤسسي",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    usernamePlaceholder: "admin",
    passwordPlaceholder: "••••••••",
    login: "دخول آمن للنظام",
    loggingIn: "تأمين الجلسة...",
    captchaError: "فشل التحقق الأمني. يرجى المحاولة مرة أخرى.",
    loginError: "خطأ في اسم المستخدم أو كلمة المرور",
    securityNote: "جلسة مشفرة مؤسسية",
    havingIssues: "تواجه مشكلة؟",
    downloadApp: "تحميل تطبيق الأندرويد",
    copyright: "جميع الحقوق محفوظة MDLBEAST Entertainment Company",
    protectedBy: "محمي بواسطة reCAPTCHA",
  }
}

// reCAPTCHA site key - set via environment variable
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""

declare global {
  interface Window {
    grecaptcha: any
    onRecaptchaLoad: () => void
  }
}

export default function Login({ onLogin, logoUrl }: { onLogin?: (u: any) => void; logoUrl?: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [lang, setLang] = useState<'en' | 'ar'>('en')
  const [recaptchaReady, setRecaptchaReady] = useState(false)
  const [isClearCacheOpen, setIsClearCacheOpen] = useState(false)
  const [showDeploymentNotice, setShowDeploymentNotice] = useState(false)

  const t = translations[lang]

  useEffect(() => {
    const savedLang = localStorage.getItem("mdlbeast_lang") as 'en' | 'ar'
    if (savedLang) setLang(savedLang)
    
    // Check if this is a fresh login after deployment (no token but had session)
    const hadSession = localStorage.getItem('mdlbeast_session_user')
    const hasToken = localStorage.getItem('auth_token')
    if (hadSession && !hasToken) {
      setShowDeploymentNotice(true)
      // Don't auto-hide - user needs to read it
    } else if (!hadSession && !hasToken) {
      // Clear any stale data
      localStorage.clear()
    }
  }, [])

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) return
    if (window.grecaptcha && window.grecaptcha.execute) {
      setRecaptchaReady(true)
      return
    }
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`
    script.async = true
    script.onload = () => {
      window.grecaptcha.ready(() => setRecaptchaReady(true))
    }
    document.head.appendChild(script)
    return () => { try { document.head.removeChild(script) } catch (e) { void e } }
  }, [])

  const getRecaptchaToken = async (): Promise<string | null> => {
    if (!RECAPTCHA_SITE_KEY || !recaptchaReady) return null
    try {
      return await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'login' })
    } catch (e) {
      console.error('reCAPTCHA execute failed:', e)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      let recaptchaToken: string | undefined
      if (RECAPTCHA_SITE_KEY) {
        const token = await getRecaptchaToken()
        if (!token) {
          setError(t.captchaError)
          setIsLoading(false)
          return
        }
        recaptchaToken = token
      }

      const data = await apiClient.login(username, password, recaptchaToken)
      localStorage.setItem("mdlbeast_session_user", JSON.stringify(data.user))
      localStorage.setItem("mdlbeast_lang", lang)
      if (onLogin) onLogin(data.user)
      router.push("/dashboard")
    } catch (err: any) {
      setError(err.message || t.loginError)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleLanguage = () => {
    const newLang = lang === 'en' ? 'ar' : 'en'
    setLang(newLang)
    localStorage.setItem("mdlbeast_lang", newLang)
  }

  useEffect(() => {
    if (!isClearCacheOpen) return

    const onMessage = (event: MessageEvent) => {
      // The iframe is same-origin, but keep a cheap origin check anyway.
      if (typeof window !== 'undefined' && event.origin !== window.location.origin) return
      const data: any = event.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'mdlbeast:clear-cache:done') {
        setIsClearCacheOpen(false)
        toast({
          title: lang === 'ar' ? 'تم تنظيف الكاش' : 'Cache cleared',
          description: lang === 'ar' ? 'جرّب تسجيل الدخول مرة أخرى.' : 'Please try logging in again.',
        })
      }

      if (data.type === 'mdlbeast:clear-cache:close') {
        setIsClearCacheOpen(false)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isClearCacheOpen, toast, lang])

  return (
    <div className={`h-screen overflow-hidden bg-slate-50 flex items-center justify-center p-4 font-sans`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-slate-200 p-7 lg:p-9 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-full h-2 bg-slate-900"></div>

          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-xs font-bold text-slate-600 transition-colors z-10"
          >
            <Globe size={14} />
            {lang === 'en' ? 'العربية' : 'English'}
          </button>

          <header className="text-center mb-6 mt-4">
            <img
              src={logoUrl || '/mdlbeast/logo.png'}
              className="h-16 mx-auto mb-4 object-contain"
              alt="MDLBEAST Logo"
            />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight font-heading">{t.title}</h1>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">{t.subtitle}</p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4">
            {showDeploymentNotice && (
              <div className="bg-blue-50 border-2 border-blue-300 text-blue-900 p-4 rounded-xl text-sm font-bold text-center mb-4 animate-pulse">
                <ShieldCheck size={20} className="inline ml-2" />
                <div className="mt-2">
                  {lang === 'ar' 
                    ? '🔄 تم تحديث النظام إلى إصدار جديد\nبياناتك محفوظة - يرجى تسجيل الدخول مرة أخرى' 
                    : '🔄 System updated to new version\nYour data is safe - Please login again'}
                </div>
                <button 
                  type="button"
                  onClick={() => setShowDeploymentNotice(false)}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  {lang === 'ar' ? 'فهمت' : 'Got it'}
                </button>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t.username}</label>
              <div className="relative">
                <Mail className={`absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-300`} size={16} />
                <input
                  required
                  type="text"
                  className={`w-full ${lang === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-white border border-slate-300 rounded-2xl outline-none focus:border-slate-900 font-bold transition-all text-slate-900 text-sm`}
                  placeholder={t.usernamePlaceholder}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">{t.password}</label>
              <div className="relative">
                <Lock className={`absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-300`} size={16} />
                <input
                  required
                  type="password"
                  className={`w-full ${lang === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 bg-white border border-slate-300 rounded-2xl outline-none focus:border-slate-900 font-bold transition-all text-slate-900 text-sm`}
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              {isLoading ? t.loggingIn : (<><LogIn size={20} /> {t.login}</>)}
            </button>

            {RECAPTCHA_SITE_KEY && (
              <p className="text-[9px] text-slate-400 text-center mt-2">
                <ShieldCheck size={10} className="inline mr-1" />
                {t.protectedBy}
              </p>
            )}
          </form>

          <footer className="mt-6 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-300 mb-4">
              <ShieldCheck size={14} />
              <span className="text-[9px] font-bold uppercase tracking-widest">{t.securityNote}</span>
            </div>

            <div className="space-y-4 flex flex-col items-center">
              <button
                type="button"
                data-clear-cache-trigger
                onClick={() => setIsClearCacheOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-black hover:bg-amber-200 transition-colors shadow-sm">
                {t.havingIssues}
              </button>

              <a href="/mdlbeast/app.apk"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-[10px] font-bold hover:bg-green-100 transition-colors">
                <Smartphone size={14} />
                {t.downloadApp}
              </a>
              
              <p className="text-[10px] font-bold text-slate-400">{t.copyright}</p>
              
              <div className="pt-4 flex justify-center">
                <img src="/mdlbeast/dev.png" alt="Developer" className="h-12 opacity-70 hover:opacity-100 transition-all" />
              </div>
            </div>
          </footer>
        </div>
      </div>

      <Dialog open={isClearCacheOpen} onOpenChange={setIsClearCacheOpen}>
        <DialogContent className="max-w-[720px] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-slate-900">
              Fix login issues
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-sm">
              Clear saved session data to fix login issues
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <iframe
                title="Clear cache"
                src="/mdlbeast/clear-cache.html"
                className="w-full"
                style={{ height: 'min(560px, 72vh)' }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
