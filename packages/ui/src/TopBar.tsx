'use client'

import { LogOut } from 'lucide-react'
import { AppSwitcher } from './AppSwitcher'
import type { AppId } from './AppSwitcher'

type Availability = 'available' | 'busy' | 'away' | undefined

type Props = {
  currentApp: AppId
  appUrls: Record<AppId, string>
  userName?: string
  userColor?: string
  availability?: Availability
  onSignOut?: () => void
  /** App-specific buttons (bell, settings, notulen panel, etc.) */
  extras?: React.ReactNode
  /** Path naar het ibizz logo. Default: /logo-full.svg (moet in app's public/ staan) */
  logoSrc?: string
}

export function TopBar({
  currentApp,
  appUrls,
  userName,
  userColor = '#6366f1',
  availability = 'available',
  onSignOut,
  extras,
  logoSrc = '/logo-full.svg',
}: Props) {
  const initials = userName
    ? userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const dotColor =
    availability === 'busy' ? '#f97316' :
    availability === 'away' ? '#94a3b8' :
    '#22c55e'

  return (
    <div
      className="bg-white border-b border-gray-200 flex items-center flex-shrink-0"
      style={{
        height: '56px',
        paddingLeft: '32px',
        paddingRight: '32px',
        gap: '24px',
      }}
    >
      {/* Logo + app switcher (links) */}
      <div className="flex items-center" style={{ gap: '20px' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="ibizz" width={120} height={22} />
        <span style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb' }} />
        <AppSwitcher current={currentApp} urls={appUrls} />
      </div>

      <div style={{ flex: 1 }} />

      {/* Rechts: extras + avatar + logout */}
      <div className="flex items-center" style={{ gap: '8px' }}>
        {extras}

        <div className="relative flex-shrink-0" style={{ marginLeft: '8px' }}>
          <div
            className="rounded-full flex items-center justify-center text-white font-bold"
            style={{
              backgroundColor: userColor,
              width: '28px',
              height: '28px',
              fontSize: '11px',
            }}
          >
            {initials}
          </div>
          <span
            className="absolute rounded-full"
            style={{
              backgroundColor: dotColor,
              border: '2px solid white',
              width: '10px',
              height: '10px',
              bottom: 0,
              right: 0,
            }}
          />
        </div>

        {onSignOut && (
          <button
            onClick={onSignOut}
            title="Uitloggen"
            className="rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex items-center justify-center"
            style={{ width: '32px', height: '32px' }}
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
