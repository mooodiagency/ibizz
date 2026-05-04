import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import { getProvider } from '@ibizz/ai-image'
import type { ModelId } from '@ibizz/ai-image'
import type { Database } from '@ibizz/supabase'
import { cookies } from 'next/headers'

function getEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key]
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'))
    return match?.[1]?.trim()
  } catch {
    return undefined
  }
}

async function getSupabase() {
  const cookieStore = await cookies()
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')!
  const key = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')!
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      brandId: string
      prompt: string
      model: ModelId
      referenceImageIds?: string[]
      width?: number
      height?: number
    }
    const { brandId, prompt, model, referenceImageIds = [], width, height } = body

    if (!brandId || !prompt?.trim() || !model) {
      return NextResponse.json({ error: 'brandId, prompt en model zijn verplicht' }, { status: 400 })
    }

    // Verrijk de prompt met aspect ratio hint (Gemini volgt deze niet exact, daarna resizen we)
    let effectivePrompt = prompt.trim()
    if (width && height) {
      effectivePrompt = `${effectivePrompt}\n\nGenerate at aspect ratio ${width}:${height} (${width}×${height} pixels).`
    }

    // Provider key check
    if (model === 'gemini' && !getEnv('GEMINI_API_KEY')) {
      return NextResponse.json({ error: 'GEMINI_API_KEY ontbreekt — voeg toe aan .env.local' }, { status: 500 })
    }
    if (model === 'gemini') process.env.GEMINI_API_KEY = getEnv('GEMINI_API_KEY')

    const supabase = await getSupabase()

    // User
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    let userName: string | null = null
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    if (profile) userName = profile.name

    // Refs ophalen
    const references: { url: string; mimeType: string }[] = []
    if (referenceImageIds.length > 0) {
      const { data: refImages } = await supabase
        .from('brand_images')
        .select('url, name')
        .in('id', referenceImageIds)
      for (const ri of refImages ?? []) {
        const ext = ri.name.toLowerCase().split('.').pop()
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
        references.push({ url: ri.url, mimeType: mime })
      }
    }

    // Generate
    const provider = getProvider(model)
    const result = await provider.generate({ prompt: effectivePrompt, references, model })

    // Upload naar Storage
    const buf = Buffer.from(result.imageBase64, 'base64')
    const ext = result.mimeType.includes('png') ? 'png' : 'jpg'
    const stamp = Date.now()
    const path = `${brandId}/${stamp}-${model}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('brand-generations')
      .upload(path, buf, { contentType: result.mimeType, upsert: true })
    if (uploadError) throw new Error(`Upload fout: ${uploadError.message}`)

    const { data: urlData } = supabase.storage.from('brand-generations').getPublicUrl(path)
    const resultUrl = urlData.publicUrl

    // Insert generation
    const { data: generation, error: insertError } = await supabase
      .from('generations')
      .insert({
        brand_id: brandId,
        user_id: user.id,
        user_name: userName,
        prompt,
        model,
        reference_image_ids: referenceImageIds,
        result_url: resultUrl,
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
    console.error('generate-image fout:', err)
    const msg = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
