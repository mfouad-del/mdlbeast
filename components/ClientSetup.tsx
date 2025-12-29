'use client'

import { useEffect } from 'react'

export default function ClientSetup({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      // Mute console methods in production to avoid noisy logs and potential info leaks
      // We keep this minimal and reversible for debugging if needed.
       
      ;(console as any).log = () => {}
      ;(console as any).warn = () => {}
      ;(console as any).error = () => {}
    }
  }, [])

  return <>{children}</>
}
