import React, { useEffect, useState } from 'react'
import AsyncButton from './ui/async-button'
import { apiClient } from '@/lib/api-client'

export default function AdminBackups() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await apiClient.listBackups()
      setItems(data.items || data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-3xl border border-slate-200">
        <h3 className="text-xl font-black mb-4">نسخ النظام الاحتياطية</h3>
        <p className="text-sm text-slate-500 mb-4">انشاء نسخة كاملة للقاعدة والملفات والإعدادات.</p>
        <div className="flex gap-3 mb-6">
          <AsyncButton className="bg-slate-900 text-white px-6 py-3 rounded" onClickAsync={async () => { await apiClient.createBackup(); await load() }}>انشاء نسخة احتياطية الآن</AsyncButton>
        </div>
        <div className="space-y-3">
          {items.length === 0 && <div className="text-slate-400">لا توجد نسخ احتياطية</div>}
          {items.map(i => (
            <div key={i.key} className="p-3 border rounded flex items-center justify-between">
              <div>
                <div className="text-sm font-black">{i.key}</div>
                <div className="text-xs text-slate-400">{i.lastModified ? new Date(i.lastModified).toLocaleString() : ''} • {i.size} bytes</div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={async () => {
                  try {
                    const r = await apiClient.downloadBackupUrl(i.key)
                    window.open(r.url || r.previewUrl || r.signedUrl, '_blank')
                  } catch (e) { alert('Download failed') }
                }}>تحميل</button>
                <button className="px-3 py-2 bg-red-500 text-white rounded" onClick={async () => {
                  if (!confirm('هل أنت متأكد أنك تريد حذف النسخة؟')) return
                  await apiClient.deleteBackup(i.key)
                  await load()
                }}>حذف</button>
                <button className="px-3 py-2 bg-amber-600 text-white rounded" onClick={async () => {
                  if (!confirm('استعادة النسخة ستستبدل قاعدة البيانات والملفات. موافق؟')) return
                  if (!confirm('تأكيد نهائي: استعادة النسخة الآن؟')) return
                  try {
                    await apiClient.restoreBackup(i.key)
                    alert('تمت الاستعادة بنجاح')
                  } catch (e) { alert('استعادة فشلت') }
                }}>استعادة</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
