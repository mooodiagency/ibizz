'use client'

import { useState } from 'react'
import { X, Compass, MessageSquare, Newspaper, AlertCircle, CheckSquare, Square, ExternalLink } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { IbizzMark } from '@ibizz/ui'
import type { GeoPrompt, GeoPromptIntent, GeoPromptSource } from '@ibizz/supabase'

type Candidate = { text: string; intent: GeoPromptIntent; topic: string | null; source: GeoPromptSource; ref: string | null }

type Props = {
  projectId: string
  onClose: () => void
  onAdded: (prompts: GeoPrompt[]) => void
}

const INTENT_COLOR: Record<string, string> = {
  informational: 'bg-blue-100 text-blue-700',
  commercial: 'bg-green-100 text-green-700',
  comparison: 'bg-purple-100 text-purple-700',
  transactional: 'bg-amber-100 text-amber-700',
  navigational: 'bg-gray-100 text-gray-600',
}

export default function DiscoverPromptsModal({ projectId, onClose, onAdded }: Props) {
  const [useReddit, setUseReddit] = useState(true)
  const [useNews, setUseNews] = useState(true)
  const [phase, setPhase] = useState<'input' | 'searching' | 'preview'>('input')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  async function search() {
    const sources: GeoPromptSource[] = []
    if (useReddit) sources.push('reddit')
    if (useNews) sources.push('news')
    if (sources.length === 0) return
    setPhase('searching')
    setError(null)
    try {
      const res = await fetch('/api/discover-prompts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sources }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Zoeken mislukt')
      const cands = (data.candidates ?? []) as Candidate[]
      setCandidates(cands)
      setSelected(new Set(cands.map((_, i) => i)))
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zoeken mislukt')
      setPhase('input')
    }
  }

  async function addSelected() {
    const picks = candidates.filter((_, i) => selected.has(i))
    if (picks.length === 0) { onClose(); return }
    setAdding(true)
    try {
      const inserts = picks.map(c => ({
        project_id: projectId, text: c.text, intent: c.intent, topic: c.topic, source: c.source, active: true,
      }))
      const { data, error } = await supabase.from('geo_prompts').insert(inserts).select()
      if (error) throw new Error(error.message)
      onAdded((data ?? []) as GeoPrompt[])
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toevoegen mislukt')
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={(phase === 'searching' || adding) ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass size={16} className="text-[#7c3aed]" />
            <h2 className="text-base font-bold text-gray-900">
              {phase === 'preview' ? `${candidates.length} vragen gevonden` : 'Ontdek vragen uit externe bronnen'}
            </h2>
          </div>
          <button onClick={onClose} disabled={phase === 'searching' || adding} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"><X size={18} /></button>
        </div>

        {phase === 'searching' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#7c3aed12' }}>
              <IbizzMark size={36} animate className="text-[#7c3aed]" />
            </div>
            <p className="text-base font-semibold text-gray-800">Zoeken op Reddit + nieuws…</p>
            <p className="text-sm text-gray-400">Echte vragen + actuele topics worden opgehaald.</p>
          </div>
        )}

        {phase === 'input' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">Haal échte vragen op die mensen stellen, op basis van de topics van dit project.</p>
              <SourceToggle icon={<MessageSquare size={15} />} label="Reddit" sub="Echte vragen uit discussies" active={useReddit} onClick={() => setUseReddit(v => !v)} />
              <SourceToggle icon={<Newspaper size={15} />} label="Nieuws (GDELT)" sub="Actuele topics → vragen via AI" active={useNews} onClick={() => setUseNews(v => !v)} />
              {error && <p className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><AlertCircle size={12} className="flex-shrink-0 mt-0.5" />{error}</p>}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Annuleren</button>
              <button onClick={search} disabled={!useReddit && !useNews}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: '#7c3aed' }}>
                <Compass size={14} /> Zoek vragen
              </button>
            </div>
          </>
        )}

        {phase === 'preview' && (
          <>
            <div className="px-6 py-2 border-b border-gray-100 flex items-center justify-between">
              <button onClick={() => setPhase('input')} className="text-xs font-medium text-gray-500 hover:text-gray-800">← Andere bronnen</button>
              {candidates.length > 0 && (
                <button onClick={() => setSelected(selected.size === candidates.length ? new Set() : new Set(candidates.map((_, i) => i)))}
                  className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-[#7c3aed]">
                  {selected.size === candidates.length ? <CheckSquare size={12} /> : <Square size={12} />}
                  {selected.size === candidates.length ? 'Niets' : 'Alles'} selecteren
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {candidates.length === 0 ? (
                <p className="text-center py-10 text-sm text-gray-500">Geen nieuwe vragen gevonden. Probeer andere topics of bronnen.</p>
              ) : (
                <div className="space-y-1.5">
                  {candidates.map((c, i) => {
                    const sel = selected.has(i)
                    return (
                      <div key={i} onClick={() => setSelected(p => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n })}
                        className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${sel ? 'border-[#7c3aed] bg-violet-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <span className="mt-0.5 flex-shrink-0">{sel ? <CheckSquare size={14} className="text-[#7c3aed]" /> : <Square size={14} className="text-gray-300" />}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800">{c.text}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${INTENT_COLOR[c.intent]}`}>{c.intent}</span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              {c.source === 'reddit' ? <MessageSquare size={9} /> : <Newspaper size={9} />}{c.source}
                            </span>
                            {c.ref && <a href={c.ref} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-gray-400 hover:text-[#7c3aed] inline-flex items-center gap-0.5"><ExternalLink size={9} /> bron</a>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500">{selected.size} geselecteerd</span>
              <div className="flex gap-2">
                <button onClick={onClose} disabled={adding} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">Annuleren</button>
                <button onClick={addSelected} disabled={selected.size === 0 || adding}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: '#7c3aed' }}>
                  {adding ? <IbizzMark size={13} animate /> : null} Toevoegen ({selected.size})
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SourceToggle({ icon, label, sub, active, onClick }: { icon: React.ReactNode; label: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${active ? 'border-[#7c3aed] bg-violet-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
      <span className={active ? 'text-[#7c3aed]' : 'text-gray-400'}>{icon}</span>
      <div className="flex-1">
        <div className="text-sm font-semibold text-gray-800">{label}</div>
        <div className="text-[11px] text-gray-500">{sub}</div>
      </div>
      <span className={`relative w-9 h-5 rounded-full transition-colors ${active ? 'bg-[#7c3aed]' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : ''}`} />
      </span>
    </div>
  )
}
