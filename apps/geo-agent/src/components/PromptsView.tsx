'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles, Plus, Trash2, MessageCircleQuestion, AlertCircle, Compass, ChevronDown, ChevronRight, Target } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { Select, IbizzMark } from '@ibizz/ui'
import type { GeoProject, GeoPrompt, GeoPromptIntent } from '@ibizz/supabase'
import DiscoverPromptsModal from './DiscoverPromptsModal'

type Props = { project: GeoProject }

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
const INTENTS: GeoPromptIntent[] = ['informational', 'commercial', 'comparison', 'transactional', 'navigational']

export default function PromptsView({ project }: Props) {
  const [prompts, setPrompts] = useState<GeoPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [newText, setNewText] = useState('')
  const [newIntent, setNewIntent] = useState<GeoPromptIntent>('commercial')
  const [discovering, setDiscovering] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('geo_prompts').select('*').eq('project_id', project.id).order('created_at', { ascending: true })
      .then(({ data }) => { setPrompts((data ?? []) as GeoPrompt[]); setLoading(false) })
  }, [project.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generatie mislukt')
      setPrompts(prev => [...prev, ...(data.prompts as GeoPrompt[])])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generatie mislukt')
    } finally {
      setGenerating(false)
    }
  }

  async function addManual() {
    if (!newText.trim()) return
    const { data } = await supabase.from('geo_prompts').insert({
      project_id: project.id, text: newText.trim(), intent: newIntent, source: 'manual', active: true,
    }).select().single()
    if (data) { setPrompts(prev => [...prev, data as GeoPrompt]); setNewText('') }
  }
  async function toggleActive(p: GeoPrompt) {
    setPrompts(prev => prev.map(x => x.id === p.id ? { ...x, active: !x.active } : x))
    await supabase.from('geo_prompts').update({ active: !p.active }).eq('id', p.id)
  }
  async function remove(id: string) {
    setPrompts(prev => prev.filter(x => x.id !== id))
    await supabase.from('geo_prompts').delete().eq('id', id)
  }

  const filtered = filter === 'all' ? prompts : prompts.filter(p => p.intent === filter)
  const activeCount = prompts.filter(p => p.active).length

  return (
    <div className="px-8 py-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={filter} onChange={setFilter} compact className="w-40"
            options={[{ value: 'all', label: `Alle (${prompts.length})` }, ...INTENTS.map(i => ({ value: i, label: INTENT_LABEL[i] }))]} />
          <span className="text-xs text-gray-400">{activeCount} actief voor simulatie</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDiscovering(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:border-[#7c3aed] hover:text-[#7c3aed]">
            <Compass size={14} /> Ontdek vragen
          </button>
          <button onClick={generate} disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#EB4628' }}>
            {generating ? <IbizzMark size={14} animate /> : <Sparkles size={14} />}
            {generating ? 'AI bedenkt vragen…' : prompts.length ? 'Meer (AI)' : 'Genereer vragen'}
          </button>
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />{error}
        </p>
      )}

      {/* Handmatig toevoegen */}
      <div className="flex gap-2 mb-4">
        <input value={newText} onChange={e => setNewText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addManual() }}
          placeholder="Eigen vraag toevoegen…"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]" />
        <Select value={newIntent} onChange={v => setNewIntent(v as GeoPromptIntent)} compact className="w-40"
          options={INTENTS.map(i => ({ value: i, label: INTENT_LABEL[i] }))} />
        <button onClick={addManual} disabled={!newText.trim()}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-40">
          <Plus size={14} /> Voeg toe
        </button>
      </div>

      {/* Lijst */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3"><MessageCircleQuestion size={20} className="text-gray-300" /></div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Nog geen vragen</p>
          <p className="text-xs text-gray-500 max-w-md">Laat AI realistische vragen genereren die je doelgroep aan ChatGPT/Claude/Perplexity stelt — of voeg ze handmatig toe.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(p => (
            <PromptRow key={p.id} p={p} onToggle={() => toggleActive(p)} onRemove={() => remove(p.id)} />
          ))}
        </div>
      )}

      {discovering && (
        <DiscoverPromptsModal
          projectId={project.id}
          onClose={() => setDiscovering(false)}
          onAdded={added => setPrompts(prev => [...prev, ...added])}
        />
      )}
    </div>
  )
}

function PromptRow({ p, onToggle, onRemove }: { p: GeoPrompt; onToggle: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  const hasAnswer = !!p.desired_answer
  return (
    <div className={`bg-white border rounded-xl ${p.active ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <input type="checkbox" checked={p.active} onChange={onToggle} className="w-4 h-4 accent-[#EB4628] flex-shrink-0" title="Meenemen in simulatie" />
        <span className={`flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${INTENT_COLOR[p.intent]}`}>{INTENT_LABEL[p.intent]}</span>
        <span className="flex-1 text-sm text-gray-800">{p.text}</span>
        {p.persona && <span className="text-[10px] text-[#7c3aed] bg-violet-50 rounded px-1.5 py-0.5 flex-shrink-0">{p.persona}</span>}
        {p.topic && <span className="text-[10px] text-gray-400 flex-shrink-0">{p.topic}</span>}
        {p.source !== 'ai' && p.source !== 'manual' && <span className="text-[9px] uppercase text-gray-400 flex-shrink-0">{p.source}</span>}
        {hasAnswer && (
          <button onClick={() => setOpen(o => !o)} className="p-1 rounded text-gray-400 hover:text-[#7c3aed] flex-shrink-0" title="Gezocht antwoord">
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        )}
        <button onClick={onRemove} className="p-1 rounded text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 size={12} /></button>
      </div>
      {open && hasAnswer && (
        <div className="px-3 pb-2.5 pl-10">
          <div className="flex items-start gap-1.5 text-xs bg-violet-50/50 border border-violet-100 rounded-lg px-2.5 py-2">
            <Target size={12} className="text-[#7c3aed] flex-shrink-0 mt-0.5" />
            <div><span className="font-semibold text-[#7c3aed]">Gezocht antwoord: </span><span className="text-gray-700">{p.desired_answer}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
