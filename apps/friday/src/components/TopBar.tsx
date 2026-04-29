'use client'

import { useRef, useState, useEffect } from 'react'
import { Bell, Settings, LogOut, AtSign, FileText } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useNotifications } from '@/lib/notifications/NotificationsContext'
import { format } from 'date-fns'
import SettingsModal from './SettingsModal'
import NotulenPanel from './NotulenPanel'

const IBIZZ_RED = '#EB4628'

export default function TopBar() {
  const { profile, signOut } = useAuth()
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notulenOpen, setNotulenOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const initials = profile?.name
    ? profile.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleBell() {
    setOpen(v => !v)
    if (!open) markAllRead()
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
    <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-end px-6 gap-2 flex-shrink-0">
      <span className="text-sm text-gray-500 mr-1">{profile?.name ?? ''}</span>

      {/* Avatar met status dot */}
      <div className="relative flex-shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: profile?.color ?? '#6366f1' }}
        >
          {initials}
        </div>
        <span
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white"
          style={{ backgroundColor: profile?.availability === 'busy' ? '#f97316' : profile?.availability === 'away' ? '#94a3b8' : '#22c55e' }}
        />
      </div>

      <button
        onClick={() => setNotulenOpen(true)}
        className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
        title="Notulen"
      >
        <FileText size={16} />
      </button>

      {notulenOpen && <NotulenPanel onClose={() => setNotulenOpen(false)} />}

      <button
        onClick={() => setSettingsOpen(true)}
        className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
        title="Instellingen"
      >
        <Settings size={16} />
      </button>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {/* Bell with dropdown */}
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

        {open && (
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

      <button
        onClick={signOut}
        title="Uitloggen"
        className="p-1.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
      >
        <LogOut size={16} />
      </button>
    </div>
  )
}
