'use client'

import { useMemo, useState } from 'react'
import {
  X, Search, AlertCircle, ExternalLink, Hash, AtSign, Eye, Heart,
  MessageCircle, CheckCircle2, Square, CheckSquare, ArrowLeft,
} from 'lucide-react'
import { IbizzMark } from '@ibizz/ui'
import type { VideoResearch } from '@ibizz/supabase'
import type { DiscoveryItem } from '@/lib/research-scraper'

type Props = {
  briefId: string
  onClose: () => void
  onAdded: (items: VideoResearch[]) => void
}

type Phase = 'input' | 'searching' | 'preview'

type DiscoverResponse = {
  items: DiscoveryItem[]
  summary: { query: string; found: number }[]
  duckduckgoOk: boolean
  tookMs?: number
  warning?: string
  error?: string
}

export default function DiscoverResearchModal({ briefId, onClose, onAdded }: Props) {
  const [phase, setPhase] = useState<Phase>('input')
  const [queries, setQueries] = useState<string[]>([])
  const [queryInput, setQueryInput] = useState('')
  const [perQuery, setPerQuery] = useState(8)
  const [items, setItems] = useState<DiscoveryItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [summary, setSummary] = useState<{ query: string; found: number }[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function addQuery(raw: string) {
    const q = raw.trim()
    if (!q) return
    setQueries(prev => prev.includes(q) ? prev : [...prev, q])
    setQueryInput('')
  }

  async function startSearch() {
    if (queries.length === 0) return
    setPhase('searching')
    setError(null)
    setWarning(null)
    try {
      const res = await fetch('/api/research-discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, queries, perQuery }),
      })
      const data = await res.json() as DiscoverResponse
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setItems(data.items ?? [])
      setSummary(data.summary ?? [])
      setWarning(data.warning ?? null)
      // Selecteer standaard alles wat nog niet was toegevoegd
      const next = new Set<string>()
      for (const it of data.items ?? []) if (!it.alreadyAdded) next.add(it.url)
      setSelected(next)
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zoeken mislukt')
      setPhase('input')
    }
  }

  async function confirmAdd() {
    const toAdd = items.filter(it => selected.has(it.url) && !it.alreadyAdded)
    if (toAdd.length === 0) {
      onClose()
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/research-confirm-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, items: toAdd }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      onAdded((data.research ?? []) as VideoResearch[])
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toevoegen mislukt')
      setSaving(false)
    }
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(items.filter(it => !it.alreadyAdded).map(it => it.url)))
    } else {
      setSelected(new Set())
    }
  }

  const selectableCount = useMemo(() => items.filter(it => !it.alreadyAdded).length, [items])
  const selectedCount = selected.size

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(saving || phase === 'searching') ? undefined : onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-[#EB4628]" />
            <h2 className="text-base font-bold text-gray-900">
              {phase === 'preview' ? `${items.length} TikToks gevonden` : 'Zoek succesvolle TikToks'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={saving || phase === 'searching'}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"
          >
            <X size={18} />
          </button>
        </div>

        {/* PHASE: SEARCHING */}
        {phase === 'searching' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EB462812' }}>
              <IbizzMark size={36} animate className="text-[#EB4628]" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800 mb-1">
                Zoeken via DuckDuckGo voor {queries.length} {queries.length === 1 ? 'term' : 'termen'}…
              </p>
              <p className="text-sm text-gray-400">
                Per gevonden video proberen we caption + stats op te halen. 30-60 sec.
              </p>
            </div>
          </div>
        )}

        {/* PHASE: INPUT */}
        {phase === 'input' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Geef <span className="font-semibold">hashtags</span>, <span className="font-semibold">accountnamen</span> of{' '}
                <span className="font-semibold">trefwoorden</span> waarvoor we naar succesvolle
                TikToks moeten zoeken. We gebruiken DuckDuckGo ({' '}
                <code className="bg-gray-100 text-[11px] px-1 py-0.5 rounded">site:tiktok.com</code>{' '}
                ) — geen anti-bot drama. Daarna zie je een preview voor je iets toevoegt.
              </p>

              <Field label="Zoektermen">
                <div className="border border-gray-200 rounded-xl px-2.5 py-2 focus-within:border-[#EB4628] bg-white">
                  <div className="flex flex-wrap gap-1.5">
                    {queries.map(q => (
                      <span key={q} className="inline-flex items-center gap-1 bg-orange-50 text-[#EB4628] border border-orange-200 rounded-lg px-2 py-0.5 text-xs font-semibold">
                        {q.startsWith('#') && <Hash size={9} />}
                        {q.startsWith('@') && <AtSign size={9} />}
                        {q.replace(/^[#@]/, '')}
                        <button
                          onClick={() => setQueries(queries.filter(x => x !== q))}
                          className="text-orange-400 hover:text-orange-700 ml-0.5"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    <input
                      autoFocus
                      value={queryInput}
                      onChange={e => setQueryInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault()
                          addQuery(queryInput)
                        } else if (e.key === 'Backspace' && !queryInput && queries.length) {
                          setQueries(queries.slice(0, -1))
                        }
                      }}
                      onBlur={() => addQuery(queryInput)}
                      placeholder={queries.length === 0 ? '#frenky, reistas review, @nasdaily — druk op Enter na elk' : ''}
                      className="flex-1 min-w-[180px] outline-none text-sm bg-transparent"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Enter of komma scheidt zoektermen. Voorbeelden:{' '}
                  <code>#reizen</code>, <code>handbagage hack</code>, <code>@nasdaily</code>
                </p>
              </Field>

              <Field label="Aantal videos per zoekterm">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={perQuery}
                  onChange={e => setPerQuery(Math.max(1, Math.min(20, parseInt(e.target.value || '8', 10))))}
                  className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628] text-center"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  1-20 per term. Met 3 termen × 8 = ~24 videos. Hoger = meer wachten.
                </p>
              </Field>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-[11px] text-gray-600 leading-relaxed">
                <p className="font-semibold text-gray-700 mb-1">Hoe het werkt</p>
                <ol className="space-y-0.5 ml-1 list-decimal list-inside">
                  <li>Voor elke zoekterm vragen we DuckDuckGo: <code className="text-[10px]">site:tiktok.com {'<term>'}</code></li>
                  <li>We pakken de gevonden TikTok URLs</li>
                  <li>Per video: TikTok oEmbed voor caption + thumbnail (altijd ok)</li>
                  <li>Per video: best-effort stats parse (views/likes — kan falen)</li>
                  <li>Sortering: meeste views eerst</li>
                  <li>Jij selecteert in de preview welke we opslaan</li>
                </ol>
              </div>

              {error && (
                <p className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                  {error}
                </p>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Annuleren
              </button>
              <button
                onClick={startSearch}
                disabled={queries.length === 0}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#EB4628' }}
              >
                <Search size={14} />
                Start zoeken
              </button>
            </div>
          </>
        )}

        {/* PHASE: PREVIEW */}
        {phase === 'preview' && (
          <>
            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setPhase('input')}
                className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
              >
                <ArrowLeft size={12} />
                Andere zoektermen
              </button>
              <div className="flex gap-1.5 flex-wrap">
                {summary.map(s => (
                  <span key={s.query} className="text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                    {s.query}: {s.found}
                  </span>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {selectableCount > 0 && (
                  <button
                    onClick={() => toggleAll(selectedCount !== selectableCount)}
                    className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-[#EB4628]"
                  >
                    {selectedCount === selectableCount ? <CheckSquare size={12} /> : <Square size={12} />}
                    {selectedCount === selectableCount ? 'Niets selecteren' : 'Alles selecteren'}
                  </button>
                )}
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {warning && (
                <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                  {warning}
                </p>
              )}

              {items.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-500">
                  Geen TikToks gevonden. Probeer specifiekere of brede termen.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map(item => {
                    const isSelected = selected.has(item.url)
                    const isDisabled = item.alreadyAdded
                    return (
                      <PreviewCard
                        key={item.url}
                        item={item}
                        selected={isSelected}
                        disabled={isDisabled}
                        onToggle={() => {
                          if (isDisabled) return
                          setSelected(prev => {
                            const next = new Set(prev)
                            if (next.has(item.url)) next.delete(item.url)
                            else next.add(item.url)
                            return next
                          })
                        }}
                      />
                    )
                  })}
                </div>
              )}

              {error && (
                <p className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
                  <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">
                {selectedCount} van {selectableCount} {selectableCount === 1 ? 'video' : 'videos'} geselecteerd
              </span>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                >
                  Annuleren
                </button>
                <button
                  onClick={confirmAdd}
                  disabled={selectedCount === 0 || saving}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: '#EB4628' }}
                >
                  {saving ? <IbizzMark size={11} animate /> : <CheckCircle2 size={14} />}
                  {saving ? 'Opslaan…' : `Toevoegen (${selectedCount})`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  )
}

function fmt(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function PreviewCard({
  item, selected, disabled, onToggle,
}: {
  item: DiscoveryItem
  selected: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <div
      onClick={onToggle}
      className={`relative border rounded-2xl overflow-hidden bg-white cursor-pointer transition-all ${
        disabled
          ? 'opacity-50 border-gray-200 cursor-not-allowed'
          : selected
            ? 'border-[#EB4628] shadow-sm'
            : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Top: thumbnail + checkbox + open link */}
      <div className="relative">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            alt=""
            className="w-full h-40 object-cover bg-gray-100"
          />
        ) : (
          <div className="w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400 text-xs">
            (geen thumbnail)
          </div>
        )}

        {/* Checkbox top-left */}
        <div className="absolute top-2 left-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white shadow ${
            selected ? 'bg-[#EB4628]' : 'bg-black/40 backdrop-blur-sm'
          }`}>
            {selected ? <CheckSquare size={12} /> : <Square size={12} />}
          </span>
        </div>

        {/* Open link top-right */}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5"
          title="Open TikTok in nieuw tabblad"
        >
          <ExternalLink size={11} />
        </a>

        {/* Already-added badge */}
        {item.alreadyAdded && (
          <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-lg text-center">
            Al toegevoegd
          </div>
        )}

        {/* Source query badge */}
        {!item.alreadyAdded && (
          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
            {item.sourceQuery.length > 18 ? item.sourceQuery.slice(0, 16) + '…' : item.sourceQuery}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-1.5">
        {item.caption ? (
          <p className="text-xs text-gray-800 line-clamp-2 leading-relaxed">{item.caption}</p>
        ) : (
          <p className="text-xs text-gray-400 italic">Geen caption opgehaald</p>
        )}

        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-0.5"><Eye size={10} />{fmt(item.views)}</span>
          <span className="inline-flex items-center gap-0.5"><Heart size={10} />{fmt(item.likes)}</span>
          <span className="inline-flex items-center gap-0.5"><MessageCircle size={10} />{fmt(item.comments)}</span>
          {item.author && (
            <span className="ml-auto text-gray-400 truncate">@{item.author}</span>
          )}
        </div>
      </div>
    </div>
  )
}
