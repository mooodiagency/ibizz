'use client'

import { useEffect, useState } from 'react'
import { Loader2, History, ChevronDown, ChevronRight, User } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import type { VideoBriefChange } from '@ibizz/supabase'

type VersionRow = {
  id: string
  brief_id: string
  versie: number
  changelog: VideoBriefChange[]
  created_at: string
  created_by: string | null
  created_by_name: string | null
}

type Props = {
  briefId: string
  refreshKey: number   // wordt door BriefDetail gebumpt na een save
}

export default function VersionsView({ briefId, refreshKey }: Props) {
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/list-versions?briefId=${briefId}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setVersions((data.versions ?? []) as VersionRow[])
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [briefId, refreshKey])

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
  }

  if (versions.length === 0) {
    return (
      <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-6 flex flex-col items-center text-center">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-2">
          <History size={16} className="text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-700 mb-1">Nog geen versies</p>
        <p className="text-xs text-gray-500 max-w-md leading-relaxed">
          Klik op <span className="font-semibold text-[#EB4628]">Save versie</span> bovenaan om de
          huidige staat vast te leggen als v1. Bij volgende saves genereert AI automatisch een
          changelog van wat er veranderd is.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {versions.map(v => {
        const isExpanded = expanded.has(v.id)
        const visibleChanges = isExpanded ? v.changelog : v.changelog.slice(0, 2)
        const hiddenCount = v.changelog.length - visibleChanges.length

        return (
          <article key={v.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => toggle(v.id)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0">
                {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
              </div>
              <span className="flex-shrink-0 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-gray-900 text-white">
                v{v.versie}
              </span>
              <div className="flex-1 flex items-center gap-3 text-xs text-gray-500">
                <span>{format(new Date(v.created_at), "d MMM yyyy 'om' HH:mm", { locale: nl })}</span>
                {v.created_by_name && (
                  <span className="inline-flex items-center gap-1 text-gray-400">
                    <User size={10} />
                    {v.created_by_name}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium text-gray-400 flex-shrink-0">
                {v.changelog.length === 0
                  ? 'geen wijzigingen'
                  : `${v.changelog.length} ${v.changelog.length === 1 ? 'wijziging' : 'wijzigingen'}`}
              </span>
            </button>

            {v.changelog.length > 0 && (
              <div className="px-4 pb-3 pl-12 space-y-1">
                {visibleChanges.map((c, i) => (
                  <ChangelogLine key={i} change={c} />
                ))}
                {!isExpanded && hiddenCount > 0 && (
                  <button
                    onClick={() => toggle(v.id)}
                    className="text-[11px] font-medium text-[#EB4628] hover:underline"
                  >
                    + {hiddenCount} {hiddenCount === 1 ? 'meer wijziging' : 'meer wijzigingen'}
                  </button>
                )}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function ChangelogLine({ change }: { change: VideoBriefChange }) {
  return (
    <div className="text-xs text-gray-700 leading-relaxed">
      {change.script_nummer != null && (
        <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-1 py-0.5 rounded bg-orange-100 text-orange-700 mr-1.5">
          Script {change.script_nummer}
        </span>
      )}
      <span>{change.tekst}</span>
      {change.veld && (
        <span className="ml-1.5 text-[10px] text-gray-400 italic">({change.veld})</span>
      )}
    </div>
  )
}
