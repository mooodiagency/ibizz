/**
 * ibizz-scrape — gratis multi-page brand crawler voor de Video Agent.
 *
 * Twee modes:
 *  - scrape(url)              → single page (zelfde als seo-agent)
 *  - crawlSite(rootUrl, max)  → tot N pagina's van dezelfde host, met slimme
 *                                URL-prioritering voor brand-context pagina's
 *
 * Stack: fetch + linkedom + @mozilla/readability + cheerio + turndown
 * Werkt voor 90% van marketing sites. Faalt op pure JS SPAs zonder SSR.
 */

import * as cheerio from 'cheerio'
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import TurndownService from 'turndown'

const DEFAULT_TIMEOUT_MS = 20_000
const MAX_MARKDOWN_LENGTH = 8_000     // per pagina — krapper want we doen er 12
const USER_AGENT = 'Mozilla/5.0 (compatible; ibizz-Video-Agent/1.0; +https://ibizz.2kwadraat.nl)'

export type ScrapedPage = {
  url: string
  finalUrl: string
  title: string | null
  description: string | null
  language: string | null
  ogImage: string | null
  markdown: string
  headings: { level: number; text: string }[]
  internalLinks: string[]
  wordCount: number
  scrapedAt: string
}

export type ScrapeError = {
  code: 'fetch_failed' | 'http_error' | 'parse_failed' | 'no_content' | 'timeout'
  message: string
  status?: number
}

export type CrawlResult = {
  rootUrl: string
  pages: ScrapedPage[]              // succesvolle pagina's
  failed: { url: string; reason: string }[]
  source: 'sitemap' | 'links'       // hoe we URLs vonden
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
})

turndown.remove(['script', 'style', 'noscript', 'iframe'])
turndown.addRule('removeSvg', {
  filter: (node) => node.nodeName.toLowerCase() === 'svg',
  replacement: () => '',
})

function normalizeUrl(input: string): string {
  let url = input.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  return url
}

function absoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

function isSameHost(url: string, base: string): boolean {
  try {
    return new URL(url).host === new URL(base).host
  } catch {
    return false
  }
}

// ─── Single page scrape ─────────────────────────────────────────────────
export async function scrape(rawUrl: string): Promise<ScrapedPage> {
  const url = normalizeUrl(rawUrl)

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl,en;q=0.8',
      },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      redirect: 'follow',
    })
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    throw {
      code: isTimeout ? 'timeout' : 'fetch_failed',
      message: err instanceof Error ? err.message : 'Network error',
    } satisfies ScrapeError
  }

  if (!response.ok) {
    throw {
      code: 'http_error',
      message: `HTTP ${response.status} ${response.statusText}`,
      status: response.status,
    } satisfies ScrapeError
  }

  const html = await response.text()
  const finalUrl = response.url

  const $ = cheerio.load(html)

  const title = $('meta[property="og:title"]').attr('content')
    ?? $('title').text().trim()
    ?? null

  const description = $('meta[property="og:description"]').attr('content')
    ?? $('meta[name="description"]').attr('content')
    ?? null

  const language = $('html').attr('lang')
    ?? $('meta[http-equiv="content-language"]').attr('content')
    ?? null

  const ogImageRaw = $('meta[property="og:image"]').attr('content')
    ?? $('meta[name="twitter:image"]').attr('content')
    ?? null
  const ogImage = ogImageRaw ? absoluteUrl(ogImageRaw, finalUrl) : null

  const headings: { level: number; text: string }[] = []
  $('h1, h2, h3').each((_, el) => {
    const tag = ('tagName' in el ? el.tagName : '')?.toLowerCase() ?? ''
    const level = Number(tag.charAt(1)) || 1
    const text = $(el).text().trim()
    if (text && text.length < 200) headings.push({ level, text })
  })

  const internalLinksSet = new Set<string>()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
    const abs = absoluteUrl(href, finalUrl)
    if (abs && isSameHost(abs, finalUrl)) internalLinksSet.add(abs.split('#')[0])
  })
  const internalLinks = Array.from(internalLinksSet).slice(0, 60)

  let mainHtml: string
  try {
    const { document } = parseHTML(html)
    Object.defineProperty(document, 'documentURI', { value: finalUrl, configurable: true })
    const reader = new Readability(document as unknown as Document, {
      charThreshold: 200,
      keepClasses: false,
    })
    const article = reader.parse()
    mainHtml = article?.content ?? ''
  } catch (err) {
    mainHtml = $('main').html() ?? $('article').html() ?? $('body').html() ?? ''
    console.warn('[scraper] Readability failed, fallback used:', err instanceof Error ? err.message : err)
  }

  if (!mainHtml || mainHtml.length < 100) {
    throw {
      code: 'no_content',
      message: 'Geen leesbare hoofdcontent gevonden op deze pagina',
    } satisfies ScrapeError
  }

  let markdown = turndown.turndown(mainHtml).trim()
  if (markdown.length > MAX_MARKDOWN_LENGTH) {
    markdown = markdown.slice(0, MAX_MARKDOWN_LENGTH) + '\n\n…(truncated)'
  }

  const wordCount = markdown.split(/\s+/).filter(Boolean).length

  return {
    url,
    finalUrl,
    title: title?.slice(0, 300) ?? null,
    description: description?.slice(0, 500) ?? null,
    language,
    ogImage,
    markdown,
    headings,
    internalLinks,
    wordCount,
    scrapedAt: new Date().toISOString(),
  }
}

// ─── Multi-page crawler ─────────────────────────────────────────────────

/**
 * Score een URL op hoe waarschijnlijk hij brand-context bevat.
 * Hoge score = belangrijke pagina (over ons, missie, producten).
 * Lage/negatieve score = waardeloos voor brand context (login, cart, juridisch).
 */
function scoreUrl(url: string): number {
  let path = ''
  try {
    path = new URL(url).pathname.toLowerCase()
  } catch {
    return -100
  }

  // Sterke positives
  const strong = [
    /\/about(?:\b|-|\/)/, /\/over(?:-ons|-mij|\/|$)/, /\/over$/,
    /\/our-story/, /\/onze-verhaal/, /\/verhaal/, /\/story/,
    /\/missie/, /\/mission/, /\/visie/, /\/vision/, /\/values/, /\/waarden/,
    /\/team/, /\/wie-zijn-wij/,
    /\/merk/, /\/brand/,
  ]
  for (const re of strong) if (re.test(path)) return 100

  // Medium positives
  const medium = [
    /\/producten/, /\/products/, /\/product\//, /\/collectie/, /\/shop\/?$/,
    /\/diensten/, /\/services/, /\/service\//,
    /\/werkwijze/, /\/how-it-works/, /\/aanpak/, /\/methode/,
    /\/cases/, /\/portfolio/, /\/projects/, /\/projecten/, /\/work\b/, /\/cases\//,
    /\/faq/, /\/veelgestelde-vragen/,
  ]
  for (const re of medium) if (re.test(path)) return 50

  // Soft positives (homepage + 1 segment landingspagina's)
  if (path === '/' || path === '') return 40
  const segments = path.split('/').filter(Boolean)
  if (segments.length === 1) return 20

  // Hard negatives — never useful
  const negatives = [
    /\/(cart|winkelmand|checkout|kassa|account|login|inloggen|registreren|register|wachtwoord|password)/,
    /\/(privacy|terms|voorwaarden|algemene-voorwaarden|disclaimer|cookies?|cookie-?(policy|verklaring))/,
    /\/(sitemap|robots|feed|rss|atom)/,
    /\/wp-(admin|content|includes|login)/,
    /\/(tag|tags|categorie|category|categories|author|page)\//,
    /\/(zoeken|search)\b/,
    /\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mp3|css|js|xml)$/i,
  ]
  for (const re of negatives) if (re.test(path)) return -100

  // Blog / news — kan nuttig zijn maar geen prio
  if (/\/(blog|nieuws|news|artikel|article|post)\//.test(path)) return 10

  // Standaard
  return 0
}

/**
 * Lees /sitemap.xml en geef URLs terug. Falt stilletjes.
 */
async function fetchSitemap(rootUrl: string): Promise<string[]> {
  const candidates = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml']
  for (const path of candidates) {
    try {
      const url = new URL(path, rootUrl).toString()
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/xml,text/xml' },
        signal: AbortSignal.timeout(10_000),
        redirect: 'follow',
      })
      if (!res.ok) continue
      const xml = await res.text()
      const urls = extractSitemapUrls(xml)
      if (urls.length > 0) {
        // Als het een index is, parse één laag dieper
        if (xml.includes('<sitemapindex')) {
          const childUrls: string[] = []
          for (const childUrl of urls.slice(0, 5)) {
            try {
              const childRes = await fetch(childUrl, {
                headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/xml,text/xml' },
                signal: AbortSignal.timeout(8_000),
                redirect: 'follow',
              })
              if (!childRes.ok) continue
              const childXml = await childRes.text()
              childUrls.push(...extractSitemapUrls(childXml))
              if (childUrls.length > 500) break
            } catch { /* skip */ }
          }
          return childUrls
        }
        return urls
      }
    } catch { /* try next */ }
  }
  return []
}

function extractSitemapUrls(xml: string): string[] {
  const urls: string[] = []
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) urls.push(m[1])
  return urls
}

/**
 * Crawl maximaal `maxPages` van dezelfde host als rootUrl.
 * Probeert eerst sitemap.xml, dan link-discovery vanaf homepage.
 */
export async function crawlSite(rawRootUrl: string, maxPages = 12): Promise<CrawlResult> {
  const rootUrl = normalizeUrl(rawRootUrl)
  const failed: { url: string; reason: string }[] = []

  // 1. Probeer sitemap
  let candidates: string[] = []
  let source: 'sitemap' | 'links' = 'links'
  try {
    const sitemapUrls = await fetchSitemap(rootUrl)
    if (sitemapUrls.length > 0) {
      candidates = sitemapUrls.filter(u => isSameHost(u, rootUrl))
      if (candidates.length > 0) source = 'sitemap'
    }
  } catch { /* fall through to link discovery */ }

  // 2. Fallback: scrape homepage en gebruik interne links
  let homepage: ScrapedPage | null = null
  if (candidates.length === 0) {
    try {
      homepage = await scrape(rootUrl)
      candidates = [homepage.finalUrl, ...homepage.internalLinks]
    } catch (err) {
      const reason = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'unknown'
      return { rootUrl, pages: [], failed: [{ url: rootUrl, reason }], source: 'links' }
    }
  }

  // 3. Dedupe + score + sort
  const seen = new Set<string>()
  const scored: { url: string; score: number }[] = []
  for (const url of candidates) {
    const clean = url.split('#')[0].replace(/\/$/, '') || url
    if (seen.has(clean)) continue
    seen.add(clean)
    scored.push({ url, score: scoreUrl(url) })
  }
  scored.sort((a, b) => b.score - a.score)

  // Filter negatives weg en pak top N
  const queue = scored.filter(s => s.score >= 0).slice(0, maxPages * 2)  // marge voor failures

  // 4. Scrape met concurrency 3
  const pages: ScrapedPage[] = []
  if (homepage) pages.push(homepage)
  const homeUrl = homepage?.finalUrl?.split('#')[0].replace(/\/$/, '')

  const remaining = queue.filter(q => {
    const clean = q.url.split('#')[0].replace(/\/$/, '')
    return clean !== homeUrl
  })

  let idx = 0
  const concurrency = 3
  async function worker() {
    while (pages.length < maxPages && idx < remaining.length) {
      const { url } = remaining[idx++]
      try {
        const page = await scrape(url)
        if (pages.length < maxPages) pages.push(page)
      } catch (err) {
        const reason = err && typeof err === 'object' && 'message' in err
          ? (err as { message: string }).message
          : 'unknown'
        failed.push({ url, reason })
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  return { rootUrl, pages, failed, source }
}

// ─── LLM context helper ─────────────────────────────────────────────────
export function pagesToLlmContext(pages: ScrapedPage[]): string {
  const blocks: string[] = []
  for (const p of pages) {
    const lines = [`# ${p.title ?? p.finalUrl}`, `URL: ${p.finalUrl}`]
    if (p.description) lines.push(`Description: ${p.description}`)
    if (p.headings.length > 0) {
      lines.push('', 'Headings:')
      for (const h of p.headings.slice(0, 12)) {
        lines.push(`${'  '.repeat(Math.max(0, h.level - 1))}- ${h.text}`)
      }
    }
    lines.push('', p.markdown)
    blocks.push(lines.join('\n'))
  }
  return blocks.join('\n\n---\n\n')
}

export function toLlmContext(page: ScrapedPage): string {
  return pagesToLlmContext([page])
}
