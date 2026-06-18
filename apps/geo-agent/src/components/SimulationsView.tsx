'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Radar, Loader2, AlertCircle, Check, X as XIcon, TrendingUp, Quote, Users, Smile, Meh, Frown, ChevronDown, ChevronRight,
} from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { IbizzMark } from '@ibizz/ui'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import type { GeoProject, GeoRun, GeoResult, GeoPrompt } from '@ibizz/supabase'
import RunTrend from './RunTrend'

type Props = { project: GeoProject }

export default function SimulationsView({ project }: Props) {
  const [runs, setRuns] = useState<GeoRun[]>([])
  const [promptMap, setPromptMap] = useState<Record<string, GeoPrompt>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [results, setResults] = useState<GeoResult[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingResults, setLoadingResults] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const loadRuns = useCallback(() => {
    Promise.all([
      supabase.from('geo_runs').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
      supabase.from('geo_prompts').select('*').eq('project_id', project.id),
    ]).then(([rRes, pRes]) => {
      const rs = (rRes.data ?? []) as GeoRun[]
      setRuns(rs)
      const map: Record<string, GeoPrompt> = {}
      for (const p of (pRes.data ?? []) as GeoPrompt[]) map[p.id] = p
      setPromptMap(map)
      if (!selectedId && rs.length) setSelectedId(rs[0].id)
      setLoading(false)
    })
  }, [project.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadRuns() }, [loadRuns])

  useEffect(() => {
    if (!selectedId) { setResults([]); return }
    setLoadingResults(true)
    supabase.from('geo_results').select('*').eq('run_id', selectedId).order('created_at')
      .then(({ data }) => { setResults((data ?? []) as GeoResult[]); setLoadingResults(false) })
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function run() {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/run-simulation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Simulatie mislukt')
      const newRun = data.run as GeoRun
      setRuns(prev => [newRun, ...prev])
      setSelectedId(newRun.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulatie mislukt')
    } finally {
      setRunning(false)
    }
  }

  const selected = runs.find(r => r.id === selectedId) ?? null

  return (
    <div className="px-8 py-6 space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500 max-w-xl">
          Stel de actieve vragen écht aan Claude (met web search) en meet of je merk genoemd wordt, welke concurrenten en bronnen worden geciteerd.
        </p>
        <button onClick={run} disabled={running}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 flex-shrink-0"
          style={{ backgroundColor: '#7c3aed' }}>
          {running ? <IbizzMark size={14} animate /> : <Radar size={14} />}
          {running ? 'Simuleren…' : 'Run simulatie'}
        </button>
      </div>

      {running && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <IbizzMark size={11} animate className="text-[#7c3aed]" />
          Vragen worden aan Claude gesteld + antwoorden geanalyseerd. Dit duurt 1-3 minuten — niet wegklikken.
        </p>
      )}
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />{error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
      ) : runs.length === 0 ? (
        <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center mx-auto mb-3">
            <Radar size={20} className="text-[#7c3aed]" />
          </div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Nog geen simulatie gedraaid</p>
          <p className="text-xs text-gray-500 max-w-md mx-auto">Klik op &ldquo;Run simulatie&rdquo; om je AI-zichtbaarheid te meten op de actieve vragen.</p>
        </div>
      ) : (
        <>
          {/* Trend over tijd */}
          <RunTrend runs={runs.filter(r => r.status === 'done' && r.summary).slice().reverse()} />

          {/* Run-selector */}
          <div className="flex gap-2 flex-wrap">
            {runs.map(r => (
              <button key={r.id} onClick={() => setSelectedId(r.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-colors ${
                  r.id === selectedId ? 'border-[#7c3aed] bg-violet-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <span className="font-semibold text-gray-700">{format(new Date(r.created_at), 'd MMM HH:mm', { locale: nl })}</span>
                {r.status === 'done' && r.summary && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-[#7c3aed]">SoV {r.summary.sov}%</span>
                )}
                {r.status === 'running' && <Loader2 size={11} className="animate-spin text-gray-400" />}
                {r.status === 'failed' && <span className="text-[10px] text-red-500">mislukt</span>}
              </button>
            ))}
          </div>

          {selected?.summary && <Scorecard run={selected} />}

          {/* Resultaten-tabel */}
          {loadingResults ? (
            <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-gray-300" /></div>
          ) : results.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 text-xs font-semibold text-gray-600">Per vraag ({results.length})</div>
              <div className="divide-y divide-gray-50">
                {results.map(r => <ResultRow key={r.id} result={r} prompt={promptMap[r.prompt_id]} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Scorecard({ run }: { run: GeoRun }) {
  const s = run.summary!
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* SoV */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"><TrendingUp size={12} /> Share of Voice</div>
        <div className="text-4xl font-bold" style={{ color: '#7c3aed' }}>{s.sov}%</div>
        <p className="text-xs text-gray-500 mt-1">Genoemd in {s.brandMentions} van {s.totalPrompts} antwoorden</p>
        <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${s.sov}%`, backgroundColor: '#7c3aed' }} />
        </div>
        {s.avgAnswerFit != null && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Antwoord-fit</span>
              <span className="font-bold" style={{ color: '#7c3aed' }}>{s.avgAnswerFit}%</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">Matcht het AI-antwoord wat de doelgroep zoekt</p>
            <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full bg-violet-300" style={{ width: `${s.avgAnswerFit}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Sentiment */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3"><Smile size={12} /> Sentiment</div>
        <div className="space-y-2">
          <SentimentBar icon={<Smile size={12} className="text-green-600" />} label="Positief" count={s.sentiment.positive} total={s.brandMentions} color="#22c55e" />
          <SentimentBar icon={<Meh size={12} className="text-gray-500" />} label="Neutraal" count={s.sentiment.neutral} total={s.brandMentions} color="#9ca3af" />
          <SentimentBar icon={<Frown size={12} className="text-red-500" />} label="Negatief" count={s.sentiment.negative} total={s.brandMentions} color="#ef4444" />
        </div>
      </div>

      {/* Top concurrenten */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3"><Users size={12} /> Top concurrenten</div>
        {s.topCompetitors.length === 0 ? <p className="text-xs text-gray-400">Geen concurrenten gevonden</p> : (
          <div className="space-y-1.5">
            {s.topCompetitors.slice(0, 6).map(c => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 truncate">{c.name}</span>
                <span className="text-gray-400 font-mono">{c.count}×</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top bronnen — volle breedte */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 md:col-span-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3"><Quote size={12} /> Meest geciteerde bronnen (waar AI z'n antwoord vandaan haalt)</div>
        {s.topSources.length === 0 ? <p className="text-xs text-gray-400">Geen bronnen geregistreerd (web search gaf niets terug)</p> : (
          <div className="flex flex-wrap gap-2">
            {s.topSources.map(src => (
              <span key={src.domain} className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-xs">
                <span className="font-medium text-gray-700">{src.domain}</span>
                <span className="text-[10px] text-gray-400 font-mono">{src.count}×</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SentimentBar({ icon, label, count, total, color }: { icon: React.ReactNode; label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-[11px] text-gray-600 w-16">{icon}{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] text-gray-400 font-mono w-5 text-right">{count}</span>
    </div>
  )
}

function ResultRow({ result, prompt }: { result: GeoResult; prompt?: GeoPrompt }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
        {open ? <ChevronDown size={13} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={13} className="text-gray-400 flex-shrink-0" />}
        <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${result.brand_mentioned ? 'bg-green-100' : 'bg-gray-100'}`}>
          {result.brand_mentioned ? <Check size={11} className="text-green-700" /> : <XIcon size={11} className="text-gray-400" />}
        </span>
        <span className="flex-1 text-sm text-gray-800 truncate">{prompt?.text ?? '(vraag)'}</span>
        {result.brand_position != null && <span className="text-[10px] text-gray-400 flex-shrink-0">#{result.brand_position}</span>}
        {result.answer_fit != null && <span className="text-[10px] font-semibold text-[#7c3aed] flex-shrink-0">fit {result.answer_fit}%</span>}
        {result.competitors.length > 0 && <span className="text-[10px] text-gray-400 flex-shrink-0">{result.competitors.length} concurr.</span>}
        {result.cited_sources.length > 0 && <span className="text-[10px] text-gray-400 flex-shrink-0">{result.cited_sources.length} bronnen</span>}
      </button>
      {open && (
        <div className="px-12 pb-3 space-y-2">
          {prompt?.desired_answer && (
            <div className="text-[11px] bg-violet-50/50 border border-violet-100 rounded-lg px-2.5 py-2">
              <span className="font-semibold text-[#7c3aed]">Gezocht antwoord: </span>
              <span className="text-gray-600">{prompt.desired_answer}</span>
              {result.answer_fit != null && <span className="ml-1 text-[#7c3aed] font-semibold">· fit {result.answer_fit}%</span>}
            </div>
          )}
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Echt AI-antwoord</p>
          <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">{result.answer}</p>
          {result.competitors.length > 0 && (
            <div className="text-[11px] text-gray-500"><span className="font-semibold">Concurrenten:</span> {result.competitors.join(', ')}</div>
          )}
          {result.cited_sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.cited_sources.map((s, i) => (
                <a key={i} href={s.url ?? '#'} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 hover:border-[#7c3aed] hover:text-[#7c3aed]">
                  {s.domain}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
