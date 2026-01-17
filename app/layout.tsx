import type React from "react"
import type { Metadata } from "next"
import { Tajawal } from "next/font/google"
import "./globals.css"

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
})

export const metadata: Metadata = {
  title: "MDLBEAST Communications",
  description: "نظام الاتصالات الإدارية - MDLBEAST Entertainment Company",
  generator: "v0.app",
  manifest: "/mdlbeast/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MDLBEAST",
  },
  icons: {
    icon: [
      {
        url: "/mdlbeast/icon-light-32x32.jpg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/mdlbeast/icon-dark-32x32.jpg",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/mdlbeast/icon.jpg",
        type: "image/jpeg",
      },
      {
        url: "/mdlbeast/favicon.jpg",
        type: "image/jpeg",
      },
    ],
    apple: "/mdlbeast/apple-icon.jpg",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="MDLBEAST Communications" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MDLBEAST" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0f172a" />
        <meta name="theme-color" content="#0f172a" />
        <link rel="manifest" href="/mdlbeast/manifest.json" />
        <link rel="apple-touch-icon" href="/mdlbeast/apple-icon.jpg" />
        {/* Prevent aggressive caching of the HTML shell so clients revalidate frequently */}
        <meta httpEquiv="Cache-control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        {/* If MessageChannel constructor is broken (Illegal constructor), force React scheduler to fall back to setTimeout */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
  if (typeof window === 'undefined') return;
  
  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/mdlbeast/sw.js', { scope: '/mdlbeast/' }).then(function(registration) {
        console.log('[PWA] Service Worker registered with scope:', registration.scope);
      }).catch(function(err) {
        console.log('[PWA] Service Worker registration failed:', err);
      });
    });
  }
  
  try {
    // Aggressively disable MessageChannel and BroadcastChannel
    // This forces React to use setTimeout and avoids "Illegal constructor" errors
    
    // 1. Delete properties
    delete window.MessageChannel;
    delete window.BroadcastChannel;
    
    // 2. Explicitly set to undefined (shadowing prototype if necessary)
    window.MessageChannel = undefined;
    window.BroadcastChannel = undefined;
    
    // 3. Try to lock it down
    Object.defineProperty(window, 'MessageChannel', { value: undefined, writable: false, configurable: false });
    Object.defineProperty(window, 'BroadcastChannel', { value: undefined, writable: false, configurable: false });
    
    console.log("MessageChannel/BroadcastChannel disabled.");
  } catch (e) {
    console.error("Failed to disable MessageChannel:", e);
  }
})();`,
          }}
        />
      </head>
      <body className={`${tajawal.className} antialiased`}>
        <ErrorBoundary>
          <LoadingProvider>
            {children}
          </LoadingProvider>
          <SessionExpiredModal />
        </ErrorBoundary>
      </body>
    </html>
  )
}
