"use client"

import * as React from 'react'
import { Button } from './button'
import { Spinner } from './spinner'
import { useLoading } from './loading-context'

type AsyncButtonProps = React.ComponentProps<typeof Button> & {
  onClickAsync: (...args: any[]) => Promise<any>
  showOverlay?: boolean
}

export default function AsyncButton({ onClickAsync, children, showOverlay = false, ...props }: AsyncButtonProps) {
  const [loading, setLoading] = React.useState(false)
  let loadingCtx: any = null
  try { loadingCtx = showOverlay ? useLoading() : null } catch (e) { loadingCtx = null }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (loading) return
    try {
      setLoading(true)
      if (showOverlay && loadingCtx) loadingCtx.show()
      await onClickAsync()
    } catch (err: any) {
      console.error('AsyncButton action failed', err)
      // show minimal feedback; callers may also handle errors
      alert(err?.message || 'فشلت العملية')
    } finally {
      setLoading(false)
      if (showOverlay && loadingCtx) loadingCtx.hide()
    }
  }

  return (
    <Button {...props} onClick={handleClick} disabled={loading || props.disabled} aria-busy={loading}>
      {loading ? <Spinner className="mr-2" /> : null}
      {children}
    </Button>
  )
}
