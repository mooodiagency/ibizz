import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, VideoResearch } from '@ibizz/supabase'
import { cookies } from 'next/headers'
import { scrapeTikTokHashtag, scrapeTikTokAccount } from '@/lib/research-scraper'

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
      mode: 'hashtag' | 'account'
      value: string
      limit?: number
    }
    if (!body.briefId || !body.mode || !body.value) {
      return NextResponse.json({ error: 'briefId, mode en value verplicht' }, { status: 400 })
    }

    let userName: string | null = null
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    if (profile) userName = profile.name

    const limit = Math.max(1, Math.min(20, body.limit ?? 12))

    const outcome = body.mode === 'hashtag'
      ? await scrapeTikTokHashtag(body.value, limit)
      : await scrapeTikTokAccount(body.value, limit)

    if (!outcome.ok) {
      return NextResponse.json({
        error: `TikTok scrape mislukt: ${outcome.reason}`,
        hint: 'Probeer specifieke video-URLs handmatig te plakken via "Plak URL".',
      }, { status: 500 })
    }

    if (outcome.items.length === 0) {
      return NextResponse.json({ error: 'Geen videos gevonden' }, { status: 500 })
    }

    // Bestaande URLs deduppen
    const { data: existing } = await supabase
      .from('video_research')
      .select('url')
      .eq('brief_id', body.briefId)
    const existingUrls = new Set((existing ?? []).map(r => r.url))
    const fresh = outcome.items.filter(it => !existingUrls.has(it.url))

    if (fresh.length === 0) {
      return NextResponse.json({
        warning: `Alle ${outcome.items.length} videos staan al in research.`,
        added: 0,
      })
    }

    const inserts = fresh.map(it => ({
      brief_id: body.briefId,
      platform: 'tiktok' as const,
      url: it.url,
      caption: it.caption,
      views: it.views,
      likes: it.likes,
      comments: it.comments,
      transcript: null,
      hook_pattern: null,
      notes: null,
      source: 'scraped' as const,
      added_by: user.id,
      added_by_name: userName,
    }))

    const insertRes = await supabase.from('video_research').insert(inserts).select()
    if (insertRes.error) {
      return NextResponse.json({ error: `Opslaan mislukt: ${insertRes.error.message}` }, { status: 500 })
    }

    return NextResponse.json({
      research: insertRes.data as VideoResearch[],
      added: insertRes.data?.length ?? 0,
      duplicatesSkipped: outcome.items.length - fresh.length,
      source: outcome.source,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('research-scrape-tiktok crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
