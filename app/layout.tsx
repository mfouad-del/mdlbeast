import '../styles/globals.css'

export const metadata = {
  title: 'MDLBEAST Communications Center',
  description: 'مركز الإتصالات الإدارية - MDLBEAST',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
