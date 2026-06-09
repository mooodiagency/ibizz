'use client'

import dynamic from 'next/dynamic'
import { AuthProvider } from '@/lib/auth'

const Shell = dynamic(() => import('@/components/Shell'), { ssr: false })

export default function Page() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
