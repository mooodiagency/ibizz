'use client'

import { useEffect, useState } from 'react'
import { Map, Plus, Trash2, Loader2, FileText } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { SeoPage, SeoPersona, SeoTheme, SeoPageStatus, SeoSearchIntent } from '@ibizz/supabase'

type Props = {
  briefId: string
  onCountChanged: (n: number) => void
}

const STATUS_LABEL: Record<SeoPageStatus, string> = {
  idea: 'Idee',
  planned: 'Gepland',
  in_progress: 'In progress',
  review: 'Review',
  published: 'Gepubliceerd',
}

const STATUS_COLOR: Record<SeoPageStatus, string> = {
  idea: 'bg-gray-100 text-gray-600',
  planned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  review: 'bg-purple-100 text-purple-700',
  published: 'bg-green-100 text-green-700',
}

export default function ContentMapView({ briefId, onCountChanged }: Props) {
  const [pages, setPages] = useState<SeoPage[]>([])
  const [personas, setPersonas] = useState<SeoPersona[]>([])
  const [themes, setThemes] = useState<SeoTheme[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newTopic, setNewTopic] = useState('')
  const [newPersonaId, setNewPersonaId] = useState<string>('')
  const [newThemeId, setNewThemeId] = useState<string>('')
  const [newKeyword, setNewKeyword] = useState('')
  const [filterPersonaId, setFilterPersonaId] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const supabase = createClient()

  async function reload() {
    const [pgRes, pRes, tRes] = await Promise.all([
      supabase.from('seo_pages').select('*').eq('brief_id', briefId).order('created_at', { ascending: false }),
      supabase.from('seo_personas').select('*').eq('brief_id', briefId).order('sort_order'),
      supabase.from('seo_themes').select('*').eq('brief_id', briefId).neq('status', 'archived').order('sort_order'),
    ])
    const pages = (pgRes.data ?? []) as SeoPage[]
    setPages(pages)
    setPersonas((pRes.data ?? []) as SeoPersona[])
    setThemes((tRes.data ?? []) as SeoTheme[])
    onCountChanged(pages.length)
    setLoading(false)
  }

  useEffect(() => { reload() }, [briefId])

  async function addPage() {
    if (!newTopic.trim()) return
    await supabase.from('seo_pages').insert({
      brief_id: briefId,
      persona_id: newPersonaId || null,
      theme_id: newThemeId || null,
      topic: newTopic.trim(),
      target_keyword: newKeyword.trim() || null,
      status: 'idea',
    })
    setNewTopic('')
    setNewKeyword('')
    setNewPersonaId('')
    setNewThemeId('')
    setAdding(false)
    await reload()
  }

  async function removePage(id: string) {
    await supabase.from('seo_pages').delete().eq('id', id)
    await reload()
  }

  async function updateStatus(id: string, status: SeoPageStatus) {
    await supabase.from('seo_pages').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    await reload()
  }

  async function updateKeyword(id: string, target_keyword: string) {
    await supabase.from('seo_pages').update({ target_keyword: target_keyword || null, updated_at: new Date().toISOString() }).eq('id', id)
    await reload()
  }

  async function updateIntent(id: string, search_intent: SeoSearchIntent | '') {
    await supabase.from('seo_pages').update({
      search_intent: search_intent || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    await reload()
  }

  async function updatePersona(id: string, persona_id: string) {
    await supabase.from('seo_pages').update({
      persona_id: persona_id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    await reload()
  }

  async function updateTheme(id: string, theme_id: string) {
    await supabase.from('seo_pages').update({
      theme_id: theme_id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    await reload()
  }

  const filtered = pages.filter(p => {
    if (filterPersonaId !== 'all' && p.persona_id !== filterPersonaId) return false
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    return true
  })

  function personaFor(id: string | null) {
    return id ? personas.find(p => p.id === id) : undefined
  }

  function themeFor(id: string | null) {
    return id ? themes.find(t => t.id === id) : undefined
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Map size={18} style={{ color: '#EB4628' }} />
          <h2 className="text-base font-bold text-gray-900">Content map</h2>
          <span className="text-xs text-gray-400">· {filtered.length}/{pages.length} pagina&apos;s</span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterPersonaId}
            onChange={e => setFilterPersonaId(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
          >
            <option value="all">Alle personas</option>
            {personas.map(p => (
              <option key={p.id} value={p.id}>{p.avatar_emoji} {p.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none bg-white"
          >
            <option value="all">Alle statussen</option>
            {(Object.keys(STATUS_LABEL) as SeoPageStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: '#EB4628' }}
            >
              <Plus size={12} />
              Pagina toevoegen
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        Elke pagina is gekoppeld aan een persona en thema. Begin met &quot;idee&quot;, schuif door tot &quot;gepubliceerd&quot;.
      </p>

      {/* Add row */}
      {adding && (
        <div className="bg-white border-2 border-[#EB4628] rounded-2xl p-4 space-y-2">
          <input
            value={newTopic}
            onChange={e => setNewTopic(e.target.value)}
            placeholder="Onderwerp — bijv. 'Hoe doe ik btw-aangifte als ZZP'er?'"
            autoFocus
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#EB4628]"
          />
          <input
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            placeholder="Target keyword (optioneel)"
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#EB4628]"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newPersonaId}
              onChange={e => setNewPersonaId(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-2.5 py-1.5 outline-none focus:border-[#EB4628] bg-white"
            >
              <option value="">— Persona —</option>
              {personas.map(p => (
                <option key={p.id} value={p.id}>{p.avatar_emoji} {p.name}</option>
              ))}
            </select>
            <select
              value={newThemeId}
              onChange={e => setNewThemeId(e.target.value)}
              className="text-sm border border-gray-200 rounded-xl px-2.5 py-1.5 outline-none focus:border-[#EB4628] bg-white"
            >
              <option value="">— Thema —</option>
              {themes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setAdding(false); setNewTopic(''); setNewKeyword('') }} className="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100">
              Annuleren
            </button>
            <button
              onClick={addPage}
              disabled={!newTopic.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90"
              style={{ backgroundColor: '#EB4628' }}
            >
              Toevoegen
            </button>
          </div>
        </div>
      )}

      {/* Lijst */}
      {filtered.length === 0 && !adding ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 mx-auto mb-3 flex items-center justify-center">
            <Map size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {pages.length === 0 ? 'Nog geen content gepland' : 'Geen pagina\'s voor deze filter'}
          </p>
          <p className="text-xs text-gray-400">
            {pages.length === 0 ? 'Start met je eerste pagina-idee per persona' : 'Probeer een andere persona of status filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(page => {
            const persona = personaFor(page.persona_id)
            const theme = themeFor(page.theme_id)
            return (
              <div key={page.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 mb-1">{page.topic}</p>
                    <div className="flex items-center gap-2 flex-wrap text-[10px]">
                      {persona && (
                        <span className="flex items-center gap-1 bg-gray-100 rounded px-1.5 py-0.5">
                          <span>{persona.avatar_emoji}</span>
                          <span className="font-semibold text-gray-700">{persona.name}</span>
                        </span>
                      )}
                      {theme && (
                        <span className="font-semibold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5">
                          {theme.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={page.status}
                      onChange={e => updateStatus(page.id, e.target.value as SeoPageStatus)}
                      className={`text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 outline-none border-0 cursor-pointer ${STATUS_COLOR[page.status]}`}
                    >
                      {(Object.keys(STATUS_LABEL) as SeoPageStatus[]).map(s => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removePage(page.id)}
                      className="p-1 rounded text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Persona {!page.persona_id && <span className="text-amber-600 normal-case">· vereist</span>}
                    </label>
                    <select
                      value={page.persona_id ?? ''}
                      onChange={e => updatePersona(page.id, e.target.value)}
                      className={`w-full text-xs border rounded-lg px-2 py-1 outline-none focus:border-[#EB4628] bg-white ${!page.persona_id ? 'border-amber-300' : 'border-gray-200'}`}
                    >
                      <option value="">— Selecteer persona —</option>
                      {personas.map(p => (
                        <option key={p.id} value={p.id}>{p.avatar_emoji} {p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Thema {!page.theme_id && <span className="text-amber-600 normal-case">· vereist</span>}
                    </label>
                    <select
                      value={page.theme_id ?? ''}
                      onChange={e => updateTheme(page.id, e.target.value)}
                      className={`w-full text-xs border rounded-lg px-2 py-1 outline-none focus:border-[#EB4628] bg-white ${!page.theme_id ? 'border-amber-300' : 'border-gray-200'}`}
                    >
                      <option value="">— Selecteer thema —</option>
                      {themes.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Target keyword</label>
                    <input
                      defaultValue={page.target_keyword ?? ''}
                      onBlur={e => updateKeyword(page.id, e.target.value.trim())}
                      placeholder="Hoofd zoekwoord"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#EB4628]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Search intent</label>
                    <select
                      value={page.search_intent ?? ''}
                      onChange={e => updateIntent(page.id, e.target.value as SeoSearchIntent | '')}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#EB4628] bg-white"
                    >
                      <option value="">—</option>
                      <option value="informational">Informational</option>
                      <option value="commercial">Commercial</option>
                      <option value="transactional">Transactional</option>
                      <option value="navigational">Navigational</option>
                    </select>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
