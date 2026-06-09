'use client'

import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, Check, ExternalLink } from 'lucide-react'

export type AppId = 'friday' | 'notulist' | 'brandstudio' | 'sea-agent' | 'seo-agent' | 'video-agent' | 'motion-agent'

type AppEntry = {
  id: AppId
  name: string
  description: string
  icon: string
  color: string
}

const APPS: AppEntry[] = [
  {
    id: 'friday',
    name: 'Friday',
    description: 'Project management',
    icon: '📋',
    color: '#EB4628',
  },
  {
    id: 'notulist',
    name: 'Notulist',
    description: 'Vergaderingen → notulen',
    icon: '📝',
    color: '#6366f1',
  },
  {
    id: 'brandstudio',
    name: 'Image Generator',
    description: 'Beeldbank + AI generator',
    icon: '🎨',
    color: '#8b5cf6',
  },
  {
    id: 'sea-agent',
    name: 'SEA Agent',
    description: 'AI search engine advertising',
    icon: '🎯',
    color: '#22c55e',
  },
  {
    id: 'seo-agent',
    name: 'SEO Agent',
    description: 'Persona-gedreven content SEO',
    icon: '🔍',
    color: '#0ea5e9',
  },
  {
    id: 'video-agent',
    name: 'Video Agent',
    description: 'Reels & TikTok shooting briefs',
    icon: '🎬',
    color: '#f43f5e',
  },
  {
    id: 'motion-agent',
    name: 'Motion',
    description: 'Foto → video (AI animatie)',
    icon: '🎞️',
    color: '#06b6d4',
  },
]

type Props = {
  current: AppId
  /** URL per app — voor dev kun je localhost ports geven, in prod de subdomains */
  urls: Record<AppId, string>
}

export function AppSwitcher({ current, urls }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentApp = APPS.find(a => a.id === current)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        style={{ gap: '8px', padding: '6px 10px' }}
        title="Wissel app"
      >
        <LayoutGrid size={15} />
        {currentApp && (
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{currentApp.name}</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 overflow-hidden">
          <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            ibizz apps
          </p>
          {APPS.map(app => {
            const isCurrent = app.id === current
            return (
              <a
                key={app.id}
                href={urls[app.id]}
                onClick={() => setOpen(false)}
                className={`flex items-start gap-3 px-3 py-2.5 transition-colors ${
                  isCurrent ? 'bg-gray-50' : 'hover:bg-gray-50'
                }`}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: `${app.color}15` }}
                >
                  {app.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-gray-900">{app.name}</span>
                    {isCurrent && <Check size={12} style={{ color: app.color }} />}
                    {!isCurrent && <ExternalLink size={11} className="text-gray-300" />}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{app.description}</p>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
