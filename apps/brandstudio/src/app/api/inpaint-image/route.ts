import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import { getProvider, nearestGeminiAspectRatio } from '@ibizz/ai-image'
import type { ModelId } from '@ibizz/ai-image'
import type { Database } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 180

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

/**
 * Inpaint endpoint — regenereert alleen het gemaskeerde gebied.
 *
 * MVP-implementatie: stuurt het originele beeld + masker + prompt naar Gemini
 * met instructies om alleen het witte (gemaskeerde) gedeelte te wijzigen.
 *
 * TODO toekomst: vervangen door echte inpainting via SDXL Inpainting (Replicate)
 * of Flux Fill voor pixel-perfecte regeneratie van alleen het mask-gebied.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      generationId: string
      prompt: string
      maskDataUrl: string  // data:image/png;base64,...
      model?: ModelId
    }
    const { generationId, prompt, maskDataUrl } = body
    const model: ModelId = body.model ?? 'gemini'

    if (!generationId || !prompt?.trim() || !maskDataUrl) {
      return NextResponse.json({ error: 'generationId, prompt en maskDataUrl zijn verplicht' }, { status: 400 })
    }

    if (model === 'gemini' && !getEnv('GEMINI_API_KEY')) {
      return NextResponse.json({ error: 'GEMINI_API_KEY ontbreekt' }, { status: 500 })
    }
    if (model === 'gemini') process.env.GEMINI_API_KEY = getEnv('GEMINI_API_KEY')!

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    // Profile naam
    let userName: string | null = null
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    if (profile) userName = profile.name

    // Origineel
    const { data: original } = await supabase
      .from('generations')
      .select('*')
      .eq('id', generationId)
      .single()
    if (!original || !original.result_url) {
      return NextResponse.json({ error: 'Originele generatie niet gevonden' }, { status: 404 })
    }

    // References: origineel + mask
    const references: { url: string; mimeType: string }[] = [
      { url: original.result_url, mimeType: original.result_url.endsWith('.png') ? 'image/png' : 'image/jpeg' },
      { url: maskDataUrl, mimeType: 'image/png' },
    ]

    const enrichedPrompt = [
      'You are editing an existing image. The first reference is the CURRENT IMAGE.',
      'The second reference is a black-and-white MASK image:',
      '  - WHITE pixels = the PRIMARY area the user has selected with a brush. Changes targeted at this region are top priority.',
      '  - BLACK pixels = the rest of the image.',
      '',
      `USER INSTRUCTIONS: ${prompt.trim()}`,
      '',
      'How to interpret the instructions:',
      '1. The brushed (white) area is the user\'s focus — apply any change that fits there with priority.',
      '2. The instructions may also describe changes for parts of the image OUTSIDE the brushed area (e.g. "and change the background to purple"). Apply those too if clearly mentioned.',
      '3. For all other unmentioned regions: keep them as identical as possible to the original — same composition, lighting, colors, style and subjects.',
      '',
      'Return the edited image, maintaining the original aspect ratio and overall framing.',
    ].join('\n')

    const provider = getProvider(model)
    const result = await provider.generate({ prompt: enrichedPrompt, references, model })

    // Upload
    const buf = Buffer.from(result.imageBase64, 'base64')
    const ext = result.mimeType.includes('png') ? 'png' : 'jpg'
    const stamp = Date.now()
    const path = `${original.brand_id}/${stamp}-inpaint.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('brand-generations')
      .upload(path, buf, { contentType: result.mimeType, upsert: true })
    if (uploadError) throw new Error(`Upload fout: ${uploadError.message}`)

    const { data: urlData } = supabase.storage.from('brand-generations').getPublicUrl(path)

    const { data: generation, error: insertError } = await supabase
      .from('generations')
      .insert({
        brand_id: original.brand_id,
        user_id: user.id,
        user_name: userName,
        prompt: `[Inpaint] ${prompt}`,
        model,
        reference_image_ids: original.reference_image_ids,
        result_url: urlData.publicUrl,
        result_storage_path: path,
        status: 'draft',
      })
      .select()
      .single()

    if (insertError || !generation) {
      throw new Error(insertError?.message ?? 'Kon generation niet opslaan')
    }

    return NextResponse.json(generation)
  } catch (err) {
    console.error('inpaint-image fout:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Onbekende fout' }, { status: 500 })
  }
}
