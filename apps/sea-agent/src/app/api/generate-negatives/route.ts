import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 300

function getEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key]
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'))
    return match?.[1]?.trim()
  } catch { return undefined }
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
  if (first !== -1 && last !== -1 && last > first) t = t.slice(first, last + 1)
  return t
}

const CATEGORIES = [
  'jobs',         // vacatures, banen
  'free',         // gratis, free
  'diy',          // zelf maken, doe-het-zelf
  'how-to',       // hoe werkt, wat is, cursus
  'used',         // tweedehands, marktplaats
  'reviews',      // review, ervaringen, vergelijken
  'locations',    // belgië, duitsland (NL-only campagnes)
  'inappropriate',// porn, sex, etc.
  'pirated',      // gratis download, kraken
  'general',      // overige niet-relevante termen
]

export async function POST(req: NextRequest) {
  try {
    const apiKey = getEnv('ANTHROPIC_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { mode, brandId } = await req.json().catch(() => ({ mode: 'append' })) as {
      mode?: 'replace' | 'append'
      brandId?: string
    }
    const scopedBrandId: string | null = brandId ?? null

    // Brand context (alleen relevant voor brand-scoped lijsten)
    let brandContext = ''
    if (scopedBrandId) {
      const { data: brand } = await supabase.from('brands').select('name').eq('id', scopedBrandId).single()
      if (brand) {
        brandContext = `\n\nBRAND CONTEXT: This list is for the brand "${brand.name}". Focus on keywords that are specifically irrelevant for THIS brand's industry/products. Add competitor names that should be excluded, irrelevant adjacent product categories, and brand-specific exclusions on top of generic ones.`
      }
    }

    const prompt = `You are a senior SEA specialist for ibizz, a Dutch agency. Generate a comprehensive list of NEGATIVE KEYWORDS for Dutch (Netherlands) Google Ads campaigns. These are terms that should be excluded across most B2C/B2B accounts because they signal irrelevant traffic.${brandContext}

LANGUAGE: Dutch (Nederlands).
TARGET: as exhaustive as possible. Aim for 400-600 keywords total across categories.

CATEGORIES (use exactly these category labels):
${CATEGORIES.map(c => `- ${c}`).join('\n')}

GUIDELINES:
- Use single-word negatives where they are unambiguous (vacature, gratis).
- Use multi-word for context-specific exclusions (zelf maken, hoe werkt).
- Include common typos / misspellings where impactful.
- Lowercase all keywords (Dutch convention).
- Avoid extremely generic words (alleen, een, het) — those harm coverage.
- For "locations": include surrounding countries when accounts are NL-only (belgië, belgisch, duitsland, frankrijk, vlaams).
- For "inappropriate": cover adult content, gambling, drugs.
- For "reviews": include "ervaringen", "review", "klachten", "vergelijken", "beste" (these often pull research traffic).
- For "free": include "gratis", "free", "kosteloos", "gratis downloaden", "freebie".

Match types:
- "broad" for single-word general blocks (most common)
- "phrase" when the order matters ("zelf maken")
- "exact" rarely; only for very specific exclusions

Return ONLY valid JSON. Schema:
{
  "negatives": [
    {"keyword": "vacature", "match_type": "broad", "category": "jobs"},
    {"keyword": "gratis", "match_type": "broad", "category": "free"},
    {"keyword": "zelf maken", "match_type": "phrase", "category": "diy"}
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
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Anthropic negatives error:', res.status, errText)
      return NextResponse.json({ error: 'AI request failed' }, { status: 500 })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    const parsed = JSON.parse(extractJson(text))
    const negatives: Array<{ keyword: string; match_type: string; category: string }> = parsed.negatives ?? []

    if (negatives.length === 0) {
      return NextResponse.json({ error: 'AI returned no keywords' }, { status: 500 })
    }

    // Replace mode: clear existing IN SCOPE only
    if (mode === 'replace') {
      const del = supabase.from('sea_negative_keywords').delete()
      if (scopedBrandId) await del.eq('brand_id', scopedBrandId)
      else await del.is('brand_id', null)
    }

    // Bestaande keys ophalen voor dedup
    const existingQuery = supabase.from('sea_negative_keywords').select('keyword,match_type')
    const { data: existing } = scopedBrandId
      ? await existingQuery.eq('brand_id', scopedBrandId)
      : await existingQuery.is('brand_id', null)
    const existingKeys = new Set((existing ?? []).map(e => `${e.keyword}|${e.match_type}`))

    const rows = negatives
      .filter(n => n.keyword && n.keyword.trim().length > 0)
      .map(n => ({
        brand_id: scopedBrandId,
        keyword: n.keyword.trim().toLowerCase(),
        match_type: (['broad', 'phrase', 'exact'].includes(n.match_type) ? n.match_type : 'broad') as 'broad' | 'phrase' | 'exact',
        category: n.category || 'general',
        created_by: user.id,
      }))
      .filter(r => !existingKeys.has(`${r.keyword}|${r.match_type}`))

    let inserted = 0
    const chunkSize = 200
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const { error } = await supabase.from('sea_negative_keywords').insert(chunk)
      if (!error) inserted += chunk.length
      else console.error('upsert chunk error:', error)
    }

    const countQuery = supabase.from('sea_negative_keywords').select('*', { count: 'exact', head: true })
    const { count } = scopedBrandId
      ? await countQuery.eq('brand_id', scopedBrandId)
      : await countQuery.is('brand_id', null)

    return NextResponse.json({
      generated: negatives.length,
      inserted,
      total_in_db: count ?? 0,
    })
  } catch (err) {
    console.error('generate-negatives error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
