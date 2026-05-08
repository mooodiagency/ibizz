import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@ibizz/supabase'
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

async function fetchWebsite(url: string): Promise<{ title?: string; content?: string }> {
  try {
    const target = url.startsWith('http') ? url : `https://${url}`
    const res = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ibizz-SEA-Agent/1.0)' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return {}
    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000)
    return { title: titleMatch?.[1]?.trim(), content: text }
  } catch {
    return {}
  }
}

export async function POST(req: NextRequest) {
  try {
    const { briefId, websiteUrl } = await req.json() as { briefId: string; websiteUrl?: string }
    if (!briefId) return NextResponse.json({ error: 'briefId required' }, { status: 400 })

    const apiKey = getEnv('ANTHROPIC_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: brief } = await supabase.from('sea_briefs').select('*').eq('id', briefId).single()
    if (!brief) return NextResponse.json({ error: 'Brief not found' }, { status: 404 })

    let brandName = ''
    if (brief.brand_id) {
      const { data: brand } = await supabase.from('brands').select('name').eq('id', brief.brand_id).single()
      if (brand) brandName = brand.name
    }

    let userName: string | null = null
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    if (profile) userName = profile.name

    // Optional website scrape
    let scrapedSummary: string | null = null
    let websiteContext = ''
    if (websiteUrl) {
      const scraped = await fetchWebsite(websiteUrl)
      if (scraped.content) {
        scrapedSummary = `${scraped.title ?? ''}\n${scraped.content.slice(0, 1000)}`
        websiteContext = `\nWEBSITE CONTENT (${websiteUrl}):\n${scraped.title ? `Title: ${scraped.title}\n` : ''}${scraped.content}`
      }
    }

    const { DUTCH_STYLE_RULES } = await import('@/lib/dutch-style')
    const prompt = `You are a senior SEA specialist for ibizz, a Dutch creative & digital agency. Build a complete keyword research with HYBRID structure (Branded vs Non-branded campaigns, with STAG = Single Theme Ad Groups).

LANGUAGE RULES:
- All keywords MUST be in DUTCH (the target market is Dutch).
- Ad group names + themes in DUTCH.
- Campaign segment + Google product type labels stay English (Search, Performance Max, branded, non-branded, pmax).
- Match types in English (broad, phrase, exact). Intent in English (informational, commercial, transactional, branded).

${DUTCH_STYLE_RULES}
- Keywords zijn altijd LOWERCASE behalve eigennamen / merknamen (bv. "thuisbatterij kopen", "solipower thuisbatterij").
- Ad group names volgen sentence case ("Thuisbatterij algemeen", niet "Thuisbatterij Algemeen").
- Themes ook sentence case.

BRAND: ${brandName || '(unknown)'}

BRIEF:
- Title: ${brief.title}
- Goal: ${brief.goal ?? '(not specified)'}
- Monthly budget: ${brief.monthly_budget ? `€${brief.monthly_budget}` : '(not specified)'}
- Location: ${brief.location}
- Target audience: ${brief.target_audience ?? '(not specified)'}
- ICP: ${brief.icp ?? '(not specified)'}
${websiteContext}

REQUIREMENTS:
1. Always create 1 BRANDED campaign with 1-2 ad groups (3-5 keywords each).
2. Always create 1 NON-BRANDED campaign with 4-8 STAG ad groups (10-15 keywords each).
3. If website content is rich, optionally suggest a Performance Max campaign with 1 asset group.
4. Per keyword: text (Dutch), match_type (phrase/exact preferred, broad ONLY when justified), intent (informational/commercial/transactional/branded).
5. MATCH TYPE STRATEGY (ibizz standard — based on agency expertise):
   - Default to PHRASE + EXACT match. Often use the SAME keyword in both phrase and exact for coverage.
   - AVOID broad match — too many irrelevant impressions, Google over-steers with it.
   - Branded → exact (primary) + phrase (variations).
   - Non-branded transactional → phrase + exact (both, same keyword).
   - Non-branded commercial → phrase preferred.
   - Use broad ONLY when the keyword is so niche that exact/phrase yields too little volume — and flag this clearly via the keyword text being a generic discovery term.
6. Each ad group has a clear theme — keywords within MUST stay close to that theme (STAG principle).
7. Focus ONLY on transactional and commercial intent keywords. Skip informational/navigational queries unless they are clearly purchase-driven.

Return ONLY valid JSON. No markdown fences.

Schema:
{
  "scraped_summary": "Korte samenvatting van wat er op de website staat (Nederlands), of null",
  "campaigns": [
    {
      "name": "Solipower — Branded",
      "type": "Search",
      "segment": "branded",
      "ad_groups": [
        {
          "name": "Solipower merknaam",
          "theme": "Directe merknaam-zoekopdrachten",
          "keywords": [
            {"text": "solipower", "match_type": "exact", "intent": "branded"},
            {"text": "solipower thuisbatterij", "match_type": "phrase", "intent": "branded"}
          ]
        }
      ]
    },
    {
      "name": "Solipower — Non-branded",
      "type": "Search",
      "segment": "non-branded",
      "ad_groups": [
        {
          "name": "Thuisbatterij algemeen",
          "theme": "Hoofdterm thuisbatterij",
          "keywords": [
            {"text": "thuisbatterij kopen", "match_type": "phrase", "intent": "transactional"}
          ]
        }
      ]
    }
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
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Anthropic keywords error:', res.status, errText)
      return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    const cleaned = extractJson(text)
    const parsed = JSON.parse(cleaned)

    const { data: saved, error: upsertErr } = await supabase
      .from('sea_keyword_research')
      .upsert({
        brief_id: briefId,
        website_url: websiteUrl ?? null,
        scraped_summary: scrapedSummary ?? parsed.scraped_summary ?? null,
        campaigns: parsed.campaigns ?? [],
        status: 'draft',
        created_by: user.id,
        created_by_name: userName,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'brief_id' })
      .select()
      .single()

    if (upsertErr) {
      console.error('research upsert error:', upsertErr)
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json(saved)
  } catch (err) {
    console.error('generate-keywords error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
