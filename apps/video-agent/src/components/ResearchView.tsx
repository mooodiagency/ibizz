'use client'

import { useEffect, useState } from 'react'
import { Loader2, Search, Link as LinkIcon, ExternalLink, Trash2, Music, Eye, Heart, MessageCircle, Sparkles } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { VideoResearch, VideoResearchPlatform } from '@ibizz/supabase'
import AddResearchModal from './AddResearchModal'
import DiscoverResearchModal from './DiscoverResearchModal'

type Props = {
  briefId: string
}

const PLATFORM_LABEL: Record<VideoResearchPlatform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube_shorts: 'YouTube Shorts',
  other: 'Other',
}

const PLATFORM_COLOR: Record<VideoResearchPlatform, string> = {
  tiktok: 'bg-black text-white',
  instagram: 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white',
  youtube_shorts: 'bg-red-600 text-white',
  other: 'bg-gray-200 text-gray-700',
}

export default function ResearchView({ briefId }: Props) {
  const [items, setItems] = useState<VideoResearch[]>([])
  const [loading, setLoading] = useState(true)
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const [urlOpen, setUrlOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('video_research')
      .select('*')
      .eq('brief_id', briefId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems((data ?? []) as VideoResearch[])
        setLoading(false)
      })
  }, [briefId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAdded(newItems: VideoResearch[]) {
    setItems(prev => [...newItems, ...prev])
  }

  async function updateItem(id: string, patch: Partial<Pick<VideoResearch, 'hook_pattern' | 'notes'>>) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
    await supabase.from('video_research').update(patch).eq('id', id)
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('video_research').delete().eq('id', id)
  }

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
  }

  return (
    <>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-6 flex flex-col items-center text-center">
            <p className="text-sm font-semibold text-gray-800 mb-1">Nog geen research</p>
            <p className="text-xs text-gray-500 mb-4 max-w-md leading-relaxed">
              Geef de AI hashtags of trefwoorden, dan zoekt hij online naar succesvolle TikToks.
              Jij verifieert in de preview wat we toevoegen.
            </p>
            <ActionButtons
              onDiscover={() => setDiscoverOpen(true)}
              onUrl={() => setUrlOpen(true)}
            />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs text-gray-500">
                {items.length} {items.length === 1 ? 'referentie' : 'referenties'}
              </div>
              <ActionButtons
                onDiscover={() => setDiscoverOpen(true)}
                onUrl={() => setUrlOpen(true)}
                compact
              />
            </div>

            <div className="space-y-2">
              {items.map(item => (
                <ResearchCard
                  key={item.id}
                  item={item}
                  onUpdate={(patch) => updateItem(item.id, patch)}
                  onDelete={() => deleteItem(item.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {discoverOpen && (
        <DiscoverResearchModal
          briefId={briefId}
          onClose={() => setDiscoverOpen(false)}
          onAdded={handleAdded}
        />
      )}

      {urlOpen && (
        <AddResearchModal
          briefId={briefId}
          initialMode="url"
          onClose={() => setUrlOpen(false)}
          onAdded={handleAdded}
        />
      )}
    </>
  )
}

function ActionButtons({
  onDiscover, onUrl, compact = false,
}: {
  onDiscover: () => void
  onUrl: () => void
  compact?: boolean
}) {
  const primaryCls = compact
    ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90'
    : 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90'
  const secondaryCls = compact
    ? 'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-200 hover:border-[#EB4628] hover:text-[#EB4628] transition-colors'
    : 'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 hover:border-[#EB4628] hover:text-[#EB4628] transition-colors bg-white'
  return (
    <div className="flex gap-2">
      <button
        onClick={onDiscover}
        className={primaryCls}
        style={{ backgroundColor: '#EB4628' }}
      >
        <Search size={compact ? 12 : 14} />
        Zoek videos
      </button>
      <button onClick={onUrl} className={secondaryCls}>
        <LinkIcon size={compact ? 11 : 12} />
        Plak URL
      </button>
    </div>
  )
}

function ResearchCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: VideoResearch
  onUpdate: (patch: Partial<Pick<VideoResearch, 'hook_pattern' | 'notes'>>) => void
  onDelete: () => void
}) {
  const [hookLocal, setHookLocal] = useState(item.hook_pattern ?? '')
  const [notesLocal, setNotesLocal] = useState(item.notes ?? '')

  useEffect(() => { setHookLocal(item.hook_pattern ?? '') }, [item.hook_pattern])
  useEffect(() => { setNotesLocal(item.notes ?? '') }, [item.notes])

  function fmt(n: number | null): string {
    if (n == null) return ''
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  return (
    <article className="bg-white border border-gray-200 rounded-xl p-3 flex gap-3">
      {/* Platform badge + link */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
        <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${PLATFORM_COLOR[item.platform]}`}>
          {PLATFORM_LABEL[item.platform]}
        </span>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg text-gray-400 hover:text-[#EB4628] hover:bg-orange-50"
          title="Open video in nieuw tabblad"
        >
          <ExternalLink size={12} />
        </a>
        {item.source === 'scraped' && (
          <span className="text-[9px] text-gray-400" title="Automatisch via scraper">auto</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {item.caption && (
          <p className="text-xs text-gray-800 line-clamp-2 leading-relaxed">{item.caption}</p>
        )}
        {!item.caption && (
          <p className="text-xs text-gray-400 italic">Geen caption opgehaald — open de link voor details</p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          {item.views != null && (
            <span className="inline-flex items-center gap-0.5"><Eye size={10} />{fmt(item.views)}</span>
          )}
          {item.likes != null && (
            <span className="inline-flex items-center gap-0.5"><Heart size={10} />{fmt(item.likes)}</span>
          )}
          {item.comments != null && (
            <span className="inline-flex items-center gap-0.5"><MessageCircle size={10} />{fmt(item.comments)}</span>
          )}
          {item.added_by_name && (
            <span className="ml-auto italic text-gray-400">{item.added_by_name}</span>
          )}
        </div>

        {/* Editable hook + notes */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5 flex items-center gap-1">
              <Music size={9} />
              Hook-pattern
            </label>
            <input
              value={hookLocal}
              onChange={e => setHookLocal(e.target.value)}
              onBlur={() => { if (hookLocal !== (item.hook_pattern ?? '')) onUpdate({ hook_pattern: hookLocal.trim() || null }) }}
              placeholder="POV / vergelijking / look-around / before-after…"
              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-[#EB4628]"
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5 flex items-center gap-1">
              <Sparkles size={9} />
              Notities
            </label>
            <input
              value={notesLocal}
              onChange={e => setNotesLocal(e.target.value)}
              onBlur={() => { if (notesLocal !== (item.notes ?? '')) onUpdate({ notes: notesLocal.trim() || null }) }}
              placeholder="Wat kunnen we lenen?"
              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-[#EB4628]"
            />
          </div>
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="flex-shrink-0 self-start p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50"
        title="Verwijderen"
      >
        <Trash2 size={12} />
      </button>
    </article>
  )
}
