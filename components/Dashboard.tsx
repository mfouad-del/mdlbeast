"use client"

import type { Correspondence } from "@/types"
import { FilePlus, FileMinus, Layers, Calendar, Clock, AlertTriangle, ArrowUpRight, ArrowDownLeft, Activity } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts"

interface DashboardProps {
  docs: Correspondence[]
}

export default function Dashboard({ docs }: DashboardProps) {
  const incoming = docs.filter((d) => d.type === "INCOMING").length
  const outgoing = docs.filter((d) => d.type === "OUTGOING").length
  const urgent = docs.filter((d) => d.priority === "عاجل جداً" || d.priority === "عاجل").length
  const total = docs.length

  const typeData = [
    { name: "الوارد", value: incoming, color: "#3b82f6" },
    { name: "الصادر", value: outgoing, color: "#6366f1" },
  ]

  const normalCount = docs.filter((d) => d.priority === "عادي").length
  const urgentCount = docs.filter((d) => d.priority === "عاجل" || d.priority === "عاجل جداً").length
  const priorityData = [
    { name: "عادي", value: normalCount },
    { name: "عاجل", value: urgentCount },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 font-heading tracking-tight">لوحة البيانات التحليلية</h1>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2">نظرة عامة على حركة المعاملات والأرشفة</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs font-black text-slate-700 bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <Calendar size={18} className="text-blue-600" />
            {new Date().toLocaleDateString("ar-SA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-slate-200 group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
          <div className="relative z-10 flex flex-col justify-between h-full min-h-[140px]">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                <Layers size={24} className="text-white" />
              </div>
              <span className="text-[10px] font-black bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">الإجمالي</span>
            </div>
            <div>
              <div className="text-5xl font-black tracking-tight mb-1">{total}</div>
              <div className="text-slate-400 text-xs font-bold">معاملة مسجلة</div>
            </div>
          </div>
        </div>

        {/* Incoming Card */}
        <div className="relative overflow-hidden bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-blue-900/5 group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-10 -mt-10 blur-2xl opacity-50"></div>
          <div className="relative z-10 flex flex-col justify-between h-full min-h-[140px]">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-blue-50 rounded-2xl">
                <ArrowDownLeft size={24} className="text-blue-600" />
              </div>
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">وارد</span>
            </div>
            <div>
              <div className="text-5xl font-black text-slate-900 tracking-tight mb-1">{incoming}</div>
              <div className="text-slate-400 text-xs font-bold">معاملات واردة</div>
            </div>
          </div>
        </div>

        {/* Outgoing Card */}
        <div className="relative overflow-hidden bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-indigo-900/5 group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-10 -mt-10 blur-2xl opacity-50"></div>
          <div className="relative z-10 flex flex-col justify-between h-full min-h-[140px]">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-indigo-50 rounded-2xl">
                <ArrowUpRight size={24} className="text-indigo-600" />
              </div>
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">صادر</span>
            </div>
            <div>
              <div className="text-5xl font-black text-slate-900 tracking-tight mb-1">{outgoing}</div>
              <div className="text-slate-400 text-xs font-bold">معاملات صادرة</div>
            </div>
          </div>
        </div>

        {/* Urgent Card */}
        <div className="relative overflow-hidden bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-red-900/5 group hover:scale-[1.02] transition-transform duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-10 -mt-10 blur-2xl opacity-50"></div>
          <div className="relative z-10 flex flex-col justify-between h-full min-h-[140px]">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-red-50 rounded-2xl">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <span className="text-[10px] font-black text-red-600 bg-red-50 px-3 py-1 rounded-full">عاجل</span>
            </div>
            <div>
              <div className="text-5xl font-black text-slate-900 tracking-tight mb-1">{urgent}</div>
              <div className="text-slate-400 text-xs font-bold">تتطلب اهتمام</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xl font-black text-slate-900 font-heading">توزيع الحركة</h3>
              <p className="text-xs font-bold text-slate-400 mt-1">مقارنة بين الوارد والصادر</p>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl">
              <Activity size={20} className="text-slate-400" />
            </div>
          </div>
          
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
              <BarChart data={typeData} barSize={80}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 14, fontWeight: "bold" }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1)",
                    fontSize: "14px",
                    fontWeight: "bold",
                    padding: "12px 20px",
                  }}
                />
                <Bar dataKey="value" radius={[16, 16, 16, 16]}>
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
          <h3 className="text-xl font-black mb-8 text-slate-900 font-heading">أولوية المعاملات</h3>
          <div className="flex-1 space-y-8">
            {priorityData.map((p, i) => (
              <div key={i} className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-slate-600">{p.name}</span>
                  <span className="text-2xl font-black text-slate-900">{p.value}</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${i === 1 ? 'bg-red-500' : 'bg-slate-900'}`}
                    style={{ width: `${total ? (p.value / total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-slate-50 flex items-center gap-2 text-slate-400">
            <Clock size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">آخر تحديث: الآن</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-black text-slate-900 font-heading">آخر القيود المسجلة</h3>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">أحدث 5 معاملات</span>
        </div>
        
        <div className="space-y-4">
          {docs.slice(0, 5).map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center justify-between p-5 bg-slate-50 rounded-3xl border border-transparent hover:border-slate-200 hover:bg-white hover:shadow-lg hover:shadow-slate-100 transition-all duration-300 cursor-default"
            >
              <div className="flex items-center gap-5">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                    doc.type === "INCOMING" 
                      ? "bg-blue-100 text-blue-600" 
                      : "bg-indigo-100 text-indigo-600"
                  }`}
                >
                  {doc.type === "INCOMING" ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                </div>
                <div>
                  <div className="text-base font-black text-slate-900 mb-1 group-hover:text-blue-700 transition-colors">{doc.title || doc.subject}</div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
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
              <div className="text-xs font-mono font-black text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-100 group-hover:border-slate-200 group-hover:text-slate-600 transition-colors">
                {doc.barcode}
              </div>
            </div>
          ))}
          {docs.length === 0 && (
            <div className="py-16 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Layers size={24} className="text-slate-300" />
              </div>
              <p className="text-slate-400 font-bold">لا يوجد نشاط مسجل بعد</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center py-6 opacity-40 hover:opacity-100 transition-opacity">
        <img 
          src="/dev.png" 
          alt="Developer" 
          className="h-6 grayscale hover:grayscale-0 transition-all" 
        />
      </div>
    </div>
  )
}
