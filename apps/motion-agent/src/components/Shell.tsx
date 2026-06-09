'use client'

import { useState } from 'react'
import { TopBar } from '@ibizz/ui'
import type { AppId } from '@ibizz/ui'
import { useAuth } from '@/lib/auth'
import LoginPage from './LoginPage'
import Sidebar from './Sidebar'
import type { SidebarView } from './Sidebar'
import GeneratorPage from './GeneratorPage'
import GalleryPage from './GalleryPage'

const APP_URLS: Record<AppId, string> = {
  friday: process.env.NEXT_PUBLIC_FRIDAY_URL ?? 'http://localhost:3000',
  notulist: process.env.NEXT_PUBLIC_NOTULIST_URL ?? 'http://localhost:3001',
  brandstudio: process.env.NEXT_PUBLIC_BRANDSTUDIO_URL ?? 'http://localhost:3002',
  'sea-agent': process.env.NEXT_PUBLIC_SEA_AGENT_URL ?? 'http://localhost:3003',
  'seo-agent': process.env.NEXT_PUBLIC_SEO_AGENT_URL ?? 'http://localhost:3005',
  'video-agent': process.env.NEXT_PUBLIC_VIDEO_AGENT_URL ?? 'http://localhost:3006',
  'motion-agent': process.env.NEXT_PUBLIC_MOTION_AGENT_URL ?? 'http://localhost:3007',
}

export default function Shell() {
  const { user, userName, loading, signOut } = useAuth()
  const [view, setView] = useState<SidebarView>('generator')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#EB4628] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <LoginPage />

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopBar
        currentApp="motion-agent"
        appUrls={APP_URLS}
        userName={userName}
        userColor="#EB4628"
        onSignOut={signOut}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar view={view} onSelect={setView} />
        <main className="flex-1 overflow-hidden">
          {view === 'generator' ? <GeneratorPage /> : <GalleryPage />}
        </main>
      </div>
    </div>
  )
}
