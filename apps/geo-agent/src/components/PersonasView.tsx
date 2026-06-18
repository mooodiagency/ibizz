'use client'

import { useEffect, useState } from 'react'
import { Loader2, Users, Sparkles, Trash2, MessageCircleQuestion, AlertCircle, CheckCircle2, MapPin, Wallet, Home, GraduationCap, Briefcase } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { IbizzMark } from '@ibizz/ui'
import type { GeoProject, GeoPersona } from '@ibizz/supabase'

type Props = { project: GeoProject }

export default function PersonasView({ project }: Props) {
  const [personas, setPersonas] = useState<GeoPersona[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [genFor, setGenFor] = useState<string | null>(null)   // persona-id waarvoor vragen worden gegenereerd
  const supabase = createClient()

  useEffect(() => {
    supabase.from('geo_personas').select('*').eq('project_id', project.id).order('created_at')
      .then(({ data }) => { setPersonas((data ?? []) as GeoPersona[]); setLoading(false) })
  }, [project.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function generatePersonas() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-personas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Genereren mislukt')
      setPersonas(prev => [...prev, ...(data.personas as GeoPersona[])])
      setFlash(data.cbsGrounded ? 'Persona\'s gegenereerd (CBS-gegrond)' : 'Persona\'s gegenereerd (CBS niet bereikbaar — op AI-kennis)')
      setTimeout(() => setFlash(null), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Genereren mislukt')
    } finally {
      setGenerating(false)
    }
  }

  async function genQuestions(persona: GeoPersona) {
    setGenFor(persona.id)
    setError(null)
    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, personaId: persona.id, count: 12 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Vragen genereren mislukt')
      setFlash(`${(data.prompts ?? []).length} vragen voor "${persona.name}" toegevoegd — zie tab Vragen`)
      setTimeout(() => setFlash(null), 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vragen genereren mislukt')
    } finally {
      setGenFor(null)
    }
  }

  async function remove(id: string) {
    setPersonas(prev => prev.filter(p => p.id !== id))
    await supabase.from('geo_personas').delete().eq('id', id)
  }

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm text-gray-500 max-w-xl">Persona&apos;s gegrond op Nederlandse demografie (CBS). Genereer per persona de vragen die zíj aan een AI stellen.</p>
        <button onClick={generatePersonas} disabled={generating}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: '#7c3aed' }}>
          {generating ? <IbizzMark size={14} animate /> : <Sparkles size={14} />}
          {generating ? 'CBS + AI bouwen persona\'s…' : personas.length ? 'Meer persona\'s' : 'Genereer persona\'s'}
        </button>
      </div>

      {flash && <p className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3"><CheckCircle2 size={12} />{flash}</p>}
      {error && <p className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3"><AlertCircle size={12} className="flex-shrink-0 mt-0.5" />{error}</p>}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
      ) : personas.length === 0 ? (
        <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center mb-3"><Users size={20} className="text-[#7c3aed]" /></div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Nog geen persona&apos;s</p>
          <p className="text-xs text-gray-500 max-w-md">Laat AI persona&apos;s bouwen op basis van CBS-demografie. Per persona genereer je daarna gerichte vragen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {personas.map(p => (
            <article key={p.id} className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900">{p.name}</h3>
                    <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${p.source === 'cbs' ? 'bg-violet-100 text-[#7c3aed]' : 'bg-gray-100 text-gray-500'}`}>{p.source}</span>
                    {p.share != null && <span className="text-[10px] text-gray-400">~{p.share}%</span>}
                  </div>
                  {p.segment && <p className="text-xs text-gray-500 mt-0.5">{p.segment}</p>}
                </div>
                <button onClick={() => remove(p.id)} className="p-1 rounded text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 size={13} /></button>
              </div>

              {p.demographics && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600 mb-2">
                  {p.demographics.age_range && <span className="inline-flex items-center gap-1"><Users size={10} />{p.demographics.age_range}</span>}
                  {p.demographics.region && <span className="inline-flex items-center gap-1"><MapPin size={10} />{p.demographics.region}</span>}
                  {p.demographics.income && <span className="inline-flex items-center gap-1"><Wallet size={10} />{p.demographics.income}</span>}
                  {p.demographics.household && <span className="inline-flex items-center gap-1"><Home size={10} />{p.demographics.household}</span>}
                  {p.demographics.education && <span className="inline-flex items-center gap-1"><GraduationCap size={10} />{p.demographics.education}</span>}
                  {p.demographics.occupation && <span className="inline-flex items-center gap-1"><Briefcase size={10} />{p.demographics.occupation}</span>}
                </div>
              )}
              {p.situation && <p className="text-xs text-gray-600 leading-relaxed mb-2">{p.situation}</p>}
              {p.motivations.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {p.motivations.map((m, i) => <span key={i} className="text-[10px] bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-gray-600">{m}</span>)}
                </div>
              )}
              {p.how_they_ask && <p className="text-[11px] text-gray-400 italic mb-3">Vraagstijl: {p.how_they_ask}</p>}

              <button onClick={() => genQuestions(p)} disabled={genFor === p.id}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:border-[#7c3aed] hover:text-[#7c3aed] disabled:opacity-60">
                {genFor === p.id ? <IbizzMark size={11} animate className="text-[#7c3aed]" /> : <MessageCircleQuestion size={12} />}
                {genFor === p.id ? 'Vragen genereren…' : 'Genereer vragen voor deze persona'}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
