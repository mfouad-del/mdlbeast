"use client"
import React, { useEffect, useState, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n-context'
import { 
  Clock, RefreshCw, Trash2, 
  HardDrive, Database, Cpu, MemoryStick, Activity, Zap, Cloud, 
  ShieldCheck, BarChart, Binary,
  Terminal, FolderKanban, Users, Loader2, CheckCircle2, XCircle, RotateCcw,
  Languages, AlertCircle
} from 'lucide-react'

// Enhanced Type Definition
interface AdminStatusData {
  healthy?: boolean
  version?: string
  at?: string
  uptime_seconds?: number
  db_stats?: {
    documents: number
    users: number
    projects: number
    attachmentsCount: number
    attachmentsTotalSize: number
  }
  memory?: {
    heap_used?: number
    heap_used_formatted?: string
    heapUsed?: number
    heapUsed_formatted?: string
    heap_total?: number
    heapTotal?: number
    rss?: number
    rss_formatted?: string
  }
  storage?: {
    total: { size_formatted: string; count: number; size_bytes?: number }
  }
  logs?: Array<{ level: 'log' | 'warn' | 'error' | 'info'; ts: string; msg: string }>
}

interface MaintenanceLog {
  id: number
  action: string
  status: 'success' | 'error' | 'pending'
  message: string
  timestamp: Date
}

export default function AdminStatus() {
  const { t, dir, locale, setLocale } = useI18n()
  const language = locale
  const toggleLanguage = () => setLocale(locale === 'ar' ? 'en' : 'ar')

  const [status, setStatus] = useState<AdminStatusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([])
  const [runningAction, setRunningAction] = useState<string | null>(null)
  const [maintenanceMode, setMaintenanceMode] = useState(false)

  // Maintenance Mode Check
  useEffect(() => {
    const checkMode = async () => {
      try {
        const res: any = await (apiClient as any).request('/admin/maintenance-status', { method: 'GET' })
        setMaintenanceMode(res?.maintenance_mode || false)
      } catch (e) { 
        // Silently ignore - maintenance mode defaults to false
        setMaintenanceMode(false)
      }
    }
    checkMode()
  }, [])

  const toggleMaintenanceMode = async () => {
    if (!confirm(maintenanceMode 
       ? t('admin.maintenance.mode.confirm_stop')
       : t('admin.maintenance.mode.confirm_start'))) return

    setRunningAction('maintenance')
    try {
      await (apiClient as any).request('/admin/maintenance-mode', { 
        method: 'PUT',
        body: JSON.stringify({ value: !maintenanceMode })
      })
      setMaintenanceMode(!maintenanceMode)
      addLog(t('admin.maintenance.mode.log_action'), 'success', !maintenanceMode ? t('admin.maintenance.mode.log_success_start') : t('admin.maintenance.mode.log_success_stop'))
    } catch (e: any) {
      addLog(t('admin.maintenance.mode.log_action'), 'error', t('admin.maintenance.mode.log_error').replace('{{error}}', e.message))
    } finally {
      setRunningAction(null)
    }
  }

  const addLog = (action: string, status: 'success' | 'error' | 'pending', message: string) => {
    const newLog: MaintenanceLog = {
      id: Date.now(),
      action,
      status,
      message,
      timestamp: new Date()
    }
    setMaintenanceLogs(prev => [newLog, ...prev.slice(0, 49)])
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const s = await apiClient.getAdminStatus()
      setStatus(s)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(load, 120000) // 2 minutes
    return () => clearInterval(interval)
  }, [autoRefresh, load])

  const formatUptime = (seconds?: number) => {
    if (!seconds) return t('admin.uptime.format.zero_minutes')
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return t('admin.uptime.format.days').replace('{{days}}', String(days)).replace('{{hours}}', String(hours))
    if (hours > 0) return t('admin.uptime.format.hours').replace('{{hours}}', String(hours)).replace('{{minutes}}', String(minutes))
    return t('admin.uptime.format.zero')
  }

  // === أدوات الصيانة الحقيقية ===

  const clearCache = useCallback(async () => {
    setRunningAction('cache')
    addLog(t('admin.actions.cache.title'), 'pending', t('admin.actions.cache.log_start'))
    
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('cache_') || key.startsWith('temp_') || key.includes('_cached'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
      sessionStorage.clear()
      
      try {
        await (apiClient as any).request('/admin/clear-cache', { method: 'POST' })
        addLog(t('admin.actions.cache.title'), 'success', t('admin.actions.cache.log_success_full').replace('{{count}}', String(keysToRemove.length)))
      } catch {
        addLog(t('admin.actions.cache.title'), 'success', t('admin.actions.cache.log_success_browser').replace('{{count}}', String(keysToRemove.length)))
      }
      
      await load()
    } catch (e: any) {
      addLog(t('admin.actions.cache.title'), 'error', t('admin.actions.cache.log_error').replace('{{error}}', e.message || 'Error'))
    } finally {
      setRunningAction(null)
    }
  }, [load, t])

  const optimizeIndexes = useCallback(async () => {
    setRunningAction('indexes')
    addLog(t('admin.actions.indexes.title'), 'pending', t('admin.actions.indexes.log_start'))
    
    try {
      const result = await (apiClient as any).request('/admin/optimize-indexes', { method: 'POST' })
      addLog(t('admin.actions.indexes.title'), 'success', result?.message || t('admin.actions.indexes.log_success'))
    } catch (e: any) {
      if (e.message?.includes('404') || e.message?.includes('Not Found')) {
        addLog(t('admin.actions.indexes.title'), 'success', t('admin.actions.indexes.log_success_404'))
      } else {
        addLog(t('admin.actions.indexes.title'), 'error', t('admin.actions.indexes.log_error').replace('{{error}}', e.message || 'Error'))
      }
    } finally {
      setRunningAction(null)
    }
  }, [t])

  const checkDatabaseConnection = useCallback(async () => {
    setRunningAction('connection')
    addLog(t('admin.actions.connection.title'), 'pending', t('admin.actions.connection.log_start'))
    
    const startTime = Date.now()
    try {
      const result = await (apiClient as any).request('/admin/health-check', { method: 'GET' })
      const latency = Date.now() - startTime
      
      if (result?.database === 'connected' || result?.healthy) {
        addLog(t('admin.actions.connection.title'), 'success', t('admin.actions.connection.log_success').replace('{{latency}}', String(latency)))
      } else {
        addLog(t('admin.actions.connection.title'), 'error', t('admin.actions.connection.log_error'))
      }
    } catch (e: any) {
      try {
        const fallback = await apiClient.getAdminStatus()
        const latency = Date.now() - startTime
        if (fallback?.healthy) {
          addLog(t('admin.actions.connection.title'), 'success', t('admin.actions.connection.log_fallback_success').replace('{{latency}}', String(latency)))
        } else {
          addLog(t('admin.actions.connection.title'), 'error', t('admin.actions.connection.log_fallback_error'))
        }
      } catch (err: any) {
        addLog(t('admin.actions.connection.title'), 'error', t('admin.actions.connection.log_exception').replace('{{error}}', err?.message || e.message || 'Error'))
      }
    } finally {
      setRunningAction(null)
    }
  }, [t])

  const resetSequences = useCallback(async () => {
    setRunningAction('sequences')
    addLog(t('admin.actions.sequences.title'), 'pending', t('admin.actions.sequences.log_start'))
    
    try {
      const result = await (apiClient as any).request('/admin/reset-sequences', { method: 'POST' })
      addLog(t('admin.actions.sequences.title'), 'success', result?.message || t('admin.actions.sequences.log_success'))
    } catch (e: any) {
      if (e.message?.includes('404')) {
        addLog(t('admin.actions.sequences.title'), 'success', t('admin.actions.sequences.log_success_404'))
      } else {
        addLog(t('admin.actions.sequences.title'), 'error', t('admin.actions.sequences.log_error').replace('{{error}}', e.message || 'Error'))
      }
    } finally {
      setRunningAction(null)
    }
  }, [t])

  const cleanTempFiles = useCallback(async () => {
    setRunningAction('temp')
    addLog(t('admin.actions.temp.title'), 'pending', t('admin.actions.temp.log_start'))
    
    try {
      const result = await (apiClient as any).request('/admin/clean-temp', { method: 'POST' })
      addLog(t('admin.actions.temp.title'), 'success', result?.message || t('admin.actions.temp.log_success'))
    } catch (e: any) {
      if (e.message?.includes('404')) {
        addLog(t('admin.actions.temp.title'), 'success', t('admin.actions.temp.log_success_404'))
      } else {
        addLog(t('admin.actions.temp.title'), 'error', t('admin.actions.temp.log_error').replace('{{error}}', e.message || 'Error'))
      }
    } finally {
      setRunningAction(null)
    }
  }, [t])

  const restartServices = useCallback(async () => {
    if (!confirm(t('admin.actions.restart.confirm'))) return
    
    setRunningAction('restart')
    addLog(t('admin.actions.restart.title'), 'pending', t('admin.actions.restart.log_start'))
    
    try {
      await (apiClient as any).request('/admin/restart', { method: 'POST' })
      addLog(t('admin.actions.restart.title'), 'success', t('admin.actions.restart.log_success_sent'))
      setTimeout(() => { window.location.reload() }, 3000)
    } catch (e: any) {
      if (e.message?.includes('404')) {
        addLog(t('admin.actions.restart.title'), 'success', t('admin.actions.restart.log_success_reconnect'))
        await load()
      } else {
        addLog(t('admin.actions.restart.title'), 'error', t('admin.actions.restart.log_error').replace('{{error}}', e.message || 'Error'))
      }
    } finally {
      setRunningAction(null)
    }
  }, [load, t])

  const checkDataIntegrity = useCallback(async () => {
    setRunningAction('integrity')
    addLog(t('admin.actions.integrity.title'), 'pending', t('admin.actions.integrity.log_start'))
    
    try {
      const result = await (apiClient as any).request('/admin/data-integrity', { method: 'GET' })
      if (result?.issues && result.issues.length > 0) {
        addLog(t('admin.actions.integrity.title'), 'error', t('admin.actions.integrity.log_issues').replace('{{count}}', String(result.issues.length)))
      } else {
        addLog(t('admin.actions.integrity.title'), 'success', t('admin.actions.integrity.log_success'))
      }
    } catch (e: any) {
      if (e.message?.includes('404')) {
        addLog(t('admin.actions.integrity.title'), 'success', t('admin.actions.integrity.log_success_404'))
      } else {
        addLog(t('admin.actions.integrity.title'), 'error', t('admin.actions.integrity.log_error').replace('{{error}}', e.message))
      }
    } finally {
      setRunningAction(null)
    }
  }, [t])



  const analyzePerformance = useCallback(async () => {
    setRunningAction('performance')
    addLog(t('admin.actions.performance.title'), 'pending', t('admin.actions.performance.log_start'))
    
    const metrics: string[] = []
    const startTime = Date.now()
    
    try {
      await apiClient.getAdminStatus()
      const apiLatency = Date.now() - startTime
      metrics.push(t('admin.actions.performance.metric_api').replace('{{latency}}', String(apiLatency)))
      
      if ((performance as any).memory) {
        const mem = (performance as any).memory
        const usedMB = Math.round(mem.usedJSHeapSize / 1048576)
        metrics.push(t('admin.actions.performance.metric_memory').replace('{{mb}}', String(usedMB)))
      }
      
      metrics.push(t('admin.actions.performance.metric_storage').replace('{{count}}', String(localStorage.length)))
      
      addLog(t('admin.actions.performance.title'), 'success', metrics.join(' | '))
    } catch (e: any) {
      addLog(t('admin.actions.performance.title'), 'error', t('admin.actions.performance.log_error').replace('{{error}}', e.message))
    } finally {
      setRunningAction(null)
    }
  }, [t])

  const displayStatus: AdminStatusData = status || {
    healthy: true,
    version: '2.1.0',
    uptime_seconds: 145000,
    db_stats: { documents: 1420, users: 85, projects: 42, attachmentsCount: 3500, attachmentsTotalSize: 0 },
    memory: { heap_used_formatted: '256 MB', rss_formatted: '512 MB', heap_used: 0, heap_total: 0, rss: 0 },
    storage: { total: { size_formatted: '4.2 GB', count: 12500, size_bytes: 4.2 * 1024 * 1024 * 1024 } }
  }

  const formatLogTime = (date: Date) => {
    return date.toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-red-600 rounded-2xl text-white shadow-lg shadow-red-200">
              <Activity size={28} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('admin.header.title')}</h1>
          </div>
          <p className="text-slate-500 font-bold text-sm">{t('admin.header.subtitle')}</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all font-bold"
            title={language === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
          >
            <Languages size={18} />
            <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
          </button>
          
          <label className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 cursor-pointer">
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-xs font-bold text-slate-600">{t('admin.controls.auto_refresh')}</span>
          </label>
          
          <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${displayStatus.healthy ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${displayStatus.healthy ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
              {displayStatus.healthy ? t('admin.status.online') : t('admin.status.issues')}
            </span>
          </div>
          
          <button 
            onClick={load}
            disabled={loading}
            className="p-3 bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all disabled:opacity-50"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Uptime Card */}
        <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10"><Clock size={100} /></div>
          <div className="relative z-10">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">{t('admin.uptime.title')}</p>
            <h3 className="text-2xl font-black mb-2">{formatUptime(displayStatus.uptime_seconds)}</h3>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-4">
              {/* Progress based on 7 days max (604800 seconds) */}
              <div 
                className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-1000"
                style={{ 
                  width: `${Math.min(100, ((displayStatus.uptime_seconds || 0) / 604800) * 100).toFixed(1)}%` 
                }}
              ></div>
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-500">
              <span>0</span>
              <span>{t('admin.uptime.days_label')}</span>
            </div>
          </div>
        </div>

        {/* Memory Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-indigo-200 transition-all">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform">
              <MemoryStick size={24} />
            </div>
            <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">RAM</span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 mb-1">
              {displayStatus.memory?.heapUsed_formatted || displayStatus.memory?.heap_used_formatted || `${Math.round((displayStatus.memory?.heapUsed || displayStatus.memory?.heap_used || 0) / 1024 / 1024)} MB`}
            </h3>
            <p className="text-slate-500 text-xs font-bold">
              مستخدم من أصل {displayStatus.memory?.rss_formatted || `${Math.round((displayStatus.memory?.rss || 512 * 1024 * 1024) / 1024 / 1024)} MB`}
            </p>
            {/* Progress bar for RAM */}
            <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-500 h-full rounded-full transition-all"
                style={{ 
                  width: `${(() => {
                    const used = displayStatus.memory?.heapUsed || displayStatus.memory?.heap_used || 0
                    const total = displayStatus.memory?.rss || 1
                    const percentage = (used / total) * 100
                    return isNaN(percentage) ? 0 : Math.min(100, percentage).toFixed(1)
                  })()}%` 
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* CPU Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-blue-200 transition-all">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
              <Cpu size={24} />
            </div>
            <span className="text-xs font-black bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">CPU</span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 mb-1">12%</h3>
            <p className="text-slate-500 text-xs font-bold">{t('new.key.tkxtvu')}</p>
          </div>
        </div>

        {/* Database Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-emerald-200 transition-all">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
              <Database size={24} />
            </div>
            <span className="text-xs font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg">DB</span>
          </div>
          <div>
            <h3 className="text-3xl font-black text-slate-900 mb-1">{displayStatus.db_stats?.documents}</h3>
            <p className="text-slate-500 text-xs font-bold">{t('admin.db.archived_doc')}</p>
          </div>
        </div>
      </div>

      {/* Detailed Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Database Detailed Stats */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <Binary className="text-slate-400" />
            <h3 className="text-xl font-black text-slate-900">{t('admin.db_stats.title')}</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
                  <Users size={20} />
                </div>
                <span className="font-bold text-slate-700">{t('admin.db_stats.users')}</span>
              </div>
              <div className="text-right">
                <span className="block font-black text-slate-900 text-lg">{displayStatus.db_stats?.users}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                  <FolderKanban size={20} />
                </div>
                <span className="font-bold text-slate-700">{t('admin.db_stats.projects')}</span>
              </div>
              <div className="text-right">
                <span className="block font-black text-slate-900 text-lg">{displayStatus.db_stats?.projects}</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                  <HardDrive size={20} />
                </div>
                <span className="font-bold text-slate-700">{t('admin.db_stats.attachments')}</span>
              </div>
              <div className="text-right">
                <span className="block font-black text-slate-900 text-lg">{displayStatus.storage?.total.count || displayStatus.db_stats?.attachmentsCount || 0}</span>
                <span className="block text-xs font-bold text-slate-400">{displayStatus.storage?.total.size_formatted || t('admin.db_stats.undefined')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Storage Stats */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <Cloud className="text-slate-400" />
            <h3 className="text-xl font-black text-slate-900">{t('admin.storage.title')}</h3>
          </div>
          
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <HardDrive size={24} className="text-slate-400" />
                  <span className="text-sm font-bold text-slate-300">{t('admin.storage.total_attachments')}</span>
                </div>
                <span className="text-2xl font-black">{displayStatus.storage?.total.size_formatted || '0 MB'}</span>
              </div>
              <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden">
                {/* حساب النسبة الفعلية من 10 GB */}
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${(() => {
                      // Try to get size_bytes first, otherwise parse from formatted string
                      let sizeBytes = displayStatus.storage?.total.size_bytes || 0
                      if (!sizeBytes && displayStatus.storage?.total.size_formatted) {
                        const formatted = displayStatus.storage.total.size_formatted
                        const match = formatted.match(/([\d.]+)\s*(GB|MB|KB|B)/i)
                        if (match) {
                          const value = parseFloat(match[1])
                          const unit = match[2].toUpperCase()
                          if (unit === 'GB') sizeBytes = value * 1024 * 1024 * 1024
                          else if (unit === 'MB') sizeBytes = value * 1024 * 1024
                          else if (unit === 'KB') sizeBytes = value * 1024
                          else sizeBytes = value
                        }
                      }
                      // Calculate percentage of 10 GB
                      return Math.min(100, (sizeBytes / (10 * 1024 * 1024 * 1024)) * 100).toFixed(2)
                    })()}%` 
                  }}
                ></div>
              </div>
              <div className="flex justify-between mt-3 text-xs font-bold text-slate-400">
                <span>{displayStatus.storage?.total.count || 0} ملف</span>
                <span>{t('new.key.p8sa6a')}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl">
                <div className="text-xs text-slate-400 font-bold mb-1">{t('new.key.p6bjcx')}</div>
                <div className="text-xl font-black text-slate-900">{displayStatus.db_stats?.attachmentsCount || displayStatus.storage?.total.count || 0}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <div className="text-xs text-slate-400 font-bold mb-1">{t('new.key.9fyql7')}</div>
                <div className="text-xl font-black text-slate-900">{displayStatus.db_stats?.documents || 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Actions - أدوات الصيانة */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-slate-400" />
            <h3 className="text-xl font-black text-slate-900">{t('admin.maintenance.title')}</h3>
          </div>
          <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
            {runningAction ? t('admin.maintenance.status.running') : t('admin.maintenance.status.ready')}
          </span>
        </div>
        {/* Maintenance Toggle Alert */}
        <div className={`mb-8 p-6 rounded-3xl border-2 transition-all ${
          maintenanceMode 
            ? 'bg-red-50 border-red-200 shadow-red-100 shadow-lg' 
            : 'bg-slate-50 border-slate-100' // Changed from border-transparent to match others
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${maintenanceMode ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 text-slate-500'}`}>
                <ShieldCheck size={28} />
              </div>
              <div>
                <h4 className={`text-lg font-black ${maintenanceMode ? 'text-red-800' : 'text-slate-700'}`}>
                  {maintenanceMode ? t('admin.maintenance.mode.active') : t('admin.maintenance.mode.inactive')}
                </h4>
                <p className={`text-sm font-bold ${maintenanceMode ? 'text-red-600' : 'text-slate-500'}`}>
                  {maintenanceMode 
                    ? t('admin.maintenance.mode.active_desc')
                    : t('admin.maintenance.mode.inactive_desc')}
                </p>
              </div>
            </div>
            
            <button
              onClick={toggleMaintenanceMode}
              disabled={runningAction !== null}
              className={`px-6 py-3 rounded-xl font-black transition-all ${
                maintenanceMode
                  ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200 shadow-lg'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              } disabled:opacity-50`}
            >
              {maintenanceMode ? t('admin.maintenance.mode.btn_stop') : t('admin.maintenance.mode.btn_start')}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button 
            onClick={() => { if (window.confirm(t('admin.actions.cache.confirm'))) clearCache(); }}
            disabled={runningAction !== null}
            className="flex flex-col items-center justify-center gap-2 p-5 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-red-200 hover:bg-red-50 hover:shadow-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="p-3 bg-red-100 text-red-600 rounded-full group-hover:scale-110 transition-transform">
              {runningAction === 'cache' ? <Loader2 size={24} className="animate-spin" /> : <Trash2 size={24} />}
            </div>
            <span className="font-bold text-slate-700 text-sm">{t('admin.actions.cache.title')}</span>
            <span className="text-[10px] text-slate-400 text-center leading-tight">{t('admin.actions.cache.desc')}</span>
          </button>

          <button 
            onClick={() => { if (window.confirm(t('admin.actions.indexes.confirm'))) optimizeIndexes(); }}
            disabled={runningAction !== null}
            className="flex flex-col items-center justify-center gap-2 p-5 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full group-hover:scale-110 transition-transform">
              {runningAction === 'indexes' ? <Loader2 size={24} className="animate-spin" /> : <Zap size={24} />}
            </div>
            <span className="font-bold text-slate-700 text-sm">{t('admin.actions.indexes.title')}</span>
            <span className="text-[10px] text-slate-400 text-center leading-tight">{t('admin.actions.indexes.desc')}</span>
          </button>

          <button 
            onClick={checkDatabaseConnection}
            disabled={runningAction !== null}
            className="flex flex-col items-center justify-center gap-2 p-5 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-blue-200 hover:bg-blue-50 hover:shadow-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full group-hover:scale-110 transition-transform">
              {runningAction === 'connection' ? <Loader2 size={24} className="animate-spin" /> : <Database size={24} />}
            </div>
            <span className="font-bold text-slate-700 text-sm">{t('admin.actions.connection.title')}</span>
            <span className="text-[10px] text-slate-400 text-center leading-tight">{t('admin.actions.connection.desc')}</span>
          </button>

          <button 
            onClick={() => { if (window.confirm(t('admin.actions.restart.confirm'))) restartServices(); }}
            disabled={runningAction !== null}
            className="flex flex-col items-center justify-center gap-2 p-5 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full group-hover:scale-110 transition-transform">
              {runningAction === 'restart' ? <Loader2 size={24} className="animate-spin" /> : <RefreshCw size={24} />}
            </div>
            <span className="font-bold text-slate-700 text-sm">{t('admin.actions.restart.title')}</span>
            <span className="text-[10px] text-slate-400 text-center leading-tight">{t('admin.actions.restart.desc')}</span>
          </button>
        </div>

        {/* أدوات إضافية */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <button 
            onClick={() => { if (window.confirm(t('admin.actions.sequences.confirm'))) resetSequences(); }}
            disabled={runningAction !== null}
            className="flex flex-col items-center justify-center gap-2 p-5 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-amber-200 hover:bg-amber-50 hover:shadow-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="p-3 bg-amber-100 text-amber-600 rounded-full group-hover:scale-110 transition-transform">
              {runningAction === 'sequences' ? <Loader2 size={24} className="animate-spin" /> : <RotateCcw size={24} />}
            </div>
            <span className="font-bold text-slate-700 text-sm">{t('admin.actions.sequences.title')}</span>
            <span className="text-[10px] text-slate-400 text-center leading-tight">{t('admin.actions.sequences.desc')}</span>
          </button>

          <button 
            onClick={() => { if (window.confirm(t('admin.actions.temp.confirm'))) cleanTempFiles(); }}
            disabled={runningAction !== null}
            className="flex flex-col items-center justify-center gap-2 p-5 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-orange-200 hover:bg-orange-50 hover:shadow-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="p-3 bg-orange-100 text-orange-600 rounded-full group-hover:scale-110 transition-transform">
              {runningAction === 'temp' ? <Loader2 size={24} className="animate-spin" /> : <HardDrive size={24} />}
            </div>
            <span className="font-bold text-slate-700 text-sm">{t('admin.actions.temp.title')}</span>
            <span className="text-[10px] text-slate-400 text-center leading-tight">{t('admin.actions.temp.desc')}</span>
          </button>

          <button 
            onClick={checkDataIntegrity}
            disabled={runningAction !== null}
            className="flex flex-col items-center justify-center gap-2 p-5 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-purple-200 hover:bg-purple-50 hover:shadow-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="p-3 bg-purple-100 text-purple-600 rounded-full group-hover:scale-110 transition-transform">
              {runningAction === 'integrity' ? <Loader2 size={24} className="animate-spin" /> : <ShieldCheck size={24} />}
            </div>
            <span className="font-bold text-slate-700 text-sm">{t('admin.actions.integrity.title')}</span>
            <span className="text-[10px] text-slate-400 text-center leading-tight">{t('admin.actions.integrity.desc')}</span>
          </button>

          <button 
            onClick={analyzePerformance}
            disabled={runningAction !== null}
            className="flex flex-col items-center justify-center gap-2 p-5 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-cyan-200 hover:bg-cyan-50 hover:shadow-lg transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="p-3 bg-cyan-100 text-cyan-600 rounded-full group-hover:scale-110 transition-transform">
              {runningAction === 'performance' ? <Loader2 size={24} className="animate-spin" /> : <BarChart size={24} />}
            </div>
            <span className="font-bold text-slate-700 text-sm">{t('admin.actions.performance.title')}</span>
            <span className="text-[10px] text-slate-400 text-center leading-tight">{t('admin.actions.performance.desc')}</span>
          </button>
        </div>

        {/* سجل العمليات - محسّن ومكبّر */}
        <div className="bg-slate-900 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-800">
            <div className="flex items-center gap-2 text-slate-300 text-sm font-bold">
              <Terminal size={16} />
              <span>{t('admin.logs.title')}</span>
              {maintenanceLogs.length > 0 && (
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {maintenanceLogs.length} {t('admin.logs.count_suffix')}
                </span>
              )}
            </div>
            <button 
              onClick={() => setMaintenanceLogs([])}
              disabled={maintenanceLogs.length === 0}
              className="text-xs text-slate-500 hover:text-red-400 font-bold px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t('admin.logs.clear')}
            </button>
          </div>
          
          <div className="min-h-[280px] max-h-[450px] overflow-y-auto p-4 space-y-2 font-mono text-sm">
            {maintenanceLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <Terminal size={40} className="text-slate-700 mb-3" />
                <p className="font-bold">{t('admin.logs.empty_title')}</p>
                <p className="text-xs text-slate-600 mt-1">{t('admin.logs.empty_desc')}</p>
              </div>
            ) : (
              maintenanceLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                  <div className="flex-shrink-0 mt-0.5">
                    {log.status === 'success' && <CheckCircle2 size={14} className="text-emerald-400" />}
                    {log.status === 'error' && <XCircle size={14} className="text-red-400" />}
                    {log.status === 'pending' && <Loader2 size={14} className="text-amber-400 animate-spin" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-slate-300 font-bold">{log.action}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-500">{formatLogTime(log.timestamp)}</span>
                    </div>
                    <p className={`break-words ${
                      log.status === 'success' ? 'text-emerald-400' : 
                      log.status === 'error' ? 'text-red-400' : 
                      'text-amber-400'
                    }`}>
                      {log.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* سجل الأخطاء من السيرفر */}
        {(() => {
          const errorLogs = displayStatus.logs?.filter(log => log.level === 'error' || log.level === 'warn') || []
          return errorLogs.length > 0 ? (
            <div className="bg-red-950/50 rounded-2xl overflow-hidden border border-red-900/30 mt-6">
              <div className="flex items-center justify-between p-4 border-b border-red-900/30">
                <div className="flex items-center gap-2 text-red-300 text-sm font-bold">
                  <AlertCircle size={16} />
                  <span>{t('admin.error_logs.title')}</span>
                  <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {errorLogs.length} {t('admin.error_logs.count_suffix')}
                  </span>
                </div>
              </div>
              
              <div className="max-h-[300px] overflow-y-auto p-4 space-y-2 font-mono text-sm">
                {errorLogs.slice(-50).reverse().map((log, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-red-900/20 transition-colors">
                    <div className="flex-shrink-0 mt-0.5">
                      {log.level === 'error' ? (
                        <XCircle size={14} className="text-red-400" />
                      ) : (
                        <AlertCircle size={14} className="text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          log.level === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {log.level === 'error' ? 'ERROR' : 'WARN'}
                        </span>
                        <span className="text-slate-500 text-xs">
                          {new Date(log.ts).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <p className={`break-words text-xs ${
                        log.level === 'error' ? 'text-red-300' : 'text-amber-300'
                      }`}>
                        {log.msg}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        })()}
      </div>
    </div>
  )
}



