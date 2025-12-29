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
import ClientAppVersionWatcher from '@/components/ClientAppVersionWatcher'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <head>
        {/* 
          MessageChannel and CustomEvent polyfills
          Must run SYNCHRONOUSLY and IMMEDIATELY to prevent "Illegal constructor" errors
          This is a raw HTML script tag, not a React component
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function polyfillWebAPIs(){
                'use strict';
                if(typeof window==='undefined')return;
                
                // Store native MessageChannel if it exists
                var NativeMessageChannel = window.MessageChannel;
                
                // MessageChannel polyfill for browsers that don't support it properly
                if(typeof MessageChannel==='undefined' || !NativeMessageChannel || typeof NativeMessageChannel !== 'function'){
                  function Port(){
                    this.onmessage=null;
                    this.start=function(){};
                    this.close=function(){};
                  }
                  Port.prototype.postMessage=function(msg){
                    var self=this;
                    setTimeout(function(){
                      try{if(typeof self.onmessage==='function')self.onmessage({data:msg});}catch(e){}
                    },0);
                  };
                  try{
                    window.MessageChannel=function(){
                      if(!(this instanceof window.MessageChannel)){
                        return new window.MessageChannel();
                      }
                      this.port1=new Port();
                      this.port2=new Port();
                    };
                  }catch(e){}
                }
                
                // CustomEvent polyfill for older browsers
                if(typeof window.CustomEvent!=='function'){
                  try{
                    function CustomEventPoly(type,params){
                      params=params||{bubbles:false,cancelable:false,detail:undefined};
                      var evt=document.createEvent('CustomEvent');
                      evt.initCustomEvent(type,params.bubbles,params.cancelable,params.detail);
                      return evt;
                    }
                    CustomEventPoly.prototype=window.Event.prototype;
                    window.CustomEvent=CustomEventPoly;
                  }catch(e){}
                }
              })();
            `
          }}
        />
        {/* Prevent aggressive caching of the HTML shell so clients revalidate frequently */}
        <meta httpEquiv="Cache-control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className={`${tajawal.className} antialiased`}>
        <LoadingProvider>
          {children}
        </LoadingProvider>
        <SessionExpiredModal />
        <script dangerouslySetInnerHTML={{__html: `if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'development') { console.log = function(){}; }`}} />
        <Analytics />
        {/* Version watcher runs in client to detect new deployments */}
        <ClientAppVersionWatcher />
      </body>
    </html>
  )
}
