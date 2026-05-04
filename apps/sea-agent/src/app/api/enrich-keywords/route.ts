import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, SeaKeywordResearch } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 180

function getEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key]
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'))
    return match?.[1]?.trim()
  } catch {
    return undefined
  }
}

async function getSupabase() {
  const cookieStore = await cookies()
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')!
  const key = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')!
  return createServerClient<Database>(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Map location strings to Ahrefs country codes (uitbreidbaar)
function locationToCountry(location: string | null | undefined): string {
  if (!location) return 'nl'
  const lower = location.toLowerCase()
  if (lower.includes('belgi')) return 'be'
  if (lower.includes('german') || lower.includes('duits')) return 'de'
  if (lower.includes('united kingdom') || lower.includes('uk')) return 'gb'
  if (lower.includes('united states') || lower.includes('us')) return 'us'
  return 'nl'
}

type AhrefsKeywordItem = {
  keyword: string
  volume?: number | null
  cpc?: number | null
  difficulty?: number | null
}

async function fetchAhrefsBatch(
  keywords: string[],
  country: string,
  apiKey: string
): Promise<Map<string, AhrefsKeywordItem>> {
  // Ahrefs API v3 — Keywords Explorer overview (batched)
  // Docs: https://docs.ahrefs.com/docs/api/reference/keywords-explorer-overview
  const url = new URL('https://api.ahrefs.com/v3/keywords-explorer/overview')
  url.searchParams.set('country', country)
  url.searchParams.set('select', 'keyword,volume,cpc,difficulty')
  url.searchParams.set('keywords', keywords.join(','))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Ahrefs API error (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const out = new Map<string, AhrefsKeywordItem>()
  // Ahrefs returns array under `keywords` of metric objects
  const items: AhrefsKeywordItem[] = data.keywords ?? data.data ?? []
  for (const item of items) {
    if (item.keyword) out.set(item.keyword.toLowerCase(), item)
  }
  return out
}

export async function POST(req: NextRequest) {
  try {
    const { researchId } = await req.json() as { researchId: string }
    if (!researchId) return NextResponse.json({ error: 'researchId required' }, { status: 400 })

    const apiKey = getEnv('AHREFS_API_KEY')
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AHREFS_API_KEY missing — add to .env.local. Get yours at dashboard.ahrefs.com → Settings → API.' },
        { status: 500 }
      )
    }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: research } = await supabase
      .from('sea_keyword_research')
      .select('*')
      .eq('id', researchId)
      .single()
    if (!research) return NextResponse.json({ error: 'Research not found' }, { status: 404 })

    // Bepaal country uit brief locatie
    const { data: brief } = await supabase
      .from('sea_briefs')
      .select('location')
      .eq('id', research.brief_id)
      .single()
    const country = locationToCountry(brief?.location)

    // Verzamel alle unieke keywords
    const r = research as SeaKeywordResearch
    const allKeywords = new Set<string>()
    for (const c of r.campaigns) {
      for (const g of c.ad_groups) {
        for (const k of g.keywords) {
          if (k.text.trim()) allKeywords.add(k.text.trim())
        }
      }
    }
    const keywordList = Array.from(allKeywords)

    if (keywordList.length === 0) {
      return NextResponse.json({ error: 'No keywords to enrich' }, { status: 400 })
    }

    // Batches van 100 keywords (Ahrefs API limit-vriendelijk)
    const batches = chunk(keywordList, 100)
    const enrichment = new Map<string, AhrefsKeywordItem>()

    for (const batch of batches) {
      const result = await fetchAhrefsBatch(batch, country, apiKey)
      result.forEach((v, k) => enrichment.set(k, v))
    }

    // Apply enrichment
    const now = new Date().toISOString()
    let enrichedCount = 0
    const updatedCampaigns = r.campaigns.map(c => ({
      ...c,
      ad_groups: c.ad_groups.map(g => ({
        ...g,
        keywords: g.keywords.map(k => {
          const data = enrichment.get(k.text.trim().toLowerCase())
          if (!data) return k
          enrichedCount++
          return {
            ...k,
            search_volume: data.volume ?? null,
            cpc: data.cpc ?? null,
            keyword_difficulty: data.difficulty ?? null,
            enriched_at: now,
          }
        }),
      })),
    }))

    const { data: saved, error: upErr } = await supabase
      .from('sea_keyword_research')
      .update({ campaigns: updatedCampaigns, updated_at: now })
      .eq('id', researchId)
      .select()
      .single()

    if (upErr) throw new Error(upErr.message)

    return NextResponse.json({
      research: saved,
      stats: {
        total_keywords: keywordList.length,
        enriched: enrichedCount,
        country,
      },
    })
  } catch (err) {
    console.error('enrich-keywords error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
