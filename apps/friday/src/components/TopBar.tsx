'use client'

import { useRef, useState, useEffect } from 'react'
import { Bell, Settings, AtSign, FileText } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useNotifications } from '@/lib/notifications/NotificationsContext'
import { format } from 'date-fns'
import { TopBar as SharedTopBar } from '@ibizz/ui'
import type { AppId } from '@ibizz/ui'
import SettingsModal from './SettingsModal'
import NotulenPanel from './NotulenPanel'

const IBIZZ_RED = '#EB4628'

const APP_URLS: Record<AppId, string> = {
  friday: process.env.NEXT_PUBLIC_FRIDAY_URL ?? 'http://localhost:3000',
  notulist: process.env.NEXT_PUBLIC_NOTULIST_URL ?? 'http://localhost:3001',
  brandstudio: process.env.NEXT_PUBLIC_BRANDSTUDIO_URL ?? 'http://localhost:3002',
  'sea-agent': process.env.NEXT_PUBLIC_SEA_AGENT_URL ?? 'http://localhost:3003',
  'seo-agent': process.env.NEXT_PUBLIC_SEO_AGENT_URL ?? 'http://localhost:3005',
  'video-agent': process.env.NEXT_PUBLIC_VIDEO_AGENT_URL ?? 'http://localhost:3006',
  'motion-agent': process.env.NEXT_PUBLIC_MOTION_AGENT_URL ?? 'http://localhost:3007',
}

export default function TopBar() {
  const { profile, signOut } = useAuth()
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const [bellOpen, setBellOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notulenOpen, setNotulenOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleBell() {
    setBellOpen(v => !v)
    if (!bellOpen) markAllRead()
  }

  function highlightMention(content: string, name: string) {
    const parts = content.split(new RegExp(`(@${name})`, 'gi'))
    return parts.map((p, i) =>
      p.toLowerCase() === `@${name.toLowerCase()}`
        ? <span key={i} className="font-semibold rounded px-0.5" style={{ color: IBIZZ_RED }}>@{name}</span>
        : <span key={i}>{p}</span>
    )
  }

  return (
    <>
      <SharedTopBar
        currentApp="friday"
        appUrls={APP_URLS}
        userName={profile?.name}
        userColor={profile?.color}
        availability={profile?.availability as 'available' | 'busy' | 'away' | undefined}
        onSignOut={signOut}
        extras={
          <>
            <button
              onClick={() => setNotulenOpen(true)}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
              title="Notulen"
            >
              <FileText size={16} />
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
              title="Instellingen"
            >
              <Settings size={16} />
            </button>

            <div className="relative" ref={ref}>
              <button
                onClick={toggleBell}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 relative"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: IBIZZ_RED }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-800">Meldingen</span>
                    {notifications.length > 0 && (
                      <span className="text-xs text-gray-400">{notifications.length} mention{notifications.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <AtSign size={24} className="text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Geen meldingen</p>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-gray-700">{n.sender}</span>
                            <span className="text-xs text-gray-400">
                              {format(new Date(n.createdAt), 'HH:mm')}
                            </span>
                            <span className="ml-auto text-xs text-gray-400 truncate max-w-24">{n.lineName}</span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                            {highlightMention(n.message, profile?.name ?? '')}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        }
      />

      {notulenOpen && <NotulenPanel onClose={() => setNotulenOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  )
}
