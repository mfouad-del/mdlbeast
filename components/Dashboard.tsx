"use client"

import type { Correspondence } from "@/types"
import { FilePlus, FileMinus, Layers, Calendar, Clock, AlertTriangle, ArrowUpRight, ArrowDownLeft, Activity, TrendingUp, FileText, CheckCircle, PieChart } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, PieChart as RechartsPie, Pie, AreaChart, Area, Legend } from "recharts"

interface DashboardProps {
  docs: Correspondence[]
}

export default function Dashboard({ docs }: DashboardProps) {
  const incoming = docs.filter((d) => d.type === "INCOMING").length
  const outgoing = docs.filter((d) => d.type === "OUTGOING").length
  const urgent = docs.filter((d) => d.priority === "عاجل جداً" || d.priority === "عاجل" || d.priority === "عاجله").length
  const total = docs.length

  const typeData = [
    { name: "الوارد", value: incoming, color: "#3b82f6" },
    { name: "الصادر", value: outgoing, color: "#8b5cf6" },
  ]

  const normalCount = docs.filter((d) => d.priority === "عادي" || d.priority === "عاديه").length
  const urgentCount = docs.filter((d) => d.priority === "عاجل" || d.priority === "عاجل جداً" || d.priority === "عاجله").length
  const priorityData = [
    { name: "عادي", value: normalCount, color: "#10b981" },
    { name: "عاجل", value: urgentCount, color: "#ef4444" },
  ]

  // Mock monthly trend data (you can replace with real data)
  const monthlyTrend = [
    { month: "يناير", incoming: 12, outgoing: 8 },
    { month: "فبراير", incoming: 15, outgoing: 10 },
    { month: "مارس", incoming: 18, outgoing: 14 },
    { month: "أبريل", incoming: 22, outgoing: 18 },
    { month: "مايو", incoming: 25, outgoing: 20 },
    { month: "يونيو", incoming, outgoing },
  ]

  // Status distribution for pie chart
  const statusData = [
    { name: "وارد", value: incoming, color: "#3b82f6" },
    { name: "صادر", value: outgoing, color: "#8b5cf6" },
    { name: "عاجل", value: urgent, color: "#ef4444" },
  ]

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">لوحة التحكم</h1>
          <p className="text-slate-500 text-sm mt-1">نظرة عامة على حركة المراسلات والإحصائيات</p>
        </div>
        <div className="flex items-center gap-3 text-xs font-bold text-slate-600 bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm">
          <Calendar size={16} className="text-blue-600" />
          {new Date().toLocaleDateString("ar-SA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
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
            <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded-full">الإجمالي</span>
          </div>
          <div className="text-4xl font-black mb-1">{total}</div>
          <div className="text-xs text-slate-400">معاملة مسجلة</div>
        </div>

        {/* Incoming */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <ArrowDownLeft size={20} className="text-blue-600" />
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">وارد</span>
          </div>
          <div className="text-4xl font-black text-slate-900 mb-1">{incoming}</div>
          <div className="text-xs text-slate-400">معاملات واردة</div>
        </div>

        {/* Outgoing */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <ArrowUpRight size={20} className="text-purple-600" />
            </div>
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">صادر</span>
          </div>
          <div className="text-4xl font-black text-slate-900 mb-1">{outgoing}</div>
          <div className="text-xs text-slate-400">معاملات صادرة</div>
        </div>

        {/* Urgent */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:scale-[1.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">عاجل</span>
          </div>
          <div className="text-4xl font-black text-slate-900 mb-1">{urgent}</div>
          <div className="text-xs text-slate-400">تتطلب متابعة</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Pie Chart - Status Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-slate-900">حالة المعاملات</h3>
            <PieChart size={18} className="text-slate-400" />
          </div>
          
          <div style={{ width: '100%', height: 208, minHeight: 208 }}>
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
              <h3 className="font-black text-slate-900">اتجاه المراسلات</h3>
              <p className="text-xs text-slate-400 mt-1">الأشهر الستة الأخيرة</p>
            </div>
            <TrendingUp size={18} className="text-emerald-500" />
          </div>
          
          <div style={{ width: '100%', height: 208, minHeight: 208 }}>
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
                <Area type="monotone" dataKey="incoming" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorIncoming)" name="وارد" />
                <Area type="monotone" dataKey="outgoing" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorOutgoing)" name="صادر" />
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
            <h3 className="font-black text-slate-900">توزيع الحركة</h3>
            <Activity size={18} className="text-slate-400" />
          </div>
          
          <div style={{ width: '100%', height: 224, minHeight: 224 }}>
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
            <h3 className="font-black text-slate-900">أولوية المعاملات</h3>
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
            <span className="text-[10px] font-bold">آخر تحديث: الآن</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-slate-900">آخر القيود المسجلة</h3>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">أحدث 5 معاملات</span>
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
                    doc.type === "INCOMING" 
                      ? "bg-blue-100 text-blue-600" 
                      : "bg-purple-100 text-purple-600"
                  }`}
                >
                  {doc.type === "INCOMING" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 mb-0.5 group-hover:text-blue-600 transition-colors">{doc.title || doc.subject}</div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{doc.type === 'OUTGOING' ? doc.recipient : doc.sender}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span dir="ltr">
                      {(() => {
                        try {
                          const d = new Date(doc.date || '');
                          return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB');
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
              <p className="text-slate-400 font-bold">لا يوجد نشاط مسجل بعد</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
