import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 30

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

    // Snapshot eruit laten — voorlopig alleen metadata + changelog (snapshot
    // is groot en pas nodig als we "view version" toevoegen).
    const { data, error } = await supabase
      .from('video_brief_versions')
      .select('id, brief_id, versie, changelog, created_at, created_by')
      .eq('brief_id', briefId)
      .order('versie', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Author namen via profiles ophalen
    const authorIds = Array.from(new Set((data ?? []).map(v => v.created_by).filter(Boolean) as string[]))
    let nameMap: Record<string, string> = {}
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', authorIds)
      nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id as string, p.name as string]))
    }

    const versions = (data ?? []).map(v => ({
      id: v.id,
      brief_id: v.brief_id,
      versie: v.versie,
      changelog: v.changelog,
      created_at: v.created_at,
      created_by: v.created_by,
      created_by_name: v.created_by ? (nameMap[v.created_by] ?? null) : null,
    }))

    return NextResponse.json({ versions })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('list-versions crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
