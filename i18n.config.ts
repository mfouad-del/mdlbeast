/**
 * i18n Configuration
 * English as default, Arabic as secondary
 */

export const i18n = {
  defaultLocale: 'en',
  locales: ['en', 'ar'],
} as const

export type Locale = (typeof i18n)['locales'][number]
