'use client'

import { useEffect, useState } from 'react'
import { Plus, FileText, Loader2 } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { SeaBrief, Brand } from '@ibizz/supabase'
import { format } from 'date-fns'
import NewBriefModal from './NewBriefModal'
import BriefDetail from './BriefDetail'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  in_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  archived: 'bg-gray-50 text-gray-400',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  archived: 'Archived',
}

export default function BriefsPage() {
  const [briefs, setBriefs] = useState<SeaBrief[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from('sea_briefs').select('*').order('created_at', { ascending: false }),
      supabase.from('brands').select('*'),
    ]).then(([bRes, brRes]) => {
      setBriefs((bRes.data ?? []) as SeaBrief[])
      setBrands((brRes.data ?? []) as Brand[])
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
          <p className="text-sm text-gray-500 mt-0.5">Strategy briefs for your SEA campaigns</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#EB4628' }}
        >
          <Plus size={15} />
          New brief
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
              <FileText size={26} className="text-gray-300" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">No briefs yet</p>
            <p className="text-sm text-gray-400 mb-5">Create your first brief to start a campaign strategy</p>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: '#EB4628' }}
            >
              <Plus size={14} />
              New brief
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {briefs.map(brief => {
              const brand = brandById(brief.brand_id)
              return (
                <button
                  key={brief.id}
                  onClick={() => setActiveId(brief.id)}
                  className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:shadow-md hover:border-gray-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-sm font-bold text-gray-900 line-clamp-2">{brief.title}</h3>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_COLORS[brief.status]}`}>
                      {STATUS_LABELS[brief.status]}
                    </span>
                  </div>

                  {brand && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand.color }} />
                      <span className="text-xs text-gray-600">{brand.name}</span>
                    </div>
                  )}

                  {brief.goal && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">{brief.goal}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-gray-400 pt-3 border-t border-gray-100">
                    {brief.monthly_budget && <span>€{brief.monthly_budget}/mo</span>}
                    {brief.target_cpa && <span>CPA €{brief.target_cpa}</span>}
                    <span className="ml-auto">{format(new Date(brief.created_at), 'd MMM yyyy')}</span>
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
