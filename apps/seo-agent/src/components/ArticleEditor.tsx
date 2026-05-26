'use client'

import { useEffect, useRef, useState } from 'react'
import {
  X, Save, Loader2, Sparkles, Send, ChevronDown, Hash, MessageSquare,
  Edit2, Eye, Download, Copy, Check, AlertCircle,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { createClient } from '@ibizz/supabase'
import { Select, IbizzMark } from '@ibizz/ui'
import type { SeoArticle, SeoArticleStatus, SeoWriterBrief } from '@ibizz/supabase'
import SeoScorePanel from './SeoScorePanel'
import type { AnalysisInput } from '@/lib/seo-score'

type Props = {
  article: SeoArticle
  pageTopic: string
  /** Klant website — voor het prefixen van interne links (bv. /blog/abc → https://klant.nl/blog/abc) */
  websiteUrl?: string | null
  onClose: () => void
  onUpdated: (a: SeoArticle) => void
}

/** Strip em-dashes en horizontale separators uit content (client-side, voor display). */
function stripAiTells(text: string): string {
  return text
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    .replace(/\s+—\s+/g, '. ')
    .replace(/\s+–\s+/g, '. ')
    .replace(/—/g, ',')
    .replace(/–/g, '-')
    .replace(/\.\s+\./g, '.')
    .replace(/\.\s+([a-z])/g, (_, c) => `. ${c.toUpperCase()}`)
    .replace(/\n{3,}/g, '\n\n')
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type ViewMode = 'preview' | 'edit'

const STATUS_OPTIONS: { value: SeoArticleStatus; label: string; color: string }[] = [
  { value: 'draft',     label: 'Concept',       color: 'bg-gray-100 text-gray-600' },
  { value: 'review',    label: 'In review',     color: 'bg-amber-100 text-amber-700' },
  { value: 'approved',  label: 'Goedgekeurd',   color: 'bg-green-100 text-green-700' },
  { value: 'published', label: 'Gepubliceerd',  color: 'bg-blue-100 text-blue-700' },
]

const QUICK_PROMPTS = [
  'Maak de intro pakkender — start met een sterke hook',
  'Verkort de tekst met ~20% zonder kerninformatie te verliezen',
  'Voeg een conclusie + CTA toe',
  'Verbeter de tone of voice — meer direct, minder formeel',
  'Check dat het target keyword vaker terugkomt in de eerste 100 woorden',
]

export default function ArticleEditor({ article, pageTopic, websiteUrl, onClose, onUpdated }: Props) {
  const [current, setCurrent] = useState<SeoArticle>(article)
  const [mode, setMode] = useState<ViewMode>('preview')
  const [titleDraft, setTitleDraft] = useState(article.title)
  const [metaTitleDraft, setMetaTitleDraft] = useState(article.meta_title ?? '')
  const [metaDescDraft, setMetaDescDraft] = useState(article.meta_description ?? '')
  const [contentDraft, setContentDraft] = useState(article.content_markdown)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Chat
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'score' | 'chat'>('score')
  const [writerBrief, setWriterBrief] = useState<SeoWriterBrief | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBodyRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  // Reset drafts as article changes from outside — strip em-dashes uit oude content
  useEffect(() => {
    setCurrent(article)
    setTitleDraft(article.title)
    setMetaTitleDraft(article.meta_title ?? '')
    setMetaDescDraft(stripAiTells(article.meta_description ?? ''))
    setContentDraft(stripAiTells(article.content_markdown))
  }, [article.id])

  // Laad writer brief voor target keyword / secondary keywords (voor SEO score)
  useEffect(() => {
    if (!article.writer_brief_id) {
      setWriterBrief(null)
      return
    }
    supabase
      .from('seo_writer_briefs')
      .select('*')
      .eq('id', article.writer_brief_id)
      .maybeSingle()
      .then(({ data }) => setWriterBrief((data ?? null) as SeoWriterBrief | null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.writer_brief_id])

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight
  }, [messages, chatLoading])

  const dirty =
    titleDraft !== current.title ||
    metaTitleDraft !== (current.meta_title ?? '') ||
    metaDescDraft !== (current.meta_description ?? '') ||
    contentDraft !== current.content_markdown

  async function save() {
    setSaving(true)
    setError(null)
    const wordCount = contentDraft.trim().split(/\s+/).filter(Boolean).length
    const { data, error: err } = await supabase
      .from('seo_articles')
      .update({
        title: titleDraft,
        meta_title: metaTitleDraft || null,
        meta_description: metaDescDraft || null,
        content_markdown: contentDraft,
        word_count: wordCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', current.id)
      .select()
      .single()
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    if (data) {
      const updated = data as SeoArticle
      setCurrent(updated)
      onUpdated(updated)
    }
  }

  async function setStatus(status: SeoArticleStatus) {
    const { data } = await supabase
      .from('seo_articles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', current.id)
      .select()
      .single()
    if (data) {
      setCurrent(data as SeoArticle)
      onUpdated(data as SeoArticle)
    }
  }

  async function sendChat(message?: string) {
    const content = (message ?? chatInput).trim()
    if (!content || chatLoading) return

    // Eerst save evt. ongewijzigde drafts
    if (dirty) await save()

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/chat-iterate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: current.id, messages: newMessages }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'AI iteratie mislukt')
      const updated = json.article as SeoArticle
      setCurrent(updated)
      setTitleDraft(updated.title)
      setMetaTitleDraft(updated.meta_title ?? '')
      setMetaDescDraft(updated.meta_description ?? '')
      setContentDraft(updated.content_markdown)
      setMessages([...newMessages, { role: 'assistant', content: json.reply ?? 'Aangepast.' }])
      onUpdated(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
    } finally {
      setChatLoading(false)
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(contentDraft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadMarkdown() {
    const blob = new Blob([contentDraft], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const slug = current.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 50)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const wordCount = contentDraft.trim().split(/\s+/).filter(Boolean).length

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="h-1.5 flex-shrink-0" style={{ backgroundColor: '#EB4628' }} />

        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#EB4628' }}>Artikel · {current.model}</p>
            <h2 className="text-base font-bold text-gray-900 truncate mt-0.5">{pageTopic}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Hash size={11} />
              {wordCount} woorden
            </span>
            <Select
              value={current.status}
              onChange={v => setStatus(v as SeoArticleStatus)}
              options={STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))}
              compact
              className="w-32"
            />

            {/* View mode toggle */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setMode('preview')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  mode === 'preview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                <Eye size={11} />
                Preview
              </button>
              <button
                onClick={() => setMode('edit')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  mode === 'edit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                <Edit2 size={11} />
                Edit
              </button>
            </div>

            <button onClick={copyToClipboard} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Kopieer markdown">
              {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
            </button>
            <button onClick={downloadMarkdown} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Download .md">
              <Download size={13} />
            </button>

            {dirty && (
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: '#EB4628' }}
              >
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                Opslaan
              </button>
            )}

            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="px-5 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700 flex items-center gap-1.5">
            <AlertCircle size={12} /> {error}
          </div>
        )}

        {/* Body — 2 column: content + chat */}
        <div className="flex-1 flex overflow-hidden">
          {/* Content area */}
          <div className="flex-1 overflow-y-auto">
            {/* Website URL warning */}
            {(!websiteUrl || !websiteUrl.trim()) && (
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <AlertCircle size={12} className="flex-shrink-0" />
                <span className="flex-1">
                  <strong>Klant website ontbreekt in deze brief.</strong> Interne links wijzen naar het verkeerde domein. Vul aan in <em>Brief Overview</em> om dit te fixen.
                </span>
              </div>
            )}

            {/* SEO metadata bar */}
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 space-y-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Titel</label>
                <input
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  className="w-full text-base font-bold bg-transparent border-0 outline-none focus:bg-white focus:border focus:border-[#EB4628] focus:rounded-lg focus:px-2 focus:py-1 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Meta title <span className="text-gray-400 normal-case">({metaTitleDraft.length}/60)</span>
                  </label>
                  <input
                    value={metaTitleDraft}
                    onChange={e => setMetaTitleDraft(e.target.value)}
                    className={`w-full text-xs border rounded-lg px-2 py-1 outline-none focus:border-[#EB4628] bg-white ${metaTitleDraft.length > 60 ? 'border-amber-300' : 'border-gray-200'}`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                    Meta description <span className="text-gray-400 normal-case">({metaDescDraft.length}/160)</span>
                  </label>
                  <input
                    value={metaDescDraft}
                    onChange={e => setMetaDescDraft(e.target.value)}
                    className={`w-full text-xs border rounded-lg px-2 py-1 outline-none focus:border-[#EB4628] bg-white ${metaDescDraft.length > 160 ? 'border-amber-300' : 'border-gray-200'}`}
                  />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              {mode === 'edit' ? (
                <textarea
                  value={contentDraft}
                  onChange={e => setContentDraft(e.target.value)}
                  className="w-full min-h-[60vh] text-sm font-mono leading-relaxed border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#EB4628] resize-y"
                  placeholder="# Titel..."
                />
              ) : (
                <article className="article-prose max-w-[72ch] text-[15px] leading-[1.75] text-gray-800">
                  <ReactMarkdown
                    components={{
                      h1: ({ children, ...props }) => (
                        <h1 {...props} className="text-[2rem] font-extrabold leading-tight tracking-tight text-gray-900 mt-0 mb-5">
                          {children}
                        </h1>
                      ),
                      h2: ({ children, ...props }) => (
                        <h2 {...props} className="text-[1.5rem] font-bold leading-snug text-gray-900 mt-9 mb-3">
                          {children}
                        </h2>
                      ),
                      h3: ({ children, ...props }) => (
                        <h3 {...props} className="text-[1.2rem] font-bold leading-snug text-gray-900 mt-7 mb-2">
                          {children}
                        </h3>
                      ),
                      h4: ({ children, ...props }) => (
                        <h4 {...props} className="text-[1.05rem] font-semibold text-gray-900 mt-5 mb-2">
                          {children}
                        </h4>
                      ),
                      h5: ({ children, ...props }) => (
                        <h5 {...props} className="text-[0.95rem] font-semibold uppercase tracking-wide text-gray-700 mt-4 mb-1.5">
                          {children}
                        </h5>
                      ),
                      h6: ({ children, ...props }) => (
                        <h6 {...props} className="text-[0.85rem] font-semibold uppercase tracking-wide text-gray-500 mt-4 mb-1">
                          {children}
                        </h6>
                      ),
                      p: ({ children, ...props }) => (
                        <p {...props} className="my-4 text-gray-700 leading-[1.75]">{children}</p>
                      ),
                      strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                      a: ({ href, children, ...props }) => {
                        const baseClasses = "text-[#EB4628] underline decoration-2 underline-offset-2 font-medium hover:bg-orange-50 rounded-sm px-0.5"
                        if (!href) return <a className={baseClasses} {...props}>{children}</a>

                        const isAbsolute = /^https?:\/\//.test(href)
                        const isAnchor = href.startsWith('#')
                        const isInternal = !isAbsolute && !isAnchor && !href.startsWith('mailto:') && !href.startsWith('tel:')

                        // Normaliseer website URL: voeg https:// toe als die ontbreekt
                        const normalizedWebsite = websiteUrl?.trim()
                          ? (/^https?:\/\//.test(websiteUrl.trim())
                              ? websiteUrl.trim()
                              : `https://${websiteUrl.trim().replace(/^\/\//, '')}`)
                          : null

                        // Interne link → prefix met klant website
                        let resolvedHref = href
                        let label: 'extern' | 'intern' | 'broken' | null = null
                        if (isInternal) {
                          if (normalizedWebsite) {
                            const base = normalizedWebsite.replace(/\/$/, '')
                            const path = href.startsWith('/') ? href : `/${href}`
                            resolvedHref = `${base}${path}`
                            label = 'intern'
                          } else {
                            // Geen klant website ingesteld — link werkt niet correct
                            label = 'broken'
                          }
                        } else if (isAbsolute) {
                          label = 'extern'
                        }

                        if (label === 'broken') {
                          return (
                            <span
                              className="text-amber-700 underline decoration-2 underline-offset-2 decoration-amber-400 font-medium bg-amber-50 rounded-sm px-0.5 cursor-help"
                              title="Klant website URL ontbreekt in brief — vul aan om deze link werkend te maken"
                            >
                              {children}
                              <span className="text-amber-500 text-[0.7em] ml-0.5">⚠</span>
                            </span>
                          )
                        }

                        if (label) {
                          return (
                            <a
                              href={resolvedHref}
                              target="_blank"
                              rel={label === 'extern' ? 'noopener noreferrer' : 'noopener'}
                              className={baseClasses}
                              title={label === 'intern' ? `Interne link → ${resolvedHref}` : `Externe link → ${resolvedHref}`}
                              {...props}
                            >
                              {children}
                              <span className="text-gray-400 text-[0.7em] ml-0.5">↗</span>
                            </a>
                          )
                        }
                        return <a href={href} className={baseClasses} {...props}>{children}</a>
                      },
                      ul: ({ children }) => (
                        <ul className="my-4 space-y-2 list-none pl-0">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="my-4 space-y-2 list-decimal pl-6 marker:text-[#EB4628] marker:font-bold">{children}</ol>
                      ),
                      li: ({ children, ...props }) => {
                        // Detect if parent is ol vs ul — node prop is not always there, fall back
                        const isOrdered = (props as { ordered?: boolean }).ordered
                        if (isOrdered) {
                          return <li className="text-gray-700 leading-relaxed pl-1">{children}</li>
                        }
                        return (
                          <li className="relative pl-6 text-gray-700 leading-relaxed">
                            <span className="absolute left-0 top-[0.7em] w-2 h-2 rounded-full bg-[#EB4628]" />
                            {children}
                          </li>
                        )
                      },
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-[#EB4628] pl-4 py-2 my-5 bg-orange-50/40 rounded-r-lg italic text-gray-700">
                          {children}
                        </blockquote>
                      ),
                      code: ({ children, ...props }) => {
                        const isInline = !(props as { className?: string }).className?.includes('language-')
                        if (isInline) {
                          return <code className="bg-gray-100 text-pink-700 px-1.5 py-0.5 rounded text-[0.9em] font-mono">{children}</code>
                        }
                        return <code className="text-gray-100">{children}</code>
                      },
                      pre: ({ children }) => (
                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto my-5 text-[0.85em]">{children}</pre>
                      ),
                      hr: () => null,
                      table: ({ children }) => (
                        <div className="my-5 overflow-x-auto">
                          <table className="w-full border-collapse text-sm">{children}</table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="text-left font-bold bg-gray-50 px-3 py-2 border-b-2 border-gray-200">{children}</th>
                      ),
                      td: ({ children }) => (
                        <td className="px-3 py-2 border-b border-gray-100">{children}</td>
                      ),
                    }}
                  >
                    {contentDraft}
                  </ReactMarkdown>
                </article>
              )}
            </div>
          </div>

          {/* Right sidebar with Score / Chat tabs */}
          <div className={`flex-shrink-0 border-l border-gray-100 bg-gray-50 flex flex-col transition-all ${sidebarOpen ? 'w-96' : 'w-12'}`}>
            {/* Tab header */}
            {sidebarOpen ? (
              <div className="border-b border-gray-100 flex items-center flex-shrink-0 bg-white">
                <button
                  onClick={() => setSidebarTab('score')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                    sidebarTab === 'score'
                      ? 'text-[#EB4628] border-b-2 border-[#EB4628] -mb-px'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Sparkles size={12} />
                  Score
                </button>
                <button
                  onClick={() => setSidebarTab('chat')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors ${
                    sidebarTab === 'chat'
                      ? 'text-[#EB4628] border-b-2 border-[#EB4628] -mb-px'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <MessageSquare size={12} />
                  AI Chat
                  {messages.length > 0 && (
                    <span className="text-[9px] bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 font-bold">
                      {Math.ceil(messages.length / 2)}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="px-3 py-3 text-gray-400 hover:text-gray-800"
                  title="Sluit zijbalk"
                >
                  <ChevronDown size={14} className="rotate-90" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSidebarOpen(true)}
                className="px-3 py-3 border-b border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0"
                title="Open zijbalk"
              >
                <Sparkles size={14} className="text-[#EB4628]" />
              </button>
            )}

            {sidebarOpen && sidebarTab === 'score' && (
              <SeoScorePanel
                input={{
                  title: titleDraft,
                  meta_title: metaTitleDraft || null,
                  meta_description: metaDescDraft || null,
                  content_markdown: contentDraft,
                  target_keyword: writerBrief?.content.target_keyword ?? null,
                  secondary_keywords: writerBrief?.content.secondary_keywords ?? [],
                } satisfies AnalysisInput}
              />
            )}

            {sidebarOpen && sidebarTab === 'chat' && (
              <>
                <div ref={chatBodyRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                  {messages.length === 0 && !chatLoading && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Probeer bijvoorbeeld:</p>
                      <div className="flex flex-col gap-1.5">
                        {QUICK_PROMPTS.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => sendChat(q)}
                            className="text-left text-[11px] px-2.5 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-[#EB4628] hover:text-[#EB4628] transition-colors leading-relaxed"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                          m.role === 'user'
                            ? 'bg-[#EB4628] text-white'
                            : 'bg-white text-gray-800 border border-gray-200'
                        }`}
                      >
                        {m.role === 'assistant' && (
                          <div className="flex items-center gap-1 mb-1 text-[9px] font-semibold uppercase tracking-wide opacity-70">
                            <Sparkles size={9} /> AI
                          </div>
                        )}
                        <span className="whitespace-pre-wrap break-words">{m.content}</span>
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-2xl px-3 py-2 flex items-center gap-2 text-xs text-gray-500">
                        <IbizzMark size={13} animate className="text-[#EB4628]" />
                        AI past artikel aan…
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 p-2 flex items-end gap-2 flex-shrink-0">
                  <textarea
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                    placeholder="Geef feedback…"
                    rows={2}
                    disabled={chatLoading}
                    className="flex-1 text-xs border border-gray-200 rounded-xl px-2.5 py-1.5 outline-none focus:border-[#EB4628] resize-none bg-white"
                  />
                  <button
                    onClick={() => sendChat()}
                    disabled={!chatInput.trim() || chatLoading}
                    className="p-2 rounded-xl text-white hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: '#EB4628' }}
                  >
                    <Send size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
