"use client"

import React, { useState, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'
import { Spinner } from './ui/spinner'
import { Shield, Search, RefreshCw, User, Clock, FileText, AlertCircle } from 'lucide-react'

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const data = await apiClient.getAuditLogs(200) // Fetch last 200 logs
      setLogs(data)
    } catch (err) {
      console.error('Failed to fetch audit logs', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const filteredLogs = logs.filter(log => 
    (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.entity_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getActionColor = (action: string) => {
    if (action.includes('LOGIN_FAILED')) return 'text-red-600 bg-red-50 border-red-100'
    if (action.includes('LOGIN_SUCCESS')) return 'text-green-600 bg-green-50 border-green-100'
    if (action.includes('PRINT')) return 'text-purple-600 bg-purple-50 border-purple-100'
    if (action.includes('VIEW')) return 'text-blue-600 bg-blue-50 border-blue-100'
    return 'text-slate-600 bg-slate-50 border-slate-100'
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Shield className="text-blue-600" />
              سجل التدقيق ومراقبة التفاعل
            </h2>
            <p className="text-sm text-slate-500 mt-1">مراقبة جميع عمليات الدخول، الطباعة، وفتح الملفات</p>
          </div>
          
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="بحث في السجلات..." 
                className="pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 w-64"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={fetchLogs}
              className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
              title="تحديث"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase">
                <th className="px-4 py-3 rounded-tr-xl">الوقت</th>
                <th className="px-4 py-3">المستخدم</th>
                <th className="px-4 py-3">الحدث</th>
                <th className="px-4 py-3">التفاصيل</th>
                <th className="px-4 py-3 rounded-tl-xl">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center">
                    <div className="flex justify-center"><Spinner className="text-blue-600" /></div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                    لا توجد سجلات مطابقة
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors text-sm">
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-500" dir="ltr">
                      {new Date(log.created_at).toLocaleString('en-GB')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                          {(log.full_name || log.username || '?')[0]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{log.full_name || 'زائر'}</div>
                          <div className="text-[10px] text-slate-400">{log.username || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={px-2 py-1 rounded-lg text-[10px] font-black border }>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs truncate text-slate-600 font-medium" title={log.details}>
                        {log.entity_type && <span className="font-bold text-slate-800 mr-1">[{log.entity_type}]</span>}
                        {log.entity_id && <span className="font-mono text-xs bg-slate-100 px-1 rounded mr-1">{log.entity_id}</span>}
                        {log.details}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {log.ip_address}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
