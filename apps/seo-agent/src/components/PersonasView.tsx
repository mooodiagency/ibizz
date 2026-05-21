'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, Trash2, Edit2, Save, X, Loader2, Sparkles } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { SeoPersona, SeoPersonaDemographics } from '@ibizz/supabase'
import AISuggestionsModal from './AISuggestionsModal'

type Props = {
  briefId: string
  onCountChanged: (n: number) => void
}

const EMOJI_OPTIONS = ['👤', '👩‍💼', '👨‍💼', '👩‍🔧', '👨‍🔧', '👩‍🎓', '👨‍🎓', '👩‍🍳', '👨‍🍳', '👵', '👴', '🧑', '🧑‍💻', '🧕', '🧑‍🌾']

type Draft = {
  id?: string
  name: string
  avatar_emoji: string
  one_liner: string
  age_range: string
  occupation: string
  location: string
  family: string
  income: string
  pains: string[]
  motivations: string[]
  search_behavior: string[]
  channels: string[]
}

function emptyDraft(): Draft {
  return {
    name: '',
    avatar_emoji: '👤',
    one_liner: '',
    age_range: '',
    occupation: '',
    location: '',
    family: '',
    income: '',
    pains: [''],
    motivations: [''],
    search_behavior: [''],
    channels: [''],
  }
}

function personaToDraft(p: SeoPersona): Draft {
  const d = p.demographics ?? {} as SeoPersonaDemographics
  return {
    id: p.id,
    name: p.name,
    avatar_emoji: p.avatar_emoji,
    one_liner: p.one_liner ?? '',
    age_range: d.age_range ?? '',
    occupation: d.occupation ?? '',
    location: d.location ?? '',
    family: d.family ?? '',
    income: d.income ?? '',
    pains: p.pains.length ? p.pains : [''],
    motivations: p.motivations.length ? p.motivations : [''],
    search_behavior: p.search_behavior.length ? p.search_behavior : [''],
    channels: p.channels.length ? p.channels : [''],
  }
}

export default function PersonasView({ briefId, onCountChanged }: Props) {
  const [personas, setPersonas] = useState<SeoPersona[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const supabase = createClient()

  async function reload() {
    const { data } = await supabase.from('seo_personas').select('*').eq('brief_id', briefId).order('sort_order')
    const list = (data ?? []) as SeoPersona[]
    setPersonas(list)
    onCountChanged(list.length)
    setLoading(false)
  }

  useEffect(() => { reload() }, [briefId])

  function startCreate() {
    setEditingId('new')
    setDraft(emptyDraft())
  }

  function startEdit(p: SeoPersona) {
    setEditingId(p.id)
    setDraft(personaToDraft(p))
  }

  async function save() {
    if (!draft || !draft.name.trim()) return
    setSaving(true)
    const demographics: SeoPersonaDemographics = {
      age_range: draft.age_range || null,
      occupation: draft.occupation || null,
      location: draft.location || null,
      family: draft.family || null,
      income: draft.income || null,
    }
    const payload = {
      name: draft.name.trim(),
      avatar_emoji: draft.avatar_emoji,
      one_liner: draft.one_liner.trim() || null,
      demographics,
      pains: draft.pains.map(p => p.trim()).filter(Boolean),
      motivations: draft.motivations.map(p => p.trim()).filter(Boolean),
      search_behavior: draft.search_behavior.map(p => p.trim()).filter(Boolean),
      channels: draft.channels.map(p => p.trim()).filter(Boolean),
    }

    if (draft.id) {
      await supabase.from('seo_personas').update(payload).eq('id', draft.id)
    } else {
      await supabase.from('seo_personas').insert({
        ...payload,
        brief_id: briefId,
        sort_order: personas.length,
      })
    }
    setSaving(false)
    setEditingId(null)
    setDraft(null)
    await reload()
  }

  async function remove(id: string) {
    await supabase.from('seo_personas').delete().eq('id', id)
    await reload()
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} style={{ color: '#EB4628' }} />
          <h2 className="text-base font-bold text-gray-900">Personas</h2>
          <span className="text-xs text-gray-400">· {personas.length}</span>
        </div>
        {editingId === null && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAiOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#EB4628] bg-orange-50 hover:bg-orange-100 border border-orange-200"
            >
              <Sparkles size={12} />
              AI suggesties
            </button>
            <button
              onClick={startCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: '#EB4628' }}
            >
              <Plus size={12} />
              Persona toevoegen
            </button>
          </div>
        )}
      </div>

      {aiOpen && (
        <AISuggestionsModal
          briefId={briefId}
          onClose={() => setAiOpen(false)}
          onSaved={reload}
        />
      )}

      <p className="text-xs text-gray-500 leading-relaxed">
        Schrijf content per persona, niet per doelgroep. Vier persona&apos;s zijn een goede start — minder maar relevantere pagina&apos;s.
      </p>

      {/* Editor */}
      {editingId !== null && draft && (
        <PersonaEditor
          draft={draft}
          setDraft={setDraft}
          onCancel={() => { setEditingId(null); setDraft(null) }}
          onSave={save}
          saving={saving}
        />
      )}

      {/* Lijst */}
      {personas.length === 0 && editingId === null ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 mx-auto mb-3 flex items-center justify-center">
            <Users size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Nog geen personas</p>
          <p className="text-xs text-gray-400">Begin met je belangrijkste persona — wie wil je echt bereiken?</p>
        </div>
      ) : (
        <div className="space-y-3">
          {personas.map(p => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-start gap-4 mb-3">
                <div className="text-4xl flex-shrink-0 leading-none">{p.avatar_emoji}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900">{p.name}</h3>
                  {p.one_liner && (
                    <p className="text-sm text-gray-500 mt-0.5">{p.one_liner}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(p)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#EB4628] hover:bg-gray-100"
                    title="Bewerken"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100"
                    title="Verwijderen"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Demographics chips */}
              {(p.demographics && Object.values(p.demographics).some(Boolean)) && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(p.demographics).filter(([, v]) => v).map(([k, v]) => (
                    <span key={k} className="text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                      {k.replace('_', ' ')}: {String(v)}
                    </span>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                {p.pains.length > 0 && (
                  <BlockList label="Pijnpunten" items={p.pains} color="red" />
                )}
                {p.motivations.length > 0 && (
                  <BlockList label="Motivaties" items={p.motivations} color="green" />
                )}
                {p.search_behavior.length > 0 && (
                  <BlockList label="Zoekgedrag" items={p.search_behavior} color="blue" />
                )}
                {p.channels.length > 0 && (
                  <BlockList label="Kanalen" items={p.channels} color="purple" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const BLOCK_COLORS: Record<string, string> = {
  red: 'text-red-700 bg-red-50 border-red-100',
  green: 'text-green-700 bg-green-50 border-green-100',
  blue: 'text-blue-700 bg-blue-50 border-blue-100',
  purple: 'text-purple-700 bg-purple-50 border-purple-100',
}

function BlockList({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</p>
      <div className="space-y-1">
        {items.map((it, i) => (
          <p key={i} className={`text-xs leading-relaxed rounded px-2 py-1 border ${BLOCK_COLORS[color]}`}>
            {it}
          </p>
        ))}
      </div>
    </div>
  )
}

function PersonaEditor({ draft, setDraft, onCancel, onSave, saving }: {
  draft: Draft
  setDraft: (d: Draft) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  const [emojiOpen, setEmojiOpen] = useState(false)

  function arrayField(key: 'pains' | 'motivations' | 'search_behavior' | 'channels') {
    return (
      <div className="space-y-1.5">
        {draft[key].map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={item}
              onChange={e => {
                const next = [...draft[key]]
                next[i] = e.target.value
                setDraft({ ...draft, [key]: next })
              }}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#EB4628]"
            />
            {draft[key].length > 1 && (
              <button
                onClick={() => setDraft({ ...draft, [key]: draft[key].filter((_, j) => j !== i) })}
                className="text-gray-400 hover:text-red-500 p-1"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setDraft({ ...draft, [key]: [...draft[key], ''] })}
          className="flex items-center gap-1 text-[11px] font-semibold text-[#EB4628] hover:underline"
        >
          <Plus size={10} /> Toevoegen
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border-2 border-[#EB4628] rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setEmojiOpen(o => !o)}
            className="text-4xl w-14 h-14 rounded-2xl border border-gray-200 hover:border-[#EB4628] flex items-center justify-center transition-colors"
          >
            {draft.avatar_emoji}
          </button>
          {emojiOpen && (
            <div className="absolute top-full left-0 mt-1 z-10 bg-white border border-gray-200 rounded-xl p-2 shadow-lg grid grid-cols-5 gap-1 w-56">
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { setDraft({ ...draft, avatar_emoji: e }); setEmojiOpen(false) }}
                  className={`text-2xl w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100 ${draft.avatar_emoji === e ? 'bg-orange-50' : ''}`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            value={draft.name}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
            placeholder="Persona naam — bijv. ZZP'er Sander"
            className="w-full text-base font-bold border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#EB4628]"
            autoFocus
          />
          <input
            value={draft.one_liner}
            onChange={e => setDraft({ ...draft, one_liner: e.target.value })}
            placeholder="One-liner — bijv. ZZP'er die overweegt eigen BV op te richten"
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-1.5 outline-none focus:border-[#EB4628]"
          />
        </div>
      </div>

      {/* Demographics */}
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Demografie</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={draft.age_range} onChange={e => setDraft({ ...draft, age_range: e.target.value })} placeholder="Leeftijd — bijv. 30-45" className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#EB4628]" />
          <input value={draft.occupation} onChange={e => setDraft({ ...draft, occupation: e.target.value })} placeholder="Beroep" className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#EB4628]" />
          <input value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} placeholder="Locatie" className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#EB4628]" />
          <input value={draft.family} onChange={e => setDraft({ ...draft, family: e.target.value })} placeholder="Gezin" className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#EB4628]" />
          <input value={draft.income} onChange={e => setDraft({ ...draft, income: e.target.value })} placeholder="Inkomen" className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#EB4628] col-span-2" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Pijnpunten</p>
          {arrayField('pains')}
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Motivaties</p>
          {arrayField('motivations')}
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Zoekgedrag (Google queries)</p>
          {arrayField('search_behavior')}
        </div>
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Kanalen</p>
          {arrayField('channels')}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <button onClick={onCancel} className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
          <X size={13} /> Annuleren
        </button>
        <button
          onClick={onSave}
          disabled={!draft.name.trim() || saving}
          className="flex items-center gap-1 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: '#EB4628' }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Opslaan
        </button>
      </div>
    </div>
  )
}

