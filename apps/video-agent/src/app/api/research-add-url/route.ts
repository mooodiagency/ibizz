import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, VideoResearch } from '@ibizz/supabase'
import { cookies } from 'next/headers'
import { enrichUrl } from '@/lib/research-scraper'

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

    const body = await req.json() as { briefId: string; url: string; notes?: string }
    if (!body.briefId || !body.url) {
      return NextResponse.json({ error: 'briefId en url verplicht' }, { status: 400 })
    }

    // Profile naam voor added_by_name
    let userName: string | null = null
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    if (profile) userName = profile.name

    // Enrich via oEmbed
    const enriched = await enrichUrl(body.url)

    const insert = {
      brief_id: body.briefId,
      platform: enriched.platform,
      url: enriched.url,
      caption: enriched.caption,
      views: enriched.views,
      likes: enriched.likes,
      comments: enriched.comments,
      transcript: null,
      hook_pattern: null,
      notes: body.notes?.trim() || null,
      source: 'manual' as const,
      added_by: user.id,
      added_by_name: userName,
    }

    const res = await supabase.from('video_research').insert(insert).select().single()
    if (res.error) {
      return NextResponse.json({ error: `Opslaan mislukt: ${res.error.message}` }, { status: 500 })
    }

    return NextResponse.json({
      research: res.data as VideoResearch,
      enriched: {
        author: enriched.author,
        thumbnailUrl: enriched.thumbnailUrl,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('research-add-url crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
