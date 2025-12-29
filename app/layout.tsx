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
import Script from 'next/script'
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
        {/* Early polyfill for MessageChannel and CustomEvent placed before interactive scripts via Next's Script with strategy "beforeInteractive" */}
        <Script id="early-polyfills" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `(function(){try{try{new MessageChannel()}catch(e){(function(){function Port(){this.onmessage=null}Port.prototype.postMessage=function(m){var s=this;setTimeout(function(){try{if(typeof s.onmessage==='function')s.onmessage({data:m})}catch(e){}},0)};window.MessageChannel=function(){return{port1:new Port(),port2:new Port()}}})()}catch(e){}try{new CustomEvent('__zaco_test',{detail:{}})}catch(e){(function(){function CustomEventPoly(t,p){p=p||{bubbles:false,cancelable:false,detail:null};var ev=document.createEvent('CustomEvent');ev.initCustomEvent(t,p.bubbles,p.cancelable,p.detail);return ev}CustomEventPoly.prototype=(window.Event||function(){}).prototype;window.CustomEvent=CustomEventPoly})()} }catch(e){} })();` }} />
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
