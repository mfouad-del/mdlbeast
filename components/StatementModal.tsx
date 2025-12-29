"use client"

import React from 'react'

export default function StatementModal({ open, onClose, statement }: { open: boolean; onClose: () => void; statement: string }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 z-10 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-black">عرض الملخص</h3>
          <button onClick={onClose} className="text-slate-400">إغلاق</button>
        </div>
        <div className="max-h-[60vh] overflow-auto text-slate-800 leading-relaxed whitespace-pre-wrap">
          {statement ? statement : <div className="text-slate-400">لا يوجد بيان لعرضه.</div>}
        </div>
      </div>
    </div>
  )
}
