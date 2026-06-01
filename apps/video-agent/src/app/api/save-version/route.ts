import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type {
  Database, VideoBrief, VideoScript, VideoBriefVersion,
  VideoBriefVersionSnapshot, VideoBriefChange,
} from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 120

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

/**
 * Compacte representatie van een snapshot voor de AI changelog — strip
 * nulls en empty arrays zodat het JSON-volume halveert.
 */
function compactSnapshot(brief: VideoBrief, scripts: VideoScript[]): unknown {
  function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const out: Partial<T> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue
      if (Array.isArray(v) && v.length === 0) continue
      if (typeof v === 'string' && v.trim() === '') continue
      ;(out as Record<string, unknown>)[k] = v
    }
    return out
  }
  return {
    brief: clean({
      dag_titel: brief.dag_titel,
      intro_subtitel: brief.intro_subtitel,
      overzicht: brief.overzicht,
      brand_context: brief.brand_context,
      cast_totaal: brief.cast_totaal,
      locaties: brief.locaties,
    }),
    scripts: scripts.map(s => clean({
      nummer: s.nummer,
      titel: s.titel,
      doel: s.doel,
      inzicht: s.inzicht,
      locatie: s.locatie,
      lengte_sec: s.lengte_sec,
      cast_rollen: s.cast_rollen,
      productie_toets: s.productie_toets,
      hook: s.hook,
      concept: s.concept,
      script_lines: s.script_lines,
      shotlist: s.shotlist,
      tekst_in_beeld: s.tekst_in_beeld,
      montage: s.montage,
      cta: s.cta,
      caption: s.caption,
      variaties: s.variaties,
    })),
  }
}

function buildChangelogPrompt(args: {
  prevVersie: number
  newVersie: number
  prevSnapshot: unknown
  currentSnapshot: unknown
}): string {
  return `Je bent een changelog-assistent voor een video shooting brief. Vergelijk twee versies en schrijf een korte Nederlandse changelog van wat er **meaningful** veranderd is (niet elke spelfix).

# OUTPUT FORMAT

Geef alleen JSON terug, geen uitleg eromheen:

\`\`\`json
{
  "changes": [
    { "script_nummer": null, "veld": "brand_context", "tekst": "→ Brand context vernieuwd met USPs en doelgroep" },
    { "script_nummer": 1, "veld": "hook", "tekst": "→ Script 1: nieuwe vang-hook — actrice vangt FRENKY als opening" },
    { "script_nummer": 9, "veld": null, "tekst": "→ Script 9 toegevoegd: De rolkoffer-monoloog" }
  ]
}
\`\`\`

# REGELS

- **\`script_nummer\`**: het nummer van het script dat veranderd is (1..N). Voor brief-niveau wijzigingen (dag_titel, overzicht, brand_context, cast_totaal, locaties): \`null\`.
- **\`veld\`**: korte naam van het veld dat veranderd is (\`hook\`, \`shotlist\`, \`brand_context\`, etc.). Voor toegevoegde/verwijderde scripts: \`null\`.
- **\`tekst\`**: begint altijd met "→ " en is in 1 lijn samengevat (max ~120 chars). Nederlands, droog, geen marketing.
- **Toegevoegd script**: "→ Script N toegevoegd: {nieuwe titel}"
- **Verwijderd script**: "→ Script N verwijderd: {oude titel}"
- **Brief-level**: "→ Brand context bijgewerkt", "→ Cast totaal: extra figuranten toegevoegd"
- Vermeld **alleen meaningful changes** — niet elke komma. Als een script-titel cosmetisch geupdate is maar de inhoud gelijk blijft: noem dat als "→ Script N: titel bijgewerkt". Maar dezelfde tekst met een spatie verschil: skip.
- Als er **niets meaningful veranderd is**: geef \`{"changes": []}\` terug.
- **Geen em-dashes** als zin-scheider — gebruik komma's.

# PREVIOUS (v${args.prevVersie})

${JSON.stringify(args.prevSnapshot, null, 2)}

# CURRENT (wordt v${args.newVersie})

${JSON.stringify(args.currentSnapshot, null, 2)}

Begin direct met de JSON.`
}

function normalizeChanges(raw: unknown): VideoBriefChange[] {
  if (!raw || typeof raw !== 'object') return []
  const arr = (raw as { changes?: unknown }).changes
  if (!Array.isArray(arr)) return []
  const out: VideoBriefChange[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const tekst = typeof row.tekst === 'string' ? row.tekst.trim() : ''
    if (!tekst) continue
    const sn = row.script_nummer
    const script_nummer = (typeof sn === 'number' && Number.isFinite(sn)) ? Math.round(sn) : null
    const veld = typeof row.veld === 'string' && row.veld.trim() ? row.veld.trim() : null
    out.push({ script_nummer, veld, tekst })
  }
  return out
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as { briefId: string }
    if (!body.briefId) return NextResponse.json({ error: 'briefId verplicht' }, { status: 400 })

    // Brief + scripts + vorige snapshot parallel
    const [briefRes, scriptsRes, prevVersionRes] = await Promise.all([
      supabase.from('video_briefs').select('*').eq('id', body.briefId).single(),
      supabase.from('video_scripts').select('*').eq('brief_id', body.briefId).order('nummer', { ascending: true }),
      supabase.from('video_brief_versions').select('*').eq('brief_id', body.briefId).order('versie', { ascending: false }).limit(1).maybeSingle(),
    ])

    if (briefRes.error || !briefRes.data) {
      return NextResponse.json({ error: 'Brief niet gevonden' }, { status: 404 })
    }
    const brief = briefRes.data as VideoBrief
    const scripts = (scriptsRes.data ?? []) as VideoScript[]
    const prevVersion = prevVersionRes.data as VideoBriefVersion | null

    const versie = brief.versie
    const newVersie = versie + 1

    // Snapshot van huidige staat (voor opslag — volledig, niet de afgeslankte versie)
    const snapshot: VideoBriefVersionSnapshot = { brief, scripts }

    // Changelog genereren als er een vorige versie is
    let changelog: VideoBriefChange[] = []
    if (prevVersion) {
      const apiKey = getEnv('ANTHROPIC_API_KEY')
      if (!apiKey) {
        return NextResponse.json({ error: 'ANTHROPIC_API_KEY ontbreekt voor changelog generatie' }, { status: 500 })
      }

      const prevSnap = prevVersion.snapshot
      const prevCompact = compactSnapshot(prevSnap.brief, prevSnap.scripts)
      const currentCompact = compactSnapshot(brief, scripts)

      const prompt = buildChangelogPrompt({
        prevVersie: prevVersion.versie,
        newVersie: versie,
        prevSnapshot: prevCompact,
        currentSnapshot: currentCompact,
      })

      const promptChars = prompt.length
      const tokenEstimate = Math.round(promptChars / 3.5)
      console.log(`[save-version] changelog prompt: ${promptChars} chars (~${tokenEstimate} tokens)`)

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!aiRes.ok) {
        const errText = await aiRes.text()
        console.error('Anthropic changelog error:', aiRes.status, errText.slice(0, 800))
        let detail = errText.slice(0, 300)
        try {
          const errJson = JSON.parse(errText) as { error?: { type?: string; message?: string } }
          if (errJson?.error?.message) detail = `${errJson.error.type ?? 'error'}: ${errJson.error.message}`
        } catch { /* keep raw */ }
        return NextResponse.json({ error: `Changelog AI mislukt (${aiRes.status}): ${detail}` }, { status: 500 })
      }

      const aiData = await aiRes.json()
      const raw = (aiData.content?.[0]?.text ?? '') as string

      try {
        const parsed = JSON.parse(extractJson(raw))
        changelog = normalizeChanges(parsed)
      } catch (e) {
        console.error('Changelog JSON parse error:', e, raw.slice(0, 500))
        // Niet hard falen — sla op zonder changelog
        changelog = [{ script_nummer: null, veld: null, tekst: '→ Versie opgeslagen (changelog kon niet automatisch gegenereerd worden)' }]
      }
    }

    // Insert version
    const insertRes = await supabase
      .from('video_brief_versions')
      .insert({
        brief_id: body.briefId,
        versie,
        snapshot,
        changelog,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertRes.error) {
      return NextResponse.json({ error: `Snapshot opslaan mislukt: ${insertRes.error.message}` }, { status: 500 })
    }

    // Bump brief.versie
    const updateRes = await supabase
      .from('video_briefs')
      .update({ versie: newVersie })
      .eq('id', body.briefId)
      .select()
      .single()

    if (updateRes.error) {
      return NextResponse.json({ error: `Brief versie bumpen mislukt: ${updateRes.error.message}` }, { status: 500 })
    }

    return NextResponse.json({
      version: insertRes.data as VideoBriefVersion,
      brief: updateRes.data as VideoBrief,
      changes: changelog.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('save-version crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
