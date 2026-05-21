import { NextRequest, NextResponse } from 'next/server'
import { scrape, toLlmContext, type ScrapeError } from '@/lib/scraper'
import { getCached, setCached } from '@/lib/scrape-cache'

export const runtime = 'nodejs'
export const maxDuration = 60

type Body = {
  url: string
  /** Override cache (default: true gebruikt cache). */
  noCache?: boolean
  /** Return ook LLM-ready context string in response. Default true. */
  llmContext?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Body
    const { url, noCache = false, llmContext = true } = body
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

    // Cache check
    if (!noCache) {
      const cached = getCached(url)
      if (cached) {
        return NextResponse.json({
          ...cached,
          cached: true,
          ...(llmContext ? { llmContext: toLlmContext(cached) } : {}),
        })
      }
    }

    // Scrape
    const page = await scrape(url)
    setCached(url, page)

    return NextResponse.json({
      ...page,
      cached: false,
      ...(llmContext ? { llmContext: toLlmContext(page) } : {}),
    })
  } catch (err) {
    // ScrapeError → mooie 4xx mapping
    if (err && typeof err === 'object' && 'code' in err) {
      const e = err as ScrapeError
      const status = e.code === 'http_error' ? (e.status ?? 502) :
                     e.code === 'no_content' ? 422 :
                     e.code === 'timeout' ? 504 :
                     500
      return NextResponse.json({ error: e.message, code: e.code }, { status })
    }
    console.error('scrape-website fout:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Scrape failed' }, { status: 500 })
  }
}
