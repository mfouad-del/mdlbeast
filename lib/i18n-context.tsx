'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import type { Locale } from '@/i18n.config'

interface I18nContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, defaultValue?: string) => string
  dir: 'ltr' | 'rtl'
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')
  const [translations, setTranslations] = useState<Record<string, string>>({})

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('locale') as Locale
    if (saved && (saved === 'en' || saved === 'ar')) {
      setLocaleState(saved)
    }
  }, [])

  useEffect(() => {
    // Load translations
    import(`@/locales/${locale}.json`)
      .then((module) => setTranslations(module.default))
      .catch(() => setTranslations({}))
    
    // Update document
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
  }

  const t = (key: string, defaultValue?: string): string => {
    return translations[key] || defaultValue || key
  }

  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
