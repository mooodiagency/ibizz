import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, SeoPage, SeoPersona, SeoTheme, SeoBrief, SeoWriterBrief, SeoLesson } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 120

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

type BriefContent = SeoWriterBrief['content']

export async function POST(req: NextRequest) {
  try {
    const apiKey = getEnv('ANTHROPIC_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY ontbreekt' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { pageId } = await req.json() as { pageId: string }
    if (!pageId) return NextResponse.json({ error: 'pageId verplicht' }, { status: 400 })

    // Laad page + alle context
    const { data: pageData } = await supabase.from('seo_pages').select('*').eq('id', pageId).single()
    if (!pageData) return NextResponse.json({ error: 'Page niet gevonden' }, { status: 404 })
    const page = pageData as SeoPage

    const [briefRes, personaRes, themeRes, lessonsRes] = await Promise.all([
      supabase.from('seo_briefs').select('*').eq('id', page.brief_id).single(),
      page.persona_id
        ? supabase.from('seo_personas').select('*').eq('id', page.persona_id).single()
        : Promise.resolve({ data: null }),
      page.theme_id
        ? supabase.from('seo_themes').select('*').eq('id', page.theme_id).single()
        : Promise.resolve({ data: null }),
      // Lessons learned filtered op zelfde persona + thema indien mogelijk
      page.persona_id
        ? supabase.from('seo_lessons').select('*').eq('brief_id', page.brief_id).eq('persona_id', page.persona_id)
        : supabase.from('seo_lessons').select('*').eq('brief_id', page.brief_id),
    ])

    const brief = briefRes.data as SeoBrief
    const persona = personaRes.data as SeoPersona | null
    const theme = themeRes.data as SeoTheme | null
    const lessons = (lessonsRes.data ?? []) as SeoLesson[]

    if (!brief) return NextResponse.json({ error: 'Parent brief niet gevonden' }, { status: 404 })

    // Bouw context voor Claude
    const personaContext = persona ? [
      `PERSONA: ${persona.name} ${persona.avatar_emoji}`,
      persona.one_liner ? `One-liner: ${persona.one_liner}` : '',
      persona.demographics ? `Demografie: ${JSON.stringify(persona.demographics)}` : '',
      persona.pains.length > 0 ? `Pijnpunten: ${persona.pains.join('; ')}` : '',
      persona.motivations.length > 0 ? `Motivaties: ${persona.motivations.join('; ')}` : '',
      persona.search_behavior.length > 0 ? `Zoekgedrag: ${persona.search_behavior.join('; ')}` : '',
      persona.channels.length > 0 ? `Kanalen: ${persona.channels.join(', ')}` : '',
    ].filter(Boolean).join('\n') : 'Geen persona gekoppeld'

    const themeContext = theme ? [
      `THEMA: ${theme.name}`,
      theme.description ? `Omschrijving: ${theme.description}` : '',
      theme.search_intent ? `Search intent: ${theme.search_intent}` : '',
    ].filter(Boolean).join('\n') : 'Geen thema gekoppeld'

    const lessonsContext = lessons.length > 0
      ? lessons.map(l => `- [${l.type.toUpperCase()}] ${l.description}${l.context ? ` (context: ${l.context})` : ''}`).join('\n')
      : 'Geen lessons learned beschikbaar voor deze persona/thema'

    const prompt = `Je bent een senior content strategist bij ibizz, een Nederlands digital agency. Schrijf een DETAILED CONTENT BRIEF voor een schrijver (typisch Caven, een externe copywriter) die een Nederlandstalige SEO-pagina gaat schrijven.

De brief moet zo compleet zijn dat de schrijver direct kan beginnen zonder verdere vragen, en zo specifiek dat hij past bij de persona en het merk.

KLANT BRIEF CONTEXT:
- Project: ${brief.title}
- Doel: ${brief.goal ?? '—'}
- Maand doel: ${brief.monthly_target ?? '—'}
- Markt: ${brief.primary_market}
- Website: ${brief.website_url ?? '—'}

${personaContext}

${themeContext}

PAGINA OPDRACHT:
- Onderwerp: ${page.topic}
- Target keyword: ${page.target_keyword ?? '—'}
- Secondary keywords: ${page.secondary_keywords.join(', ') || '—'}
- Search intent: ${page.search_intent ?? '—'}
- Aanvullende notities: ${page.notes ?? '—'}

LESSONS LEARNED (uit eerdere content voor deze persona/thema):
${lessonsContext}

VERPLICHTE OUTPUT — geldige JSON met deze structuur (geen markdown fences):
{
  "persona_name": "string — naam van de persona",
  "pain_addressed": "string — welk concreet pijnpunt van deze persona adresseert deze pagina?",
  "theme": "string — het thema",
  "message": "string — kernboodschap van de pagina in één zin",
  "target_keyword": "string — exact hoofdzoekwoord",
  "secondary_keywords": ["array van 5-8 nauw verwante zoekwoorden"],
  "search_intent": "string — informational/commercial/transactional/navigational",
  "tone_of_voice": "string — concrete tone: bijv. 'professioneel maar toegankelijk, jij-vorm, geen jargon, direct'",
  "word_count_target": 1500,
  "headings_structure": [
    "array van 5-8 suggested headings — concreet H2/H3 niveau, niet generiek"
  ],
  "must_include": [
    "array van 5-7 concrete elementen die in de tekst MOETEN staan — voorbeelden, getallen, CTA's, bewijs"
  ],
  "must_avoid": [
    "array van 3-5 dingen die de schrijver MOET vermijden — jargon, claims, off-brand woordgebruik"
  ],
  "lessons_learned": [
    "array — herhaal de relevante lessons learned voor deze schrijver, in kort actiegerichte bewoordingen"
  ],
  "internal_links": [
    "array — suggesties voor internal links: 'link naar [page topic] voor [reden]'"
  ],
  "examples_good": "string — kort voorbeeld van hoe een goede zin/paragraaf eruit zou kunnen zien voor deze persona",
  "examples_bad": "string — kort voorbeeld van wat NIET moet — een typisch off-brand of off-persona zin"
}

Pas word_count_target aan de complexiteit van de topic aan (informational topics meestal 1200-2000 woorden, commercial pages 600-1000, gidsende artikelen 2000-3500).`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
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
    const content = JSON.parse(extractJson(text)) as BriefContent

    // Opslaan in seo_writer_briefs
    // Check of er al een bestaat voor deze page — dan updaten ipv nieuw
    const { data: existing } = await supabase
      .from('seo_writer_briefs')
      .select('id')
      .eq('page_id', pageId)
      .maybeSingle()

    let writerBrief: SeoWriterBrief
    if (existing) {
      const { data, error: upErr } = await supabase
        .from('seo_writer_briefs')
        .update({ content, status: 'draft' })
        .eq('id', existing.id)
        .select()
        .single()
      if (upErr) throw new Error(upErr.message)
      writerBrief = data as SeoWriterBrief
    } else {
      const { data, error: insErr } = await supabase
        .from('seo_writer_briefs')
        .insert({ page_id: pageId, content, status: 'draft' })
        .select()
        .single()
      if (insErr) throw new Error(insErr.message)
      writerBrief = data as SeoWriterBrief
    }

    return NextResponse.json(writerBrief)
  } catch (err) {
    console.error('generate-writer-brief fout:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Onbekende fout' }, { status: 500 })
  }
}
