"use client"
import React, { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { Spinner } from './ui/spinner'

interface AdminStatusData {
  healthy?: boolean
  version?: string
  at?: string
  logs?: Array<{ ts: string; level: string; message: string }>
  [key: string]: unknown
}

export default function AdminStatus() {
  const [status, setStatus] = useState<AdminStatusData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const s = await apiClient.getAdminStatus()
      setStatus(s)
    } catch (e) {
      console.error('Failed to load admin status', e)
      setStatus(null)
    }
    setLoading(false)
  }

  const clearLogs = async () => {
    if (!confirm('هل تريد مسح السجلات الأخيرة؟')) return
    try {
      await apiClient.clearAdminLogs()
      await load()
      alert('تم مسح السجلات')
    } catch (e: any) {
      alert('فشل مسح السجلات: ' + (e?.message || e))
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-start justify-between gap-6">
        <div>
          <h3 className="text-xl font-black mb-1">حالة النظام</h3>
          <p className="text-sm text-slate-500 mb-2">نظرة عامة على صحة النظام والسجلات الأخيرة.</p>
          <div className="flex gap-6 items-center">
            <div className={`w-3 h-3 rounded-full ${status && status.healthy ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <div className="text-sm font-black">{status ? (status.healthy ? 'صحي وآمن' : 'تحذير: تحقق من النظام') : (loading ? 'جارٍ التحميل...' : 'غير متاح')}</div>
            <div className="text-xs text-slate-400">نسخة: {status?.version || '—'}</div>
          </div>
        </div>

        <div className="ml-auto flex gap-3">
          <button onClick={load} className="px-4 py-2 rounded bg-white border">تحديث</button>
          <button onClick={clearLogs} className="px-4 py-2 rounded bg-red-50 text-red-600">مسح السجلات</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-black">سجل النظام (آخر السجلات)</div>
          <div className="text-xs text-slate-400">{status?.at ? new Date(status.at).toLocaleString() : ''}</div>
        </div>
        <div className="h-80 overflow-auto bg-slate-50 p-3 rounded">
          {loading && <div className="flex items-center justify-center"><Spinner/></div>}
          {!loading && status && status.logs && status.logs.length > 0 ? (
            status.logs.map((l:any, idx:number) => (
              <div key={idx} className={`text-[12px] ${l.level === 'error' ? 'text-red-600' : l.level === 'warn' ? 'text-amber-700' : 'text-slate-700'}`}>
                <div className="text-[10px] text-slate-400">{new Date(l.ts).toLocaleString()}</div>
                <div className="font-mono break-words">{l.msg}</div>
                <hr className="my-1" />
              </div>
            ))
          ) : (
            !loading && <div className="text-slate-400">لا توجد سجلات</div>
          )}
        </div>
      </div>
    </div>
  )
}
