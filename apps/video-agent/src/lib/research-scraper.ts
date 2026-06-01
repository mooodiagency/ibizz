/**
 * Research scraper voor de Video Agent.
 *
 * Doel: succesvolle TikTok/IG/YouTube Shorts videos ophalen die de AI als
 * referentie kan gebruiken bij script-generatie.
 *
 * Twee modes:
 *  1. Manuele URL — gebruikt officiële oEmbed endpoints (rock-solid)
 *  2. Hashtag / account scrape — fetch + parse __UNIVERSAL_DATA_FOR_REHYDRATION__
 *     uit TikTok HTML. Best-effort, breekt soms door anti-bot.
 *
 * Geen Playwright (nog) — eerst kijken hoever fetch+parse komt. Als TikTok
 * te vaak weigert: Fase 3.5 voegt Playwright als fallback toe.
 */

import type { VideoResearchPlatform } from '@ibizz/supabase'

const USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DEFAULT_TIMEOUT_MS = 20_000

export type ResearchItem = {
  platform: VideoResearchPlatform
  url: string
  caption: string | null
  views: number | null
  likes: number | null
  comments: number | null
  author: string | null
  thumbnailUrl: string | null
  hookPattern: string | null     // alleen door AI ingevuld, hier altijd null
  videoId: string | null         // voor de-dup
}

// ─── Platform detectie ──────────────────────────────────────────────────
export function detectPlatform(url: string): VideoResearchPlatform {
  const u = url.toLowerCase()
  if (/(?:^|\/\/)(?:www\.|m\.|vm\.)?tiktok\.com\//.test(u)) return 'tiktok'
  if (/(?:^|\/\/)(?:www\.)?instagram\.com\//.test(u)) return 'instagram'
  if (/(?:^|\/\/)(?:www\.|m\.)?youtube\.com\/shorts\//.test(u) || /(?:^|\/\/)youtu\.be\//.test(u)) return 'youtube_shorts'
  return 'other'
}

function extractTikTokVideoId(url: string): string | null {
  // tiktok.com/@user/video/1234567890
  const m1 = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
  if (m1) return m1[1]
  // vm.tiktok.com/XXXXX (kort) — wordt later geredirect
  const m2 = url.match(/vm\.tiktok\.com\/([A-Za-z0-9]+)/)
  if (m2) return `vm:${m2[1]}`
  return null
}

function extractYouTubeVideoId(url: string): string | null {
  const m1 = url.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]+)/)
  if (m1) return m1[1]
  const m2 = url.match(/youtu\.be\/([A-Za-z0-9_-]+)/)
  if (m2) return m2[1]
  return null
}

function extractInstagramShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

// ─── oEmbed helpers ─────────────────────────────────────────────────────
type OEmbedResponse = {
  title?: string
  author_name?: string
  author_url?: string
  thumbnail_url?: string
  html?: string
}

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json', ...(headers ?? {}) },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      redirect: 'follow',
    })
    if (!res.ok) return null
    return await res.json() as T
  } catch {
    return null
  }
}

async function tiktokOEmbed(url: string): Promise<OEmbedResponse | null> {
  const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
  return fetchJson<OEmbedResponse>(endpoint)
}

async function youtubeOEmbed(url: string): Promise<OEmbedResponse | null> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
  return fetchJson<OEmbedResponse>(endpoint)
}

// ─── Single URL enrich ──────────────────────────────────────────────────
export async function enrichUrl(rawUrl: string): Promise<ResearchItem> {
  let url = rawUrl.trim()
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  const platform = detectPlatform(url)

  // Lege baseline
  const base: ResearchItem = {
    platform,
    url,
    caption: null,
    views: null,
    likes: null,
    comments: null,
    author: null,
    thumbnailUrl: null,
    hookPattern: null,
    videoId: null,
  }

  if (platform === 'tiktok') {
    base.videoId = extractTikTokVideoId(url)
    const oe = await tiktokOEmbed(url)
    if (oe) {
      base.caption = oe.title ?? null
      base.author = oe.author_name ?? null
      base.thumbnailUrl = oe.thumbnail_url ?? null
    }
    return base
  }

  if (platform === 'youtube_shorts') {
    base.videoId = extractYouTubeVideoId(url)
    const oe = await youtubeOEmbed(url)
    if (oe) {
      base.caption = oe.title ?? null
      base.author = oe.author_name ?? null
      base.thumbnailUrl = oe.thumbnail_url ?? null
    }
    return base
  }

  if (platform === 'instagram') {
    base.videoId = extractInstagramShortcode(url)
    // IG oEmbed vereist Facebook app token — overslaan, gebruiker vult zelf in
    return base
  }

  return base
}

// ─── TikTok HTML scraping (best-effort) ─────────────────────────────────
type TikTokItem = {
  id?: string
  desc?: string                       // = caption
  stats?: {
    playCount?: number
    diggCount?: number                 // likes
    commentCount?: number
    shareCount?: number
  }
  author?: {
    uniqueId?: string
    nickname?: string
  }
  video?: {
    cover?: string
    dynamicCover?: string
  }
  music?: { title?: string; authorName?: string }
}

async function fetchTikTokHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      redirect: 'follow',
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function extractUniversalData(html: string): unknown | null {
  // Modern format
  const m1 = html.match(/<script[^>]+id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/)
  if (m1) {
    try { return JSON.parse(m1[1]) } catch { /* fall through */ }
  }
  // Legacy format
  const m2 = html.match(/<script[^>]+id=["']SIGI_STATE["'][^>]*>([\s\S]*?)<\/script>/)
  if (m2) {
    try { return JSON.parse(m2[1]) } catch { /* fall through */ }
  }
  return null
}

function getNested(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

function itemsToResearch(items: TikTokItem[], limit: number): ResearchItem[] {
  return items.slice(0, limit).map((it): ResearchItem => {
    const videoId = it.id ?? null
    const author = it.author?.uniqueId ?? null
    return {
      platform: 'tiktok',
      url: author && videoId ? `https://www.tiktok.com/@${author}/video/${videoId}` : '',
      caption: it.desc ?? null,
      views: it.stats?.playCount ?? null,
      likes: it.stats?.diggCount ?? null,
      comments: it.stats?.commentCount ?? null,
      author,
      thumbnailUrl: it.video?.cover ?? it.video?.dynamicCover ?? null,
      hookPattern: null,
      videoId,
    }
  }).filter(r => r.url)
}

export type ScrapeOutcome =
  | { ok: true; items: ResearchItem[]; source: 'universal_data' | 'sigi_state' }
  | { ok: false; reason: string }

/**
 * Scrape de top videos van een TikTok hashtag (zonder Playwright).
 * Best-effort: TikTok kan anti-bot triggeren, dan krijgen we 0 items.
 */
export async function scrapeTikTokHashtag(tag: string, limit = 12): Promise<ScrapeOutcome> {
  const cleanTag = tag.replace(/^#/, '').trim()
  if (!cleanTag) return { ok: false, reason: 'Lege hashtag' }

  const url = `https://www.tiktok.com/tag/${encodeURIComponent(cleanTag)}`
  const html = await fetchTikTokHtml(url)
  if (!html) return { ok: false, reason: 'Kon TikTok pagina niet ophalen (timeout / network)' }
  if (html.length < 5000) return { ok: false, reason: 'TikTok gaf een lege of geblokkeerde pagina terug' }

  const data = extractUniversalData(html)
  if (!data) return { ok: false, reason: 'Geen JSON data-blob gevonden in HTML (TikTok blokkeert mogelijk, of het format is veranderd)' }

  // Modern format: __DEFAULT_SCOPE__.webapp.tag-detail.itemList
  const modernItems = getNested(data, ['__DEFAULT_SCOPE__', 'webapp.tag-detail', 'itemList']) as TikTokItem[] | undefined
  if (Array.isArray(modernItems) && modernItems.length > 0) {
    return { ok: true, items: itemsToResearch(modernItems, limit), source: 'universal_data' }
  }

  // Legacy format
  const sigiItems = getNested(data, ['ItemModule']) as Record<string, TikTokItem> | undefined
  if (sigiItems && typeof sigiItems === 'object') {
    const arr = Object.values(sigiItems).sort((a, b) => (b.stats?.playCount ?? 0) - (a.stats?.playCount ?? 0))
    if (arr.length > 0) {
      return { ok: true, items: itemsToResearch(arr, limit), source: 'sigi_state' }
    }
  }

  return { ok: false, reason: 'JSON gevonden maar geen video-lijst in verwachte structuur (TikTok kan format gewijzigd hebben)' }
}

/**
 * Scrape de recente videos van een TikTok account (zonder Playwright).
 */
export async function scrapeTikTokAccount(username: string, limit = 12): Promise<ScrapeOutcome> {
  const cleanUser = username.replace(/^@/, '').trim()
  if (!cleanUser) return { ok: false, reason: 'Lege gebruikersnaam' }

  const url = `https://www.tiktok.com/@${encodeURIComponent(cleanUser)}`
  const html = await fetchTikTokHtml(url)
  if (!html) return { ok: false, reason: 'Kon TikTok pagina niet ophalen (timeout / network)' }
  if (html.length < 5000) return { ok: false, reason: 'TikTok gaf een lege of geblokkeerde pagina terug' }

  const data = extractUniversalData(html)
  if (!data) return { ok: false, reason: 'Geen JSON data-blob gevonden in HTML (TikTok blokkeert mogelijk)' }

  // Modern format: webapp.user-detail.itemList of webapp.user-detail.posts
  const candidates: TikTokItem[][] = []
  const c1 = getNested(data, ['__DEFAULT_SCOPE__', 'webapp.user-detail', 'itemList']) as TikTokItem[] | undefined
  if (Array.isArray(c1)) candidates.push(c1)
  const c2 = getNested(data, ['__DEFAULT_SCOPE__', 'webapp.user-detail', 'posts']) as TikTokItem[] | undefined
  if (Array.isArray(c2)) candidates.push(c2)

  for (const items of candidates) {
    if (items.length > 0) {
      return { ok: true, items: itemsToResearch(items, limit), source: 'universal_data' }
    }
  }

  // Legacy ItemModule
  const sigiItems = getNested(data, ['ItemModule']) as Record<string, TikTokItem> | undefined
  if (sigiItems && typeof sigiItems === 'object') {
    const arr = Object.values(sigiItems)
    if (arr.length > 0) {
      return { ok: true, items: itemsToResearch(arr, limit), source: 'sigi_state' }
    }
  }

  return { ok: false, reason: 'Geen video-lijst gevonden voor dit account (mogelijk privé, leeg, of TikTok blokkeert)' }
}

// ─── LLM context helper ─────────────────────────────────────────────────
/**
 * Format research items als compact tekstblok voor in de generate-scripts prompt.
 */
export function researchToLlmContext(items: {
  platform: string
  url: string
  caption: string | null
  views: number | null
  likes: number | null
  hook_pattern: string | null
  notes: string | null
}[]): string {
  if (items.length === 0) return ''
  const lines: string[] = ['# RESEARCH — succesvolle videos in deze niche', '']
  for (let i = 0; i < items.length; i++) {
    const r = items[i]
    const stats = [
      r.views ? `${r.views.toLocaleString('nl-NL')} views` : null,
      r.likes ? `${r.likes.toLocaleString('nl-NL')} likes` : null,
    ].filter(Boolean).join(' · ')
    lines.push(`${i + 1}. [${r.platform}] ${r.url}`)
    if (stats) lines.push(`   ${stats}`)
    if (r.caption) lines.push(`   Caption: ${r.caption.replace(/\n+/g, ' ').slice(0, 200)}`)
    if (r.hook_pattern) lines.push(`   Hook-pattern: ${r.hook_pattern}`)
    if (r.notes) lines.push(`   Notes: ${r.notes.slice(0, 200)}`)
    lines.push('')
  }
  return lines.join('\n')
}
