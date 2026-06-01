'use client'

import { useEffect, useState } from 'react'
import { Plus, Film, Loader2 } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { VideoBrief, Brand } from '@ibizz/supabase'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import NewBriefModal from './NewBriefModal'
import BriefDetail from './BriefDetail'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  in_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  archived: 'bg-gray-50 text-gray-400',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Concept',
  in_review: 'In review',
  approved: 'Goedgekeurd',
  archived: 'Gearchiveerd',
}

export default function BriefsPage() {
  const [briefs, setBriefs] = useState<VideoBrief[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [scriptCounts, setScriptCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from('video_briefs').select('*').order('created_at', { ascending: false }),
      supabase.from('brands').select('*'),
      supabase.from('video_scripts').select('brief_id'),
    ]).then(([bRes, brRes, sRes]) => {
      setBriefs((bRes.data ?? []) as VideoBrief[])
      setBrands((brRes.data ?? []) as Brand[])
      // Tel scripts per brief
      const counts: Record<string, number> = {}
      for (const row of (sRes.data ?? []) as { brief_id: string }[]) {
        counts[row.brief_id] = (counts[row.brief_id] ?? 0) + 1
      }
      setScriptCounts(counts)
      setLoading(false)
    })
  }, [])

  function brandById(id: string | null): Brand | undefined {
    return id ? brands.find(b => b.id === id) : undefined
  }

  const activeBrief = briefs.find(b => b.id === activeId)

  if (activeBrief) {
    return (
      <BriefDetail
        brief={activeBrief}
        brand={brandById(activeBrief.brand_id)}
        onBack={() => setActiveId(null)}
        onUpdated={(updated) => {
          setBriefs(prev => prev.map(b => b.id === updated.id ? updated : b))
        }}
        onDeleted={(id) => {
          setBriefs(prev => prev.filter(b => b.id !== id))
          setScriptCounts(prev => {
            const next = { ...prev }
            delete next[id]
            return next
          })
          setActiveId(null)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Briefs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Per draaidag een shooting brief met N scripts</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#EB4628' }}
        >
          <Plus size={15} />
          Nieuwe brief
        </button>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {loading ? (
          <div className="flex justify-center py-16 text-sm text-gray-400">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : briefs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Film size={26} className="text-gray-300" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">Nog geen briefs</p>
            <p className="text-sm text-gray-400 mb-5">Maak je eerste shooting brief aan om scripts te plannen</p>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: '#EB4628' }}
            >
              <Plus size={14} />
              Nieuwe brief
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {briefs.map(brief => {
              const brand = brandById(brief.brand_id)
              const count = scriptCounts[brief.id] ?? 0
              return (
                <button
                  key={brief.id}
                  onClick={() => setActiveId(brief.id)}
                  className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:shadow-md hover:border-gray-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-sm font-bold text-gray-900 line-clamp-2">{brief.dag_titel}</h3>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_COLORS[brief.status]}`}>
                      {STATUS_LABELS[brief.status]}
                    </span>
                  </div>

                  {brand && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand.color }} />
                      <span className="text-xs text-gray-600">{brand.name}</span>
                      {brief.intro_subtitel && (
                        <span className="text-xs text-gray-400">· {brief.intro_subtitel}</span>
                      )}
                    </div>
                  )}

                  {brief.overzicht && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">{brief.overzicht}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-gray-400 pt-3 border-t border-gray-100">
                    <span>{count} {count === 1 ? 'script' : 'scripts'}</span>
                    <span>· v{brief.versie}</span>
                    <span className="ml-auto">{format(new Date(brief.created_at), 'd MMM yyyy', { locale: nl })}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {creating && (
        <NewBriefModal
          onClose={() => setCreating(false)}
          onCreated={(b) => setBriefs(prev => [b, ...prev])}
        />
      )}
    </div>
  )
}
