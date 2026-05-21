/**
 * Simpele in-memory cache voor scrape resultaten.
 *
 * Werkt per Node instance — dus per dev server / serverless cold start een lege
 * cache. Voor de SEA Agent use case (paar pages per brief, dev + lichte productie)
 * is dit voldoende. Bij meer volume kan dit later naar Supabase storage of Redis.
 */

import type { ScrapedPage } from './scraper'

type CacheEntry = {
  page: ScrapedPage
  expiresAt: number
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000   // 24 uur
const cache = new Map<string, CacheEntry>()

function key(url: string): string {
  // Normaliseer URL → host + pathname (querystring negeren voor cache hits)
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}${u.pathname}`.toLowerCase().replace(/\/$/, '')
  } catch {
    return url.toLowerCase()
  }
}

export function getCached(url: string): ScrapedPage | null {
  const entry = cache.get(key(url))
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key(url))
    return null
  }
  return entry.page
}

export function setCached(url: string, page: ScrapedPage, ttlMs = DEFAULT_TTL_MS): void {
  cache.set(key(url), { page, expiresAt: Date.now() + ttlMs })
}

export function clearCache(): void {
  cache.clear()
}

export function cacheStats(): { size: number; oldest: number | null } {
  let oldest: number | null = null
  for (const entry of cache.values()) {
    if (oldest === null || entry.expiresAt < oldest) oldest = entry.expiresAt
  }
  return { size: cache.size, oldest }
}
