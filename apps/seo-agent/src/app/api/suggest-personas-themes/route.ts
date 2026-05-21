import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, SeoBrief } from '@ibizz/supabase'
import { cookies } from 'next/headers'
import { scrape, toLlmContext } from '@/lib/scraper'
import { getCached, setCached } from '@/lib/scrape-cache'

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

function extractJson(text: string): string {
  let t = text.trim()
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence) t = fence[1].trim()
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first !== -1 && last > first) t = t.slice(first, last + 1)
  return t
}

type PersonaSuggestion = {
  name: string
  avatar_emoji: string
  one_liner: string
  demographics: {
    age_range?: string
    occupation?: string
    location?: string
    family?: string
    income?: string
  }
  pains: string[]
  motivations: string[]
  search_behavior: string[]
  channels: string[]
}

type ThemeSuggestion = {
  name: string
  description: string
  search_intent: 'informational' | 'commercial' | 'transactional' | 'navigational'
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getEnv('ANTHROPIC_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY ontbreekt' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { briefId } = await req.json() as { briefId: string }
    if (!briefId) return NextResponse.json({ error: 'briefId verplicht' }, { status: 400 })

    const { data: briefData } = await supabase.from('seo_briefs').select('*').eq('id', briefId).single()
    if (!briefData) return NextResponse.json({ error: 'Brief niet gevonden' }, { status: 404 })
    const brief = briefData as SeoBrief

    // Scrape de klant website voor context
    let websiteContext = ''
    if (brief.website_url) {
      try {
        let page = getCached(brief.website_url)
        if (!page) {
          page = await scrape(brief.website_url)
          setCached(brief.website_url, page)
        }
        websiteContext = toLlmContext(page).slice(0, 6000)
      } catch (err) {
        console.warn('[suggest-personas-themes] scrape failed:', err)
      }
    }

    // Scrape concurrenten (max 2) voor extra context
    const competitorContext: string[] = []
    for (const compUrl of brief.competitors.slice(0, 2)) {
      try {
        let page = getCached(compUrl)
        if (!page) {
          page = await scrape(compUrl)
          setCached(compUrl, page)
        }
        competitorContext.push(`CONCURRENT (${compUrl}):\n${toLlmContext(page).slice(0, 2000)}`)
      } catch { /* skip */ }
    }

    const prompt = `Je bent een senior SEO content strategist bij ibizz, een Nederlands digital agency. Op basis van de klant website + concurrenten, stel 3-4 sterke personas en 5-6 inhoudsthema's voor.

BRIEF CONTEXT:
- Project: ${brief.title}
- Doel: ${brief.goal ?? '—'}
- Maand doel: ${brief.monthly_target ?? '—'}
- Markt: ${brief.primary_market}

${websiteContext ? `KLANT WEBSITE:\n${websiteContext}` : 'Geen klant website beschikbaar — werk op basis van de brief context.'}

${competitorContext.length > 0 ? competitorContext.join('\n\n') : ''}

INSTRUCTIES:
- Persona's moeten realistische ZAKELIJKE doelgroepen zijn die DEZE klant kan bedienen, niet generiek
- Geef per persona concrete pijnpunten in de woorden van de persona zelf
- Search behavior: lijst Google queries die deze persona daadwerkelijk zou typen (Nederlands)
- Thema's moeten content categorieën zijn waarmee de klant deze persona's bedient
- Hou rekening met de markt (${brief.primary_market})

OUTPUT — geldige JSON, geen markdown fences:
{
  "personas": [
    {
      "name": "string — concrete naam, bv. 'ZZP'er Sander'",
      "avatar_emoji": "één emoji die past, bijv. 👷 of 👩‍💻",
      "one_liner": "string — 1 zin typering",
      "demographics": {
        "age_range": "bijv. 30-45",
        "occupation": "string",
        "location": "string",
        "family": "string",
        "income": "string"
      },
      "pains": ["5 concrete pijnpunten in 1e persoon"],
      "motivations": ["4-5 motivaties / wensen"],
      "search_behavior": ["6-8 Google queries die deze persona typt"],
      "channels": ["welke kanalen volgt deze persona — Google, LinkedIn, Reddit, vakbladen, etc."]
    }
  ],
  "themes": [
    {
      "name": "string — kort, vetdrukbaar",
      "description": "1-2 zin omschrijving",
      "search_intent": "informational | commercial | transactional | navigational"
    }
  ]
}

Maak 3-4 personas (niet meer, kwaliteit boven kwantiteit) en 5-6 themes.`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 10000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('Anthropic error:', aiRes.status, errText.slice(0, 500))
      return NextResponse.json({ error: `AI request mislukt (${aiRes.status})` }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const text = aiData.content?.[0]?.text ?? ''
    const parsed = JSON.parse(extractJson(text)) as {
      personas: PersonaSuggestion[]
      themes: ThemeSuggestion[]
    }

    return NextResponse.json({
      personas: parsed.personas ?? [],
      themes: parsed.themes ?? [],
    })
  } catch (err) {
    console.error('suggest-personas-themes fout:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Onbekende fout' }, { status: 500 })
  }
}
