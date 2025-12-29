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
        {/* Inline, tiny version/checker, probe, defensive polyfills, and an emergency error handler.
            - Polyfills MessageChannel/CustomEvent where they throw
            - Probes /asset-check.js and /api/version, forces cache-busting reload when needed
            - Installs a global error/unhandledrejection handler that logs Illegal constructor errors
              to /api/client-log (via sendBeacon) and attempts a limited cache-busting reload to recover.
        */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{
  // -- defensive polyfills (MessageChannel, CustomEvent)
  try { new MessageChannel(); } catch (e) { (function(){ function Port(){ this.onmessage=null } Port.prototype.postMessage=function(msg){ var self=this; setTimeout(function(){ try{ if(typeof self.onmessage==='function') self.onmessage({data:msg}) }catch(e){} },0) }; window.MessageChannel=function(){ return { port1:new Port(), port2:new Port() } } })(); }
  try { new CustomEvent('__zaco_test',{detail:{}}) } catch(e) { (function(){ function CustomEventPoly(type, params){ params=params||{bubbles:false,cancelable:false,detail:null}; var ev=document.createEvent('CustomEvent'); ev.initCustomEvent(type, params.bubbles, params.cancelable, params.detail); return ev } CustomEventPoly.prototype=(window.Event||function(){}).prototype; window.CustomEvent=CustomEventPoly })(); }

  // -- small helper: report to server without blocking
  function reportClientError(payload){ try{ var b = null; if(navigator && navigator.sendBeacon){ try{ b = navigator.sendBeacon('/api/client-log', JSON.stringify(payload)) }catch(e){} } if(!b){ try{ fetch('/api/client-log', { method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(()=>{}) }catch(e){} } } catch(e){}
  }

  // -- emergency handlers: intercept errors that would crash the app
  (function(){
    var reloadKey = 'app_error_reload_count'
    var maxReloads = 3
    function attemptRecovery(ev, reason){ try{
      var msg = (ev && (ev.error && ev.error.message)) || (ev && ev.message) || (reason && reason.message) || String(reason || '');
      var filename = ev && ev.filename || (reason && reason.filename) || null;
      var important = false;
      if(msg && msg.indexOf('Illegal constructor') !== -1) important = true;
      if(filename && filename.indexOf('cc759f7c2413b7ff.js') !== -1) important = true;
      if(!important) return; // only handle the problematic case

      try{ ev.preventDefault && ev.preventDefault(); ev.stopImmediatePropagation && ev.stopImmediatePropagation(); }catch(e){}

      // send a small log to the server (non-blocking)
      try{ reportClientError({ message: msg, filename: filename, href: location.href, ua: navigator.userAgent, stack: ev && ev.error && ev.error.stack || (reason && reason.stack) || null }) }catch(e){}

      // limit reload loops
      try{
        var count = parseInt(localStorage.getItem(reloadKey) || '0', 10) || 0;
        if(count < maxReloads){ localStorage.setItem(reloadKey, String(count+1)); var u=new URL(window.location.href); u.searchParams.set('_t', Date.now()); setTimeout(function(){ try{ window.location.replace(u.toString()) }catch(e){ try{ window.location.reload() }catch(e){} } }, 800);
        }else{
          // exceeded retries: avoid infinite loop
          console.warn('app: exceeded error reload attempts');
        }
      }catch(e){}
    }catch(e){}
  })();

  window.addEventListener('error', function(ev){ try{ attemptRecovery(ev, null); }catch(e){} }, true);
  window.addEventListener('unhandledrejection', function(ev){ try{ attemptRecovery(null, ev.reason); }catch(e){} }, true);

  // -- standard version & asset probe (unchanged)
  try{
    var now = Date.now(); var prev=null; try{ prev = localStorage.getItem('app_version') }catch(e){}
    fetch('/api/version?_t='+now, { cache: 'no-store', credentials: 'same-origin' }).then(function(r){ return r.text() }).then(function(t){ try{ var v = JSON.parse(t); var s = (v.version||'')+'@'+(v.commit||''); if(prev !== s){ try{ localStorage.setItem('app_version', s) }catch(e){} var u = new URL(window.location.href); u.searchParams.set('_t', Date.now()); window.location.replace(u.toString()); } }catch(e){} }).catch(function(){})
    fetch('/asset-check.js?_t='+now, { cache: 'no-store', credentials: 'same-origin' }).then(function(r){ var ct = (r.headers && r.headers.get && r.headers.get('content-type')) || ''; if(/text\/html/i.test(ct)) throw new Error('asset returned html'); return r.text() }).then(function(body){ if(!body || body.trim().charAt(0)==='<') throw new Error('asset looks like HTML') }).catch(function(){ try{ var u2=new URL(window.location.href); u2.searchParams.set('_t', Date.now()); window.location.replace(u2.toString()); }catch(e){} })
  }catch(e){}

}catch(e){} })();` }} />
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
