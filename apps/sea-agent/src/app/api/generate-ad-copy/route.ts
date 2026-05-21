import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, SeaCampaign, SeaAdCopy } from '@ibizz/supabase'
import { cookies } from 'next/headers'
import { parseLocation, describeLocation } from '@/lib/location-targeting'

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

type GenerateInput = {
  researchId: string
  /** Wanneer gezet: alleen die ad group regenereren */
  onlyCampaign?: number
  onlyGroup?: number
}

async function generateAdCopyForGroup(
  apiKey: string,
  brandName: string,
  brief: { title: string; goal: string | null; target_audience: string | null; icp: string | null; location: string },
  campaign: SeaCampaign,
  groupIndex: number,
): Promise<SeaAdCopy> {
  const group = campaign.ad_groups[groupIndex]
  const keywordsText = group.keywords.map(k => `- ${k.text} (${k.intent})`).join('\n')

  const { DUTCH_STYLE_RULES } = await import('@/lib/dutch-style')
  const prompt = `You are a senior SEA copywriter for ibizz, a Dutch creative & digital agency. Write Google Responsive Search Ad copy in DUTCH for the target market.

LANGUAGE: Dutch (Nederlands).
GOOGLE LIMITS (HARD): headlines ≤30 characters, descriptions ≤90 characters. Count carefully.
RSA REQUIREMENTS: 15 headlines, 4 descriptions, all unique and varied.

${DUTCH_STYLE_RULES}
- Headlines volgen sentence case ("Bespaar op je energierekening", niet "Bespaar Op Je Energierekening").
- Descriptions volgen normale Nederlandse zinsbouw met sentence case per zin.

BRAND: ${brandName || '(unknown)'}
BRIEF:
- Title: ${brief.title}
- Goal: ${brief.goal ?? '(not specified)'}
- Audience: ${brief.target_audience ?? '(not specified)'}
- ICP: ${brief.icp ?? '(not specified)'}
- Location: ${describeLocation(parseLocation(brief.location))}

CAMPAIGN: ${campaign.name} (${campaign.segment})
AD GROUP: ${group.name}
THEME: ${group.theme}
KEYWORDS:
${keywordsText}

GUIDELINES:
- Vary the headlines: include benefits, features, CTAs, USPs, social proof.
- Use the keyword in 3-5 headlines (relevance helps Quality Score).
- For ${campaign.segment === 'branded' ? 'branded campaigns: emphasize the brand name and unique positioning' : 'non-branded: emphasize value proposition, USPs, and clear CTA'}.
- Headlines: short, punchy, benefit-driven. Use numbers when possible (e.g. "Vanaf €99", "5 jaar garantie").
- Descriptions: full sentences with a clear CTA. Vary the angle.
- NO claims like "beste in Nederland" — Google bans superlatives.
- NO repeated punctuation, NO ALL CAPS words.
- No CTAs in headlines that conflict with the campaign goal.

Return ONLY valid JSON. No markdown fences. Schema:
{
  "headlines": [
    "Headline 1 (max 30 chars)",
    ...15 totaal
  ],
  "descriptions": [
    "Volledige zin als eerste regel die de propositie pakkend overbrengt naar de doelgroep.",
    ...4 totaal
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
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Anthropic ad copy fout (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text ?? ''
  const parsed = JSON.parse(extractJson(text))

  const { toSentenceCase } = await import('@/lib/dutch-style')

  // Sanitize: sentence case + enforce char limits + dedupe + truncate
  const headlines: string[] = (parsed.headlines ?? [])
    .map((h: string) => toSentenceCase(String(h).trim()).slice(0, 30))
    .filter((h: string, i: number, arr: string[]) => h.length > 0 && arr.indexOf(h) === i)
    .slice(0, 15)

  const descriptions: string[] = (parsed.descriptions ?? [])
    .map((d: string) => toSentenceCase(String(d).trim()).slice(0, 90))
    .filter((d: string, i: number, arr: string[]) => d.length > 0 && arr.indexOf(d) === i)
    .slice(0, 4)

  return {
    headlines,
    descriptions,
    generated_at: new Date().toISOString(),
  }
}

export async function POST(req: NextRequest) {
  try {
    const { researchId, onlyCampaign, onlyGroup } = await req.json() as GenerateInput
    if (!researchId) return NextResponse.json({ error: 'researchId required' }, { status: 400 })

    const apiKey = getEnv('ANTHROPIC_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY missing' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { data: research, error: rErr } = await supabase
      .from('sea_keyword_research')
      .select('*')
      .eq('id', researchId)
      .single()
    if (rErr || !research) return NextResponse.json({ error: 'Research not found' }, { status: 404 })

    const { data: brief } = await supabase
      .from('sea_briefs')
      .select('*')
      .eq('id', research.brief_id)
      .single()
    if (!brief) return NextResponse.json({ error: 'Brief not found' }, { status: 404 })

    let brandName = ''
    if (brief.brand_id) {
      const { data: brand } = await supabase.from('brands').select('name').eq('id', brief.brand_id).single()
      if (brand) brandName = brand.name
    }

    const campaigns: SeaCampaign[] = research.campaigns
    let totalGroups = 0
    let generated = 0
    const errors: string[] = []

    for (let ci = 0; ci < campaigns.length; ci++) {
      for (let gi = 0; gi < campaigns[ci].ad_groups.length; gi++) {
        if (onlyCampaign !== undefined && (ci !== onlyCampaign || gi !== onlyGroup)) continue
        totalGroups++
        try {
          const adCopy = await generateAdCopyForGroup(apiKey, brandName, brief, campaigns[ci], gi)
          campaigns[ci].ad_groups[gi].ad_copy = adCopy
          generated++
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown'
          errors.push(`${campaigns[ci].name} → ${campaigns[ci].ad_groups[gi].name}: ${msg}`)
        }
      }
    }

    const { data: updated, error: updErr } = await supabase
      .from('sea_keyword_research')
      .update({ campaigns, updated_at: new Date().toISOString() })
      .eq('id', researchId)
      .select()
      .single()

    if (updErr || !updated) {
      return NextResponse.json({ error: updErr?.message ?? 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({
      research: updated,
      stats: { total_groups: totalGroups, generated, errors: errors.length, error_messages: errors },
    })
  } catch (err) {
    console.error('generate-ad-copy error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
