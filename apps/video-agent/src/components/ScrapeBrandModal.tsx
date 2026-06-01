'use client'

import { useState } from 'react'
import { X, Globe, AlertCircle, BookOpen, CheckCircle2 } from 'lucide-react'
import { IbizzMark } from '@ibizz/ui'
import type { VideoBrief } from '@ibizz/supabase'

type Props = {
  briefId: string
  hasExistingContext: boolean
  onClose: () => void
  onScraped: (brief: VideoBrief, stats: ScrapeStats) => void
}

export type ScrapeStats = {
  pagesScraped: number
  pagesFailed: number
  crawlMs: number
  source: 'sitemap' | 'links'
  scrapedUrls: string[]
  failed: { url: string; reason: string }[]
}

export default function ScrapeBrandModal({ briefId, hasExistingContext, onClose, onScraped }: Props) {
  const [url, setUrl] = useState('')
  const [scraping, setScraping] = useState(false)
  const [progress, setProgress] = useState<string>('Crawlen van pagina\'s…')
  const [error, setError] = useState<string | null>(null)

  async function start() {
    if (!url.trim()) return
    setScraping(true)
    setError(null)
    setProgress('Pagina\'s ontdekken (sitemap of homepage)…')

    // Geef de UI even tijd om de progress te tonen
    const stages = [
      { ms: 3000, text: 'Pagina\'s downloaden (12 stuks)…' },
      { ms: 10000, text: 'Hoofdcontent extraheren…' },
      { ms: 20000, text: 'AI synthesizet brand-dossier…' },
    ]
    const timers = stages.map(s => setTimeout(() => setProgress(s.text), s.ms))

    try {
      const res = await fetch('/api/scrape-brand-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, websiteUrl: url.trim() }),
      })
      timers.forEach(clearTimeout)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { brief: VideoBrief; stats: ScrapeStats }
      onScraped(data.brief, data.stats)
      onClose()
    } catch (e) {
      timers.forEach(clearTimeout)
      setError(e instanceof Error ? e.message : 'Crawl mislukt')
      setScraping(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={scraping ? undefined : onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-[#EB4628]" />
            <h2 className="text-base font-bold text-gray-900">Brand context via website</h2>
          </div>
          <button
            onClick={onClose}
            disabled={scraping}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"
          >
            <X size={18} />
          </button>
        </div>

        {scraping ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EB462812' }}>
              <IbizzMark size={36} animate className="text-[#EB4628]" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800 mb-1">{progress}</p>
              <p className="text-sm text-gray-400">
                Crawl + synthese duurt 30-90 seconden, afhankelijk van de website.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Geef de website van het merk. We scrapen tot 12 pagina&apos;s (over-ons, missie,
                producten, etc.), en Claude synthesizet er een compact brand-dossier van met
                positionering, USP&apos;s, doelgroep, tone-of-voice en do&apos;s &amp; don&apos;ts.
                Dit dossier vervangt de huidige brand context.
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Website URL
                </label>
                <div className="relative">
                  <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && url.trim()) start() }}
                    placeholder="bv. frenky.com of https://www.frenky.com"
                    className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-[#EB4628]"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  https:// wordt automatisch toegevoegd als 't ontbreekt.
                </p>
              </div>

              {hasExistingContext && (
                <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                  De bestaande brand context wordt vervangen door wat de scraper teruggeeft.
                </p>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600 leading-relaxed">
                <p className="font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 size={11} className="text-[#EB4628]" />
                  Wat de crawler doet
                </p>
                <ul className="space-y-1 ml-1">
                  <li>1. Probeert eerst <code className="bg-white px-1 rounded text-[11px]">sitemap.xml</code> te lezen voor URL-discovery</li>
                  <li>2. Fallback: scrape homepage + interne links</li>
                  <li>3. Scoort URLs op brand-context relevantie (about, missie, producten…)</li>
                  <li>4. Scrapet top 12 pagina&apos;s parallel (3 tegelijk)</li>
                  <li>5. Stuurt alles naar Claude voor synthese in markdown</li>
                </ul>
              </div>

              {error && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                Annuleren
              </button>
              <button
                onClick={start}
                disabled={!url.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                style={{ backgroundColor: '#EB4628' }}
              >
                <Globe size={14} />
                Start crawl
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
