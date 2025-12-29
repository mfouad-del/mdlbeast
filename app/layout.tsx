// app/layout.tsx  (أو app/root-layout.tsx)
import type React from "react"
import type { Metadata } from "next"
import { Tajawal } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

// Providers / components
import { LoadingProvider } from "../components/ui/loading-context"
import MobileHeader from "../components/MobileHeader"
// ملاحظة: لم نضع SidebarProvider هنا حتى لا يحجز مساحة على الدسكتوب
// لو حابب تضيفه لاحقًا كـ overlay، أرسللي كود sidebar ونظبطه.

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
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      {/* Note: body نظيف من أي padding عام (نضيف padding فقط على الـ main عند الموبايل) */}
      <body className={`${tajawal.className} antialiased`}>
        {/* ===== MobileHeader: يظهر فقط على الموبايل (md:hidden) ===== */}
        {/* MobileHeader نفسه يحتوي: fixed top-0 h-14 md:hidden */}
        <div className="md:hidden">
          <MobileHeader />
        </div>

        {/* ===== Main app wrapper ===== */}
        {/* نضع الـ main بحيث يحصل offset عند الموبايل فقط (pt-14) لتعويض الـ MobileHeader الثابت */}
        <LoadingProvider>
          <main className="min-h-screen pt-14 md:pt-0">
            {children}
          </main>
        </LoadingProvider>

        <Analytics />
      </body>
    </html>
  )
}
