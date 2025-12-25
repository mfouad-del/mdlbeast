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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white/90 px-8 py-6 rounded-2xl shadow-lg flex items-center gap-4">
        <Spinner className="h-6 w-6 text-slate-700" />
        <div className="text-slate-900 font-bold">جاري تحميل البيانات...</div>
      </div>
    </div>
  )
}
