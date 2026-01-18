"use client"

import React, { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n-context'

export function SignedPdfPreview({ barcode, fallbackUrl, attachmentIndex = 0 }: { barcode: string; fallbackUrl?: string; attachmentIndex?: number }) {
  const { t } = useI18n()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const get = async () => {
      try {
        const p = await apiClient.getPreviewUrl(barcode, attachmentIndex)
        if (mounted) setUrl(p || (fallbackUrl ? `${fallbackUrl}?t=${Date.now()}` : null))
      } catch (e: any) {
        console.warn('SignedPdfPreview failed to fetch preview url', e)
        if (mounted) setError(String(e?.message || e))
      }
    }
    get()
    return () => { mounted = false }
  }, [barcode, fallbackUrl, attachmentIndex])

  if (error) return <div className="absolute inset-0 flex items-center justify-center text-slate-300"><div className="text-center"><div className="font-black opacity-20 text-2xl">{t('new.key.vpn4ha')}</div><div className="text-xs text-slate-400 mt-2">{error}</div></div></div>
  if (!url) return <div className="absolute inset-0 flex items-center justify-center text-slate-300"><div className="font-black opacity-20 text-2xl">{t('new.key.77ojhp')}</div></div>

  return (
    <iframe src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`} className="w-full h-full border-none" title="PDF Preview" />
  )
}

export default SignedPdfPreview
