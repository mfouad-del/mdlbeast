'use client'

import { useI18n } from '@/lib/i18n-context'
import { Globe } from 'lucide-react'

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()

  return (
    <button
      onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
      title={locale === 'en' ? 'Switch to Arabic' : 'التحويل للإنجليزية'}
    >
      <Globe size={18} />
      <span className="font-bold text-sm">
        {locale === 'en' ? 'عربي' : 'English'}
      </span>
    </button>
  )
}
