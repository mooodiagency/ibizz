import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, GeoProject, GeoPromptIntent, GeoPromptSource } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 120

const MODEL = 'claude-sonnet-4-6'
const UA = 'ibizz-geo-agent/1.0 (+https://ibizz.2kwadraat.nl)'

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
function guessIntent(t: string): GeoPromptIntent {
  const s = t.toLowerCase()
  if (/\bvs\b|versus|alternatie|vergelijk| of /.test(s)) return 'comparison'
  if (/beste|aanrad|welke|top \d|aanbevol|recommend|\bbest\b/.test(s)) return 'commercial'
  if (/kopen|prijs|kosten|waar koop|deal|korting|bestellen/.test(s)) return 'transactional'
  return 'informational'
}
function isQuestionLike(t: string): boolean {
  const s = t.trim().toLowerCase()
  return s.includes('?')
    || /^(hoe|wat|waarom|welke|wanneer|waar|kan|is|zijn|moet|how|what|why|which|when|where|should|can|are|is)\b/.test(s)
    || /beste|aanrad|\bvs\b|alternatie|vergelijk/.test(s)
}

type Candidate = { text: string; intent: GeoPromptIntent; topic: string | null; source: GeoPromptSource; ref: string | null }

async function fromReddit(topics: string[]): Promise<Candidate[]> {
  const out: Candidate[] = []
  const seen = new Set<string>()
  for (const topic of topics.slice(0, 5)) {
    try {
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(topic)}&limit=25&sort=relevance&t=year&type=link`
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: AbortSignal.timeout(12000) })
      if (!res.ok) { console.warn(`[discover-prompts] Reddit "${topic}" → ${res.status} (mogelijk rate-limit)`); continue }
      const data = await res.json() as { data?: { children?: { data?: { title?: string; permalink?: string } }[] } }
      for (const c of data.data?.children ?? []) {
        const title = c.data?.title?.trim()
        if (!title || title.length < 12 || title.length > 180) continue
        if (!isQuestionLike(title)) continue
        const key = title.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        out.push({
          text: title, intent: guessIntent(title), topic,
          source: 'reddit', ref: c.data?.permalink ? `https://www.reddit.com${c.data.permalink}` : null,
        })
      }
    } catch { /* skip topic */ }
  }
  return out.slice(0, 30)
}

async function fromNews(apiKey: string, topics: string[], market: string): Promise<Candidate[]> {
  // 1. GDELT recente headlines
  const query = topics.slice(0, 5).map(t => `"${t}"`).join(' OR ')
  let headlines: string[] = []
  try {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=30&format=json&sort=datedesc&timespan=3m`
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) })
    if (res.ok) {
      const data = await res.json() as { articles?: { title?: string }[] }
      headlines = (data.articles ?? []).map(a => a.title?.trim()).filter((x): x is string => !!x).slice(0, 25)
    } else {
      console.warn(`[discover-prompts] GDELT → ${res.status}`)
    }
  } catch (e) { console.warn('[discover-prompts] GDELT fout:', e instanceof Error ? e.message : e) }
  if (headlines.length === 0) return []

  // 2. Claude distilleert headlines → natuurlijke gebruikersvragen
  const prompt = `Hieronder recente nieuwskoppen over ${topics.join(', ')} (markt: ${market}). Bedenk op basis hiervan natuurlijke vragen die mensen aan een AI-assistent zouden stellen rond deze onderwerpen — vragen waar een merk aanbevolen of genoemd kan worden.

KOPPEN:
${headlines.map(h => `- ${h}`).join('\n')}

Geef ALLEEN JSON, max 12 vragen, in het ${market === 'Netherlands' ? 'Nederlands' : 'Engels'}:
{ "questions": [ { "text": "de vraag", "intent": "informational|commercial|comparison|transactional|navigational", "topic": "kort label" } ] }`
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) { console.warn(`[discover-prompts] nieuws-distillatie mislukt (${res.status})`); return [] }
    const data = await res.json()
    const raw = (data.content?.[0]?.text ?? '') as string
    const parsed = JSON.parse(extractJson(raw)) as { questions?: { text?: string; intent?: string; topic?: string }[] }
    const valid: GeoPromptIntent[] = ['informational', 'commercial', 'comparison', 'transactional', 'navigational']
    return (parsed.questions ?? []).map((q): Candidate | null => {
      const text = typeof q.text === 'string' ? q.text.trim() : ''
      if (!text) return null
      const intent = (typeof q.intent === 'string' && (valid as string[]).includes(q.intent)) ? q.intent as GeoPromptIntent : 'informational'
      return { text, intent, topic: typeof q.topic === 'string' ? q.topic : null, source: 'news', ref: null }
    }).filter((x): x is Candidate => x !== null)
  } catch { return [] }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as { projectId: string; sources: GeoPromptSource[] }
    if (!body.projectId) return NextResponse.json({ error: 'projectId verplicht' }, { status: 400 })
    const sources = Array.isArray(body.sources) && body.sources.length ? body.sources : (['reddit', 'news'] as GeoPromptSource[])

    const projRes = await supabase.from('geo_projects').select('*').eq('id', body.projectId).single()
    if (projRes.error || !projRes.data) return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    const project = projRes.data as GeoProject
    const topics = project.topics.length ? project.topics : [project.name]

    const tasks: Promise<Candidate[]>[] = []
    if (sources.includes('reddit')) tasks.push(fromReddit(topics))
    if (sources.includes('news')) {
      const apiKey = getEnv('ANTHROPIC_API_KEY')
      if (apiKey) tasks.push(fromNews(apiKey, topics, project.market))
    }
    const settled = await Promise.all(tasks)
    let candidates = settled.flat()

    // Dedupe vs bestaande prompts
    const existing = await supabase.from('geo_prompts').select('text').eq('project_id', body.projectId)
    if (existing.error) console.warn('[discover-prompts] dedup-query fout, mogelijk duplicaten:', existing.error.message)
    const existingSet = new Set((existing.data ?? []).map(p => (p.text as string).toLowerCase().trim()))
    const localSeen = new Set<string>()
    candidates = candidates.filter(c => {
      const k = c.text.toLowerCase().trim()
      if (existingSet.has(k) || localSeen.has(k)) return false
      localSeen.add(k)
      return true
    })

    const stats = {
      reddit: candidates.filter(c => c.source === 'reddit').length,
      news: candidates.filter(c => c.source === 'news').length,
    }
    return NextResponse.json({ candidates, stats })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('discover-prompts crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
