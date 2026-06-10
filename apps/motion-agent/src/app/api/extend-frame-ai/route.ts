import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 120

const MODEL = 'gemini-2.5-flash-image'

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
    const apiKey = getEnv('GEMINI_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY ontbreekt' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as {
      imageBase64: string          // de witte composite (product gecentreerd, lege ruimte eromheen)
      imageMimeType: string
      aspectRatio: '16:9' | '9:16'
      prompt?: string
    }
    if (!body.imageBase64) return NextResponse.json({ error: 'imageBase64 verplicht' }, { status: 400 })

    const cleanBase64 = body.imageBase64.replace(/^data:[^;]+;base64,/, '')
    const scene = body.prompt?.trim()
      ? `The surrounding background should depict: ${body.prompt.trim()}.`
      : 'The surrounding background should be a clean, premium, photorealistic product-photography setting (soft studio lighting, subtle surface, gentle bokeh) that matches the product colors and lighting.'

    const instruction = `The attached image shows a product centered on a plain white background, with empty white space around it. Replace ONLY the plain white area around the product with a seamless, photorealistic, professional background that blends naturally with the product's existing lighting and colors. ${scene}

CRITICAL RULES:
- Do NOT change, move, resize, re-crop, redraw or recolor the product itself. Keep the product exactly as-is, in the exact same position and size, and fully visible — nothing cut off or covered.
- Keep all label text and packaging identical.
- Keep the same overall framing and the ${body.aspectRatio} aspect ratio.
- Make the transition between product and new background seamless and realistic.
Return the full edited image.`

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: instruction },
            { inlineData: { mimeType: body.imageMimeType || 'image/jpeg', data: cleanBase64 } },
          ],
        }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: body.aspectRatio },
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Gemini extend error:', res.status, errText.slice(0, 500))
      let detail = errText.slice(0, 250)
      try {
        const j = JSON.parse(errText) as { error?: { message?: string; status?: string } }
        if (j?.error?.message) detail = `${j.error.status ?? 'error'}: ${j.error.message}`
      } catch { /* keep raw */ }
      return NextResponse.json({ error: `AI kader vullen mislukt (${res.status}): ${detail}` }, { status: 500 })
    }

    const data = await res.json() as {
      candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[]
    }
    const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)
    if (!imagePart?.inlineData?.data) {
      return NextResponse.json({ error: 'Geen afbeelding ontvangen van Gemini' }, { status: 500 })
    }

    return NextResponse.json({
      base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType ?? 'image/png',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('extend-frame-ai crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
