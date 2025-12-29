"use client"
import React, { useEffect, useState } from 'react'

export default function UpdateBanner() {
  const [payload, setPayload] = useState<any | null>(() => {
    try { const s = localStorage.getItem('app_update_available'); return s ? JSON.parse(s) : null } catch(e){ return null }
  })

  useEffect(() => {
    const onUpdate = () => {
      try { const s = localStorage.getItem('app_update_available'); setPayload(s ? JSON.parse(s) : null) } catch (e) { setPayload(null) }
    }
    window.addEventListener('app-update-available', onUpdate)
    // also listen to storage events (other tabs may set localStorage)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'app_update_available') onUpdate()
    }
    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener('app-update-available', onUpdate); window.removeEventListener('storage', onStorage) }
  }, [])

  if (!payload) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(980px,calc(100%-24px))] px-6 py-3 rounded-2xl bg-amber-50 border border-amber-200 shadow-lg flex items-center justify-between gap-4">
      <div>
        <div className="font-black">تحديث جديد متاح</div>
        <div className="text-xs text-slate-600">نسخة: {payload.version || 'غير معروف'}</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => { try { localStorage.removeItem('app_update_available') } catch (e){}; window.location.reload() }} className="px-4 py-2 bg-slate-900 text-white rounded font-black">إعادة التحميل</button>
        <button onClick={() => { try { localStorage.removeItem('app_update_available'); setPayload(null) } catch(e){} }} className="px-3 py-2 rounded border">تجاهل</button>
      </div>
    </div>
  )
}
