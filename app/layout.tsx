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
import ErrorBoundary from '@/components/ErrorBoundary'
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
        <Script id="early-polyfills" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `(function(){try{try{new MessageChannel()}catch(e){(function(){function Port(){this.onmessage=null;}Port.prototype.postMessage=function(m){var s=this;setTimeout(function(){try{if(typeof s.onmessage==='function')s.onmessage({data:m})}catch(e){}},0)};window.MessageChannel=function(){return{port1:new Port(),port2:new Port()}}})()}catch(e){}try{new CustomEvent('__zaco_test',{detail:{}})}catch(e){(function(){function CustomEventPoly(t,p){p=p||{bubbles:false,cancelable:false,detail:null};var ev=document.createEvent('CustomEvent');ev.initCustomEvent(t,p.bubbles,p.cancelable,p.detail);return ev}CustomEventPoly.prototype=(window.Event||function(){}).prototype;window.CustomEvent=CustomEventPoly})();} }catch(e){} })();` }} />
        {/* Asset probe: ensure small static JS file is served as JS, otherwise force cache-busting replace */}
        <Script id="asset-probe" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: `(function(){try{var now=Date.now();fetch('/asset-check.js?_t='+now,{cache:'no-store',credentials:'same-origin'}).then(function(r){var ct=(r.headers&&r.headers.get&&r.headers.get('content-type'))||'';if(/text\/html/i.test(ct))throw new Error('asset returned html');return r.text()}).then(function(body){if(!body||String(body).trim().charAt(0)==='<')throw new Error('asset looks like HTML')}).catch(function(){try{var u=new URL(window.location.href);u.searchParams.set('_t',Date.now());window.location.replace(u.toString())}catch(e){}})}catch(e){}

// Capture runtime script/parse errors and report asset content back to server for debugging
window.addEventListener('error', function(ev){try{var src = ev && ev.filename ? ev.filename : (ev && ev.target && ev.target.src ? ev.target.src : null); if(!src) return; if(/\.js(\?|$)/i.test(src)){ try{ fetch(src + (src.indexOf('?')>-1?'&_probe=':'?_probe=') + Date.now(), {cache:'no-store', credentials:'same-origin'}).then(function(r){ return r.text().then(function(t){ fetch('/api/admin/report-asset', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: src, status: r.status, contentType: r.headers && r.headers.get && r.headers.get('content-type'), snippet: (t||'').slice(0,1024) })}) }) }).catch(function(){}) }catch(e){}}}catch(e){}})

window.addEventListener('unhandledrejection', function(ev){try{ var r = ev && ev.reason ? ev.reason : null; var maybe = null; if (r && typeof r === 'object' && r.stack) { var m = String(r.stack).match(/(https?:\/\/[^\s)]+\.js(?:\?[^\s)]*)?)/i); if (m) maybe = m[1]; }
if (!maybe && r && typeof r === 'string') { var m2 = String(r).match(/([0-9a-f]{6,}\.js)/i); if (m2) maybe = m2[1]; }
if (!maybe) return; var src = maybe; try{ fetch(src + (src.indexOf('?')>-1?'&_probe=':'?_probe=') + Date.now(), {cache:'no-store', credentials:'same-origin'}).then(function(r){ return r.text().then(function(t){ fetch('/api/admin/report-asset', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: src, status: r.status, contentType: r.headers && r.headers.get && r.headers.get('content-type'), snippet: (t||'').slice(0,1024) })}) }) }).catch(function(){}) }catch(e){} });` }} />
      </head>
      <body className={`${tajawal.className} antialiased`}>
        <ErrorBoundary>
          <LoadingProvider>
            {children}
          </LoadingProvider>
          <SessionExpiredModal />
        </ErrorBoundary>
        <script dangerouslySetInnerHTML={{__html: `if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'development') { console.log = function(){}; }`}} />
        <Analytics />
      </body>
    </html>
  )
}
