"use client"
import React, { useEffect, useState } from 'react'

export default function SafeAnalytics() {
  const [AnalyticsComp, setAnalyticsComp] = useState<any | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const mod = await import('@vercel/analytics/next')
        if (mounted && mod && mod.Analytics) setAnalyticsComp(() => mod.Analytics)
      } catch (e) {
        // fail quietly; analytics is non-critical
        console.warn('SafeAnalytics: failed to load analytics', e)
      }
    })()
    return () => { mounted = false }
  }, [])

  if (!AnalyticsComp) return null
  const C = AnalyticsComp
  return <C />
}
