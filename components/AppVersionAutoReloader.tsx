"use client"
import { useEffect, useRef } from 'react'
import { apiClient } from '@/lib/api-client'

export default function AppVersionAutoReloader() {
  const versionRef = useRef<any | null>(null)

  useEffect(() => {
    let mounted = true

    async function check() {
      try {
        const v = await apiClient.getAppVersion()
        if (!mounted) return
        if (!versionRef.current) {
          versionRef.current = v
          return
        }

        if (v && (v.version !== versionRef.current.version || v.commit !== versionRef.current.commit)) {
          // New version detected — force a reload and bypass caches by adding a unique query param
          try {
            const url = new URL(window.location.href)
            url.searchParams.set('_t', String(Date.now()))
            // Use replace so we don't create a navigation entry
            window.location.replace(url.toString())
          } catch (e) {
            // Fallback to a normal reload
            try { window.location.reload() } catch (e2) { /* ignore */ }
          }
        }
      } catch (e) {
        // ignore network errors
      }
    }

    // Run immediately and then poll periodically
    check()
    const id = window.setInterval(check, 60_000)

    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  return null
}
