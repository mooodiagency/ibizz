/**
 * ibizz-scrape — gratis, zelf-gebouwde web scraper voor de SEA Agent.
 *
 * Stack:
 *  - fetch (native)            → HTML ophalen
 *  - linkedom                  → DOM parsen voor Readability
 *  - @mozilla/readability      → hoofdcontent extraheren (nav/ads/footer eruit)
 *  - cheerio                   → metadata (title, OG, headings, lang)
 *  - turndown                  → HTML → Markdown
 *
 * Werkt voor 90% van marketing sites (WordPress, Shopify, Webflow, Next.js SSR).
 * Faalt op pure JS SPA's zonder SSR — daarvoor is een Playwright fallback nodig.
 */

import * as cheerio from 'cheerio'
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import TurndownService from 'turndown'

const DEFAULT_TIMEOUT_MS = 20_000
const MAX_MARKDOWN_LENGTH = 12_000
const USER_AGENT = 'Mozilla/5.0 (compatible; ibizz-SEA-Agent/1.0; +https://work.2kwadraat.nl)'

export type ScrapedPage = {
  url: string
  finalUrl: string                   // na redirects
  title: string | null
  description: string | null
  language: string | null
  /** Open Graph image URL, indien aanwezig. */
  ogImage: string | null
  /** Schoongemaakte hoofdcontent in markdown. */
  markdown: string
  /** Headings hiërarchie voor structurele context. */
  headings: { level: number; text: string }[]
  /** Eerste paar interne links — handig voor crawl context. */
  internalLinks: string[]
  /** Schatting aantal woorden (na schoonmaak). */
  wordCount: number
  /** Wanneer gescraped (ISO). */
  scrapedAt: string
}

export type ScrapeError = {
  code: 'fetch_failed' | 'http_error' | 'parse_failed' | 'no_content' | 'timeout'
  message: string
  status?: number
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
})

// Verwijder elementen die geen waarde toevoegen voor LLM analyse
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

/**
 * Scrape een URL en geef gestructureerde content terug.
 */
export async function scrape(rawUrl: string): Promise<ScrapedPage> {
  const url = normalizeUrl(rawUrl)

  // 1. Fetch HTML
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

  // 2. Parse met cheerio voor metadata
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

  // Headings hiërarchie (h1-h3)
  const headings: { level: number; text: string }[] = []
  $('h1, h2, h3').each((_, el) => {
    const tag = ('tagName' in el ? el.tagName : '')?.toLowerCase() ?? ''
    const level = Number(tag.charAt(1)) || 1
    const text = $(el).text().trim()
    if (text && text.length < 200) headings.push({ level, text })
  })

  // Interne links (eerste 20)
  const internalLinksSet = new Set<string>()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
    const abs = absoluteUrl(href, finalUrl)
    if (abs && isSameHost(abs, finalUrl)) internalLinksSet.add(abs.split('#')[0])
  })
  const internalLinks = Array.from(internalLinksSet).slice(0, 20)

  // 3. Readability voor hoofdcontent
  let mainHtml: string
  try {
    const { document } = parseHTML(html)
    // Readability heeft een document.URL nodig om links te resolven
    Object.defineProperty(document, 'documentURI', { value: finalUrl, configurable: true })
    const reader = new Readability(document as unknown as Document, {
      charThreshold: 200,        // accepteer kortere artikelen
      keepClasses: false,
    })
    const article = reader.parse()
    mainHtml = article?.content ?? ''
  } catch (err) {
    // Readability faalt soms op rare HTML — fallback naar body
    mainHtml = $('main').html() ?? $('article').html() ?? $('body').html() ?? ''
    console.warn('[scraper] Readability failed, fallback used:', err instanceof Error ? err.message : err)
  }

  if (!mainHtml || mainHtml.length < 100) {
    throw {
      code: 'no_content',
      message: 'Geen leesbare hoofdcontent gevonden op deze pagina',
    } satisfies ScrapeError
  }

  // 4. HTML → Markdown
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

/**
 * Hulpfunctie voor LLM context — geeft een compacte representatie.
 */
export function toLlmContext(page: ScrapedPage): string {
  const lines: string[] = []
  lines.push(`URL: ${page.finalUrl}`)
  if (page.title) lines.push(`Title: ${page.title}`)
  if (page.description) lines.push(`Description: ${page.description}`)
  if (page.language) lines.push(`Language: ${page.language}`)
  lines.push(`Word count: ${page.wordCount}`)
  if (page.headings.length > 0) {
    lines.push('', 'Headings:')
    for (const h of page.headings.slice(0, 15)) {
      lines.push(`${'  '.repeat(h.level - 1)}- ${h.text}`)
    }
  }
  lines.push('', '--- CONTENT ---', '', page.markdown)
  return lines.join('\n')
}
