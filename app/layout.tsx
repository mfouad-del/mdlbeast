import type React from "react"
import type { Metadata } from "next"
import { Tajawal } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
})

export const metadata: Metadata = {
  title: "نظام الأرشفة الموحد - زوايا البناء",
  description: "نظام إدارة المراسلات والأرشفة الرقمية",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },      {
        url: "/favicon.ico",
        type: "image/x-icon",
      },    ],
    apple: "/apple-icon.png",
  },
}

// Use dedicated viewport export for Next.js app router
export const viewport = {
  width: 'device-width',
  initialScale: 1,
}


import { LoadingProvider } from "../components/ui/loading-context"
import SessionExpiredModal from '@/components/SessionExpiredModal'
import SafeAnalytics from '@/components/SafeAnalytics'
import AppVersionAutoReloader from '@/components/AppVersionAutoReloader'
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <head>
        {/* Prevent aggressive caching of the HTML shell so clients revalidate frequently */}
        <meta httpEquiv="Cache-control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        {/* Inline, tiny version-checker: runs before any main bundle to force-reload clients if server reports a new version. Keeps logic minimal to avoid depending on app bundles. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var prev=null;try{prev=localStorage.getItem('app_version')}catch(e){}fetch('/api/version?_t='+Date.now(),{cache:'no-store',credentials:'same-origin'}).then(function(r){return r.text()}).then(function(t){try{var v=JSON.parse(t);var s=(v.version||'')+'@'+(v.commit||'');if(prev!==s){try{localStorage.setItem('app_version',s)}catch(e){}var u=new URL(window.location.href);u.searchParams.set('_t',Date.now());window.location.replace(u.toString())}}catch(e){/* ignore non-json */}}).catch(function(){})}catch(e){}})();` }} />
      </head>
      <body className={`${tajawal.className} antialiased`}>
        <LoadingProvider>
          {children}
        </LoadingProvider>
        <SessionExpiredModal />
        <script dangerouslySetInnerHTML={{__html: `if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'development') { console.log = function(){}; }`}} />
        {/* Safe analytics loader: loads analytics dynamically in client and fails quietly if unsupported */}
        <SafeAnalytics />
        {/* Auto-reloader: silently force-refresh clients when a new server version is detected (no banner/dialog) */}
        <AppVersionAutoReloader />
      </body>
    </html>
  )
}
