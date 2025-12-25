"use client"

import * as React from 'react'
import { Spinner } from './spinner'

type LoadingContextValue = {
  show: () => void
  hide: () => void
  isLoading: boolean
}

const LoadingContext = React.createContext<LoadingContextValue | null>(null)

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = React.useState(0)
  const show = React.useCallback(() => setCount((c) => c + 1), [])
  const hide = React.useCallback(() => setCount((c) => Math.max(0, c - 1)), [])
  const value = React.useMemo(() => ({ show, hide, isLoading: count > 0 }), [show, hide, count])

  return (
    <LoadingContext.Provider value={value}>
      {children}
      <LoadingOverlay isLoading={count > 0} />
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const ctx = React.useContext(LoadingContext)
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider')
  return ctx
}

function LoadingOverlay({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white/95 px-8 py-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-xs">
        <Spinner className="h-10 w-10 text-slate-800" />
        <div className="text-slate-900 font-extrabold text-lg">جاري التحميل</div>
        <div className="text-slate-500 text-sm">يرجى الانتظار قليلاً، قد تستغرق بعض العمليات وقتًا</div>
      </div>
    </div>
  )
}
