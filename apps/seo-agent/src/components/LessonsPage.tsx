'use client'

import { useEffect, useMemo, useState } from 'react'
import { Lightbulb, Plus, Trash2, Loader2, ThumbsUp, ThumbsDown, Eye, X, Save, Filter } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { Select } from '@ibizz/ui'
import type { SeoLesson, SeoLessonType, SeoBrief, SeoPersona, SeoTheme, Brand } from '@ibizz/supabase'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { useAuth } from '@/lib/auth'

const TYPE_LABEL: Record<SeoLessonType, string> = {
  success: 'Wat werkte',
  failure: 'Wat werkte niet',
  observation: 'Observatie',
}

const TYPE_COLOR: Record<SeoLessonType, string> = {
  success: 'bg-green-50 text-green-700 border-green-100',
  failure: 'bg-red-50 text-red-700 border-red-100',
  observation: 'bg-blue-50 text-blue-700 border-blue-100',
}

const TYPE_ICON: Record<SeoLessonType, React.ReactNode> = {
  success: <ThumbsUp size={11} />,
  failure: <ThumbsDown size={11} />,
  observation: <Eye size={11} />,
}

type LessonWithContext = SeoLesson & {
  brief?: SeoBrief
  persona?: SeoPersona
  theme?: SeoTheme
  brand?: Brand
}

export default function LessonsPage() {
  const { user, userName } = useAuth()
  const [lessons, setLessons] = useState<LessonWithContext[]>([])
  const [briefs, setBriefs] = useState<SeoBrief[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [personas, setPersonas] = useState<SeoPersona[]>([])
  const [themes, setThemes] = useState<SeoTheme[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  // Filters
  const [filterBriefId, setFilterBriefId] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')

  // New lesson draft
  const [newBriefId, setNewBriefId] = useState<string>('')
  const [newType, setNewType] = useState<SeoLessonType>('success')
  const [newDescription, setNewDescription] = useState('')
  const [newContext, setNewContext] = useState('')
  const [newPersonaId, setNewPersonaId] = useState<string>('')
  const [newThemeId, setNewThemeId] = useState<string>('')
  const supabase = createClient()

  async function reload() {
    const [lRes, bRes, brRes, pRes, tRes] = await Promise.all([
      supabase.from('seo_lessons').select('*').order('created_at', { ascending: false }),
      supabase.from('seo_briefs').select('*').order('created_at', { ascending: false }),
      supabase.from('brands').select('*'),
      supabase.from('seo_personas').select('*'),
      supabase.from('seo_themes').select('*'),
    ])
    const briefList = (bRes.data ?? []) as SeoBrief[]
    const brandList = (brRes.data ?? []) as Brand[]
    const personaList = (pRes.data ?? []) as SeoPersona[]
    const themeList = (tRes.data ?? []) as SeoTheme[]

    const enriched = (lRes.data ?? []).map(l => {
      const brief = briefList.find(b => b.id === l.brief_id)
      return {
        ...l,
        brief,
        brand: brief?.brand_id ? brandList.find(br => br.id === brief.brand_id) : undefined,
        persona: l.persona_id ? personaList.find(p => p.id === l.persona_id) : undefined,
        theme: l.theme_id ? themeList.find(t => t.id === l.theme_id) : undefined,
      } as LessonWithContext
    })

    setLessons(enriched)
    setBriefs(briefList)
    setBrands(brandList)
    setPersonas(personaList)
    setThemes(themeList)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  const briefPersonas = useMemo(() => personas.filter(p => p.brief_id === newBriefId), [personas, newBriefId])
  const briefThemes = useMemo(() => themes.filter(t => t.brief_id === newBriefId), [themes, newBriefId])

  const filtered = useMemo(() => {
    return lessons.filter(l => {
      if (filterBriefId !== 'all' && l.brief_id !== filterBriefId) return false
      if (filterType !== 'all' && l.type !== filterType) return false
      return true
    })
  }, [lessons, filterBriefId, filterType])

  async function addLesson() {
    if (!newBriefId || !newDescription.trim()) return
    const { error } = await supabase.from('seo_lessons').insert({
      brief_id: newBriefId,
      persona_id: newPersonaId || null,
      theme_id: newThemeId || null,
      type: newType,
      description: newDescription.trim(),
      context: newContext.trim() || null,
      created_by: user?.id ?? null,
    })
    if (!error) {
      setNewDescription('')
      setNewContext('')
      setNewPersonaId('')
      setNewThemeId('')
      setAdding(false)
      await reload()
    }
  }

  async function removeLesson(id: string) {
    await supabase.from('seo_lessons').delete().eq('id', id)
    await reload()
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-gray-300" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lightbulb size={18} style={{ color: '#EB4628' }} />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Lessons learned</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {lessons.length} lessons over alle briefs · gebruikt door de Writer brief generator
            </p>
          </div>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: '#EB4628' }}
          >
            <Plus size={14} />
            Lesson toevoegen
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="px-8 py-4 border-b border-gray-100 bg-orange-50/40">
          <div className="max-w-3xl space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select
                value={newBriefId}
                onChange={v => { setNewBriefId(v); setNewPersonaId(''); setNewThemeId('') }}
                placeholder="— Selecteer brief —"
                options={[
                  { value: '', label: '— Selecteer brief —' },
                  ...briefs.map(b => {
                    const brand = brands.find(br => br.id === b.brand_id)
                    return { value: b.id, label: `${brand?.name ? `${brand.name} · ` : ''}${b.title}` }
                  }),
                ]}
              />
              <Select
                value={newType}
                onChange={v => setNewType(v as SeoLessonType)}
                options={(Object.keys(TYPE_LABEL) as SeoLessonType[]).map(t => ({ value: t, label: TYPE_LABEL[t] }))}
              />
            </div>
            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="Wat is geleerd? — bijv. 'Headlines met cijfer in eerste 6 woorden geven 40% meer CTR voor deze persona'"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#EB4628] resize-none"
              autoFocus
            />
            <input
              value={newContext}
              onChange={e => setNewContext(e.target.value)}
              placeholder="Context (optioneel) — bijv. URL van de pagina of campagne"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#EB4628]"
            />
            {newBriefId && (briefPersonas.length > 0 || briefThemes.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={newPersonaId}
                  onChange={setNewPersonaId}
                  placeholder="— Alle personas —"
                  options={[{ value: '', label: '— Geldt voor alle personas —' }, ...briefPersonas.map(p => ({ value: p.id, label: `${p.avatar_emoji} ${p.name}` }))]}
                />
                <Select
                  value={newThemeId}
                  onChange={setNewThemeId}
                  placeholder="— Alle themes —"
                  options={[{ value: '', label: '— Geldt voor alle themes —' }, ...briefThemes.map(t => ({ value: t.id, label: t.name }))]}
                />
              </div>
            )}
            <p className="text-[11px] text-gray-500 italic leading-relaxed">
              Tip: hoe specifieker je een lesson koppelt aan persona/theme, hoe gerichter de AI hem gebruikt bij nieuwe writer briefs.
              {userName && <span> Toegevoegd als <strong>{userName}</strong>.</span>}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setAdding(false)} className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                <X size={13} /> Annuleren
              </button>
              <button
                onClick={addLesson}
                disabled={!newBriefId || !newDescription.trim()}
                className="flex items-center gap-1 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#EB4628' }}
              >
                <Save size={13} /> Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-8 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <Filter size={12} className="text-gray-400" />
        <Select
          value={filterBriefId}
          onChange={setFilterBriefId}
          options={[
            { value: 'all', label: 'Alle briefs' },
            ...briefs.map(b => {
              const brand = brands.find(br => br.id === b.brand_id)
              return { value: b.id, label: `${brand?.name ? `${brand.name} · ` : ''}${b.title}` }
            }),
          ]}
          className="w-52"
          compact
        />
        <Select
          value={filterType}
          onChange={setFilterType}
          options={[{ value: 'all', label: 'Alle types' }, ...(Object.keys(TYPE_LABEL) as SeoLessonType[]).map(t => ({ value: t, label: TYPE_LABEL[t] }))]}
          className="w-40"
          compact
        />
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length}/{lessons.length} lessons getoond
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-8 py-6">
        {filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center max-w-2xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 mx-auto mb-3 flex items-center justify-center">
              <Lightbulb size={22} style={{ color: '#EB4628' }} />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">
              {lessons.length === 0 ? 'Nog geen lessons learned' : 'Geen resultaten voor deze filter'}
            </p>
            <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
              {lessons.length === 0
                ? 'Voeg lessons toe naarmate je leert wat werkt en wat niet voor specifieke persona\'s of themas. De AI gebruikt deze bij het genereren van writer briefs.'
                : 'Wijzig de filters om meer te zien.'}
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-2">
            {filtered.map(l => (
              <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded border ${TYPE_COLOR[l.type]} flex-shrink-0`}>
                    {TYPE_ICON[l.type]}
                    {TYPE_LABEL[l.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-relaxed">{l.description}</p>
                    {l.context && (
                      <p className="text-xs text-gray-500 mt-1 italic">{l.context}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap mt-2 text-[10px]">
                      {l.brand && (
                        <span className="flex items-center gap-1 bg-gray-100 rounded px-1.5 py-0.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.brand.color }} />
                          <span className="font-semibold text-gray-700">{l.brand.name}</span>
                        </span>
                      )}
                      {l.brief && (
                        <span className="text-gray-500">{l.brief.title}</span>
                      )}
                      {l.persona && (
                        <span className="flex items-center gap-1 bg-gray-100 rounded px-1.5 py-0.5">
                          <span>{l.persona.avatar_emoji}</span>
                          <span className="font-semibold text-gray-700">{l.persona.name}</span>
                        </span>
                      )}
                      {l.theme && (
                        <span className="font-semibold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5">
                          {l.theme.name}
                        </span>
                      )}
                      <span className="text-gray-400 ml-auto">
                        {format(new Date(l.created_at), 'd MMM yyyy', { locale: nl })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeLesson(l.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100 flex-shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
