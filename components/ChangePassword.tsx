import React, { useState } from 'react';
import { Lock, Check } from 'lucide-react';
import { apiClient } from '../lib/api-client';

const ChangePassword: React.FC = () => {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPass !== confirm) return setMessage('كلمتا المرور غير متطابقتين')
    if (!newPass || newPass.length < 6) return setMessage('كلمة المرور يجب أن تكون على الأقل 6 أحرف')
    try {
      setLoading(true)
      await apiClient.changePassword(current, newPass)
      setMessage('تم تحديث كلمة المرور بنجاح')
      setCurrent('')
      setNewPass('')
      setConfirm('')
    } catch (err: any) {
      console.error(err)
      setMessage(err.message || 'فشل تغيير كلمة المرور')
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
      <h2 className="text-2xl font-black mb-4">تغيير كلمة المرور</h2>
      <p className="text-sm text-slate-500 mb-4">يمكنك فقط تغيير كلمة المرور من هنا. لتغيير الاسم أو البريد تواصل مع مسؤول النظام.</p>
      <form onSubmit={submit} className="space-y-4">
        {message && <div className="p-3 bg-slate-50 text-slate-700 rounded">{message}</div>}
        <div>
          <label className="text-sm font-bold block mb-1">كلمة المرور الحالية</label>
          <div className="relative">
            <Lock className="absolute right-3 top-3 text-slate-300" size={16} />
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} className="w-full p-3 pr-10 rounded-xl border" required />
          </div>
        </div>
        <div>
          <label className="text-sm font-bold block mb-1">كلمة المرور الجديدة</label>
          <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full p-3 rounded-xl border" required />
        </div>
        <div>
          <label className="text-sm font-bold block mb-1">تأكيد كلمة المرور</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full p-3 rounded-xl border" required />
        </div>
        <button type="submit" className={`w-full bg-blue-600 text-white py-3 rounded-xl font-black ${loading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'}`} disabled={loading}>
          {loading ? 'جارٍ المعالجة...' : <><Check size={16} /> تحديث كلمة المرور</>}
        </button>
      </form>
    </div>
  )
}

export default ChangePassword;
