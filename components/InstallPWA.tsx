"use client"

import { useState, useEffect } from 'react'
import { Download, X, Monitor, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowInstallBanner(true)
    }

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowInstallBanner(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    // Show the install prompt
    deferredPrompt.prompt()

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      console.log('User accepted the install prompt')
    } else {
      console.log('User dismissed the install prompt')
    }

    // Clear the deferred prompt
    setDeferredPrompt(null)
    setShowInstallBanner(false)
  }

  const handleDismiss = () => {
    setShowInstallBanner(false)
    // Store in localStorage to not show again for 7 days
    localStorage.setItem('pwa_install_dismissed', Date.now().toString())
  }

  // Check if user dismissed recently
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa_install_dismissed')
    if (dismissed) {
      const dismissedTime = parseInt(dismissed)
      const sevenDays = 7 * 24 * 60 * 60 * 1000
      if (Date.now() - dismissedTime < sevenDays) {
        setShowInstallBanner(false)
      }
    }
  }, [])

  if (isInstalled || !showInstallBanner) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in slide-in-from-bottom-4 duration-500">
      <button
        onClick={handleDismiss}
        className="absolute top-2 left-2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <X size={18} />
      </button>

      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center flex-shrink-0">
          <img src="/mdlbeast/logo.png" alt="MDLBEAST" className="w-8 h-8 object-contain" />
        </div>

        <div className="flex-1">
          <h3 className="font-black text-slate-900 text-sm mb-1">تثبيت MDLBEAST</h3>
          <p className="text-xs text-slate-500 mb-3">
            ثبّت التطبيق على جهازك للوصول السريع والعمل بدون اتصال
          </p>

          <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-3">
            <Monitor size={12} />
            <span>Windows / Mac</span>
            <span className="mx-1">•</span>
            <Smartphone size={12} />
            <span>Mobile</span>
          </div>

          <button
            onClick={handleInstallClick}
            className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Download size={16} />
            تثبيت التطبيق
          </button>
        </div>
      </div>
    </div>
  )
}
