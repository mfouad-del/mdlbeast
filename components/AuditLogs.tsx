"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n-context'
import { formatDateTimeGregorian } from "@/lib/utils"
import { 
  Shield, Search, RefreshCw, Clock, 
  LogIn, LogOut, FileDown,
  Activity, FilePlus, Trash2, Edit, AlertTriangle,
  Users, Database, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight,
  Code2, List, FileJson
} from 'lucide-react'

// Translation Dictionary for JSON keys - Updated to use i18n
// Keeping keys map for dynamic lookup but values will be translation keys
const KEY_TRANSLATION_KEYS: Record<string, string> = {
  // General
  id: "audit.field.id",
  crated_at: "audit.field.created_at",
  created_at: "audit.field.created_at",
  updated_at: "audit.field.updated_at",
  status: "audit.field.status",
  name: "audit.field.name",
  description: "audit.field.description",
  title: "audit.field.title",
  type: "audit.field.type",
  
  // Payment / Financial
  amount: "audit.field.amount",
  project_id: "audit.field.project_id",
  project_name: "audit.field.project_name",
  note: "audit.field.note",
  notes: "audit.field.notes",
  message: "audit.field.message",
  payment_method: "audit.field.payment_method",
  bank_name: "audit.field.bank_name",
  transfer_number: "audit.field.transfer_number",
  invoice_number: "audit.field.invoice_number",
  response_notes: "audit.field.response_notes",
  transfer_image: "audit.field.transfer_image",
  invoice_image: "audit.field.invoice_image",
  
  // Users & Permissions
  username: "audit.field.username",
  email: "audit.field.email",
  role: "audit.field.role",
  phone: "audit.field.phone",
  full_name: "audit.field.full_name",
  permissions: "audit.field.permissions",
  user_id: "audit.field.user_id",
  
  // Documents & Files
  file_name: "audit.field.file_name",
  file_size: "audit.field.file_size",
  file_type: "audit.field.file_type",
  url: "audit.field.url",
  pdf_url: "audit.field.pdf_url",
  filename: "audit.field.filename",
  
  // System
  ip_address: "audit.field.ip_address",
  user_agent: "audit.field.user_agent",
  success: "audit.field.success",
  error: "audit.field.error",
  method: "audit.field.method",
  
  // Reports
  report_number: "audit.field.report_number",
  report_type: "audit.field.report_type",
  visit_date: "audit.field.visit_date",
  engineer_id: "audit.field.engineer_id",
  completion_percentage: "audit.field.completion_percentage",
  work_description: "audit.field.work_description",
  recommendations: "audit.field.recommendations",
  
  // Projects
  contract_value: "audit.field.contract_value",
  total_collected: "audit.field.total_collected",
  new_total_collected: "audit.field.new_total_collected",
  client_id: "audit.field.client_id",
  location: "audit.field.location",
  
  // Custom
  urgency: "audit.field.urgency",
  phase: "audit.field.phase",
  client_name: "audit.field.client_name",
  previous_status: "audit.field.previous_status",
  new_status: "audit.field.new_status",
  action: "audit.field.action",
  entity_type: "audit.field.entity_type",
  entity_id: "audit.field.entity_id"
}

// Helper to translate values if needed (e.g. status)
const VALUE_TRANSLATION_KEYS: Record<string, string> = {
  // Statuses
  pending: "audit.value.pending",
  pending_approval: "audit.value.pending_approval",
  approved: "audit.value.approved",
  rejected: "audit.value.rejected",
  completed: "audit.value.completed", 
  collected: "audit.value.collected",
  received: "audit.value.received",
  paid: "audit.value.paid",
  active: "audit.value.active",
  inactive: "audit.value.inactive",
  draft: "audit.value.draft",
  revision_requested: "audit.value.revision_requested",
  
  // Urgency/Priority
  high: "audit.value.high",
  low: "audit.value.low",
  normal: "audit.value.normal",
  urgent: "audit.value.urgent",
  
  // Roles
  admin: "role.admin",
  manager: "role.manager",
  accountant: "user.role.accountant",
  supervisor: "role.supervisor",
  member: "role.member",
  
  // Actions
  created: "audit.value.created",
  updated: "audit.value.updated",
  deleted: "audit.value.deleted",
  downloaded: "audit.value.downloaded",
  printed: "audit.value.printed",
  pdf_regenerated: "audit.value.pdf_regenerated",
  
  // Boolean
  true: "audit.value.true",
  false: "audit.value.false"
}

interface AuditLog {
  id: number
  created_at: string
  user_id?: number
  username?: string
  full_name?: string
  action: string
  entity_type?: string
  entity_id?: string
  details?: string
  ip_address?: string
}

// Component to render JSON details nicely
const DetailsViewer = ({ details }: { details: string }) => {
  const { t } = useI18n()

  if (!details) return <span className="text-slate-400 text-xs">{t('audit.details.none')}</span>

  let parsedDetails: any = null
  let isJson = false

  try {
    // Try parsing if it looks like JSON
    if (typeof details === 'string' && (details.startsWith('{') || details.startsWith('['))) {
      parsedDetails = JSON.parse(details)
      isJson = true
    }
  } catch (e) {
    // Not JSON, render as text
  }

  if (!isJson) {
    return <p className="text-slate-700 font-medium text-xs leading-relaxed whitespace-pre-wrap">{details}</p>
  }

  // Render Object/Array
  if (typeof parsedDetails === 'object' && parsedDetails !== null) {
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
            {Object.entries(parsedDetails).map(([key, value], idx) => {
                // Skip empty values or technical keys if needed, but showing all for audit is usually better
                // Skip if value is complex object/array for now or recursive render (keeping it simple)
                if (typeof value === 'object' && value !== null) return null 
                
                return (
                    <div key={idx} className={`flex items-center text-xs p-2 ${idx !== Object.keys(parsedDetails).length - 1 ? 'border-b border-slate-100' : ''}`}>
                        <span className="font-bold text-slate-500 w-1/3 truncate pl-2 border-l border-slate-200 ml-2">
                             {KEY_TRANSLATION_KEYS[key] ? t(KEY_TRANSLATION_KEYS[key]) : key}
                        </span>
                        <span className="font-bold text-slate-800 flex-1 break-all">
                             {VALUE_TRANSLATION_KEYS[String(value).toLowerCase()] ? t(VALUE_TRANSLATION_KEYS[String(value).toLowerCase()]) : String(value)}
                        </span>
                    </div>
                )
            })}
        </div>
      )
  }

  return <span className="text-slate-700 text-xs">{String(parsedDetails)}</span>
}

export default function AuditLogs() {
  const { t } = useI18n()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [expandedLog, setExpandedLog] = useState<number | null>(null)
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const data = await apiClient.getAuditLogs(500)
      setLogs(data)
    } catch (err) {
      console.error('Failed to fetch audit logs', err)
    } finally {
      setLoading(false)
    }
  }

  // Helper to get icon and color based on action type
  const getActionConfig = (action: string) => {
    const act = action.toLowerCase()
    
    // Login/Logout
    if (act.includes('login')) return { icon: LogIn, color: 'text-emerald-600', bg: 'bg-emerald-100', label: act.includes('fail') ? t('audit.action.login_fail') : t('audit.action.login') }
    if (act.includes('logout')) return { icon: LogOut, color: 'text-slate-600', bg: 'bg-slate-100', label: t('audit.action.logout') }
    
    // Create/Add
    if (act.includes('create') || act.includes('add') || act.includes('إنشاء')) return { icon: FilePlus, color: 'text-blue-600', bg: 'bg-blue-100', label: t('audit.action.create') }
    
    // Update/Edit
    if (act.includes('update') || act.includes('edit') || act.includes(t('new.key.8x92zx')) || act.includes('تحديث')) return { icon: Edit, color: 'text-amber-600', bg: 'bg-amber-100', label: t('audit.action.update') }
    
    // Delete/Remove
    if (act.includes('delete') || act.includes('remove') || act.includes(t('new.key.onrqgj'))) return { icon: Trash2, color: 'text-red-600', bg: 'bg-red-100', label: t('audit.action.delete') }
    
    // Print/Download/PDF
    if (act.includes('print') || act.includes(t('new.key.3nr9i1'))) return { icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-100', label: t('audit.action.print') }
    if (act.includes('download') || act.includes('تحميل') || act.includes('pdf')) return { icon: FileDown, color: 'text-purple-600', bg: 'bg-purple-100', label: t('audit.action.download') }
    if (act.includes('view') || act.includes('read') || act.includes('عرض')) return { icon: Activity, color: 'text-slate-500', bg: 'bg-slate-100', label: t('audit.action.view') }
    
    // Approve/Reject/Review
    if (act.includes('approve') || act.includes('اعتماد') || act.includes('موافق')) return { icon: Activity, color: 'text-green-600', bg: 'bg-green-100', label: t('audit.action.approve') }
    if (act.includes('reject') || act.includes('رفض')) return { icon: Activity, color: 'text-red-600', bg: 'bg-red-100', label: t('audit.action.reject') }
    
    // Payment requests
    if (act.includes('payment') || act.includes('دفع') || act.includes('دفعة')) return { icon: Activity, color: 'text-cyan-600', bg: 'bg-cyan-100', label: t('audit.action.payment') }
    
    // Supervision reports
    if (act.includes('supervision') || act.includes('إشراف') || act.includes('تقرير')) return { icon: Activity, color: 'text-violet-600', bg: 'bg-violet-100', label: t('audit.action.supervision') }
    
    // User management
    if (act.includes('user') || act.includes('مستخدم') || act.includes('صلاحي')) return { icon: Users, color: 'text-teal-600', bg: 'bg-teal-100', label: t('audit.action.user_mgmt') }
    
    // Projects
    if (act.includes('project') || act.includes('مشروع')) return { icon: Activity, color: 'text-orange-600', bg: 'bg-orange-100', label: t('audit.action.project') }
    
    // Archive/Documents
    if (act.includes('archive') || act.includes('document') || act.includes('أرشيف') || act.includes('مستند')) return { icon: Activity, color: 'text-rose-600', bg: 'bg-rose-100', label: t('audit.action.archive') }
    
    // Sync/Backup
    if (act.includes('sync') || act.includes('backup') || act.includes('نسخ') || act.includes('مزامنة')) return { icon: Database, color: 'text-gray-600', bg: 'bg-gray-100', label: t('audit.action.backup') }

    return { icon: Activity, color: 'text-slate-600', bg: 'bg-slate-100', label: t('audit.action.activity') }
  }

  const filteredLogs = useMemo(() => {
    const now = new Date()
    return logs.filter(log => {
      const matchesSearch = 
        log.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = actionFilter === 'all' ? true : log.action.toLowerCase().includes(actionFilter);
      
      // Date filtering
      let matchesDate = true
      if (dateFilter !== 'all') {
        const logDate = new Date(log.created_at)
        if (dateFilter === 'today') {
          matchesDate = logDate.toDateString() === now.toDateString()
        } else if (dateFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          matchesDate = logDate >= weekAgo
        } else if (dateFilter === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          matchesDate = logDate >= monthAgo
        }
      }
      
      return matchesSearch && matchesFilter && matchesDate;
    })
  }, [logs, searchTerm, actionFilter, dateFilter])

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredLogs.slice(start, start + itemsPerPage)
  }, [filteredLogs, currentPage, itemsPerPage])

  // Reset page
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, actionFilter, dateFilter])

  // Stats
  const stats = useMemo(() => {
    const today = new Date().toDateString()
    const todayLogs = logs.filter(l => new Date(l.created_at).toDateString() === today)
    const logins = logs.filter(l => l.action.toLowerCase().includes('login'))
    const errors = logs.filter(l => l.action.toLowerCase().includes('error') || l.action.toLowerCase().includes('failed'))
    const uniqueUsers = new Set(logs.map(l => l.user_id || l.username)).size
    return { todayCount: todayLogs.length, loginsCount: logins.length, errorsCount: errors.length, uniqueUsers }
  }, [logs])

  const exportLogs = () => {
    const data = filteredLogs.map(l => ({
      التاريخ: formatDateTimeGregorian(l.created_at),
      المستخدم: l.full_name || l.username || t('new.key.kff6c1'),
      العملية: l.action,
      التفاصيل: l.details || '',
      IP: l.ip_address || ''
    }))
    const csv = '\uFEFF' + Object.keys(data[0] || {}).join(',') + '\n' + 
      data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
                <Shield size={26} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900">{t('audit.title')}</h1>
                <p className="text-sm text-slate-500 font-bold">{t('audit.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                <RefreshCw size={18} className={`text-slate-600 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={exportLogs}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors"
                title={t('new.key.9cfkjt')}
              >
                <FileDown size={16} />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={async () => {
                   if(confirm(t('audit.clearConfirm'))) {
                      try {
                        const res = await apiClient.clearAuditLogs();
                        if(res) {
                           setLogs([]);
                           alert(t('audit.cleared'));
                        }
                      } catch(e) {
                         alert(t('backup.clear_logs_error'));
                         console.error(e);
                      }
                   }
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors"
                title={t('audit.clear')}
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">{t('audit.clear')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200">
          <div className="bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Activity size={18} className="text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{stats.todayCount}</div>
                <div className="text-xs text-slate-500 font-bold">{t('new.key.ww1jax')}</div>
              </div>
            </div>
          </div>
          <div className="bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <LogIn size={18} className="text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{stats.loginsCount}</div>
                <div className="text-xs text-slate-500 font-bold">{t('new.key.7egl6s')}</div>
              </div>
            </div>
          </div>
          <div className="bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <Users size={18} className="text-slate-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{stats.uniqueUsers}</div>
                <div className="text-xs text-slate-500 font-bold">{t('new.key.5see7q')}</div>
              </div>
            </div>
          </div>
          <div className="bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{stats.errorsCount}</div>
                <div className="text-xs text-slate-500 font-bold">{t('new.key.y5boq4')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <input
            type="text"
            placeholder={t('new.key.fpxwyf')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-slate-100 outline-none shadow-sm"
          />
          <Search size={18} className="absolute right-3 top-3.5 text-slate-400" />
        </div>
        
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as any)}
          className="px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none shadow-sm"
        >
          <option value="all">{t('new.key.cji5of')}</option>
          <option value="today">{t('new.key.b3243e')}</option>
          <option value="week">{t('new.key.7j2q9k')}</option>
          <option value="month">{t('new.key.m5wcho')}</option>
        </select>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none shadow-sm"
        >
          <option value="all">{t('new.key.co8a2n')}</option>
          <option value="login">{t('new.key.ct9ode')}</option>
          <option value="create">{t('new.key.gowo99')}</option>
          <option value="update">{t('new.key.8x92zx')}</option>
          <option value="delete">{t('new.key.onrqgj')}</option>
          <option value="print">{t('new.key.3nr9i1')}</option>
        </select>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
             <RefreshCw size={32} className="animate-spin text-slate-300 mx-auto mb-4" />
             <p className="text-slate-500 font-bold">{t('new.key.b9edk9')}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
             <Activity size={32} className="text-slate-300 mx-auto mb-4" />
             <p className="text-slate-500 font-bold">{t('new.key.gvw8f0')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedLogs.map((log) => {
              const config = getActionConfig(log.action)
              const Icon = config.icon
              const isExpanded = expandedLog === log.id

              return (
                <div 
                  key={log.id} 
                  className={`bg-white border transition-all duration-300 overflow-hidden ${isExpanded ? 'rounded-3xl border-slate-300 shadow-lg ring-1 ring-slate-100 z-10' : 'rounded-2xl border-slate-100 hover:border-slate-200 hover:shadow-sm'}`}
                >
                  <div 
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    className="p-4 flex items-center gap-4 cursor-pointer"
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center shrink-0`}>
                      <Icon size={18} className={config.color} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="col-span-1">
                        <div className="flex items-center gap-2">
                           <span className="font-bold text-slate-800 text-sm">{log.full_name || log.username || t('new.key.kff6c1')}</span>
                           {log.user_id && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">#{log.user_id}</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                           <Clock size={10} />
                           {formatDateTimeGregorian(log.created_at)}
                        </p>
                      </div>

                      <div className="col-span-1 md:col-span-2 flex items-center justify-between gap-4">
                         <div className="flex-1">
                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${config.bg} ${config.color} mb-1 inline-block`}>
                               {config.label}
                            </span>
                            <p className="text-sm font-medium text-slate-700 truncate dir-ltr text-right" title={log.action}>
                               {/* Use details directly if short, or action name */}
                               {log.action}
                            </p>
                         </div>
                         <ChevronDown size={18} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-slate-50/30 border-t border-slate-50 animate-in slide-in-from-top-2">
                      <div className="pt-4 grid sm:grid-cols-2 gap-4">
                        {/* Meta Info */}
                        <div className="space-y-3">
                          <div className="flex items-start gap-2">
                             <div className="p-1 bg-slate-100 rounded mt-0.5"><Database size={14} className="text-slate-500" /></div>
                             <div>
                                <span className="text-xs font-bold text-slate-400 block">{t('new.key.gq6s3y')}</span>
                                <span className="text-sm font-bold text-slate-700">{log.entity_type || '-'}</span>
                             </div>
                          </div>
                          <div className="flex items-start gap-2">
                             <div className="p-1 bg-slate-100 rounded mt-0.5"><Activity size={14} className="text-slate-500" /></div>
                             <div>
                                <span className="text-xs font-bold text-slate-400 block">{t('new.key.epyqqt')}</span>
                                <span className="text-sm font-bold text-slate-700">{log.entity_id || '-'}</span>
                             </div>
                          </div>
                          {log.ip_address && (
                            <div className="flex items-start gap-2">
                               <div className="p-1 bg-slate-100 rounded mt-0.5"><Shield size={14} className="text-slate-500" /></div>
                               <div>
                                  <span className="text-xs font-bold text-slate-400 block">{t('new.key.na0rwm')}</span>
                                  <span className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{log.ip_address}</span>
                               </div>
                            </div>
                          )}
                        </div>

                        {/* JSON Details */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                             <div className="p-1 bg-blue-50 rounded"><Code2 size={14} className="text-blue-500" /></div>
                             <span className="text-xs font-bold text-slate-500">{t('new.key.242vyk')}</span>
                          </div>
                          <DetailsViewer details={log.details || ''} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && filteredLogs.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
             {/* Same pagination logic as before */}
             <div className="flex items-center gap-3">
               <span className="text-xs font-bold text-slate-500">{t('new.key.oj91vl')}</span>
               <select
                 value={itemsPerPage}
                 onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                 className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
               >
                 <option value={10}>10</option>
                 <option value={20}>20</option>
                 <option value={50}>50</option>
                 <option value={100}>100</option>
               </select>
             </div>

             <div className="flex items-center gap-1" dir="ltr">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30"><ChevronsLeft size={16} /></button>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30"><ChevronLeft size={16} /></button>
                <div className="px-2 font-bold text-xs text-slate-600">Page {currentPage} of {totalPages}</div>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30"><ChevronRight size={16} /></button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-white disabled:opacity-30"><ChevronsRight size={16} /></button>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChevronDown({ className, ...props }: any) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><path d="m6 9 6 6 6-6"/></svg>
}

