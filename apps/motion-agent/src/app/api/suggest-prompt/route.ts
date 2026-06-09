import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = 'gemini-2.5-flash'

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

type Suggestion = { title: string; prompt: string }
type SuggestResponse = { subjectType: string; productName?: string | null; analysis: string; suggestions: Suggestion[] }

export async function POST(req: NextRequest) {
  try {
    const apiKey = getEnv('GEMINI_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY ontbreekt' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as {
      imageBase64: string
      imageMimeType: string
      hint?: string
      aspectRatio?: string
      brandContext?: string
    }
    if (!body.imageBase64) return NextResponse.json({ error: 'imageBase64 verplicht' }, { status: 400 })

    const cleanBase64 = body.imageBase64.replace(/^data:[^;]+;base64,/, '')
    const hint = body.hint?.trim()
    const format = body.aspectRatio === '9:16' ? 'verticaal (9:16, Reels/TikTok)' : 'liggend (16:9)'

    const instruction = `Je bent een ervaren video-regisseur die image-to-video prompts schrijft voor Google Veo 3.1. Je krijgt een foto. Analyseer EERST nauwkeurig wat erop staat, en schrijf dan 3 sterke beweging-prompts.

${hint ? `De gebruiker geeft als richting/doel: "${hint}"\n` : ''}${body.brandContext ? `Merk-context: ${body.brandContext}\n` : ''}Doelformaat van de video: ${format}.

STAP 1 — HERKEN HET ONDERWERP
- Is het een PRODUCT (verpakking, pot, fles, doos, etc.), een PERSOON, of een SCENE/omgeving?
- Bij een product: LEES het etiket. Noteer merknaam, productnaam en belangrijke tekst (bv. gewicht, smaak). Zet dit in "analysis", bijvoorbeeld: "Glazen pot 'Thai @ Home — Kip Cashewnoten', 300gr, oranje etiket".

STAP 2 — SCHRIJF DE PROMPTS
Bij een PRODUCT geldt de IJZEREN REGEL: het product blijft EXACT zoals het is. De pot/verpakking, het etiket, de vorm, de kleuren en ALLE tekst mogen NOOIT veranderen, vervormen, hertekend of opnieuw gegenereerd worden. Het product staat centraal en is de held.
Beweging komt daarom UITSLUITEND van:
- de CAMERA (langzame push-in, trage orbit rondom het product, parallax, rack focus, sierlijke kraanbeweging)
- de OMGEVING (zachte stoom, dampende ingrediënten ernaast, props die subtiel in beeld komen, achtergrond-bokeh)
- het LICHT (warme glow die over het etiket strijkt, glinstering, schaduwen die bewegen)
Beschrijf het product expliciet als "statisch en onveranderd". Vermijd alles wat het product zelf laat bewegen of vervormen.
KADER-REGEL: het VOLLEDIGE product blijft de hele clip compleet in beeld en gecentreerd. Camerabewegingen (push-in, orbit) mogen het product NOOIT aansnijden of buiten beeld brengen — houd altijd ruime marge zodat de hele pot/verpakking zichtbaar blijft. Een inzoom mag, maar stopt ruim voor de randen van het product. Geen enkel deel van het product mag wegvallen.

Bij een PERSOON of SCENE: natuurlijke beweging is prima (de persoon beweegt, kijkt, glimlacht; de omgeving leeft).

ALGEMEEN
- Schrijf in het NEDERLANDS.
- Elke prompt is 1 tot 3 zinnen, direct bruikbaar (geen "de video toont", gewoon de regie).
- Maak de 3 prompts DUIDELIJK verschillend (bv. rustig/premium, dynamisch/appetijtelijk, en een verrassende invalshoek).
- Realistisch voor ~8 seconden, geen scene-wisselingen, geen nieuwe tekst in beeld.

Geef ALLEEN geldige JSON terug in dit formaat:
{
  "subjectType": "product | persoon | scene | overig",
  "productName": "merk + productnaam als het een product is, anders null",
  "analysis": "1 korte zin over wat je precies ziet (incl. etiket-tekst bij een product)",
  "suggestions": [
    { "title": "Korte titel (2-4 woorden)", "prompt": "De volledige beweging-prompt" },
    { "title": "...", "prompt": "..." },
    { "title": "...", "prompt": "..." }
  ]
}`

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: instruction },
              { inlineData: { mimeType: body.imageMimeType || 'image/jpeg', data: cleanBase64 } },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.9,
          },
        }),
      },
    )

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('Gemini suggest error:', aiRes.status, errText.slice(0, 500))
      let detail = errText.slice(0, 250)
      try {
        const j = JSON.parse(errText) as { error?: { message?: string; status?: string } }
        if (j?.error?.message) detail = `${j.error.status ?? 'error'}: ${j.error.message}`
      } catch { /* keep raw */ }
      return NextResponse.json({ error: `AI-suggesties mislukt (${aiRes.status}): ${detail}` }, { status: 500 })
    }

    const aiData = await aiRes.json() as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const raw = aiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!raw) return NextResponse.json({ error: 'Lege AI-response' }, { status: 500 })

    let parsed: SuggestResponse
    try {
      parsed = JSON.parse(raw) as SuggestResponse
    } catch {
      // soms wrapt het model alsnog in ```json
      const m = raw.match(/\{[\s\S]*\}/)
      if (!m) return NextResponse.json({ error: 'AI-output niet parsebaar' }, { status: 500 })
      parsed = JSON.parse(m[0]) as SuggestResponse
    }

    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .filter(s => s && typeof s.prompt === 'string' && s.prompt.trim())
          .map(s => ({ title: (s.title ?? 'Suggestie').trim(), prompt: s.prompt.trim() }))
          .slice(0, 5)
      : []

    if (suggestions.length === 0) {
      return NextResponse.json({ error: 'Geen suggesties gegenereerd' }, { status: 500 })
    }

    return NextResponse.json({
      subjectType: parsed.subjectType ?? 'overig',
      productName: parsed.productName ?? null,
      analysis: parsed.analysis ?? '',
      suggestions,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('suggest-prompt crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
