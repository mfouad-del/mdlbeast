'use client'

import React, { ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

interface Props {
  children: ReactNode
}

interface InnerProps extends Props {
  t: (key: string) => string
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundaryInner extends React.Component<InnerProps, State> {
  constructor(props: InnerProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    const { t } = this.props
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-orange-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 shadow-lg p-8">
            <div className="flex justify-center mb-6">
              <div className="bg-red-100 p-4 rounded-full">
                <AlertCircle className="text-red-600" size={32} />
              </div>
            </div>
            <h1 className="text-2xl font-black text-slate-900 text-center mb-3">{t('new.key.xdxafp')}</h1>
            <p className="text-slate-600 text-center mb-6 text-sm leading-relaxed">{t('new.key.1zr2fe')}</p>
            {this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-xs text-red-700 font-mono overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.resetError}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw size={16} />{t('new.key.7jlidb')}</button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default function ErrorBoundary(props: Props) {
  const { t } = useI18n()
  return <ErrorBoundaryInner {...props} t={t} />
}
