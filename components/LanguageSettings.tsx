"use client"
import React, { useState, useEffect } from 'react'
import { Globe, Check } from 'lucide-react'
import { getCurrentLanguage, setCurrentLanguage, Language, t } from '@/lib/translations'
import { useI18n } from '../lib/i18n-context'

export default function LanguageSettings() {
  const [selectedLang, setSelectedLang] = useState<Language>('en')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSelectedLang(getCurrentLanguage())
  }, [])

  const handleLanguageChange = (lang: Language) => {
  const { t } = useI18n()
    setSelectedLang(lang)
    setCurrentLanguage(lang)
    setSaved(true)
    
    // Reload page to apply language change
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  const isRTL = selectedLang === 'ar'

  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-3 mb-6">
        <Globe className="text-blue-600" size={28} />
        <div>
          <h3 className="text-xl font-black text-slate-900">{t('languageSettings', selectedLang)}</h3>
          <p className="text-sm text-slate-500 mt-1">{t('selectLanguage', selectedLang)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* English Option */}
        <button
          onClick={() => handleLanguageChange('en')}
          className={`p-6 rounded-2xl border-2 transition-all ${
            selectedLang === 'en'
              ? 'border-blue-600 bg-blue-50 shadow-lg scale-105'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-4xl">🇬🇧</span>
            {selectedLang === 'en' && (
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <Check size={16} />
              </div>
            )}
          </div>
          <div className="text-left">
            <div className="text-lg font-black text-slate-900">English</div>
            <div className="text-xs text-slate-500 mt-1">Primary Language</div>
          </div>
        </button>

        {/* Arabic Option */}
        <button
          onClick={() => handleLanguageChange('ar')}
          className={`p-6 rounded-2xl border-2 transition-all ${
            selectedLang === 'ar'
              ? 'border-blue-600 bg-blue-50 shadow-lg scale-105'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-4xl">🇸🇦</span>
            {selectedLang === 'ar' && (
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <Check size={16} />
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-lg font-black text-slate-900">{t('new.key.mopwuy' as any)}</div>
            <div className="text-xs text-slate-500 mt-1">{t('new.key.56lbpw' as any)}</div>
          </div>
        </button>
      </div>

      {saved && (
        <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-700 animate-in fade-in slide-in-from-top-2 duration-300">
          <Check size={20} className="shrink-0" />
          <span className="font-bold">{t('languageSaved', selectedLang)}</span>
        </div>
      )}

      <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-start gap-3 text-sm text-slate-600">
          <Globe size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-2">{selectedLang === 'ar' ? 'ملاحظة:' : 'Note:'}</p>
            <p>
              {selectedLang === 'ar' 
                ? t('new.key.vnf8el' as any)
                : 'The selected language will be applied to all interface elements and the page will reload automatically.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
