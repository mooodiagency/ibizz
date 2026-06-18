import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type {
  Database, GeoProject, GeoPrompt, GeoRun, GeoResult, GeoRunSummary,
  GeoCitedSource, GeoSentiment,
} from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 300

const MODEL = 'claude-sonnet-4-6'
const MAX_PROMPTS = 25
const CONCURRENCY = 4

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

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
function extractJson(text: string): string {
  let t = text.trim()
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fence) t = fence[1].trim()
  const first = t.indexOf('{'); const last = t.lastIndexOf('}')
  if (first !== -1 && last > first) t = t.slice(first, last + 1)
  return t
}

type AnthropicBlock =
  | { type: 'text'; text: string }
  | { type: 'web_search_tool_result'; content?: { type: string; url?: string; title?: string }[] }
  | { type: string; [k: string]: unknown }

async function answerWithSearch(apiKey: string, question: string): Promise<{ answer: string; sources: GeoCitedSource[] }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: question }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Claude answer (${res.status}): ${t.slice(0, 160)}`)
  }
  const data = await res.json() as { content?: AnthropicBlock[] }
  const blocks = data.content ?? []
  const answer = blocks.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n').trim()
  const seen = new Set<string>()
  const sources: GeoCitedSource[] = []
  for (const b of blocks) {
    if (b.type === 'web_search_tool_result' && Array.isArray((b as { content?: unknown[] }).content)) {
      for (const r of (b as { content: { type: string; url?: string; title?: string }[] }).content) {
        if (r.type === 'web_search_result' && r.url) {
          const d = domainOf(r.url)
          if (!seen.has(r.url)) { seen.add(r.url); sources.push({ domain: d, url: r.url, title: r.title ?? null }) }
        }
      }
    }
  }
  return { answer, sources }
}

async function analyze(apiKey: string, answer: string, brandTerms: string[], competitors: string[]): Promise<{
  brand_mentioned: boolean; brand_position: number | null; competitors: string[]; sentiment: GeoSentiment | null
}> {
  const prompt = `Analyseer dit AI-antwoord voor merk-zichtbaarheid (GEO).

MERK-TERMEN (zo herken je het merk): ${brandTerms.join(', ') || '(geen)'}
BEKENDE CONCURRENTEN: ${competitors.join(', ') || '(geen)'}

ANTWOORD:
"""${answer.slice(0, 6000)}"""

Geef ALLEEN JSON:
{
  "brand_mentioned": true/false,          // wordt het merk (een van de merk-termen) genoemd?
  "brand_position": null of nummer,        // als 't antwoord meerdere merken/opties noemt: op welke positie staat het merk (1=eerst genoemd/aanbevolen)? anders null
  "competitors": ["..."],                  // welke concurrenten/andere merken worden genoemd (uit de lijst + nieuwe die je ziet)
  "sentiment": "positive"|"neutral"|"negative"  // hoe wordt het merk beschreven; null als niet genoemd
}`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) return { brand_mentioned: false, brand_position: null, competitors: [], sentiment: null }
  const data = await res.json()
  const raw = (data.content?.[0]?.text ?? '') as string
  try {
    const p = JSON.parse(extractJson(raw)) as {
      brand_mentioned?: boolean; brand_position?: number | null; competitors?: unknown; sentiment?: string
    }
    const sentiment = (['positive', 'neutral', 'negative'] as const).includes(p.sentiment as GeoSentiment)
      ? p.sentiment as GeoSentiment : null
    return {
      brand_mentioned: !!p.brand_mentioned,
      brand_position: typeof p.brand_position === 'number' ? p.brand_position : null,
      competitors: Array.isArray(p.competitors) ? p.competitors.filter((x): x is string => typeof x === 'string') : [],
      sentiment: p.brand_mentioned ? sentiment : null,
    }
  } catch {
    return { brand_mentioned: false, brand_position: null, competitors: [], sentiment: null }
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getEnv('ANTHROPIC_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY ontbreekt' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as { projectId: string }
    if (!body.projectId) return NextResponse.json({ error: 'projectId verplicht' }, { status: 400 })

    const projRes = await supabase.from('geo_projects').select('*').eq('id', body.projectId).single()
    if (projRes.error || !projRes.data) return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    const project = projRes.data as GeoProject

    const promptsRes = await supabase.from('geo_prompts').select('*').eq('project_id', body.projectId).eq('active', true).order('created_at')
    const allPrompts = (promptsRes.data ?? []) as GeoPrompt[]
    if (allPrompts.length === 0) return NextResponse.json({ error: 'Geen actieve vragen — voeg eerst vragen toe' }, { status: 400 })
    const prompts = allPrompts.slice(0, MAX_PROMPTS)

    let brandTerms = project.brand_terms
    if (brandTerms.length === 0 && project.brand_id) {
      const b = await supabase.from('brands').select('name').eq('id', project.brand_id).single()
      if (b.data?.name) brandTerms = [b.data.name]
    }

    // Run aanmaken
    const runRes = await supabase.from('geo_runs').insert({
      project_id: body.projectId, engine: 'claude', status: 'running', prompt_count: prompts.length, created_by: user.id,
    }).select().single()
    if (runRes.error || !runRes.data) return NextResponse.json({ error: 'Kon run niet starten' }, { status: 500 })
    const run = runRes.data as GeoRun

    // Prompts verwerken met concurrency-pool
    const results: GeoResult[] = []
    const resultInserts: Database['public']['Tables']['geo_results']['Insert'][] = []
    let idx = 0
    async function worker() {
      while (idx < prompts.length) {
        const p = prompts[idx++]
        try {
          const { answer, sources } = await answerWithSearch(apiKey!, p.text)
          const a = await analyze(apiKey!, answer, brandTerms, project.competitors)
          resultInserts.push({
            run_id: run.id, prompt_id: p.id, engine: 'claude', answer,
            brand_mentioned: a.brand_mentioned, brand_position: a.brand_position,
            competitors: a.competitors, cited_sources: sources, sentiment: a.sentiment,
          })
        } catch {
          resultInserts.push({
            run_id: run.id, prompt_id: p.id, engine: 'claude', answer: '(fout bij ophalen)',
            brand_mentioned: false, brand_position: null, competitors: [], cited_sources: [], sentiment: null,
          })
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))

    const inserted = await supabase.from('geo_results').insert(resultInserts).select()
    if (!inserted.error && inserted.data) results.push(...(inserted.data as GeoResult[]))

    // Summary berekenen
    const total = resultInserts.length
    const brandMentions = resultInserts.filter(r => r.brand_mentioned).length
    const sentiment = { positive: 0, neutral: 0, negative: 0 }
    const compCount = new Map<string, number>()
    const srcCount = new Map<string, number>()
    for (const r of resultInserts) {
      if (r.sentiment) sentiment[r.sentiment]++
      for (const c of (r.competitors ?? [])) compCount.set(c, (compCount.get(c) ?? 0) + 1)
      for (const s of (r.cited_sources ?? [])) srcCount.set(s.domain, (srcCount.get(s.domain) ?? 0) + 1)
    }
    const summary: GeoRunSummary = {
      totalPrompts: total,
      brandMentions,
      sov: total > 0 ? Math.round((brandMentions / total) * 100) : 0,
      sentiment,
      topCompetitors: [...compCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
      topSources: [...srcCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([domain, count]) => ({ domain, count })),
    }

    const upd = await supabase.from('geo_runs').update({ status: 'done', summary }).eq('id', run.id).select().single()

    return NextResponse.json({ run: (upd.data ?? { ...run, status: 'done', summary }) as GeoRun, results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('run-simulation crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
