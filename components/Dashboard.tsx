"use client"

import type { Correspondence } from "@/types"
import { FilePlus, FileMinus, Layers, Calendar, Clock, AlertTriangle } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

interface DashboardProps {
  docs: Correspondence[]
}

export default function Dashboard({ docs }: DashboardProps) {
  const incoming = docs.filter((d) => d.type === "INCOMING").length
  const outgoing = docs.filter((d) => d.type === "OUTGOING").length
  const urgent = docs.filter((d) => d.priority === "عاجله" || d.priority === "عاجل").length
  const total = docs.length

  const typeData = [
    { name: "الوارد", value: incoming, color: "#0f172a" },
    { name: "الصادر", value: outgoing, color: "#3b82f6" },
  ]

  const priorityData = [
    { name: "عاديه", value: docs.filter((d) => d.priority === "عاديه").length },
    { name: "عاجله", value: docs.filter((d) => d.priority === "عاجله").length },
    { name: "عاجل", value: docs.filter((d) => d.priority === "عاجل").length },
  ]

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 font-heading">لوحة البيانات التحليلية</h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">مركز إدارة زوايا البناء</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-black text-slate-900 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm">
            <Calendar size={16} className="text-slate-400" />
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
        <div className="bg-slate-900 p-8 rounded-[2rem] text-white shadow-xl shadow-slate-200 flex flex-col justify-between">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">إجمالي المعاملات</div>
          <div className="flex items-end justify-between">
            <div className="text-5xl font-black leading-none">{total}</div>
            <Layers size={32} className="text-slate-700" />
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">الوارد المسجل</div>
          <div className="flex items-end justify-between">
            <div className="text-5xl font-black text-slate-900 leading-none">{incoming}</div>
            <FilePlus size={32} className="text-blue-100" />
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4">الصادر المسجل</div>
          <div className="flex items-end justify-between">
            <div className="text-5xl font-black text-slate-900 leading-none">{outgoing}</div>
            <FileMinus size={32} className="text-indigo-100" />
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-between border-r-4 border-r-red-500">
          <div className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-4">معاملات عاجلة</div>
          <div className="flex items-end justify-between">
            <div className="text-5xl font-black text-slate-900 leading-none">{urgent}</div>
            <AlertTriangle size={32} className="text-red-100" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
          <h3 className="text-lg font-black mb-10 text-slate-900 font-heading">توزيع الحركة الشهرية</h3>
          <div className="h-64 min-h-[200px] w-full">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={typeData}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: "bold" }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{
                    borderRadius: "16px",
                    border: "none",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                />
                <Bar dataKey="value" radius={[12, 12, 4, 4]} barSize={60}>
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-lg font-black mb-8 text-slate-900 font-heading">أولوية المعاملات</h3>
          <div className="flex-1 space-y-4">
            {priorityData.map((p, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">{p.name}</span>
                  <span className="text-slate-900">{p.value}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-900 transition-all duration-1000"
                    style={{ width: `${total ? (p.value / total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-slate-50 flex items-center gap-2 text-slate-400">
            <Clock size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">محدث الآن</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <h3 className="text-lg font-black mb-6 text-slate-900 font-heading">آخر القيود المسجلة</h3>
        <div className="space-y-3">
          {docs.slice(0, 5).map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all cursor-default"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-2 h-2 rounded-full ${doc.type === "INCOMING" ? "bg-blue-500" : "bg-indigo-500"}`}
                ></div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{doc.title || doc.subject}</div>
                  <div className="text-[10px] font-bold text-slate-400">{doc.sender}</div>
                </div>
              </div>
              <div className="text-xs font-mono font-bold text-slate-400 whitespace-nowrap max-w-[140px] overflow-hidden text-ellipsis">{doc.barcodeId || doc.barcode}</div>
            </div>
          ))}
          {docs.length === 0 && (
            <div className="py-10 text-center text-slate-400 text-sm font-bold italic">لا يوجد نشاط مسجل بعد.</div>
          )}
        </div>
      </div>
    </div>
  )
}
