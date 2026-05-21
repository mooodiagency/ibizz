import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ibizz — SEA Agent',
  description: 'AI-powered Search Engine Advertising for ibizz',
  icons: { icon: '/logo-icon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
