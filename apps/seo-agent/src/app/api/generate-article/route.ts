import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, SeoPage, SeoBrief, SeoWriterBrief, SeoArticle } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 300

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

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Strip AI-tells uit de output. Vooral em-dashes (—) en en-dashes (–)
 * die Claude graag gebruikt maar voor mensenoog direct herkenbaar zijn.
 * Ook horizontale lijnen (--- in markdown) weghalen — die geven lelijke
 * grijze strepen in de preview.
 */
function stripAiTells(text: string): string {
  return text
    // Horizontale regels strippen (---, ***, ___ op eigen regel)
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    // " — " patroon (em-dash tussen spaties) → punt + spatie
    .replace(/\s+—\s+/g, '. ')
    .replace(/\s+–\s+/g, '. ')
    // alleenstaande em-dash → komma
    .replace(/—/g, ',')
    .replace(/–/g, '-')
    // Dubbele punten ". ." opruimen
    .replace(/\.\s+\./g, '.')
    // Capitaliseer na ". " als de volgende letter klein is (basic fix)
    .replace(/\.\s+([a-z])/g, (_, c) => `. ${c.toUpperCase()}`)
    // Triple+ newlines opruimen
    .replace(/\n{3,}/g, '\n\n')
}

const MODEL = 'claude-sonnet-4-6'

export async function POST(req: NextRequest) {
  try {
    const apiKey = getEnv('ANTHROPIC_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY ontbreekt' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    let userName: string | null = null
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    if (profile) userName = profile.name

    const { pageId } = await req.json() as { pageId: string }
    if (!pageId) return NextResponse.json({ error: 'pageId verplicht' }, { status: 400 })

    // Laad page + writer brief + brief context
    const [pageRes, wbRes] = await Promise.all([
      supabase.from('seo_pages').select('*').eq('id', pageId).single(),
      supabase.from('seo_writer_briefs').select('*').eq('page_id', pageId).maybeSingle(),
    ])
    const page = pageRes.data as SeoPage | null
    const writerBrief = wbRes.data as SeoWriterBrief | null

    if (!page) return NextResponse.json({ error: 'Page niet gevonden' }, { status: 404 })
    if (!writerBrief) {
      return NextResponse.json({ error: 'Geen writer brief gevonden voor deze pagina — genereer eerst een writer brief' }, { status: 400 })
    }

    const { data: briefData } = await supabase.from('seo_briefs').select('*').eq('id', page.brief_id).single()
    const brief = briefData as SeoBrief

    const wbContent = writerBrief.content

    const prompt = `Je bent een ervaren Nederlandse SEO content schrijver bij ibizz. Schrijf een COMPLEET artikel op basis van de onderstaande writer brief. De content moet klaar zijn om gepubliceerd te worden — geen placeholders, geen "[invullen]", geen samenvatting.

BRIEF CONTEXT:
- Project: ${brief.title}
- Markt: ${brief.primary_market}

ONDERWERP: ${page.topic}

PERSONA: ${wbContent.persona_name}
PIJNPUNT: ${wbContent.pain_addressed}
THEMA: ${wbContent.theme}
KERNBOODSCHAP: ${wbContent.message}

SEO SETUP:
- Target keyword: ${wbContent.target_keyword}
- Secondary keywords: ${wbContent.secondary_keywords.join(', ')}
- Search intent: ${wbContent.search_intent}
- Doel woordlengte: ${wbContent.word_count_target} woorden (mag 10% afwijken)

TONE OF VOICE: ${wbContent.tone_of_voice}

HEADING STRUCTUUR (volgen):
${wbContent.headings_structure.map((h, i) => `${i + 1}. ${h}`).join('\n')}

VERPLICHTE ELEMENTEN (allemaal verwerken):
${wbContent.must_include.map(m => `- ${m}`).join('\n')}

VERMIJD:
${wbContent.must_avoid.map(m => `- ${m}`).join('\n')}

${wbContent.lessons_learned.length > 0 ? `LESSONS LEARNED (toepassen):\n${wbContent.lessons_learned.map(l => `- ${l}`).join('\n')}` : ''}

${wbContent.internal_links.length > 0 ? `INTERNAL LINKS (verwerken als markdown links naar plausibele paden):\n${wbContent.internal_links.map(l => `- ${l}`).join('\n')}` : ''}

${wbContent.examples_good ? `VOORBEELD GOED:\n${wbContent.examples_good}` : ''}
${wbContent.examples_bad ? `VOORBEELD VERMIJDEN:\n${wbContent.examples_bad}` : ''}

INSTRUCTIES — schrijfstijl:
- Schrijf NEDERLANDS, native, niet vertaald uit Engels
- Schrijf in JIJ-vorm tenzij tone of voice anders zegt
- Korte zinnen (gemiddeld 15 woorden). Korte alinea's (2-4 zinnen)
- Lees-niveau B1: simpel, helder, geen jargon. Schrijf zoals je een collega aan de keukentafel iets uitlegt
- Actief, niet passief. "Wij bouwen" niet "er wordt gebouwd"
- Geen meta-commentaar ("in dit artikel ga ik..."). Direct waarde leveren.

⛔ ABSOLUTE VERBODEN — dit zijn AI-tells, vermijd KOSTE WAT HET KOST:
- GEEN em-dashes (—) of en-dashes (–). NOOIT. Gebruik in plaats daarvan: punt, komma, of dubbele punt
- GEEN horizontale lijnen (\`---\`, \`***\`, of \`___\`) tussen secties. Headings (H2/H3) zorgen vanzelf voor scheiding.
- Geen "het is essentieel om", "het belang van", "uiteindelijk", "tot slot", "kortom"
- Geen lege overgangs-zinnen ("Laten we eens kijken naar...")
- Geen overdreven adjectieven (zoals "ongelooflijk", "revolutionair", "baanbrekend")
- Geen lijstjes met meer dan 5 items (kort houden)

MARKDOWN STRUCTUUR:
- Eerste regel = exact ÉÉN H1 (de artikel titel): \`# Titel\`
- H2 voor hoofdsecties (de logische blokken van het verhaal)
- H3 voor subsecties binnen een H2
- H4 voor concrete punten binnen een H3 (zelden nodig)
- H5/H6 vermijd, te diep
- Eerste paragraaf onder H1 = hook + belofte: wat leert de lezer?
- Target keyword komt voor in: H1, eerste paragraaf, minstens één H2, en 2-3× natuurlijk in de tekst

LINKS — KRITIEK BELANGRIJK:
- INTERNE LINKS: gebruik markdown \`[anchor tekst](/pad)\` voor verwijzingen naar andere paginas op de klantsite (\`brief.website_url\`). Plaats er minimaal 2-3 in het artikel. Gebruik de internal_links suggesties uit de brief als richtlijn voor anchor + path.
- EXTERNE LINKS: gebruik markdown \`[anchor tekst](https://externe-site.nl)\` voor verwijzingen naar autoriteiten of bronnen. Plaats er 1-3 in het artikel waar je een claim doet die bewijs nodig heeft. Gebruik echte bekende NL bronnen (consumentenbond, belastingdienst, rijksoverheid, kvk, wikipedia, nu.nl, etc.) — NIET verzonnen URLs.
- Externe links openen automatisch in nieuwe tab door onze renderer, jij hoeft alleen de markdown link te schrijven.

SLOT:
- CTA aan het einde bij commercial/transactional intent (zelfs subtiel: "Wil je weten wat dit voor jou betekent? [Plan een gratis adviesgesprek](/contact)")
- Bij informational intent: korte conclusie + verwijzing naar verwante pagina

OUTPUT — geldige JSON, geen markdown fences eromheen:
{
  "title": "string — exacte H1 / pagina titel (50-60 char)",
  "meta_title": "string — SEO title tag (max 60 char), inclusief target keyword vooraan",
  "meta_description": "string — meta description (140-160 char), inclusief target keyword + CTA",
  "content_markdown": "string — VOLLEDIGE artikel in markdown, beginnend met # [titel]"
}`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
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
      title: string
      meta_title: string
      meta_description: string
      content_markdown: string
    }

    // Deactivate andere artikelen voor deze pagina — nieuwe wordt actief
    await supabase.from('seo_articles').update({ is_active: false }).eq('page_id', pageId)

    // Strip AI-tells (em-dashes etc) voor opslag
    const cleanMarkdown = stripAiTells(parsed.content_markdown)
    const cleanMetaDesc = stripAiTells(parsed.meta_description)

    const { data: inserted, error: insErr } = await supabase.from('seo_articles').insert({
      page_id: pageId,
      writer_brief_id: writerBrief.id,
      title: parsed.title,
      meta_title: parsed.meta_title,
      meta_description: cleanMetaDesc,
      content_markdown: cleanMarkdown,
      model: MODEL,
      word_count: countWords(cleanMarkdown),
      status: 'draft',
      is_active: true,
      created_by: user.id,
      created_by_name: userName,
    }).select().single()

    if (insErr) throw new Error(insErr.message)

    // Zet page status door naar in_progress als hij nog op idea/planned stond
    if (page.status === 'idea' || page.status === 'planned') {
      await supabase.from('seo_pages').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', pageId)
    }

    return NextResponse.json(inserted as SeoArticle)
  } catch (err) {
    console.error('generate-article fout:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Onbekende fout' }, { status: 500 })
  }
}
