"use client"
import React, { useEffect, useRef, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

export default function AppVersionWatcher() {
  const { toast } = useToast()
  const [version, setVersion] = useState<any>(null)
  const polling = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true
    async function fetchVersion() {
      try {
        const v = await apiClient.getAppVersion()
        if (!mounted) return
        if (!version) {
          setVersion(v)
        } else if (version && v && (v.version !== version.version || v.commit !== version.commit)) {
          // New version detected — safe behavior: simple toast + broadcast event for a persistent banner
          try {
            toast({ title: 'تحديث جديد متاح', description: 'هناك نسخة جديدة من التطبيق. يرجى إعادة التحميل.' })
          } catch (e) {
            // toast might fail in some environments; fallback to alert
            console.warn('AppVersionWatcher: toast failed', e)
            try { alert('تحديث جديد متاح — أعد تحميل الصفحة') } catch (e2) { /* ignore */ }
          }

          // Broadcast update event and set a local flag so that a persistent banner can show across tabs
          try {
            const payload = v || { version: 'unknown' }
            try { localStorage.setItem('app_update_available', JSON.stringify(payload)) } catch (e) {}
            try { window.dispatchEvent(new Event('app-update-available')) } catch (e) {}
          } catch (e) { console.warn('AppVersionWatcher: broadcast failed', e) }
          // Optional: auto reload after short delay
          // setTimeout(() => window.location.reload(true), 5000)
        }
      } catch (err) {
        // ignore
      }
    }

    fetchVersion()
    polling.current = window.setInterval(fetchVersion, 60_000)
    return () => {
      mounted = false
      if (polling.current) window.clearInterval(polling.current)
    }
  }, [version, toast])

  return null
}
