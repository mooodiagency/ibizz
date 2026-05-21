'use client'

import { useEffect, useState } from 'react'
import { Tags, Plus, Trash2, Edit2, Save, X, Loader2, Eye, EyeOff, Archive, Sparkles } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { SeoTheme, SeoSearchIntent, SeoThemeStatus } from '@ibizz/supabase'
import AISuggestionsModal from './AISuggestionsModal'

type Props = {
  briefId: string
  onCountChanged: (n: number) => void
}

type Draft = {
  id?: string
  name: string
  description: string
  search_intent: SeoSearchIntent | ''
  status: SeoThemeStatus
}

const INTENT_LABEL: Record<SeoSearchIntent, string> = {
  informational: 'Informational',
  commercial: 'Commercial',
  transactional: 'Transactional',
  navigational: 'Navigational',
}

const INTENT_COLOR: Record<SeoSearchIntent, string> = {
  informational: 'bg-blue-50 text-blue-700 border-blue-100',
  commercial: 'bg-purple-50 text-purple-700 border-purple-100',
  transactional: 'bg-green-50 text-green-700 border-green-100',
  navigational: 'bg-gray-100 text-gray-600 border-gray-200',
}

const STATUS_LABEL: Record<SeoThemeStatus, string> = {
  active: 'Actief',
  on_hold: 'On hold',
  archived: 'Gearchiveerd',
}

const STATUS_COLOR: Record<SeoThemeStatus, string> = {
  active: 'bg-green-100 text-green-700',
  on_hold: 'bg-amber-100 text-amber-700',
  archived: 'bg-gray-100 text-gray-400',
}

export default function ThemesView({ briefId, onCountChanged }: Props) {
  const [themes, setThemes] = useState<SeoTheme[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const supabase = createClient()

  async function reload() {
    const { data } = await supabase.from('seo_themes').select('*').eq('brief_id', briefId).order('sort_order')
    const list = (data ?? []) as SeoTheme[]
    setThemes(list)
    onCountChanged(list.filter(t => t.status !== 'archived').length)
    setLoading(false)
  }

  useEffect(() => { reload() }, [briefId])

  function startCreate() {
    setEditingId('new')
    setDraft({ name: '', description: '', search_intent: '', status: 'active' })
  }

  function startEdit(t: SeoTheme) {
    setEditingId(t.id)
    setDraft({
      id: t.id,
      name: t.name,
      description: t.description ?? '',
      search_intent: t.search_intent ?? '',
      status: t.status,
    })
  }

  async function save() {
    if (!draft || !draft.name.trim()) return
    setSaving(true)
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      search_intent: draft.search_intent || null,
      status: draft.status,
    }
    if (draft.id) {
      await supabase.from('seo_themes').update(payload).eq('id', draft.id)
    } else {
      await supabase.from('seo_themes').insert({
        ...payload,
        brief_id: briefId,
        sort_order: themes.length,
      })
    }
    setSaving(false)
    setEditingId(null)
    setDraft(null)
    await reload()
  }

  async function remove(id: string) {
    await supabase.from('seo_themes').delete().eq('id', id)
    await reload()
  }

  async function setStatus(id: string, status: SeoThemeStatus) {
    await supabase.from('seo_themes').update({ status }).eq('id', id)
    await reload()
  }

  const visibleThemes = themes.filter(t => showArchived || t.status !== 'archived')

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tags size={18} style={{ color: '#EB4628' }} />
          <h2 className="text-base font-bold text-gray-900">Thema&apos;s</h2>
          <span className="text-xs text-gray-400">· {visibleThemes.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(s => !s)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
          >
            {showArchived ? <EyeOff size={11} /> : <Eye size={11} />}
            {showArchived ? 'Verberg' : 'Toon'} gearchiveerd
          </button>
          {editingId === null && (
            <>
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
                Thema toevoegen
              </button>
            </>
          )}
        </div>
      </div>

      {aiOpen && (
        <AISuggestionsModal
          briefId={briefId}
          onClose={() => setAiOpen(false)}
          onSaved={reload}
        />
      )}

      <p className="text-xs text-gray-500 leading-relaxed">
        Thema&apos;s zijn de hoofdcategorieën waarbinnen je content schrijft. Bijv. &quot;Belasting &amp; ZZP&quot;, &quot;Eigen BV oprichten&quot;, &quot;Pensioen voor ondernemers&quot;.
      </p>

      {/* Editor */}
      {editingId !== null && draft && (
        <div className="bg-white border-2 border-[#EB4628] rounded-2xl p-5 space-y-3">
          <input
            value={draft.name}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
            placeholder="Themanaam — bijv. Belasting & ZZP"
            className="w-full text-base font-bold border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#EB4628]"
            autoFocus
          />
          <textarea
            value={draft.description}
            onChange={e => setDraft({ ...draft, description: e.target.value })}
            placeholder="Omschrijving — wat valt allemaal onder dit thema?"
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#EB4628] resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={draft.search_intent}
              onChange={e => setDraft({ ...draft, search_intent: e.target.value as SeoSearchIntent })}
              className="text-sm border border-gray-200 rounded-xl px-2.5 py-1.5 outline-none focus:border-[#EB4628] bg-white"
            >
              <option value="">— Search intent —</option>
              {(Object.keys(INTENT_LABEL) as SeoSearchIntent[]).map(i => (
                <option key={i} value={i}>{INTENT_LABEL[i]}</option>
              ))}
            </select>
            <select
              value={draft.status}
              onChange={e => setDraft({ ...draft, status: e.target.value as SeoThemeStatus })}
              className="text-sm border border-gray-200 rounded-xl px-2.5 py-1.5 outline-none focus:border-[#EB4628] bg-white"
            >
              {(Object.keys(STATUS_LABEL) as SeoThemeStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button onClick={() => { setEditingId(null); setDraft(null) }} className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
              <X size={13} /> Annuleren
            </button>
            <button
              onClick={save}
              disabled={!draft.name.trim() || saving}
              className="flex items-center gap-1 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: '#EB4628' }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Opslaan
            </button>
          </div>
        </div>
      )}

      {/* Lijst */}
      {visibleThemes.length === 0 && editingId === null ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 mx-auto mb-3 flex items-center justify-center">
            <Tags size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Nog geen thema&apos;s</p>
          <p className="text-xs text-gray-400">Begin met 4-6 hoofdthema&apos;s die jullie content gaat dekken</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleThemes.map(t => (
            <div key={t.id} className={`bg-white border border-gray-200 rounded-xl p-4 ${t.status === 'archived' ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-bold text-gray-900">{t.name}</h3>
                    {t.search_intent && (
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${INTENT_COLOR[t.search_intent]}`}>
                        {INTENT_LABEL[t.search_intent]}
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_COLOR[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </div>
                  {t.description && (
                    <p className="text-xs text-gray-500 leading-relaxed">{t.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {t.status !== 'archived' ? (
                    <button
                      onClick={() => setStatus(t.id, 'archived')}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                      title="Archiveren"
                    >
                      <Archive size={13} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(t.id, 'active')}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-gray-100"
                      title="Activeren"
                    >
                      <Eye size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(t)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#EB4628] hover:bg-gray-100"
                    title="Bewerken"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => remove(t.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100"
                    title="Verwijderen"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
