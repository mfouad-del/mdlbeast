'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { apiClient } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { useI18n } from '../lib/i18n-context'

export default function SessionExpiredModal() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const cb = () => setOpen(true)
    apiClient.onSessionExpired(cb)
    return () => {
      // no unsubscribe helper currently—keep simple, will not leak in long-lived SPA
    }
  }, [])

  const handleLogin = () => {
  const { t } = useI18n()
    setOpen(false)
    apiClient.clearToken()
    // After session expiry, redirect user to the public archive root as requested
    // basePath is /archive so use / to redirect to the archive root
    router.push('/')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('new.key.32ekks')}</DialogTitle>
          <DialogDescription>{t('new.key.inpqoy')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleLogin}>{t('new.key.cusxmh')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
