import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type {
  Database,
  VideoBrief,
  VideoScript,
  VideoResearch,
  Brand,
  VideoCastRole,
  VideoLocation,
  VideoProductieToets,
  VideoShot,
  VideoScriptLine,
  VideoTextOverlay,
  VideoShotTag,
  VideoKostencategorie,
} from '@ibizz/supabase'
import { cookies } from 'next/headers'
import { researchToLlmContext } from '@/lib/research-scraper'

export const runtime = 'nodejs'
export const maxDuration = 300

const MODEL = 'claude-sonnet-4-6'

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

const VALID_TAGS: VideoShotTag[] = ['REAL', 'CGI', 'STOCK']
const VALID_KOSTEN: VideoKostencategorie[] = ['LAAG', 'LAAG-MIDDEL', 'MIDDEL', 'MIDDEL-HOOG', 'HOOG']

type RawScript = {
  titel?: unknown
  doel?: unknown
  inzicht?: unknown
  locatie?: unknown
  lengte_sec?: unknown
  cast_rollen?: unknown
  productie_toets?: unknown
  hook?: unknown
  concept?: unknown
  script_lines?: unknown
  shotlist?: unknown
  tekst_in_beeld?: unknown
  montage?: unknown
  cta?: unknown
  caption?: unknown
  variaties?: unknown
}

function asString(v: unknown, fallback: string | null = null): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

function asInt(v: unknown, fallback: number | null = null): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v)
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function normalizeCastRoles(v: unknown): VideoCastRole[] {
  if (!Array.isArray(v)) return []
  return v
    .map((r): VideoCastRole | null => {
      if (!r || typeof r !== 'object') return null
      const row = r as Record<string, unknown>
      const rol = asString(row.rol)
      if (!rol) return null
      return {
        rol,
        aantal: asInt(row.aantal, 1) ?? 1,
        omschrijving: asString(row.omschrijving),
      }
    })
    .filter((x): x is VideoCastRole => x !== null)
}

function normalizeProductieToets(v: unknown): VideoProductieToets | null {
  if (!v || typeof v !== 'object') return null
  const row = v as Record<string, unknown>
  const rawKost = asString(row.kostencategorie, 'MIDDEL')!.toUpperCase().replace(' ', '-')
  const kostencategorie: VideoKostencategorie = (VALID_KOSTEN as string[]).includes(rawKost)
    ? (rawKost as VideoKostencategorie)
    : 'MIDDEL'
  return {
    cast: asString(row.cast) ?? '',
    locatie: asString(row.locatie) ?? '',
    props: asString(row.props) ?? '',
    permits: asString(row.permits) ?? '',
    productietijd: asString(row.productietijd) ?? '',
    risico: asString(row.risico) ?? '',
    kostencategorie,
  }
}

function normalizeScriptLines(v: unknown): VideoScriptLine[] {
  if (!Array.isArray(v)) return []
  return v
    .map((line): VideoScriptLine | null => {
      if (!line || typeof line !== 'object') return null
      const row = line as Record<string, unknown>
      const text = asString(row.text)
      if (!text) return null
      const type = row.type === 'direction' ? 'direction' : 'vo'
      return { type, text }
    })
    .filter((x): x is VideoScriptLine => x !== null)
}

function normalizeShotlist(v: unknown): VideoShot[] {
  if (!Array.isArray(v)) return []
  return v
    .map((shot, idx): VideoShot | null => {
      if (!shot || typeof shot !== 'object') return null
      const row = shot as Record<string, unknown>
      const beschrijving = asString(row.beschrijving)
      if (!beschrijving) return null
      const rawTag = asString(row.tag, 'REAL')!.toUpperCase()
      const tag: VideoShotTag = (VALID_TAGS as string[]).includes(rawTag) ? (rawTag as VideoShotTag) : 'REAL'
      return {
        nummer: asInt(row.nummer, idx + 1) ?? idx + 1,
        tag,
        beschrijving,
        start_sec: asInt(row.start_sec, 0) ?? 0,
        end_sec: asInt(row.end_sec, 0) ?? 0,
      }
    })
    .filter((x): x is VideoShot => x !== null)
}

function normalizeOverlays(v: unknown): VideoTextOverlay[] {
  if (!Array.isArray(v)) return []
  return v
    .map((ov): VideoTextOverlay | null => {
      if (!ov || typeof ov !== 'object') return null
      const row = ov as Record<string, unknown>
      const text = asString(row.text)
      if (!text) return null
      return {
        start_sec: asInt(row.start_sec, 0) ?? 0,
        end_sec: asInt(row.end_sec, null),
        text,
      }
    })
    .filter((x): x is VideoTextOverlay => x !== null)
}

function buildPrompt(args: {
  brandName: string
  brief: VideoBrief
  research: VideoResearch[]
  aantal: number
  lengteSec: number
  creatieveRichting: string
}): string {
  const { brandName, brief, research, aantal, lengteSec, creatieveRichting } = args

  const castContext = brief.cast_totaal && brief.cast_totaal.length > 0
    ? brief.cast_totaal.map(c => `- ${c.aantal}× ${c.rol}${c.omschrijving ? ` — ${c.omschrijving}` : ''}`).join('\n')
    : '(geen cast bundel opgegeven — kies zelf passende rollen per script)'

  const locatieContext = brief.locaties && brief.locaties.length > 0
    ? brief.locaties.map(l => `- ${l.naam}${l.toelichting ? ` — ${l.toelichting}` : ''}${l.scripts.length > 0 ? ` (gepland voor scripts: ${l.scripts.join(', ')})` : ''}`).join('\n')
    : '(geen vaste locaties opgegeven — kies zelf realistische publieke locaties)'

  // Research videos — alleen meegeven als er items zijn
  const researchBlock = research.length > 0
    ? `\n\n${researchToLlmContext(research)}\n**Gebruik deze referenties als inspiratie**, niet om te kopiëren. Wat werkt qua hooks, ritme, captions, hook-patterns? Vermijd dezelfde concepten letterlijk overdoen.`
    : ''

  return `Je bent een senior Nederlandse creative director gespecialiseerd in TikTok, Instagram Reels en YouTube Shorts voor merken. Je schrijft shooting briefs op productie-niveau: niet alleen wat de kijker hoort/ziet, maar ook hoe het gefilmd wordt, met welke cast, kostenplaatje en risico's.

Genereer ${aantal} unieke scripts voor onderstaand merk en draaidag. Elk script moet visueel anders zijn — varieer in hook-techniek (fysieke opening, vergelijking, POV, look-around, mockumentary, before/after, walk-by), in toon en in cast. Geen 8 variaties op hetzelfde idee.

# CONTEXT

**Merk:** ${brandName}
**Draaidag:** ${brief.dag_titel}${brief.intro_subtitel ? ` (${brief.intro_subtitel})` : ''}
${brief.overzicht ? `\n**Overzicht:** ${brief.overzicht}` : ''}
${brief.brand_context ? `\n**Brand context:**\n${brief.brand_context}` : ''}

**Cast totaal (bundel over alle scripts):**
${castContext}

**Locaties dag:**
${locatieContext}

**Creatieve richting voor deze sessie:**
${creatieveRichting || '(geen specifieke richting — gebruik je eigen oordeel passend bij het merk)'}

**Doel-lengte per script:** ~${lengteSec} seconden${researchBlock}

# OUTPUT FORMAT

Geef **alleen** geldige JSON terug, geen uitleg eromheen. Exacte structuur:

\`\`\`json
{
  "scripts": [
    {
      "titel": "Korte pakkende titel zonder script-nummer",
      "doel": "1-2 zinnen — waarom bestaat deze video, wat wil hij bereiken",
      "inzicht": "Het psychologische/culturele inzicht waar het concept op leunt",
      "locatie": "Concrete plek — bestaande publieke locatie indien mogelijk",
      "lengte_sec": ${lengteSec},
      "cast_rollen": [
        { "rol": "hoofdactrice (drager)", "aantal": 1, "omschrijving": "25-40, casual reisstijl" }
      ],
      "productie_toets": {
        "cast": "1 actrice",
        "locatie": "Eindhoven Airport publiek",
        "props": "Het product, casual outfit",
        "permits": "Geen — DJI OSMO Pocket 3 handheld",
        "productietijd": "3 uur incl. reis",
        "risico": "Drukte kan opnames hinderen — vroege ochtend filmen",
        "kostencategorie": "LAAG"
      },
      "hook": "De fysieke/visuele openingsmove in 1-2 zinnen — geen 'in dit filmpje laten we zien'",
      "concept": "Hoe de scene zich ontvouwt, 2-4 zinnen",
      "script_lines": [
        { "type": "direction", "text": "(geen voice-over tijdens vang — alleen ambient + lichte kreun)" },
        { "type": "vo", "text": "Twee soorten reizigers." },
        { "type": "vo", "text": "Eentje staat hier." },
        { "type": "direction", "text": "(beat)" },
        { "type": "vo", "text": "De ander loopt door." }
      ],
      "shotlist": [
        { "nummer": 1, "tag": "REAL", "beschrijving": "Wide — vrouw staat op vliegveld, tas vliegt vanuit links in beeld", "start_sec": 0, "end_sec": 1 },
        { "nummer": 2, "tag": "REAL", "beschrijving": "Slow-mo close-up — ze vangt 'm met beide handen, inspanning op gezicht", "start_sec": 1, "end_sec": 3 }
      ],
      "tekst_in_beeld": [
        { "start_sec": 8, "end_sec": null, "text": "Twee soorten reizigers." },
        { "start_sec": 20, "end_sec": null, "text": "Eentje wacht. Eentje loopt." }
      ],
      "montage": "Editing-aanwijzingen: slow-mo bij vang, sound design, muziek-keuze, ritme",
      "cta": "Korte krachtige afsluiter — bv. 'PRODUCT. Link in bio.'",
      "caption": "Social caption — pakkend, kort, geen hashtag-spam",
      "variaties": [
        "Alternatieve hook/CTA regel 1",
        "Alternatieve hook/CTA regel 2",
        "Alternatieve hook/CTA regel 3"
      ]
    }
  ]
}
\`\`\`

# REGELS

1. **Nederlandse taal**, droog en direct. Geen marketing-fluff ("ervaar de revolutie", "ontdek vandaag nog"). Geen Engelse marketing-leenwoorden.
2. **Geen em-dashes als zin-scheider** in voice-over regels — gebruik aparte regels. Em-dashes ALLEEN in titels en shotlist-beschrijvingen om visuele scheiding aan te geven.
3. **Shotlist tijdspannes moeten optellen** tot rond de \`lengte_sec\`. Eerste shot start op 0, laatste shot eindigt op of net voor \`lengte_sec\`.
4. **Hook MOET in de eerste 2-3 seconden** een fysieke of visuele actie zijn, geen praat-opening.
5. **Voice-over regels kort** — meestal 3-7 woorden per regel. Lees-tempo is langzaam.
6. **Tekst in beeld** complementeert voice-over, herhaalt 'm niet. 2-4 overlays per video. Laatste overlay vaak \`end_sec: null\` voor "tot eind".
7. **Productie-toets** moet realistisch zijn voor Nederlandse productie:
   - cast: aantal mensen
   - props: concrete spullen
   - permits: "Geen" als publieke ruimte; vermeld als nodig (NS, particuliere locatie, etc.)
   - productietijd: incl. reizen
   - risico: 1 zin
   - kostencategorie: LAAG / LAAG-MIDDEL / MIDDEL / MIDDEL-HOOG / HOOG
8. **3 variaties** per script — alternatieve invalshoeken op hook of CTA (geen volledige scripts).
9. **Variëer tussen scripts**: minimaal 4 verschillende hook-types (fysieke actie, vergelijking, POV, look-around, before/after, mockumentary, walk-by, etc.).
10. **Cast_rollen per script**: 1-3 rollen, kort en concreet (geen casting-spec, wel essentie).

Begin direct met de JSON, geen inleiding.`
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getEnv('ANTHROPIC_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY ontbreekt' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as {
      briefId: string
      aantal?: number
      lengteSec?: number
      creatieveRichting?: string
      mode?: 'replace' | 'append'
    }
    if (!body.briefId) return NextResponse.json({ error: 'briefId verplicht' }, { status: 400 })

    const aantal = Math.max(1, Math.min(20, body.aantal ?? 8))
    const lengteSec = Math.max(10, Math.min(120, body.lengteSec ?? 35))
    const creatieveRichting = (body.creatieveRichting ?? '').trim()
    const mode = body.mode === 'append' ? 'append' : 'replace'

    // Brief + brand laden
    const briefRes = await supabase.from('video_briefs').select('*').eq('id', body.briefId).single()
    if (briefRes.error || !briefRes.data) {
      return NextResponse.json({ error: 'Brief niet gevonden' }, { status: 404 })
    }
    const brief = briefRes.data as VideoBrief

    let brandName = 'het merk'
    if (brief.brand_id) {
      const brRes = await supabase.from('brands').select('*').eq('id', brief.brand_id).single()
      if (brRes.data) brandName = (brRes.data as Brand).name
    }

    // Research items meegeven aan AI (top 15 — meer is overkill voor de prompt)
    const researchRes = await supabase
      .from('video_research')
      .select('*')
      .eq('brief_id', body.briefId)
      .order('views', { ascending: false, nullsFirst: false })
      .limit(15)
    const research = (researchRes.data ?? []) as VideoResearch[]

    // Prompt opbouwen
    const prompt = buildPrompt({ brandName, brief, research, aantal, lengteSec, creatieveRichting })

    // Claude aanroepen
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
      console.error('Anthropic error:', aiRes.status, errText.slice(0, 800))
      return NextResponse.json({ error: `AI request mislukt (${aiRes.status})` }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const raw = (aiData.content?.[0]?.text ?? '') as string
    if (!raw) return NextResponse.json({ error: 'Lege AI response' }, { status: 500 })

    // JSON parsen
    let parsed: { scripts?: RawScript[] }
    try {
      parsed = JSON.parse(extractJson(raw))
    } catch (e) {
      console.error('JSON parse error:', e, raw.slice(0, 600))
      return NextResponse.json({ error: 'AI output kon niet geparsed worden als JSON' }, { status: 500 })
    }

    if (!parsed.scripts || !Array.isArray(parsed.scripts) || parsed.scripts.length === 0) {
      return NextResponse.json({ error: 'AI gaf geen scripts terug' }, { status: 500 })
    }

    // Normaliseren naar VideoScript Insert shape
    const startNummer = mode === 'append'
      ? ((await supabase.from('video_scripts').select('nummer').eq('brief_id', body.briefId).order('nummer', { ascending: false }).limit(1).maybeSingle()).data?.nummer ?? 0) + 1
      : 1

    const inserts = parsed.scripts.map((s, idx) => ({
      brief_id: body.briefId,
      nummer: startNummer + idx,
      titel: asString(s.titel) ?? `Script ${startNummer + idx}`,
      doel: asString(s.doel),
      inzicht: asString(s.inzicht),
      locatie: asString(s.locatie),
      lengte_sec: asInt(s.lengte_sec, lengteSec),
      cast_rollen: normalizeCastRoles(s.cast_rollen),
      productie_toets: normalizeProductieToets(s.productie_toets),
      hook: asString(s.hook),
      concept: asString(s.concept),
      script_lines: normalizeScriptLines(s.script_lines),
      shotlist: normalizeShotlist(s.shotlist),
      tekst_in_beeld: normalizeOverlays(s.tekst_in_beeld),
      montage: asString(s.montage),
      cta: asString(s.cta),
      caption: asString(s.caption),
      variaties: Array.isArray(s.variaties)
        ? (s.variaties as unknown[]).map(v => asString(v)).filter((v): v is string => v !== null)
        : [],
    }))

    // Bij replace mode: bestaande scripts verwijderen
    if (mode === 'replace') {
      await supabase.from('video_scripts').delete().eq('brief_id', body.briefId)
    }

    const insertRes = await supabase.from('video_scripts').insert(inserts).select()
    if (insertRes.error) {
      console.error('Insert error:', insertRes.error)
      return NextResponse.json({ error: `Opslaan mislukt: ${insertRes.error.message}` }, { status: 500 })
    }

    return NextResponse.json({ scripts: insertRes.data as VideoScript[] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('generate-scripts crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
