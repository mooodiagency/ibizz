'use client'

import { useCallback, useEffect, useState } from 'react'
import { Newspaper, Loader2, Sparkles, AlertCircle, Eye, Hash, RotateCcw } from 'lucide-react'
import { IbizzMark } from '@ibizz/ui'
import { createClient } from '@ibizz/supabase'
import type { SeoArticle, SeoBrief, SeoPage, SeoPersona, SeoTheme, SeoWriterBrief, SeoArticleStatus } from '@ibizz/supabase'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import ArticleEditor from './ArticleEditor'

type Props = {
  briefId: string
  onCountChanged?: (n: number) => void
}

const STATUS_LABEL: Record<SeoArticleStatus, string> = {
  draft: 'Concept',
  review: 'In review',
  approved: 'Goedgekeurd',
  published: 'Gepubliceerd',
}

const STATUS_COLOR: Record<SeoArticleStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  review: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  published: 'bg-blue-100 text-blue-700',
}

export default function ArticlesView({ briefId, onCountChanged }: Props) {
  const [brief, setBrief] = useState<SeoBrief | null>(null)
  const [pages, setPages] = useState<SeoPage[]>([])
  const [personas, setPersonas] = useState<SeoPersona[]>([])
  const [themes, setThemes] = useState<SeoTheme[]>([])
  const [writerBriefs, setWriterBriefs] = useState<Map<string, SeoWriterBrief>>(new Map())
  const [articles, setArticles] = useState<Map<string, SeoArticle>>(new Map())
  const [loading, setLoading] = useState(true)
  const [generatingForPage, setGeneratingForPage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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

    if (pageList.length === 0) {
      setWriterBriefs(new Map())
      setArticles(new Map())
      onCountChanged?.(0)
      setLoading(false)
      return
    }

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
    onCountChanged?.(artMap.size)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefId])

  useEffect(() => { reload() }, [reload])

  async function generateArticle(pageId: string) {
    setGeneratingForPage(pageId)
    setError(null)
    try {
      const res = await fetch('/api/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Genereren mislukt')
      const article = json as SeoArticle
      setArticles(prev => {
        const next = new Map(prev)
        next.set(article.page_id, article)
        onCountChanged?.(next.size)
        return next
      })
      // Open editor direct na generatie
      const page = pages.find(p => p.id === pageId)
      if (page) setOpenArticle({ article, pageTopic: page.topic })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setGeneratingForPage(null)
    }
  }

  function personaFor(id: string | null) { return id ? personas.find(p => p.id === id) : undefined }
  function themeFor(id: string | null) { return id ? themes.find(t => t.id === id) : undefined }

  const eligible = pages.filter(p => writerBriefs.has(p.id))
  const ineligible = pages.filter(p => !writerBriefs.has(p.id))

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Newspaper size={18} style={{ color: '#EB4628' }} />
        <h2 className="text-base font-bold text-gray-900">Artikelen</h2>
        <span className="text-xs text-gray-400">· {articles.size}/{eligible.length} geschreven</span>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        Per pagina met een writer brief kun je AI een volledig artikel laten schrijven in markdown. Daarna in de editor itereren met chat feedback.
      </p>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {pages.length === 0 ? (
        <EmptyState title="Geen pagina's" message="Voeg eerst pagina's toe in de Content map." />
      ) : eligible.length === 0 ? (
        <EmptyState
          title="Geen writer briefs"
          message="Eerst een writer brief genereren in de Writer briefs stap — daarna kun je hier het artikel laten schrijven."
        />
      ) : (
        <>
          {ineligible.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong>{ineligible.length}</strong> pagina&apos;s hebben nog geen writer brief — daarvoor kunnen we geen artikel maken.
              </div>
            </div>
          )}

          <div className="space-y-2">
            {eligible.map(page => {
              const article = articles.get(page.id)
              const persona = personaFor(page.persona_id)
              const theme = themeFor(page.theme_id)
              const generating = generatingForPage === page.id

              return (
                <div key={page.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 mb-1">{article?.title ?? page.topic}</p>
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
                        {article && (
                          <>
                            <span className={`font-semibold uppercase px-1.5 py-0.5 rounded ${STATUS_COLOR[article.status]}`}>
                              {STATUS_LABEL[article.status]}
                            </span>
                            <span className="text-gray-500 flex items-center gap-1">
                              <Hash size={9} /> {article.word_count} woorden
                            </span>
                            <span className="text-gray-400">
                              {format(new Date(article.updated_at), 'd MMM HH:mm', { locale: nl })}
                            </span>
                          </>
                        )}
                      </div>

                      {article?.meta_description && (
                        <p className="text-[11px] text-gray-500 italic mt-2 leading-relaxed line-clamp-2">
                          {article.meta_description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {article ? (
                        <>
                          <button
                            onClick={() => setOpenArticle({ article, pageTopic: page.topic })}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
                          >
                            <Eye size={11} />
                            Open editor
                          </button>
                          <button
                            onClick={() => generateArticle(page.id)}
                            disabled={generating}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-[#EB4628] hover:bg-gray-100 disabled:opacity-50"
                            title="Opnieuw genereren (vervangt deze versie)"
                          >
                            {generating ? <IbizzMark size={11} animate /> : <RotateCcw size={11} />}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => generateArticle(page.id)}
                          disabled={generating}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                          style={{ backgroundColor: '#EB4628' }}
                        >
                          {generating ? <IbizzMark size={11} animate /> : <Sparkles size={11} />}
                          {generating ? 'Schrijven…' : 'Genereer artikel'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
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

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 mx-auto mb-3 flex items-center justify-center">
        <Newspaper size={22} className="text-gray-300" />
      </div>
      <p className="text-sm font-semibold text-gray-700 mb-1">{title}</p>
      <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">{message}</p>
    </div>
  )
}
