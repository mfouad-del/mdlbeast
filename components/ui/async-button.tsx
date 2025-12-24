"use client"

import * as React from 'react'
import { Button } from './button'
import { Spinner } from './spinner'

type AsyncButtonProps = React.ComponentProps<typeof Button> & {
  onClickAsync: (...args: any[]) => Promise<any>
}

export default function AsyncButton({ onClickAsync, children, ...props }: AsyncButtonProps) {
  const [loading, setLoading] = React.useState(false)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (loading) return
    try {
      setLoading(true)
      await onClickAsync()
    } catch (err: any) {
      console.error('AsyncButton action failed', err)
      // show minimal feedback; callers may also handle errors
      alert(err?.message || 'فشلت العملية')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button {...props} onClick={handleClick} disabled={loading || props.disabled} aria-busy={loading}>
      {loading ? <Spinner className="mr-2" /> : null}
      {children}
    </Button>
  )
}
