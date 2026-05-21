'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Sparkles, Download, Loader2, CheckCircle2, AlertCircle, Send, RotateCcw, Eye, Newspaper } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { SeoPage, SeoWriterBrief, SeoBrief, SeoPersona, SeoTheme, SeoArticle } from '@ibizz/supabase'
import { generateWriterBriefPDF } from '@/lib/writer-brief-pdf'
import WriterBriefDetailModal from './WriterBriefDetailModal'
import ArticleEditor from './ArticleEditor'

type Props = {
  briefId: string
  onCountChanged: (n: number) => void
}

const STATUS_LABEL: Record<SeoWriterBrief['status'], string> = {
  draft: 'Concept',
  sent: 'Verzonden',
  completed: 'Voltooid',
}

const STATUS_COLOR: Record<SeoWriterBrief['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
}

export default function WriterBriefsView({ briefId, onCountChanged }: Props) {
  const [brief, setBrief] = useState<SeoBrief | null>(null)
  const [pages, setPages] = useState<SeoPage[]>([])
  const [personas, setPersonas] = useState<SeoPersona[]>([])
  const [themes, setThemes] = useState<SeoTheme[]>([])
  const [writerBriefs, setWriterBriefs] = useState<Map<string, SeoWriterBrief>>(new Map())
  const [loading, setLoading] = useState(true)
  const [generatingForPage, setGeneratingForPage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openBrief, setOpenBrief] = useState<{ writerBrief: SeoWriterBrief; pageTopic: string } | null>(null)
  const [generatingArticleForPage, setGeneratingArticleForPage] = useState<string | null>(null)
  const [articles, setArticles] = useState<Map<string, SeoArticle>>(new Map())
  const [openArticle, setOpenArticle] = useState<{ article: SeoArticle; pageTopic: string } | null>(null)
  const supabase = createClient()

  const reload = useCallback(async () => {
    const [bRes, pRes, perRes, thRes] = await Promise.all([
      supabase.from('seo_briefs').select('*').eq('id', briefId).single(),
      supabase.from('seo_pages').select('*').eq('brief_id', briefId).order('created_at', { ascending: false }),
      supabase.from('seo_personas').select('*').eq('brief_id', briefId).order('sort_order'),
      supabase.from('seo_themes').select('*').eq('brief_id', briefId).order('sort_order'),
    ])
    const pageList = (pRes.data ?? []) as SeoPage[]
    setBrief(bRes.data as SeoBrief)
    setPages(pageList)
    setPersonas((perRes.data ?? []) as SeoPersona[])
    setThemes((thRes.data ?? []) as SeoTheme[])

    if (pageList.length > 0) {
      const pageIds = pageList.map(p => p.id)
      const [wbRes, artRes] = await Promise.all([
        supabase.from('seo_writer_briefs').select('*').in('page_id', pageIds),
        supabase.from('seo_articles').select('*').in('page_id', pageIds).eq('is_active', true),
      ])
      const wbMap = new Map<string, SeoWriterBrief>()
      for (const wb of (wbRes.data ?? []) as SeoWriterBrief[]) wbMap.set(wb.page_id, wb)
      const artMap = new Map<string, SeoArticle>()
      for (const art of (artRes.data ?? []) as SeoArticle[]) artMap.set(art.page_id, art)
      setWriterBriefs(wbMap)
      setArticles(artMap)
      onCountChanged(wbMap.size)
    } else {
      setWriterBriefs(new Map())
      setArticles(new Map())
      onCountChanged(0)
    }

    setLoading(false)
  }, [briefId])

  async function generateArticle(pageId: string) {
    setGeneratingArticleForPage(pageId)
    setError(null)
    try {
      const res = await fetch('/api/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Artikel genereren mislukt')
      const article = json as SeoArticle
      setArticles(prev => {
        const next = new Map(prev)
        next.set(article.page_id, article)
        return next
      })
      // Open editor direct na generatie
      const page = pages.find(p => p.id === pageId)
      if (page) setOpenArticle({ article, pageTopic: page.topic })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setGeneratingArticleForPage(null)
    }
  }

  useEffect(() => { reload() }, [reload])

  async function generateBrief(pageId: string) {
    setGeneratingForPage(pageId)
    setError(null)
    try {
      const res = await fetch('/api/generate-writer-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Genereren mislukt')
      const wb = json as SeoWriterBrief
      setWriterBriefs(prev => {
        const next = new Map(prev)
        next.set(wb.page_id, wb)
        onCountChanged(next.size)
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setGeneratingForPage(null)
    }
  }

  function downloadPDF(page: SeoPage, wb: SeoWriterBrief) {
    if (!brief) return
    generateWriterBriefPDF(wb, brief, page.topic)
  }

  async function markStatus(wbId: string, status: SeoWriterBrief['status']) {
    const update: { status: SeoWriterBrief['status']; sent_at?: string | null; sent_to?: string | null } = { status }
    if (status === 'sent') {
      update.sent_at = new Date().toISOString()
      update.sent_to = 'Caven'
    }
    const { data } = await supabase.from('seo_writer_briefs').update(update).eq('id', wbId).select().single()
    if (data) {
      const wb = data as SeoWriterBrief
      setWriterBriefs(prev => {
        const next = new Map(prev)
        next.set(wb.page_id, wb)
        return next
      })
    }
  }

  function personaFor(id: string | null) {
    return id ? personas.find(p => p.id === id) : undefined
  }
  function themeFor(id: string | null) {
    return id ? themes.find(t => t.id === id) : undefined
  }

  // Pagina's voor briefs: alleen die met persona + thema gekoppeld (anders mist context)
  const eligible = pages.filter(p => p.persona_id && p.theme_id)
  const incomplete = pages.filter(p => !p.persona_id || !p.theme_id)

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText size={18} style={{ color: '#EB4628' }} />
        <h2 className="text-base font-bold text-gray-900">Writer briefs</h2>
        <span className="text-xs text-gray-400">· {writerBriefs.size}/{eligible.length} gegenereerd</span>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        Per pagina uit de content map genereert AI een gedetailleerde brief voor de schrijver — met persona, thema, tone of voice, lessons learned en SEO setup. Download als PDF om naar Caven te sturen.
      </p>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {pages.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 mx-auto mb-3 flex items-center justify-center">
            <FileText size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Geen pagina&apos;s om briefs voor te maken</p>
          <p className="text-xs text-gray-400">Voeg eerst pagina&apos;s toe in de Content map.</p>
        </div>
      ) : (
        <>
          {/* Onvolledig waarschuwen */}
          {incomplete.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong>{incomplete.length}</strong> {incomplete.length === 1 ? 'pagina mist' : 'pagina’s missen'} een persona of thema — daarvoor kunnen we geen brief genereren (te weinig context). Vul ze aan in de Content map.
              </div>
            </div>
          )}

          {/* Lijst */}
          <div className="space-y-2">
            {eligible.map(page => {
              const wb = writerBriefs.get(page.id)
              const persona = personaFor(page.persona_id)
              const theme = themeFor(page.theme_id)
              const generating = generatingForPage === page.id

              return (
                <div key={page.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
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
                        {page.target_keyword && (
                          <span className="text-gray-400">→ {page.target_keyword}</span>
                        )}
                        {wb && (
                          <span className={`font-semibold uppercase px-1.5 py-0.5 rounded ${STATUS_COLOR[wb.status]}`}>
                            {STATUS_LABEL[wb.status]}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {wb ? (
                        <>
                          <button
                            onClick={() => setOpenBrief({ writerBrief: wb, pageTopic: page.topic })}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
                            title="Bekijk brief"
                          >
                            <Eye size={11} />
                            Bekijk
                          </button>
                          <button
                            onClick={() => downloadPDF(page, wb)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
                            title="Download als PDF voor schrijver"
                          >
                            <Download size={11} />
                            PDF
                          </button>
                          {(() => {
                            const article = articles.get(page.id)
                            const generating = generatingArticleForPage === page.id
                            if (article) {
                              return (
                                <button
                                  onClick={() => setOpenArticle({ article, pageTopic: page.topic })}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90"
                                  style={{ backgroundColor: '#EB4628' }}
                                  title="Open AI artikel"
                                >
                                  <Newspaper size={11} />
                                  Open artikel
                                </button>
                              )
                            }
                            return (
                              <button
                                onClick={() => generateArticle(page.id)}
                                disabled={generating}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                                style={{ backgroundColor: '#EB4628' }}
                                title="Laat AI het artikel schrijven"
                              >
                                {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                {generating ? 'Schrijven…' : 'Schrijf met AI'}
                              </button>
                            )
                          })()}
                          {wb.status === 'draft' && (
                            <button
                              onClick={() => markStatus(wb.id, 'sent')}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 hover:bg-gray-100"
                              title="Markeer als verzonden naar Caven"
                            >
                              <Send size={11} />
                              Verzonden
                            </button>
                          )}
                          {wb.status === 'sent' && (
                            <button
                              onClick={() => markStatus(wb.id, 'completed')}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-green-700 hover:bg-green-50"
                              title="Markeer als voltooid"
                            >
                              <CheckCircle2 size={11} />
                              Voltooid
                            </button>
                          )}
                          {wb.status === 'completed' && (
                            <button
                              onClick={() => markStatus(wb.id, 'sent')}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                              title="Terug naar verzonden"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                          <button
                            onClick={() => generateBrief(page.id)}
                            disabled={generating}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#EB4628] hover:bg-gray-100 disabled:opacity-50"
                            title="Brief opnieuw genereren"
                          >
                            {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => generateBrief(page.id)}
                          disabled={generating}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                          style={{ backgroundColor: '#EB4628' }}
                        >
                          {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          {generating ? 'Genereren…' : 'Brief genereren'}
                        </button>
                      )}
                    </div>
                  </div>

                  {wb && wb.status === 'sent' && wb.sent_at && (
                    <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">
                      Verzonden naar {wb.sent_to ?? 'schrijver'} op {new Date(wb.sent_at).toLocaleDateString('nl-NL')}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {openBrief && (
        <WriterBriefDetailModal
          writerBrief={openBrief.writerBrief}
          pageTopic={openBrief.pageTopic}
          brief={brief}
          onClose={() => setOpenBrief(null)}
          onUpdated={(updated) => {
            setWriterBriefs(prev => {
              const next = new Map(prev)
              next.set(updated.page_id, updated)
              return next
            })
            setOpenBrief({ writerBrief: updated, pageTopic: openBrief.pageTopic })
          }}
        />
      )}

      {openArticle && (
        <ArticleEditor
          article={openArticle.article}
          pageTopic={openArticle.pageTopic}
          websiteUrl={brief?.website_url ?? null}
          onClose={() => setOpenArticle(null)}
          onUpdated={(updated) => {
            setArticles(prev => {
              const next = new Map(prev)
              next.set(updated.page_id, updated)
              return next
            })
            setOpenArticle({ article: updated, pageTopic: openArticle.pageTopic })
          }}
        />
      )}
    </div>
  )
}
