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
        <div className="flex flex-wrap gap-3 mb-6">
          {/* Full comprehensive backup (DB + uploads + settings) */}
          <AsyncButton className="bg-slate-900 text-white px-6 py-3 rounded" onClickAsync={async () => {
            if (!confirm('سيتم إنشاء نسخة شاملة للقاعدة والملفات والإعدادات. موافق؟')) return
            try {
              const res = await apiClient.createBackup()
              await load()
              if (res && res.key) {
                alert('تم إنشاء النسخة الشاملة بنجاح. المفتاح: ' + res.key)
              } else {
                alert('تم إنشاء النسخة الشاملة')
              }
            } catch (e) {
              alert('فشل إنشاء النسخة الشاملة')
            }
          }}>إنشاء نسخة احتياطية شاملة</AsyncButton>

          {/* JSON backup (metadata + uploads list) */}
          <AsyncButton className="bg-slate-700 text-white px-6 py-3 rounded" onClickAsync={async () => {
            try {
              const blob = await apiClient.downloadJsonBackupBlob()
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `backup-json-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
              document.body.appendChild(a)
              a.click()
              a.remove()
              URL.revokeObjectURL(url)
            } catch (e) { alert('فشل تحميل JSON') }
          }}>تحميل JSON</AsyncButton>

          <label className="px-4 py-3 bg-slate-100 border rounded cursor-pointer">
            <span className="text-sm">استعادة JSON</span>
            <input type="file" accept="application/json" onChange={async (e) => {
              const f = (e.target as HTMLInputElement).files?.[0]
              if (!f) return
              if (!confirm('استعادة JSON ستقوم بعمل إدخالات/تحديثات في قاعدة البيانات. موافق؟')) return
              try { await apiClient.restoreJsonBackup(f); alert('تمت الاستعادة (تحقق من السجلات)'); await load() } catch (err) { alert('فشل الاستعادة') }
            }} style={{ display: 'none' }} />
          </label>

          <label className="px-4 py-3 bg-red-100 border rounded cursor-pointer">
            <span className="text-sm">استعادة شاملة من ملف (tar.gz / .gpg / .enc)</span>
            <input type="file" accept=".tar,.tar.gz,.tgz,.gpg,.enc" onChange={async (e) => {
              const f = (e.target as HTMLInputElement).files?.[0]
              if (!f) return
              if (!confirm('استعادة ملف شاملة ستستبدل قاعدة البيانات والملفات. هذا إجراء مدمر. موافق؟')) return
              try {
                await apiClient.restoreBackupUpload(f)
                alert('تمت الاستعادة الشاملة من الملف (تحقق من السجلات)')
                await load()
              } catch (err) { alert('فشل استعادة الملف: ' + ((err as any)?.message || 'خطأ')) }
            }} style={{ display: 'none' }} />
          </label>
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
                  if (!confirm('استعادة النسخة الشاملة ستستبدل قاعدة البيانات والملفات. هذا إجراء مدمر. موافق؟')) return
                  if (!confirm('تأكيد نهائي: استعادة النسخة الآن؟')) return
                  try {
                    await apiClient.restoreBackup(i.key)
                    alert('تمت الاستعادة بنجاح')
                    await load()
                  } catch (e) { alert('استعادة فشلت: ' + (e as any)?.message || 'خطأ') }
                }}>استعادة كاملة</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
