import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, VideoResearch } from '@ibizz/supabase'
import { cookies } from 'next/headers'
import type { DiscoveryItem } from '@/lib/research-scraper'

export const runtime = 'nodejs'
export const maxDuration = 60

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
      items: DiscoveryItem[]
    }
    if (!body.briefId) return NextResponse.json({ error: 'briefId verplicht' }, { status: 400 })
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'items (array) verplicht' }, { status: 400 })
    }

    let userName: string | null = null
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    if (profile) userName = profile.name

    // Dedup tegen bestaande URLs
    const { data: existing } = await supabase
      .from('video_research')
      .select('url')
      .eq('brief_id', body.briefId)
    const existingSet = new Set((existing ?? []).map(r => r.url))

    const fresh = body.items.filter(it => it.url && !existingSet.has(it.url))
    if (fresh.length === 0) {
      return NextResponse.json({
        added: 0,
        duplicatesSkipped: body.items.length,
        warning: 'Alle geselecteerde videos staan al in research.',
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
      notes: it.sourceQuery ? `Gevonden via "${it.sourceQuery}"` : null,
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
      duplicatesSkipped: body.items.length - fresh.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('research-confirm-add crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
