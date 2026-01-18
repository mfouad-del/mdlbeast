"use client"

import type { Correspondence } from "@/types"
import { FilePlus, FileMinus, Layers, Calendar, Clock, AlertTriangle, ArrowUpRight, ArrowDownLeft, Activity, TrendingUp, FileText, CheckCircle, PieChart } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, PieChart as RechartsPie, Pie, AreaChart, Area, Legend } from "recharts"
import { useI18n } from "@/lib/i18n-context"
import { useEffect, useState } from "react"
import { formatDateTimeGregorian } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"

interface DashboardProps {
  docs: Correspondence[]
}

export default function Dashboard({ docs }: DashboardProps) {
  const { t, locale } = useI18n()
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState({ incoming: 0, outgoing: 0, urgent: 0, total: 0 })

  useEffect(() => {
    setMounted(true)
    // Fetch correct total stats from backend (since docs is now paginated)
    apiClient.getStats().then(s => {
        if (s) setStats(s)
    }).catch(console.error)
  }, [])

  // Use backend stats if available, otherwise fallback to prop (e.g. initial load)
  // Note: prop based stats are likely wrong due to pagination, so prefer API stats
  const incoming = stats.total > 0 ? stats.incoming : docs.filter((d) => d.type === "INCOMING").length
  const outgoing = stats.total > 0 ? stats.outgoing : docs.filter((d) => d.type === "OUTGOING").length
  const urgent = stats.total > 0 ? stats.urgent : docs.filter((d) => d.priority === t('new.key.iewttb') || d.priority === t('new.key.6c24cm') || d.priority === t('new.key.xpy7gp')).length
  const total = stats.total > 0 ? stats.total : docs.length

  const parseDocDate = (d: Correspondence) => {
    const raw = (d.documentDate || (d as any).date || (d as any).created_at || '') as any
    if (!raw) return null
    const dt = raw instanceof Date ? raw : new Date(String(raw))
    if (Number.isNaN(dt.getTime())) return null
    return dt
  }

  const buildMonthlyTrend = () => {
    const now = new Date()
    const months: { key: string; month: string; incoming: number; outgoing: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      // Use locale for month name (ar-SA or en-US)
      const monthLabel = d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'long' })
      months.push({ key, month: monthLabel, incoming: 0, outgoing: 0 })
    }
    const idx = new Map(months.map((m, i) => [m.key, i] as const))

    for (const doc of docs) {
      const dt = parseDocDate(doc)
      if (!dt) continue
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      const i = idx.get(key)
      if (i === undefined) continue
      if (doc.type === 'INCOMING') months[i].incoming += 1
      if (doc.type === 'OUTGOING') months[i].outgoing += 1
    }
    return months.map(({ month, incoming, outgoing }) => ({ month, incoming, outgoing }))
  }

  // Translate Chart Data Labels
  const typeData = [
    { name: t('dashboard.incoming'), value: incoming, color: "#3b82f6" },
    { name: t('dashboard.outgoing'), value: outgoing, color: "#8b5cf6" },
  ]

  const normalCount = docs.filter((d) => d.priority === t('new.key.fafis5') || d.priority === t('new.key.aalvvw')).length
  const urgentCount = docs.filter((d) => d.priority === t('new.key.6c24cm') || d.priority === t('new.key.iewttb') || d.priority === t('new.key.xpy7gp')).length
  
  const priorityData = [
    { name: t('dashboard.registered'), value: normalCount, color: "#10b981" }, 
    { name: t('dashboard.urgent'), value: urgentCount, color: "#ef4444" },
  ]

  // Real monthly trend data (last 6 months)
  const monthlyTrend = buildMonthlyTrend()

  // Status distribution for pie chart
  const statusData = [
    { name: t('dashboard.incoming'), value: incoming, color: "#3b82f6" },
    { name: t('dashboard.outgoing'), value: outgoing, color: "#8b5cf6" },
    { name: t('dashboard.urgent'), value: urgent, color: "#ef4444" },
  ]

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">{t('dashboard.title')}</h1>
          <p className="text-slate-500 text-sm mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold text-slate-600 bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm">
          <Calendar size={16} className="text-blue-600" />
          {mounted ? formatDateTimeGregorian(new Date().toISOString()) : <span className="w-32 h-4 bg-slate-100 animate-pulse rounded block"></span>}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-3xl text-white shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Layers size={20} />
            </div>
            <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-full">{t('dashboard.total')}</span>
          </div>
          <div className="text-4xl font-black mb-1">{total}</div>
          <div className="text-xs text-slate-400">{t('dashboard.registered')}</div>
        </div>

        {/* Incoming */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <ArrowDownLeft size={20} className="text-blue-600" />
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{t('dashboard.incoming')}</span>
          </div>
          <div className="text-4xl font-black text-slate-900 mb-1">{incoming}</div>
          <div className="text-xs text-slate-400">{t('dashboard.incomingDocs')}</div>
        </div>

        {/* Outgoing */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <ArrowUpRight size={20} className="text-purple-600" />
            </div>
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{t('dashboard.outgoing')}</span>
          </div>
          <div className="text-4xl font-black text-slate-900 mb-1">{outgoing}</div>
          <div className="text-xs text-slate-400">{t('dashboard.outgoingDocs')}</div>
        </div>

        {/* Urgent */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{t('dashboard.urgent')}</span>
          </div>
          <div className="text-4xl font-black text-slate-900 mb-1">{urgent}</div>
          <div className="text-xs text-slate-400">{t('dashboard.attention')}</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Pie Chart - Status Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-slate-900">{t('dashboard.statusDist')}</h3>
            <PieChart size={18} className="text-slate-400" />
          </div>
          
          <div style={{ width: '100%', height: 208, minHeight: 208, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)',
                    padding: '10px 16px'
                  }} 
                />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
          
          <div className="flex justify-center gap-4 mt-4">
            {statusData.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                <span className="text-xs font-bold text-slate-600">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Area Chart - Trend */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-black text-slate-900">{t('dashboard.trend')}</h3>
              <p className="text-xs text-slate-400 mt-1">{t('dashboard.trendSubtitle')}</p>
            </div>
            <TrendingUp size={18} className="text-emerald-500" />
          </div>
          
          <div style={{ width: '100%', height: 208, minHeight: 208, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="colorIncoming" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOutgoing" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    padding: '10px 16px'
                  }} 
                />
                <Area type="monotone" dataKey="incoming" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorIncoming)" name={t('dashboard.incoming')} />
                <Area type="monotone" dataKey="outgoing" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorOutgoing)" name={t('dashboard.outgoing')} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Priority & Bar Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-slate-900">{t('dashboard.activity')}</h3>
            <Activity size={18} className="text-slate-400" />
          </div>
          
          <div style={{ width: '100%', height: 224, minHeight: 224, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} barSize={60}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12, fontWeight: "bold" }}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 30px -5px rgba(0,0,0,0.1)",
                    fontSize: "12px",
                    padding: "10px 16px",
                  }}
                />
                <Bar dataKey="value" radius={[12, 12, 12, 12]}>
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-slate-900">{t('dashboard.priority')}</h3>
            <FileText size={18} className="text-slate-400" />
          </div>
          
          <div className="space-y-5">
             {priorityData.map((p, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                    <span className="text-sm font-bold text-slate-600">{p.name}</span>
                  </div>
                  <span className="text-lg font-black text-slate-900">{p.value}</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ 
                      width: `${total ? (p.value / total) * 100 : 0}%`,
                      backgroundColor: p.color
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 text-slate-400">
            <Clock size={14} />
            <span className="text-[10px] font-bold">{t('dashboard.lastUpdate')}</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-slate-900">{t('dashboard.recentActivity')}</h3>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{t('dashboard.latest5')}</span>
        </div>
        
        <div className="space-y-3">
          {docs.slice(0, 5).map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-white hover:shadow-md border border-transparent hover:border-slate-200 transition-all cursor-default"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                    doc.type === "INCOMING" || (doc.type as string) === t('new.key.3mij8b')
                      ? "bg-blue-100 text-blue-600" 
                      : "bg-purple-100 text-purple-600"
                  }`}
                >
                  {(doc.type === "INCOMING" || (doc.type as string) === t('new.key.3mij8b')) ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 mb-0.5 group-hover:text-blue-600 transition-colors">{doc.title || doc.subject}</div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{(doc.type === 'OUTGOING' || (doc.type as string) === t('new.key.5fsw78')) ? doc.recipient : doc.sender}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span dir="ltr">
                      {(() => {
                        try {
                          const d = new Date(doc.date || '');
                          // Use locale for date format
                          return isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB');
                        } catch (e) { return '' }
                      })()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-xs font-mono font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-100 group-hover:border-slate-200 transition-colors">
                {doc.barcode}
              </div>
            </div>
          ))}
          {docs.length === 0 && (
            <div className="py-12 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Layers size={24} className="text-slate-400" />
              </div>
              <p className="text-slate-400 font-bold">{t('dashboard.noActivity')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
