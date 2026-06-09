import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 120

const BUCKET = 'motion-generations'
const BRIA_MODEL = 'fal-ai/bria/expand'

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
    const falKey = getEnv('FAL_KEY')
    if (!falKey) return NextResponse.json({ error: 'FAL_KEY ontbreekt (nodig voor kader vullen via fal.ai)' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as {
      imageBase64: string
      imageMimeType: string
      canvasSize: [number, number]
      originalImageSize: [number, number]
      originalImageLocation: [number, number]
      prompt?: string
    }
    if (!body.imageBase64) return NextResponse.json({ error: 'imageBase64 verplicht' }, { status: 400 })
    if (!body.canvasSize) return NextResponse.json({ error: 'canvasSize verplicht' }, { status: 400 })

    const cleanBase64 = body.imageBase64.replace(/^data:[^;]+;base64,/, '')
    const srcBuf = Buffer.from(cleanBase64, 'base64')
    const ext = body.imageMimeType.includes('png') ? 'png' : 'jpg'
    const stamp = Date.now()
    const tmpPath = `_extend/${user.id}/${stamp}-src.${ext}`

    // 1. Bron tijdelijk uploaden zodat Bria er een URL van heeft
    const up = await supabase.storage.from(BUCKET).upload(tmpPath, srcBuf, { contentType: body.imageMimeType, upsert: true })
    if (up.error) return NextResponse.json({ error: `Upload mislukt: ${up.error.message}` }, { status: 500 })
    const srcUrl = supabase.storage.from(BUCKET).getPublicUrl(tmpPath).data.publicUrl

    // 2. Bria Expand aanroepen (sync endpoint — klaar in seconden)
    const briaPrompt = (body.prompt?.trim() || 'Seamless professional product photography background, soft studio lighting, subtle warm bokeh, premium clean surface, photorealistic, commercial brand quality')

    const briaRes = await fetch(`https://fal.run/${BRIA_MODEL}`, {
      method: 'POST',
      headers: { 'Authorization': `Key ${falKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: srcUrl,
        canvas_size: body.canvasSize,
        original_image_size: body.originalImageSize,
        original_image_location: body.originalImageLocation,
        prompt: briaPrompt,
        negative_prompt: 'distorted product, warped label, altered text, changed packaging, seams, artifacts, black bars, borders',
      }),
    })

    if (!briaRes.ok) {
      const errText = await briaRes.text()
      let detail = errText.slice(0, 400)
      try {
        const j = JSON.parse(errText) as { detail?: unknown; error?: string }
        if (typeof j.detail === 'string') detail = j.detail
        else if (j.error) detail = j.error
        else if (j.detail) detail = JSON.stringify(j.detail).slice(0, 400)
      } catch { /* keep raw */ }
      // tijdelijke bron opruimen
      await supabase.storage.from(BUCKET).remove([tmpPath])
      return NextResponse.json({ error: `Kader vullen mislukt (${briaRes.status}): ${detail}` }, { status: 500 })
    }

    const briaData = await briaRes.json() as { image?: { url?: string; content_type?: string; width?: number; height?: number } }
    const outUrl = briaData.image?.url
    if (!outUrl) {
      await supabase.storage.from(BUCKET).remove([tmpPath])
      return NextResponse.json({ error: 'Bria gaf geen resultaat-afbeelding terug' }, { status: 500 })
    }

    // 3. Resultaat downloaden → base64 (zodat de client het als nieuwe bron kan gebruiken)
    const outRes = await fetch(outUrl)
    if (!outRes.ok) {
      await supabase.storage.from(BUCKET).remove([tmpPath])
      return NextResponse.json({ error: `Resultaat downloaden mislukt (${outRes.status})` }, { status: 500 })
    }
    const outBuf = Buffer.from(await outRes.arrayBuffer())
    const outMime = briaData.image?.content_type || 'image/jpeg'
    const outExt = outMime.includes('png') ? 'png' : 'jpg'
    const outBase64 = outBuf.toString('base64')

    // 4. Uitgebreide versie opslaan (preview-URL) + tijdelijke bron opruimen
    const extPath = `_extend/${user.id}/${stamp}-expanded.${outExt}`
    await supabase.storage.from(BUCKET).upload(extPath, outBuf, { contentType: outMime, upsert: true })
    const extUrl = supabase.storage.from(BUCKET).getPublicUrl(extPath).data.publicUrl
    await supabase.storage.from(BUCKET).remove([tmpPath])

    return NextResponse.json({
      base64: outBase64,
      mimeType: outMime,
      url: extUrl,
      width: briaData.image?.width ?? body.canvasSize[0],
      height: briaData.image?.height ?? body.canvasSize[1],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('extend-frame crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
