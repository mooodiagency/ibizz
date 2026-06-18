import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ibizz — GEO Agent',
  description: 'AI-zichtbaarheid & citatie-intelligence voor ibizz',
  icons: { icon: '/logo-icon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
