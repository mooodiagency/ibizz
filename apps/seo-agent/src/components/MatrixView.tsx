'use client'

import { useEffect, useState, useCallback } from 'react'
import { Network, Loader2, Check, AlertTriangle } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { SeoPersona, SeoTheme, SeoPersonaTheme } from '@ibizz/supabase'

type Props = {
  briefId: string
}

export default function MatrixView({ briefId }: Props) {
  const [personas, setPersonas] = useState<SeoPersona[]>([])
  const [themes, setThemes] = useState<SeoTheme[]>([])
  const [links, setLinks] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const supabase = createClient()

  const reload = useCallback(async () => {
    const [pRes, tRes] = await Promise.all([
      supabase.from('seo_personas').select('*').eq('brief_id', briefId).order('sort_order'),
      supabase.from('seo_themes').select('*').eq('brief_id', briefId).neq('status', 'archived').order('sort_order'),
    ])
    const ps = (pRes.data ?? []) as SeoPersona[]
    const ts = (tRes.data ?? []) as SeoTheme[]
    setPersonas(ps)
    setThemes(ts)

    // Laad alle koppelingen voor deze persona/theme ids
    if (ps.length > 0 && ts.length > 0) {
      const { data: linkData } = await supabase
        .from('seo_persona_themes')
        .select('*')
        .in('persona_id', ps.map(p => p.id))
      const linkSet = new Set<string>()
      for (const l of (linkData ?? []) as SeoPersonaTheme[]) {
        linkSet.add(`${l.persona_id}|${l.theme_id}`)
      }
      setLinks(linkSet)
    } else {
      setLinks(new Set())
    }
    setLoading(false)
  }, [briefId])

  useEffect(() => { reload() }, [reload])

  async function toggle(personaId: string, themeId: string) {
    const key = `${personaId}|${themeId}`
    setPendingKey(key)
    const isLinked = links.has(key)

    // Optimistic update
    const nextSet = new Set(links)
    if (isLinked) nextSet.delete(key)
    else nextSet.add(key)
    setLinks(nextSet)

    if (isLinked) {
      await supabase.from('seo_persona_themes')
        .delete()
        .eq('persona_id', personaId)
        .eq('theme_id', themeId)
    } else {
      await supabase.from('seo_persona_themes').insert({ persona_id: personaId, theme_id: themeId })
    }
    setPendingKey(null)
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
  }

  // Coverage analyse
  const personaCoverage = personas.map(p => ({
    persona: p,
    coverage: themes.filter(t => links.has(`${p.id}|${t.id}`)).length,
  }))
  const themeCoverage = themes.map(t => ({
    theme: t,
    coverage: personas.filter(p => links.has(`${p.id}|${t.id}`)).length,
  }))

  const totalCells = personas.length * themes.length
  const filledCells = links.size
  const fillPct = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Network size={18} style={{ color: '#EB4628' }} />
        <h2 className="text-base font-bold text-gray-900">Persona × Thema matrix</h2>
        <span className="text-xs text-gray-400">· {filledCells}/{totalCells} koppelingen ({fillPct}%)</span>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        Klik een cel om aan te geven dat een thema relevant is voor een persona. Hier zie je direct welke gaten er in je dekking zitten.
      </p>

      {personas.length === 0 || themes.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 mx-auto mb-3 flex items-center justify-center">
            <Network size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {personas.length === 0 && themes.length === 0 ? 'Geen personas en thema\'s' : personas.length === 0 ? 'Geen personas' : 'Geen thema\'s'}
          </p>
          <p className="text-xs text-gray-400">
            Maak eerst {personas.length === 0 ? 'personas' : ''}{personas.length === 0 && themes.length === 0 ? ' en ' : ''}{themes.length === 0 ? 'thema\'s' : ''} aan om de matrix te bouwen.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 min-w-[180px]">
                    Persona ↓ / Thema →
                  </th>
                  {themes.map(t => (
                    <th key={t.id} className="px-3 py-3 text-center text-[10px] font-semibold text-gray-700 min-w-[110px]" title={t.description ?? ''}>
                      <div className="line-clamp-2 leading-tight">{t.name}</div>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400 min-w-[60px]">Dekking</th>
                </tr>
              </thead>
              <tbody>
                {personas.map(p => {
                  const cov = personaCoverage.find(pc => pc.persona.id === p.id)?.coverage ?? 0
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="sticky left-0 bg-white px-4 py-3 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <span className="text-xl flex-shrink-0">{p.avatar_emoji}</span>
                          <span className="text-sm font-semibold text-gray-800 truncate">{p.name}</span>
                        </div>
                      </td>
                      {themes.map(t => {
                        const key = `${p.id}|${t.id}`
                        const linked = links.has(key)
                        const pending = pendingKey === key
                        return (
                          <td key={t.id} className="px-2 py-1 text-center">
                            <button
                              onClick={() => toggle(p.id, t.id)}
                              disabled={pending}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                                linked
                                  ? 'bg-[#EB4628] text-white hover:opacity-90'
                                  : 'bg-gray-100 text-gray-300 hover:bg-gray-200 hover:text-gray-500'
                              }`}
                              title={linked ? 'Klik om los te koppelen' : 'Klik om te koppelen'}
                            >
                              {pending ? <Loader2 size={14} className="animate-spin" /> : linked ? <Check size={14} /> : <span className="text-xs">·</span>}
                            </button>
                          </td>
                        )
                      })}
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs font-bold ${cov === 0 ? 'text-red-500' : cov < 2 ? 'text-amber-500' : 'text-green-600'}`}>
                          {cov}/{themes.length}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="sticky left-0 bg-gray-50 px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Dekking ↑
                  </td>
                  {themes.map(t => {
                    const cov = themeCoverage.find(tc => tc.theme.id === t.id)?.coverage ?? 0
                    return (
                      <td key={t.id} className="px-3 py-3 text-center">
                        <span className={`text-xs font-bold ${cov === 0 ? 'text-red-500' : cov < 2 ? 'text-amber-500' : 'text-green-600'}`}>
                          {cov}/{personas.length}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-3 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suggesties */}
      {personas.length > 0 && themes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
          <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed">
            <strong>Tip:</strong> bekijk welke persona&apos;s of thema&apos;s 0 koppelingen hebben — dat zijn gaten in je content strategie.
            Niet elke combinatie hoeft gevuld te zijn, maar elke persona moet minimaal 2 relevante thema&apos;s hebben.
          </div>
        </div>
      )}
    </div>
  )
}
