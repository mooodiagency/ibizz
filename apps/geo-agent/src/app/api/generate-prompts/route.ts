import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, GeoProject, GeoPrompt, GeoPromptIntent } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 120

const MODEL = 'claude-sonnet-4-6'
const VALID_INTENTS: GeoPromptIntent[] = ['informational', 'commercial', 'comparison', 'transactional', 'navigational']

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
  const first = t.indexOf('{'); const last = t.lastIndexOf('}')
  if (first !== -1 && last > first) t = t.slice(first, last + 1)
  return t
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
    const count = Math.max(5, Math.min(40, body.count ?? 24))

    const projRes = await supabase.from('geo_projects').select('*').eq('id', body.projectId).single()
    if (projRes.error || !projRes.data) return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    const project = projRes.data as GeoProject

    let brandName = project.brand_terms[0] ?? project.name
    if (project.brand_id) {
      const b = await supabase.from('brands').select('name').eq('id', project.brand_id).single()
      if (b.data?.name) brandName = b.data.name
    }

    const prompt = `Je bent een GEO-strateeg (Generative Engine Optimization). Je brengt in kaart welke vragen echte mensen aan AI-assistenten (ChatGPT, Claude, Gemini, Perplexity) stellen rondom een merk en zijn categorie. Dit zijn de prompts waarmee we straks testen of het merk in AI-antwoorden genoemd/geciteerd wordt.

# CONTEXT
Merk: ${brandName}
Markt: ${project.market}
${project.website_url ? `Website: ${project.website_url}` : ''}
Topics/categorieën: ${project.topics.length ? project.topics.join(', ') : '(leid zelf af uit het merk)'}
Concurrenten: ${project.competitors.length ? project.competitors.join(', ') : '(onbekend)'}

# OPDRACHT
Genereer ${count} realistische vragen/prompts zoals echte mensen ze aan een AI-assistent typen — NIET zoals zoekwoorden, maar volledige natuurlijke vragen. Spreid over intenties:
- informational: "hoe/wat/waarom" vragen over de categorie
- commercial: "beste / aanbevolen / welke moet ik kiezen" (hier worden merken aanbevolen)
- comparison: "X vs Y" of "alternatieven voor"
- transactional: "waar koop ik / prijs / kortingen"
- navigational: direct over het merk zelf

Belangrijk:
- De meeste high-value GEO-prompts zijn **commercial** en **comparison** (daar worden merken genoemd). Zorg dat minstens de helft daar valt.
- Schrijf in het ${project.market === 'Netherlands' ? 'Nederlands' : 'Engels'}.
- Noem het merk NIET in informational/commercial/comparison vragen (we willen testen of de AI het merk uit zichzelf noemt). Wel in navigational vragen.
- Natuurlijke spreektaal, zoals iemand echt typt.

Geef ALLEEN geldige JSON terug:
{
  "prompts": [
    { "text": "de volledige vraag", "intent": "commercial", "topic": "kort topic-label" }
  ]
}`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!aiRes.ok) {
      const t = await aiRes.text()
      return NextResponse.json({ error: `AI request mislukt (${aiRes.status}): ${t.slice(0, 200)}` }, { status: 500 })
    }
    const aiData = await aiRes.json()
    const raw = (aiData.content?.[0]?.text ?? '') as string

    let parsed: { prompts?: { text?: unknown; intent?: unknown; topic?: unknown }[] }
    try { parsed = JSON.parse(extractJson(raw)) } catch {
      return NextResponse.json({ error: 'AI-output niet parsebaar' }, { status: 500 })
    }
    if (!parsed.prompts || !Array.isArray(parsed.prompts) || parsed.prompts.length === 0) {
      return NextResponse.json({ error: 'Geen prompts gegenereerd' }, { status: 500 })
    }

    const inserts = parsed.prompts
      .map(p => {
        const text = typeof p.text === 'string' ? p.text.trim() : ''
        if (!text) return null
        const intent = (typeof p.intent === 'string' && (VALID_INTENTS as string[]).includes(p.intent))
          ? p.intent as GeoPromptIntent : 'informational'
        const topic = typeof p.topic === 'string' && p.topic.trim() ? p.topic.trim() : null
        return { project_id: body.projectId, text, intent, topic, source: 'ai' as const, active: true }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    const insertRes = await supabase.from('geo_prompts').insert(inserts).select()
    if (insertRes.error) return NextResponse.json({ error: `Opslaan mislukt: ${insertRes.error.message}` }, { status: 500 })

    return NextResponse.json({ prompts: insertRes.data as GeoPrompt[] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('generate-prompts crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
