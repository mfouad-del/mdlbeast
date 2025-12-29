'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { apiClient } from '@/lib/api-client'
import { useRouter } from 'next/navigation'

export default function SessionExpiredModal() {
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
          <DialogTitle>جلستك انتهت</DialogTitle>
          <DialogDescription>يرجى تسجيل الدخول مرة أخرى لحماية بياناتك.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleLogin}>اذهب لتسجيل الدخول</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
