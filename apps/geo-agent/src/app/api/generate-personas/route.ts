import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, GeoProject, GeoPersona, GeoPersonaDemographics } from '@ibizz/supabase'
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
  const f = t.indexOf('{'); const l = t.lastIndexOf('}')
  if (f !== -1 && l > f) t = t.slice(f, l + 1)
  return t
}

/** Best-effort: meest recente landelijke bevolkings-kerncijfers van CBS (StatLine 37296ned). */
async function fetchCbsFigures(): Promise<Record<string, unknown> | null> {
  try {
    const url = 'https://opendata.cbs.nl/ODataApi/odata/37296ned/TypedDataSet?$orderby=Perioden%20desc&$top=1'
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(9000) })
    if (!res.ok) { console.warn(`[generate-personas] CBS niet bereikbaar (${res.status})`); return null }
    const data = await res.json() as { value?: Record<string, unknown>[] }
    return data.value?.[0] ?? null
  } catch (e) { console.warn('[generate-personas] CBS fetch fout:', e instanceof Error ? e.message : e); return null }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getEnv('ANTHROPIC_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY ontbreekt' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as { projectId: string; count?: number }
    if (!body.projectId) return NextResponse.json({ error: 'projectId verplicht' }, { status: 400 })
    const count = Math.max(2, Math.min(6, body.count ?? 4))

    const projRes = await supabase.from('geo_projects').select('*').eq('id', body.projectId).single()
    if (projRes.error || !projRes.data) return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    const project = projRes.data as GeoProject

    let brandName = project.brand_terms[0] ?? project.name
    if (project.brand_id) {
      const b = await supabase.from('brands').select('name').eq('id', project.brand_id).single()
      if (b.data?.name) brandName = b.data.name
    }

    const cbs = await fetchCbsFigures()
    const cbsBlock = cbs
      ? `\n# CBS BEVOLKINGS-KERNCIJFERS (StatLine 37296ned, meest recente periode — gebruik als demografische grounding)\n${JSON.stringify(cbs).slice(0, 2500)}\n`
      : '\n# CBS\n(Geen live CBS-cijfers beschikbaar — gebruik je kennis van de Nederlandse demografie.)\n'

    const prompt = `Je bent een doelgroep-onderzoeker. Bouw ${count} realistische persona's voor de doelgroep van dit merk/deze categorie in ${project.market}. Grond de demografie op echte Nederlandse cijfers (CBS).

# MERK / CONTEXT
Merk: ${brandName}
Categorie/topics: ${project.topics.length ? project.topics.join(', ') : '(leid af uit merk)'}
Markt: ${project.market}
${cbsBlock}

# OPDRACHT
Maak ${count} onderscheidende persona's die samen de doelgroep dekken. Per persona: realistische demografie (leeftijd, regio, inkomen, huishouden, opleiding, beroep), leefsituatie, motivaties, en — belangrijk voor GEO — HOE deze persona vragen formuleert aan een AI-assistent (toon, detailniveau, koop-fase).

Geef ALLEEN JSON:
{
  "personas": [
    {
      "name": "korte persona-naam",
      "segment": "1 zin segment-omschrijving",
      "demographics": { "age_range": "30-45", "region": "Randstad", "income": "modaal-bovenmodaal", "household": "gezin met kinderen", "education": "hbo", "occupation": "..." },
      "situation": "leefsituatie in 1-2 zinnen",
      "motivations": ["...", "..."],
      "how_they_ask": "hoe deze persona een AI-vraag formuleert",
      "share": 30
    }
  ]
}
share = ruw % van de doelgroep (samen ~100). Nederlands.`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(60000),
    })
    if (!aiRes.ok) {
      const t = await aiRes.text()
      return NextResponse.json({ error: `AI request mislukt (${aiRes.status}): ${t.slice(0, 160)}` }, { status: 500 })
    }
    const aiData = await aiRes.json()
    const raw = (aiData.content?.[0]?.text ?? '') as string

    let parsed: { personas?: Record<string, unknown>[] }
    try { parsed = JSON.parse(extractJson(raw)) } catch {
      return NextResponse.json({ error: 'AI-output niet parsebaar' }, { status: 500 })
    }
    if (!parsed.personas || !Array.isArray(parsed.personas) || parsed.personas.length === 0) {
      return NextResponse.json({ error: 'Geen persona\'s gegenereerd' }, { status: 500 })
    }

    const asStr = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null
    const inserts = parsed.personas.map(p => {
      const name = asStr(p.name)
      if (!name) return null
      const d = (p.demographics ?? {}) as Record<string, unknown>
      const demographics: GeoPersonaDemographics = {
        age_range: asStr(d.age_range), region: asStr(d.region), income: asStr(d.income),
        household: asStr(d.household), education: asStr(d.education), occupation: asStr(d.occupation),
      }
      return {
        project_id: body.projectId,
        name,
        segment: asStr(p.segment),
        demographics,
        situation: asStr(p.situation),
        motivations: Array.isArray(p.motivations) ? (p.motivations as unknown[]).map(asStr).filter((x): x is string => !!x) : [],
        how_they_ask: asStr(p.how_they_ask),
        share: typeof p.share === 'number' ? Math.round(p.share) : null,
        source: (cbs ? 'cbs' : 'ai') as 'cbs' | 'ai',
      }
    }).filter((x): x is NonNullable<typeof x> => x !== null)

    const insertRes = await supabase.from('geo_personas').insert(inserts).select()
    if (insertRes.error) return NextResponse.json({ error: `Opslaan mislukt: ${insertRes.error.message}` }, { status: 500 })

    return NextResponse.json({ personas: insertRes.data as GeoPersona[], cbsGrounded: !!cbs })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('generate-personas crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
