'use client'

import dynamic from 'next/dynamic'
import { AuthProvider, useAuth } from '@/lib/auth'
import LoginPage from '@/components/LoginPage'

const NotulistApp = dynamic(() => import('./NotulistClient'), { ssr: false })

function Gate() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#EB4628] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <LoginPage />
  return <NotulistApp />
}

export default function NotulistPage() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
