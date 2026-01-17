"use client"
import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Register service worker with the correct scope and path
      navigator.serviceWorker
        .register('/mdlbeast/sw.js', { scope: '/mdlbeast/' })
        .then((registration) => {
          console.log('[SW] Service Worker registered with scope:', registration.scope)
        })
        .catch((error) => {
          console.error('[SW] Service Worker registration failed:', error)
        })
    }
  }, [])

  return null
}
