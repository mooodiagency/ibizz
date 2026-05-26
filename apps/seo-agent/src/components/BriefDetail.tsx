'use client'

import { ArrowLeft, Trash2, Info, Users, Tags, Network, Map, FileText, Globe, ExternalLink, MessageSquare, Newspaper } from 'lucide-react'
import type { SeoBrief, Brand } from '@ibizz/supabase'
import { createClient } from '@ibizz/supabase'
import { Select } from '@ibizz/ui'
import { format } from 'date-fns'
import { useCallback, useEffect, useState } from 'react'
import PersonasView from './PersonasView'
import ThemesView from './ThemesView'
import MatrixView from './MatrixView'
import ContentMapView from './ContentMapView'
import WriterBriefsView from './WriterBriefsView'
import MessagesView from './MessagesView'
import ArticlesView from './ArticlesView'

type Step = 'overview' | 'personas' | 'themes' | 'messages' | 'matrix' | 'contentmap' | 'writerbriefs' | 'articles'

type Props = {
  brief: SeoBrief
  brand?: Brand
  onBack: () => void
  onUpdated: (b: SeoBrief) => void
  onDeleted: (id: string) => void
}

export default function BriefDetail({ brief, brand, onBack, onUpdated, onDeleted }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activeStep, setActiveStep] = useState<Step>('overview')
  const [counts, setCounts] = useState({ personas: 0, themes: 0, messages: 0, pages: 0, writerBriefs: 0, articles: 0 })
  const supabase = createClient()

  // Stable callbacks zodat child components niet onnodig re-renderen
  const setPersonasCount = useCallback((n: number) => setCounts(c => c.personas === n ? c : { ...c, personas: n }), [])
  const setThemesCount = useCallback((n: number) => setCounts(c => c.themes === n ? c : { ...c, themes: n }), [])
  const setMessagesCount = useCallback((n: number) => setCounts(c => c.messages === n ? c : { ...c, messages: n }), [])
  const setPagesCount = useCallback((n: number) => setCounts(c => c.pages === n ? c : { ...c, pages: n }), [])
  const setWriterBriefsCount = useCallback((n: number) => setCounts(c => c.writerBriefs === n ? c : { ...c, writerBriefs: n }), [])
  const setArticlesCount = useCallback((n: number) => setCounts(c => c.articles === n ? c : { ...c, articles: n }), [])

  useEffect(() => {
    Promise.all([
      supabase.from('seo_personas').select('id', { count: 'exact', head: true }).eq('brief_id', brief.id),
      supabase.from('seo_themes').select('id', { count: 'exact', head: true }).eq('brief_id', brief.id).neq('status', 'archived'),
      supabase.from('seo_messages').select('id', { count: 'exact', head: true }).eq('brief_id', brief.id),
      supabase.from('seo_pages').select('id', { count: 'exact', head: true }).eq('brief_id', brief.id),
    ]).then(async ([pers, themes, messages, pages]) => {
      // Writer briefs en articles vragen iets meer werk — eerst page ids ophalen
      let wbCount = 0
      let artCount = 0
      const { data: pageIds } = await supabase.from('seo_pages').select('id').eq('brief_id', brief.id)
      if (pageIds && pageIds.length > 0) {
        const ids = pageIds.map(p => p.id)
        const [wb, art] = await Promise.all([
          supabase.from('seo_writer_briefs').select('id', { count: 'exact', head: true }).in('page_id', ids),
          supabase.from('seo_articles').select('id', { count: 'exact', head: true }).in('page_id', ids).eq('is_active', true),
        ])
        wbCount = wb.count ?? 0
        artCount = art.count ?? 0
      }

      setCounts({
        personas: pers.count ?? 0,
        themes: themes.count ?? 0,
        messages: messages.count ?? 0,
        pages: pages.count ?? 0,
        writerBriefs: wbCount,
        articles: artCount,
      })
    })
  }, [brief.id])

  async function deleteBrief() {
    onDeleted(brief.id)
    await supabase.from('seo_briefs').delete().eq('id', brief.id)
  }

  return (
    <div className="flex h-full">
      {/* Pipeline rail */}
      <div className="w-60 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
            title="Terug naar briefs"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-800 truncate">{brief.title}</p>
            {brand && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand.color }} />
                <span className="text-[10px] text-gray-400">{brand.name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <RailItem
            icon={<Info size={14} />}
            label="Overview"
            active={activeStep === 'overview'}
            onClick={() => setActiveStep('overview')}
          />
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 mt-3 mb-1">Pipeline</p>
          <RailItem
            icon={<Users size={14} />}
            label="Personas"
            active={activeStep === 'personas'}
            onClick={() => setActiveStep('personas')}
            sublabel={counts.personas.toString()}
          />
          <RailItem
            icon={<Tags size={14} />}
            label="Thema's"
            active={activeStep === 'themes'}
            onClick={() => setActiveStep('themes')}
            sublabel={counts.themes.toString()}
          />
          <RailItem
            icon={<MessageSquare size={14} />}
            label="Boodschappen"
            active={activeStep === 'messages'}
            onClick={() => setActiveStep('messages')}
            sublabel={counts.messages.toString()}
          />
          <RailItem
            icon={<Network size={14} />}
            label="Matrix"
            active={activeStep === 'matrix'}
            onClick={() => setActiveStep('matrix')}
          />
          <RailItem
            icon={<Map size={14} />}
            label="Content map"
            active={activeStep === 'contentmap'}
            onClick={() => setActiveStep('contentmap')}
            sublabel={counts.pages.toString()}
          />
          <RailItem
            icon={<FileText size={14} />}
            label="Writer briefs"
            active={activeStep === 'writerbriefs'}
            onClick={() => setActiveStep('writerbriefs')}
            sublabel={counts.writerBriefs.toString()}
          />
          <RailItem
            icon={<Newspaper size={14} />}
            label="Artikelen"
            active={activeStep === 'articles'}
            onClick={() => setActiveStep('articles')}
            sublabel={counts.articles.toString()}
          />
        </div>

        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={11} />
            Brief verwijderen
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-8 py-6">
          {activeStep === 'overview' && (
            <OverviewSection brief={brief} brand={brand} onUpdated={onUpdated} />
          )}
          {activeStep === 'personas' && (
            <PersonasView briefId={brief.id} onCountChanged={setPersonasCount} />
          )}
          {activeStep === 'themes' && (
            <ThemesView briefId={brief.id} onCountChanged={setThemesCount} />
          )}
          {activeStep === 'messages' && (
            <MessagesView briefId={brief.id} onCountChanged={setMessagesCount} />
          )}
          {activeStep === 'matrix' && (
            <MatrixView briefId={brief.id} />
          )}
          {activeStep === 'contentmap' && (
            <ContentMapView briefId={brief.id} onCountChanged={setPagesCount} />
          )}
          {activeStep === 'writerbriefs' && (
            <WriterBriefsView briefId={brief.id} onCountChanged={setWriterBriefsCount} />
          )}
          {activeStep === 'articles' && (
            <ArticlesView briefId={brief.id} onCountChanged={setArticlesCount} />
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">Brief verwijderen?</h3>
            <p className="text-xs text-gray-400 text-center mb-6">&quot;{brief.title}&quot; en alle bijbehorende personas, thema&apos;s en content gaan verloren.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Annuleren
              </button>
              <button onClick={deleteBrief} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600">
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RailItem({ icon, label, active, onClick, sublabel }: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  sublabel?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
        active ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className={active ? 'text-[#EB4628]' : 'text-gray-400'}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {sublabel && sublabel !== '0' && (
        <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
          {sublabel}
        </span>
      )}
    </button>
  )
}

function OverviewSection({ brief, brand, onUpdated }: { brief: SeoBrief; brand?: Brand; onUpdated: (b: SeoBrief) => void }) {
  return (
    <section className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Info size={16} className="text-[#EB4628]" />
          <h2 className="text-sm font-bold text-gray-800">Brief overzicht</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Merk" value={brand?.name ?? '—'} />
          <Field label="Status" value={brief.status} />
          <Field label="Maand doel" value={brief.monthly_target ?? '—'} />
          <Field label="Primaire markt" value={brief.primary_market} />
          <Field label="Aangemaakt" value={format(new Date(brief.created_at), 'd MMM yyyy')} />
          <WebsiteUrlField brief={brief} onUpdated={onUpdated} />
        </div>

        {brief.goal && (
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Doel</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{brief.goal}</p>
          </div>
        )}

        {brief.competitors.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Concurrenten</p>
            <div className="flex flex-wrap gap-2">
              {brief.competitors.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1"
                >
                  <Globe size={11} className="text-gray-400" />
                  {url.replace(/^https?:\/\//, '').slice(0, 40)}
                  <ExternalLink size={9} className="text-gray-400" />
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-gray-400 mt-5 pt-4 border-t border-gray-100">
          {brief.created_by_name && `Aangemaakt door ${brief.created_by_name} · `}
          {format(new Date(brief.created_at), "d MMM yyyy 'om' HH:mm")}
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-xs text-gray-500">Status:</span>
        <Select
          value={brief.status}
          onChange={async v => {
            const supabase = createClient()
            const { data } = await supabase.from('seo_briefs')
              .update({ status: v as SeoBrief['status'], updated_at: new Date().toISOString() })
              .eq('id', brief.id).select().single()
            if (data) onUpdated(data as SeoBrief)
          }}
          options={[
            { value: 'draft', label: 'Concept' },
            { value: 'in_review', label: 'In review' },
            { value: 'approved', label: 'Goedgekeurd' },
            { value: 'archived', label: 'Gearchiveerd' },
          ]}
          className="w-40"
        />
      </div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  )
}

function WebsiteUrlField({ brief, onUpdated }: { brief: SeoBrief; onUpdated: (b: SeoBrief) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(brief.website_url ?? '')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function save() {
    setSaving(true)
    let normalized = draft.trim()
    if (normalized && !/^https?:\/\//.test(normalized)) {
      normalized = `https://${normalized.replace(/^\/\//, '')}`
    }
    const { data } = await supabase.from('seo_briefs')
      .update({ website_url: normalized || null, updated_at: new Date().toISOString() })
      .eq('id', brief.id)
      .select()
      .single()
    setSaving(false)
    if (data) {
      onUpdated(data as SeoBrief)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Website</p>
        <div className="flex items-center gap-1">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="https://klantwebsite.nl"
            autoFocus
            className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#EB4628]"
            onKeyDown={e => { if (e.key === 'Enter') save() }}
          />
          <button
            onClick={save}
            disabled={saving}
            className="px-2 py-1 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#EB4628' }}
          >
            {saving ? '...' : 'OK'}
          </button>
          <button onClick={() => { setEditing(false); setDraft(brief.website_url ?? '') }} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800">
            ×
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Website</p>
      {brief.website_url ? (
        <div className="flex items-center gap-1.5">
          <a href={brief.website_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#EB4628] hover:underline inline-flex items-center gap-1">
            {brief.website_url.replace(/^https?:\/\//, '').slice(0, 30)}
            <ExternalLink size={10} />
          </a>
          <button
            onClick={() => setEditing(true)}
            className="text-[10px] text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            bewerken
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-sm font-semibold text-amber-700 hover:text-[#EB4628] underline decoration-dashed underline-offset-2"
        >
          + voeg toe (vereist voor interne links)
        </button>
      )}
    </div>
  )
}
