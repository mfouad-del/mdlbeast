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
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ServiceWorkerRegister />
        <Providers>
          <InstallPWA />
          {children}
        </Providers>
      </body>
    </html>
  )
}
