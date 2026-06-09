import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, MotionGeneration, MotionModelId, MotionAspectRatio, MotionResolution } from '@ibizz/supabase'
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

export async function POST(req: NextRequest) {
  try {
    // Zorg dat de factory de keys uit .env.local kan lezen (process.env fallback)
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

    const body = await req.json() as {
      brandId?: string | null
      prompt: string
      model: MotionModelId
      aspectRatio: MotionAspectRatio
      resolution: MotionResolution
      durationSec?: number
      imageBase64: string
      imageMimeType: string
    }

    if (!body.prompt?.trim()) return NextResponse.json({ error: 'Prompt verplicht' }, { status: 400 })
    if (!body.imageBase64) return NextResponse.json({ error: 'Bron-afbeelding verplicht' }, { status: 400 })

    let userName: string | null = null
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    if (profile) userName = profile.name

    // 1. Bron-afbeelding opslaan in storage
    const cleanBase64 = body.imageBase64.replace(/^data:[^;]+;base64,/, '')
    const srcBuf = Buffer.from(cleanBase64, 'base64')
    const ext = body.imageMimeType.includes('png') ? 'png' : 'jpg'
    const stamp = Date.now()
    const folder = body.brandId || '_nobrand'
    const srcPath = `${folder}/sources/${stamp}.${ext}`

    const srcUpload = await supabase.storage
      .from(BUCKET)
      .upload(srcPath, srcBuf, { contentType: body.imageMimeType, upsert: true })
    if (srcUpload.error) {
      return NextResponse.json({ error: `Bron-upload mislukt: ${srcUpload.error.message}` }, { status: 500 })
    }
    const srcUrl = supabase.storage.from(BUCKET).getPublicUrl(srcPath).data.publicUrl

    // 2. Veo operation starten
    let operationName: string
    try {
      const provider = getVideoProvider(body.model)
      const started = await provider.startGeneration({
        model: body.model,
        prompt: body.prompt.trim(),
        imageBase64: cleanBase64,
        imageMimeType: body.imageMimeType,
        imageUrl: srcUrl,                 // Kling/fal gebruiken de publieke URL i.p.v. base64
        aspectRatio: body.aspectRatio,
        resolution: body.resolution,
        durationSeconds: body.durationSec,
      })
      operationName = started.operationName
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Veo start mislukt' }, { status: 500 })
    }

    // 3. Row opslaan met status=running
    const insertRes = await supabase
      .from('motion_generations')
      .insert({
        brand_id: body.brandId || null,
        user_id: user.id,
        user_name: userName,
        prompt: body.prompt.trim(),
        model: body.model,
        aspect_ratio: body.aspectRatio,
        resolution: body.resolution,
        duration_sec: body.durationSec ?? null,
        source_image_url: srcUrl,
        source_image_path: srcPath,
        status: 'running',
        operation_name: operationName,
      })
      .select()
      .single()

    if (insertRes.error) {
      return NextResponse.json({ error: `Opslaan mislukt: ${insertRes.error.message}` }, { status: 500 })
    }

    return NextResponse.json({ generation: insertRes.data as MotionGeneration })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('generate-video crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
