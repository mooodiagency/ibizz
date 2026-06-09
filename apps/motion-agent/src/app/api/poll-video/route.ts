import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, MotionGeneration } from '@ibizz/supabase'
import { cookies } from 'next/headers'
import { getVideoProvider } from '@ibizz/ai-video'

export const runtime = 'nodejs'
export const maxDuration = 120

const BUCKET = 'motion-generations'

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
    if (!process.env.GEMINI_API_KEY) {
      const k = getEnv('GEMINI_API_KEY')
      if (k) process.env.GEMINI_API_KEY = k
    }
    if (!process.env.FAL_KEY) {
      const k = getEnv('FAL_KEY')
      if (k) process.env.FAL_KEY = k
    }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })

    const rowRes = await supabase.from('motion_generations').select('*').eq('id', id).single()
    if (rowRes.error || !rowRes.data) {
      return NextResponse.json({ error: 'Generatie niet gevonden' }, { status: 404 })
    }
    const row = rowRes.data as MotionGeneration

    // Al klaar of gefaald → meteen teruggeven
    if (row.status !== 'running') {
      return NextResponse.json({ generation: row })
    }
    if (!row.operation_name) {
      return NextResponse.json({ generation: row })
    }

    // Poll Veo operation
    const provider = getVideoProvider(row.model)
    const poll = await provider.pollOperation(row.operation_name)

    if (!poll.done) {
      return NextResponse.json({ generation: row, status: 'running' })
    }

    // Gefaald
    if (poll.error || !poll.videoUri) {
      const failRes = await supabase
        .from('motion_generations')
        .update({ status: 'failed', error: poll.error ?? 'Onbekende fout' })
        .eq('id', id)
        .select()
        .single()
      return NextResponse.json({ generation: (failRes.data ?? row) as MotionGeneration })
    }

    // Succes → download + opslaan
    try {
      const videoBytes = await provider.downloadVideo(poll.videoUri)
      const buf = Buffer.from(videoBytes)
      const folder = row.brand_id || '_nobrand'
      const stamp = Date.now()
      const path = `${folder}/${stamp}.mp4`

      const upload = await supabase.storage
        .from(BUCKET)
        .upload(path, buf, { contentType: 'video/mp4', upsert: true })
      if (upload.error) throw new Error(`Video-upload mislukt: ${upload.error.message}`)

      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

      const okRes = await supabase
        .from('motion_generations')
        .update({
          status: 'succeeded',
          result_url: url,
          result_storage_path: path,
          error: null,
        })
        .eq('id', id)
        .select()
        .single()

      return NextResponse.json({ generation: (okRes.data ?? row) as MotionGeneration })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Download/opslag mislukt'
      const failRes = await supabase
        .from('motion_generations')
        .update({ status: 'failed', error: msg })
        .eq('id', id)
        .select()
        .single()
      return NextResponse.json({ generation: (failRes.data ?? row) as MotionGeneration })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('poll-video crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
