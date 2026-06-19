'use client'

import { useEffect, useState } from 'react'
import { Loader2, Target, AlertCircle, CheckSquare, Square, ChevronDown, ChevronRight, ArrowUpRight, ExternalLink, Radar } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { IbizzMark } from '@ibizz/ui'
import type { GeoProject, GeoRun, GeoResult, GeoPrompt, GeoPromptIntent } from '@ibizz/supabase'

type Props = { project: GeoProject }

const SEO_URL = process.env.NEXT_PUBLIC_SEO_AGENT_URL ?? 'http://localhost:3005'

const INTENT_LABEL: Record<GeoPromptIntent, string> = {
  informational: 'Info', commercial: 'Commercieel', comparison: 'Vergelijking', transactional: 'Transactie', navigational: 'Navigatie',
}
const INTENT_COLOR: Record<GeoPromptIntent, string> = {
  informational: 'bg-blue-100 text-blue-700',
  commercial: 'bg-green-100 text-green-700',
  comparison: 'bg-purple-100 text-purple-700',
  transactional: 'bg-amber-100 text-amber-700',
  navigational: 'bg-gray-100 text-gray-600',
}

type Opp = {
  promptId: string
  question: string
  intent: GeoPromptIntent
  desired_answer: string | null
  mentioned: boolean
  answer_fit: number | null
  competitors: string[]
  sources: string[]
  score: number
}

function scoreOf(r: GeoResult, p: GeoPrompt): number {
  let s = 0
  if (!r.brand_mentioned) s += 60
  else if (r.answer_fit != null && r.answer_fit < 50) s += 30
  else s += 8
  if (p.intent === 'commercial' || p.intent === 'comparison') s += 25
  else if (p.intent === 'transactional') s += 12
  if ((r.competitors ?? []).length) s += 10
  if ((r.cited_sources ?? []).length) s += 5
  if (r.answer_fit != null) s += (100 - r.answer_fit) * 0.15
  return Math.round(s)
}

export default function OpportunitiesView({ project }: Props) {
  const [opps, setOpps] = useState<Opp[]>([])
  const [loading, setLoading] = useState(true)
  const [hasRun, setHasRun] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ briefId: string; created: number; duplicatesSkipped?: number } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    (async () => {
      const runRes = await supabase.from('geo_runs').select('*').eq('project_id', project.id)
        .eq('status', 'done').order('created_at', { ascending: false }).limit(1).maybeSingle()
      const run = runRes.data as GeoRun | null
      if (!run) { setLoading(false); return }
      setHasRun(true)
      const [resultsRes, promptsRes] = await Promise.all([
        supabase.from('geo_results').select('*').eq('run_id', run.id),
        supabase.from('geo_prompts').select('*').eq('project_id', project.id),
      ])
      if (resultsRes.error) console.warn('[opportunities] results laden mislukt:', resultsRes.error.message)
      if (promptsRes.error) console.warn('[opportunities] prompts laden mislukt:', promptsRes.error.message)
      const pMap: Record<string, GeoPrompt> = {}
      for (const p of (promptsRes.data ?? []) as GeoPrompt[]) pMap[p.id] = p
      const list: Opp[] = ((resultsRes.data ?? []) as GeoResult[]).map(r => {
        const p = pMap[r.prompt_id]
        if (!p) return null
        return {
          promptId: p.id, question: p.text, intent: p.intent, desired_answer: p.desired_answer,
          mentioned: r.brand_mentioned, answer_fit: r.answer_fit,
          competitors: r.competitors ?? [], sources: (r.cited_sources ?? []).map(s => s.domain),
          score: scoreOf(r, p),
        }
      }).filter((x): x is Opp => x !== null).sort((a, b) => b.score - a.score)
      setOpps(list)
      // default: selecteer de duidelijke gaps (niet genoemd), top 10
      setSelected(new Set(list.filter(o => !o.mentioned).slice(0, 10).map(o => o.promptId)))
      setLoading(false)
    })()
  }, [project.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function push() {
    const items = opps.filter(o => selected.has(o.promptId)).map(o => ({
      question: o.question, intent: o.intent, desired_answer: o.desired_answer, competitors: o.competitors, sources: o.sources,
    }))
    if (items.length === 0) return
    setPushing(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/push-to-seo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Pushen mislukt')
      setResult({ briefId: data.briefId, created: data.created, duplicatesSkipped: data.duplicatesSkipped })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pushen mislukt')
    } finally {
      setPushing(false)
    }
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-gray-300" /></div>

  if (!hasRun) {
    return (
      <div className="px-8 py-6">
        <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center mx-auto mb-3"><Radar size={20} className="text-[#7c3aed]" /></div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Eerst een simulatie draaien</p>
          <p className="text-xs text-gray-500 max-w-md mx-auto">Kansen worden bepaald op basis van een simulatie-run: vragen waar je merk níet genoemd wordt of het antwoord niet matcht. Draai eerst een simulatie onder &ldquo;Simulaties&rdquo;.</p>
        </div>
      </div>
    )
  }

  const selCount = selected.size

  return (
    <div className="px-8 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500 max-w-xl">Gerangschikt op kans: vragen waar je merk ontbreekt of het antwoord tekortschiet — precies de pagina&apos;s die de SEO-agent moet schrijven om geciteerd te worden.</p>
        <button onClick={push} disabled={selCount === 0 || pushing}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 flex-shrink-0"
          style={{ backgroundColor: '#7c3aed' }}>
          {pushing ? <IbizzMark size={14} animate /> : <ArrowUpRight size={14} />}
          {pushing ? 'Versturen…' : `Stuur ${selCount} naar SEO Agent`}
        </button>
      </div>

      {result && (
        <div className="flex items-center gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
          <CheckSquare size={14} className="flex-shrink-0" />
          <span>
            {result.created} {result.created === 1 ? 'pagina' : 'pagina\'s'} aangemaakt in de SEO-agent
            {result.duplicatesSkipped ? ` (${result.duplicatesSkipped} bestonden al)` : ''}.
          </span>
          <a href={SEO_URL} target="_blank" rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 font-semibold text-[#7c3aed] hover:underline flex-shrink-0">
            Open SEO Agent <ExternalLink size={12} />
          </a>
        </div>
      )}
      {error && <p className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"><AlertCircle size={12} className="flex-shrink-0 mt-0.5" />{error}</p>}

      {opps.length > 0 && (
        <button onClick={() => setSelected(selected.size === opps.length ? new Set() : new Set(opps.map(o => o.promptId)))}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-[#7c3aed]">
          {selected.size === opps.length ? <CheckSquare size={12} /> : <Square size={12} />}
          {selected.size === opps.length ? 'Niets' : 'Alles'} selecteren
        </button>
      )}

      <div className="space-y-1.5">
        {opps.map(o => {
          const sel = selected.has(o.promptId)
          const open = openId === o.promptId
          return (
            <div key={o.promptId} className={`bg-white border rounded-xl ${sel ? 'border-[#7c3aed]' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <button onClick={() => setSelected(p => { const n = new Set(p); if (n.has(o.promptId)) n.delete(o.promptId); else n.add(o.promptId); return n })} className="flex-shrink-0">
                  {sel ? <CheckSquare size={15} className="text-[#7c3aed]" /> : <Square size={15} className="text-gray-300" />}
                </button>
                <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${INTENT_COLOR[o.intent]}`}>{INTENT_LABEL[o.intent]}</span>
                <span className="flex-1 text-sm text-gray-800">{o.question}</span>
                {o.mentioned
                  ? <span className="text-[10px] text-gray-400 flex-shrink-0">genoemd{o.answer_fit != null ? ` · fit ${o.answer_fit}%` : ''}</span>
                  : <span className="text-[10px] font-semibold text-red-500 flex-shrink-0">niet genoemd</span>}
                <span className="text-[10px] font-bold text-[#7c3aed] flex-shrink-0" title="Kans-score">{o.score}</span>
                <button onClick={() => setOpenId(open ? null : o.promptId)} className="p-1 rounded text-gray-400 hover:text-[#7c3aed] flex-shrink-0">
                  {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              </div>
              {open && (
                <div className="px-3 pb-2.5 pl-10 space-y-1.5">
                  {o.desired_answer && <p className="text-[11px] bg-violet-50/50 border border-violet-100 rounded-lg px-2.5 py-2"><span className="font-semibold text-[#7c3aed]">Gezocht antwoord: </span><span className="text-gray-700">{o.desired_answer}</span></p>}
                  {o.competitors.length > 0 && <p className="text-[11px] text-gray-500"><span className="font-semibold">AI noemt nu: </span>{o.competitors.join(', ')}</p>}
                  {o.sources.length > 0 && <p className="text-[11px] text-gray-500"><span className="font-semibold">Geciteerde bronnen: </span>{o.sources.slice(0, 8).join(', ')}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
