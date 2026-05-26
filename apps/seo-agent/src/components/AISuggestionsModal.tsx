'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X, Loader2, Check, AlertCircle, Users, Tags, Save } from 'lucide-react'
import { IbizzMark } from '@ibizz/ui'
import { createClient } from '@ibizz/supabase'
import type { SeoSearchIntent } from '@ibizz/supabase'

type PersonaSuggestion = {
  name: string
  avatar_emoji: string
  one_liner: string
  demographics: {
    age_range?: string
    occupation?: string
    location?: string
    family?: string
    income?: string
  }
  pains: string[]
  motivations: string[]
  search_behavior: string[]
  channels: string[]
}

type ThemeSuggestion = {
  name: string
  description: string
  search_intent: SeoSearchIntent
}

type Props = {
  briefId: string
  onClose: () => void
  onSaved: () => void
}

export default function AISuggestionsModal({ briefId, onClose, onSaved }: Props) {
  const [phase, setPhase] = useState<'loading' | 'review' | 'saving' | 'done' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [personas, setPersonas] = useState<PersonaSuggestion[]>([])
  const [themes, setThemes] = useState<ThemeSuggestion[]>([])
  const [selectedPersonas, setSelectedPersonas] = useState<Set<number>>(new Set())
  const [selectedThemes, setSelectedThemes] = useState<Set<number>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    async function run() {
      try {
        const res = await fetch('/api/suggest-personas-themes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ briefId }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'AI request mislukt')
        const ps = (json.personas ?? []) as PersonaSuggestion[]
        const ts = (json.themes ?? []) as ThemeSuggestion[]
        setPersonas(ps)
        setThemes(ts)
        // Alles default geselecteerd
        setSelectedPersonas(new Set(ps.map((_, i) => i)))
        setSelectedThemes(new Set(ts.map((_, i) => i)))
        setPhase('review')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Onbekende fout')
        setPhase('error')
      }
    }
    run()
  }, [briefId])

  async function saveSelection() {
    setPhase('saving')

    const personasToSave = personas.filter((_, i) => selectedPersonas.has(i))
    const themesToSave = themes.filter((_, i) => selectedThemes.has(i))

    // Get bestaande sort orders
    const [{ count: personaCount }, { count: themeCount }] = await Promise.all([
      supabase.from('seo_personas').select('id', { count: 'exact', head: true }).eq('brief_id', briefId),
      supabase.from('seo_themes').select('id', { count: 'exact', head: true }).eq('brief_id', briefId),
    ])

    if (personasToSave.length > 0) {
      await supabase.from('seo_personas').insert(
        personasToSave.map((p, i) => ({
          brief_id: briefId,
          name: p.name,
          avatar_emoji: p.avatar_emoji || '👤',
          one_liner: p.one_liner,
          demographics: p.demographics,
          pains: p.pains,
          motivations: p.motivations,
          search_behavior: p.search_behavior,
          channels: p.channels,
          sort_order: (personaCount ?? 0) + i,
        }))
      )
    }

    if (themesToSave.length > 0) {
      await supabase.from('seo_themes').insert(
        themesToSave.map((t, i) => ({
          brief_id: briefId,
          name: t.name,
          description: t.description,
          search_intent: t.search_intent,
          status: 'active' as const,
          sort_order: (themeCount ?? 0) + i,
        }))
      )
    }

    setPhase('done')
    setTimeout(() => {
      onSaved()
      onClose()
    }, 800)
  }

  function togglePersona(i: number) {
    setSelectedPersonas(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }
  function toggleTheme(i: number) {
    setSelectedThemes(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="h-1.5" style={{ backgroundColor: '#EB4628' }} />

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} style={{ color: '#EB4628' }} />
            <h2 className="text-base font-bold text-gray-900">AI suggesties — Personas + Thema&apos;s</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <IbizzMark size={32} animate className="text-[#EB4628]" />
              <p className="text-sm font-semibold text-gray-700">AI analyseert je klant website…</p>
              <p className="text-xs text-gray-400">Dit duurt 20-40 seconden</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold mb-1">Suggesties genereren mislukt</p>
                <p className="text-xs">{error}</p>
                <p className="text-xs mt-2 text-red-600/70">Controleer of de klant website in de brief is ingevuld.</p>
              </div>
            </div>
          )}

          {(phase === 'review' || phase === 'saving' || phase === 'done') && (
            <div className="space-y-6">
              {/* Personas section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-gray-400" />
                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                      Personas ({selectedPersonas.size}/{personas.length} geselecteerd)
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedPersonas(new Set(personas.map((_, i) => i)))} className="text-[10px] text-gray-500 hover:text-gray-800">Alles</button>
                    <button onClick={() => setSelectedPersonas(new Set())} className="text-[10px] text-gray-500 hover:text-gray-800">Niets</button>
                  </div>
                </div>
                <div className="space-y-2">
                  {personas.map((p, i) => {
                    const selected = selectedPersonas.has(i)
                    return (
                      <button
                        key={i}
                        onClick={() => togglePersona(i)}
                        className={`w-full text-left bg-white border-2 rounded-xl p-4 transition-all ${
                          selected ? 'border-[#EB4628] bg-orange-50/30' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-3xl flex-shrink-0">{p.avatar_emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-bold text-gray-900">{p.name}</h4>
                              {selected && <Check size={13} style={{ color: '#EB4628' }} />}
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed mb-2">{p.one_liner}</p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                              {p.pains.length > 0 && (
                                <div>
                                  <p className="font-semibold text-red-700 text-[10px] uppercase tracking-wide">Pijnpunten</p>
                                  <p className="text-gray-600 leading-snug">{p.pains.slice(0, 2).join(' · ')}{p.pains.length > 2 && ` +${p.pains.length - 2}`}</p>
                                </div>
                              )}
                              {p.search_behavior.length > 0 && (
                                <div>
                                  <p className="font-semibold text-blue-700 text-[10px] uppercase tracking-wide">Zoekt</p>
                                  <p className="text-gray-600 leading-snug italic">{p.search_behavior.slice(0, 2).join(' · ')}{p.search_behavior.length > 2 && ` +${p.search_behavior.length - 2}`}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Themes section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Tags size={14} className="text-gray-400" />
                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                      Thema&apos;s ({selectedThemes.size}/{themes.length} geselecteerd)
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedThemes(new Set(themes.map((_, i) => i)))} className="text-[10px] text-gray-500 hover:text-gray-800">Alles</button>
                    <button onClick={() => setSelectedThemes(new Set())} className="text-[10px] text-gray-500 hover:text-gray-800">Niets</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {themes.map((t, i) => {
                    const selected = selectedThemes.has(i)
                    return (
                      <button
                        key={i}
                        onClick={() => toggleTheme(i)}
                        className={`text-left bg-white border-2 rounded-xl p-3 transition-all ${
                          selected ? 'border-[#EB4628] bg-orange-50/30' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <h4 className="text-sm font-bold text-gray-900 flex-1">{t.name}</h4>
                          {selected && <Check size={13} style={{ color: '#EB4628' }} className="flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mb-2">{t.description}</p>
                        <span className="inline-block text-[9px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                          {t.search_intent}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(phase === 'review' || phase === 'saving' || phase === 'done') && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {phase === 'done' ? '✓ Opgeslagen' : `${selectedPersonas.size} personas + ${selectedThemes.size} thema's worden toegevoegd`}
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Annuleren
              </button>
              <button
                onClick={saveSelection}
                disabled={phase !== 'review' || (selectedPersonas.size === 0 && selectedThemes.size === 0)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#EB4628' }}
              >
                {phase === 'saving' ? <Loader2 size={13} className="animate-spin" /> : phase === 'done' ? <Check size={13} /> : <Save size={13} />}
                {phase === 'saving' ? 'Opslaan…' : phase === 'done' ? 'Opgeslagen' : 'Selectie toevoegen'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
