import '../styles/globals.css'
import InstallPWA from '../components/InstallPWA'
import ServiceWorkerRegister from '../components/ServiceWorkerRegister'
import Providers from './providers'

export const metadata = {
  title: 'MDLBEAST Communications Center',
  description: 'مركز الإتصالات الإدارية - MDLBEAST',
  manifest: '/mdlbeast/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <ServiceWorkerRegister />
        <InstallPWA />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
