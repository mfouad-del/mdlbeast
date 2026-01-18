"use client"

import { useI18n } from '@/lib/i18n-context'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Check, Trash2, RefreshCcw, MailOpen, AlertCircle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import AsyncButton from './ui/async-button'

type NotificationItem = {
  id: number
  title: string
  message?: string
  type?: string
  entity_type?: string
  entity_id?: string
  link?: string
  is_read?: boolean
  read_at?: string
  priority?: string
  created_at?: string
}

export default function NotificationCenter() {
  const { t, locale } = useI18n()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unreadOnly, setUnreadOnly] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiClient.getNotifications({ limit: 100, offset: 0, unreadOnly })
      setItems((res as any)?.data || [])
    } catch (e: any) {
      setError(String(e?.message || e || t('notifications.error_load')))
    } finally {
      setLoading(false)
    }
  }, [unreadOnly, t])

  useEffect(() => {
    load()
  }, [load])

  const unreadCount = useMemo(() => items.filter(i => !i.is_read).length, [items])

  const onMarkRead = async (id: number) => {
    await apiClient.markNotificationRead(id)
    setItems(prev => prev.map(n => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)))
  }

  const onDelete = async (id: number) => {
    await apiClient.deleteNotification(id)
    setItems(prev => prev.filter(n => n.id !== id))
  }

  const onReadAll = async () => {
    await apiClient.markAllNotificationsRead()
    setItems(prev => prev.map(n => ({ ...n, is_read: true, read_at: n.read_at || new Date().toISOString() })))
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <Bell size={18} />
            </div>
            <div>
              <div className="text-lg font-black text-slate-900">{t('notifications.center')}</div>
              <div className="text-xs text-slate-500 font-bold">{t('notifications.unread')}{unreadCount}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-2 rounded-xl text-xs font-black border transition-all ${unreadOnly ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              onClick={() => setUnreadOnly(v => !v)}
            >
              {unreadOnly ? t('notifications.view_all') : t('notifications.unread_only')}
            </button>

            <AsyncButton onClickAsync={onReadAll} className="px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700">
              <MailOpen size={14} className="ml-2" />
              {t('notifications.markAllRead')}
            </AsyncButton>

            <AsyncButton onClickAsync={load} className="px-3 py-2 rounded-xl text-xs font-black bg-slate-100 text-slate-800 hover:bg-slate-200">
              <RefreshCcw size={14} className="ml-2" />
              {t('notifications.refresh')}
            </AsyncButton>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-2xl bg-red-50 text-red-700 font-bold text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-slate-600 font-bold">{t('notifications.loading')}</div>
        ) : items.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm text-center">
            <div className="text-slate-900 font-black">{t('notifications.no_notifications')}</div>
            <div className="text-slate-500 text-sm mt-1">{t('notifications.no_notifications_desc')}</div>
          </div>
        ) : (
          items.map((n) => (
            <div key={n.id} className={`bg-white p-5 rounded-3xl border shadow-sm flex items-start justify-between gap-4 ${n.is_read ? 'border-slate-200' : 'border-blue-200 ring-4 ring-blue-100/50'}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-black text-slate-900">{n.title}</div>
                  {!n.is_read && <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full">{t('notifications.new_badge')}</span>}
                </div>
                {n.message && <div className="text-sm text-slate-600 mt-1 leading-relaxed">{n.message}</div>}
                <div className="text-[11px] text-slate-400 font-bold mt-2">
                  {n.created_at ? new Date(n.created_at).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US') : ''}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!n.is_read && (
                  <AsyncButton
                    onClickAsync={async () => onMarkRead(n.id)}
                    className="px-3 py-2 rounded-xl text-xs font-black bg-slate-900 text-white hover:bg-black"
                  >
                    <Check size={14} className="ml-2" />
                    {t('notifications.mark_read_action')}
                  </AsyncButton>
                )}

                <AsyncButton
                  onClickAsync={async () => onDelete(n.id)}
                  className="px-3 py-2 rounded-xl text-xs font-black bg-red-50 text-red-700 hover:bg-red-100"
                >
                  <Trash2 size={14} className="ml-2" />
                  {t('notifications.delete')}
                </AsyncButton>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
