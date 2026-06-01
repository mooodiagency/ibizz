import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, VideoBrief, VideoScript, Brand } from '@ibizz/supabase'
import { cookies } from 'next/headers'
import { buildBriefDocx, filenameFor } from '@/lib/docx-export'

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

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const briefId = searchParams.get('briefId')
    if (!briefId) return NextResponse.json({ error: 'briefId verplicht' }, { status: 400 })

    // Brief + scripts + brand parallel laden
    const [briefRes, scriptsRes] = await Promise.all([
      supabase.from('video_briefs').select('*').eq('id', briefId).single(),
      supabase.from('video_scripts').select('*').eq('brief_id', briefId).order('nummer', { ascending: true }),
    ])

    if (briefRes.error || !briefRes.data) {
      return NextResponse.json({ error: 'Brief niet gevonden' }, { status: 404 })
    }
    const brief = briefRes.data as VideoBrief
    const scripts = (scriptsRes.data ?? []) as VideoScript[]

    let brand: Brand | null = null
    if (brief.brand_id) {
      const brRes = await supabase.from('brands').select('*').eq('id', brief.brand_id).single()
      if (brRes.data) brand = brRes.data as Brand
    }

    const buffer = await buildBriefDocx({ brief, scripts, brand })
    const filename = filenameFor(brief, brand)

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('export-brief-docx crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
