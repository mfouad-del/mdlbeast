"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, ShieldCheck, LogIn, Smartphone, Globe, RefreshCw } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

// Translations
const translations = {
  en: {
    title: "MDLBEAST Communications",
    subtitle: "Enterprise Access Hub",
    username: "Username",
    password: "Password",
    usernamePlaceholder: "admin",
    passwordPlaceholder: "••••••••",
    captchaLabel: "Security Verification",
    login: "Secure Login",
    loggingIn: "Securing session...",
    captchaError: "Please complete the security verification",
    loginError: "Invalid username or password",
    securityNote: "Enterprise Encrypted Session",
    havingIssues: "Having issues?",
    downloadApp: "Download Android App",
    copyright: "All rights reserved MDLBEAST Entertainment Company",
    mathCaptcha: "Solve",
  },
  ar: {
    title: "MDLBEAST Communications",
    subtitle: "بوابة الوصول المؤسسي",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    usernamePlaceholder: "admin",
    passwordPlaceholder: "••••••••",
    captchaLabel: "التحقق الأمني",
    login: "دخول آمن للنظام",
    loggingIn: "تأمين الجلسة...",
    captchaError: "يرجى إكمال التحقق الأمني",
    loginError: "خطأ في اسم المستخدم أو كلمة المرور",
    securityNote: "جلسة مشفرة مؤسسية",
    havingIssues: "تواجه مشكلة؟",
    downloadApp: "تحميل تطبيق الأندرويد",
    copyright: "جميع الحقوق محفوظة MDLBEAST Entertainment Company",
    mathCaptcha: "حل",
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
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [lang, setLang] = useState<'en' | 'ar'>('en')
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false)
  const [isClearCacheOpen, setIsClearCacheOpen] = useState(false)
  const recaptchaRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<number | null>(null)
  
  // Fallback math captcha when reCAPTCHA is not configured
  const [mathCaptcha, setMathCaptcha] = useState({ q: "", a: 0 })
  const [mathAnswer, setMathAnswer] = useState("")
  const useGoogleRecaptcha = !!RECAPTCHA_SITE_KEY

  const t = translations[lang]

  const generateMathCaptcha = useCallback(() => {
    const n1 = Math.floor(Math.random() * 10) + 1
    const n2 = Math.floor(Math.random() * 10) + 1
    setMathCaptcha({ q: `${n1} + ${n2}`, a: n1 + n2 })
    setMathAnswer("")
  }, [])

  // Load saved language preference
  useEffect(() => {
    const savedLang = localStorage.getItem("mdlbeast_lang") as 'en' | 'ar'
    if (savedLang) setLang(savedLang)
  }, [])

  // Load reCAPTCHA script
  useEffect(() => {
    if (!useGoogleRecaptcha) {
      generateMathCaptcha()
      return
    }

    // Check if already loaded
    if (window.grecaptcha && window.grecaptcha.render) {
      setRecaptchaLoaded(true)
      return
    }

    // Define callback
    window.onRecaptchaLoad = () => {
      setRecaptchaLoaded(true)
    }

    // Load script
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit`
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    return () => {
      try { 
        document.head.removeChild(script) 
      } catch (_e) {
        // Ignore cleanup errors
      }
    }
  }, [useGoogleRecaptcha, generateMathCaptcha])

  // Render reCAPTCHA widget
  useEffect(() => {
    if (!useGoogleRecaptcha || !recaptchaLoaded || !recaptchaRef.current) return
    if (widgetId.current !== null) return

    try {
      widgetId.current = window.grecaptcha.render(recaptchaRef.current, {
        sitekey: RECAPTCHA_SITE_KEY,
        callback: (token: string) => {
          setRecaptchaToken(token)
          setError("")
        },
        'expired-callback': () => setRecaptchaToken(null),
        theme: 'light',
        size: 'normal',
        hl: lang
      })
    } catch (e) {
      console.error('Failed to render reCAPTCHA:', e)
    }
  }, [recaptchaLoaded, useGoogleRecaptcha, lang])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (useGoogleRecaptcha) {
        if (!recaptchaToken) {
          setError(t.captchaError)
          setIsLoading(false)
          return
        }
      } else {
        if (Number.parseInt(mathAnswer) !== mathCaptcha.a) {
          setError(t.captchaError)
          generateMathCaptcha()
          setIsLoading(false)
          return
        }
      }

      const data = await apiClient.login(username, password, useGoogleRecaptcha ? recaptchaToken || undefined : undefined)
      localStorage.setItem("mdlbeast_session_user", JSON.stringify(data.user))
      localStorage.setItem("mdlbeast_lang", lang)
      if (onLogin) onLogin(data.user)
      router.push("/dashboard")
    } catch (err: any) {
      setError(err.message || t.loginError)
      if (useGoogleRecaptcha && window.grecaptcha && widgetId.current !== null) {
        window.grecaptcha.reset(widgetId.current)
        setRecaptchaToken(null)
      } else {
        generateMathCaptcha()
      }
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
              className="h-12 mx-auto mb-4 object-contain"
              alt="MDLBEAST Logo"
            />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight font-heading">{t.title}</h1>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">{t.subtitle}</p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            {/* Captcha Section */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                  {t.captchaLabel}
                </span>
                {!useGoogleRecaptcha && (
                  <button type="button" onClick={generateMathCaptcha} className="text-slate-300 hover:text-slate-900 transition-colors">
                    <RefreshCw size={14} />
                  </button>
                )}
              </div>
              
              {useGoogleRecaptcha ? (
                <div className="flex justify-center">
                  <div ref={recaptchaRef}></div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white border border-slate-300 py-2.5 text-center rounded-xl font-black text-lg text-slate-900">
                    {t.mathCaptcha}: {mathCaptcha.q} = ?
                  </div>
                  <input
                    required
                    type="number"
                    className="w-20 p-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:border-slate-900 font-black text-center text-slate-900"
                    value={mathAnswer}
                    onChange={(e) => setMathAnswer(e.target.value)}
                  />
                </div>
              )}
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
                <img src="/mdlbeast/dev.png" alt="Developer" className="h-8 opacity-70 hover:opacity-100 transition-all" />
              </div>
            </div>
          </footer>
        </div>
      </div>

      <Dialog open={isClearCacheOpen} onOpenChange={setIsClearCacheOpen}>
        <DialogContent className="max-w-[720px] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-slate-900">
              {lang === 'ar' ? 'إصلاح مشاكل تسجيل الدخول' : 'Fix login issues'}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <iframe
                title="Clear cache"
                src="/mdlbeast/clear-cache.html"
                className="w-full"
                style={{ height: 560 }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
