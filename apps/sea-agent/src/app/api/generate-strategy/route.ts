import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 120

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

function extractJson(text: string): string {
  let t = text.trim()
  const fenceMatch = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenceMatch) t = fenceMatch[1].trim()
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1)
  }
  return t
}

export async function POST(req: NextRequest) {
  try {
    const { briefId } = await req.json() as { briefId: string }
    if (!briefId) return NextResponse.json({ error: 'briefId required' }, { status: 400 })

    const apiKey = getEnv('ANTHROPIC_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Load brief
    const { data: brief } = await supabase.from('sea_briefs').select('*').eq('id', briefId).single()
    if (!brief) return NextResponse.json({ error: 'Brief not found' }, { status: 404 })

    // Optional brand context
    let brandContext = ''
    if (brief.brand_id) {
      const { data: brand } = await supabase.from('brands').select('*').eq('id', brief.brand_id).single()
      if (brand) brandContext = `Brand: ${brand.name}`
    }

    let userName: string | null = null
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    if (profile) userName = profile.name

    const { DUTCH_STYLE_RULES } = await import('@/lib/dutch-style')
    const prompt = `You are a senior Search Engine Advertising (SEA) strategist for ibizz, a Dutch creative & digital agency. Build a complete campaign strategy for the following brief.

IMPORTANT — language rules:
- All client-facing text fields (summary, reasoning, focus, notes, considerations, budget item names) MUST be in DUTCH (Nederlands), since the end clients are Dutch.
- Field names and Google product labels stay in English (Search, Performance Max, Display, Demand Gen, YouTube).
- Currency: euros.

${DUTCH_STYLE_RULES}

${brandContext}

BRIEF:
- Title: ${brief.title}
- Goal: ${brief.goal ?? '(not specified)'}
- Monthly budget: ${brief.monthly_budget ? `€${brief.monthly_budget}` : '(not specified)'}
- Target CPA: ${brief.target_cpa ? `€${brief.target_cpa}` : '(not specified, derive from goal)'}
- Location: ${brief.location}
- Target audience: ${brief.target_audience ?? '(not specified)'}
- ICP: ${brief.icp ?? '(not specified)'}

Build a strategy that:
1. Reverse-engineers the budget from the goal where possible
2. Recommends a mix of Google campaign types (Search, Performance Max, Display, Demand Gen, YouTube) appropriate to the goal
3. Provides budget breakdown with realistic percentages
4. Estimates expected results (leads, CPA, conversion rate)
5. Defines a 4-week timeline (week 1 setup, week 2 first optimisations, etc.)
6. Lists key considerations / risks

Return ONLY valid JSON. No markdown fences, no commentary. Begin with { and end with }.

Schema (text fields in Dutch, technical labels in English):
{
  "summary": "Strategische samenvatting van 2-3 zinnen in het Nederlands",
  "budget_breakdown": [
    {"name": "Search — merknaam termen", "amount": 600, "percentage": 20}
  ],
  "expected_results": {
    "estimated_leads": 40,
    "estimated_cpa": 75,
    "conversion_rate_pct": 4.5,
    "notes": "Conservatieve schatting op basis van vergelijkbare accounts"
  },
  "campaign_types": [
    {"type": "Search", "budget": 1800, "share_pct": 60, "reasoning": "Primaire conversie-driver voor zoekers met hoge intentie"}
  ],
  "timeline": [
    {"week": "Week 1", "focus": "Account setup, conversion tracking inrichten, eerste campagnes live"}
  ],
  "considerations": [
    "Conversion tracking moet vóór livegang volledig werken",
    "Budget pacing eerste 2 weken dagelijks monitoren"
  ]
}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Anthropic strategy error:', res.status, errText)
      return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    const cleaned = extractJson(text)
    const parsed = JSON.parse(cleaned)

    // Upsert (one strategy per brief — replace on regenerate)
    const { data: saved, error: upsertErr } = await supabase
      .from('sea_strategies')
      .upsert({
        brief_id: briefId,
        summary: parsed.summary ?? null,
        budget_breakdown: parsed.budget_breakdown ?? [],
        expected_results: parsed.expected_results ?? null,
        campaign_types: parsed.campaign_types ?? [],
        timeline: parsed.timeline ?? [],
        considerations: parsed.considerations ?? [],
        status: 'draft',
        created_by: user.id,
        created_by_name: userName,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'brief_id' })
      .select()
      .single()

    if (upsertErr) {
      console.error('strategy upsert error:', upsertErr)
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json(saved)
  } catch (err) {
    console.error('generate-strategy error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
