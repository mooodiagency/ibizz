import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@ibizz/supabase'
import { cookies } from 'next/headers'
import { discoverTikTokVideos } from '@/lib/research-scraper'

export const runtime = 'nodejs'
export const maxDuration = 120

function getEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key]
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    return content.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim()
  } catch { return undefined }
}

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    getEnv('NEXT_PUBLIC_SUPABASE_URL')!,
    getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as {
      briefId: string
      queries: string[]
      perQuery?: number
    }
    if (!body.briefId) return NextResponse.json({ error: 'briefId verplicht' }, { status: 400 })
    if (!Array.isArray(body.queries) || body.queries.length === 0) {
      return NextResponse.json({ error: 'queries (array) verplicht' }, { status: 400 })
    }

    // Bestaande URLs voor dedup-markering
    const { data: existing } = await supabase
      .from('video_research')
      .select('url')
      .eq('brief_id', body.briefId)
    const existingUrls = (existing ?? []).map(r => r.url)

    const t0 = Date.now()
    const result = await discoverTikTokVideos({
      queries: body.queries,
      perQuery: body.perQuery,
      existingUrls,
    })
    const tookMs = Date.now() - t0

    if (result.items.length === 0) {
      return NextResponse.json({
        items: [],
        summary: result.perQuerySummary,
        duckduckgoOk: result.duckduckgoOk,
        tookMs,
        warning: result.duckduckgoOk
          ? 'DuckDuckGo gaf 0 TikTok videos terug — probeer andere zoektermen of hashtags.'
          : 'DuckDuckGo bereikte de server niet of gaf geen resultaten. Probeer later opnieuw.',
      })
    }

    return NextResponse.json({
      items: result.items,
      summary: result.perQuerySummary,
      duckduckgoOk: result.duckduckgoOk,
      tookMs,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('research-discover crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
