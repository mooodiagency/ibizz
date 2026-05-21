import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, SeaCampaign, SeaStrategy, SeaKeywordResearch, SeaBrief } from '@ibizz/supabase'
import { cookies } from 'next/headers'
import { parseLocation, describeLocation } from '@/lib/location-targeting'

export const runtime = 'nodejs'
export const maxDuration = 180

type Step = 'strategy' | 'keywords' | 'adcopy'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

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

function briefContext(brief: SeaBrief): string {
  return [
    `BRIEF:`,
    `- Title: ${brief.title}`,
    `- Goal: ${brief.goal ?? '(not specified)'}`,
    `- Monthly budget: ${brief.monthly_budget ? `€${brief.monthly_budget}` : 'not set'}`,
    `- Target CPA: ${brief.target_cpa ? `€${brief.target_cpa}` : 'not set'}`,
    `- Location: ${describeLocation(parseLocation(brief.location))}`,
    `- Audience: ${brief.target_audience ?? '(not specified)'}`,
    `- ICP: ${brief.icp ?? '(not specified)'}`,
  ].join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getEnv('ANTHROPIC_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY ontbreekt' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as {
      briefId: string
      step: Step
      currentOutput: unknown        // huidige strategy/research data om te itereren
      messages: ChatMessage[]       // conversatie-history (incl. nieuwste user message)
    }
    const { briefId, step, currentOutput, messages } = body

    if (!briefId || !step || !messages?.length) {
      return NextResponse.json({ error: 'briefId, step en messages verplicht' }, { status: 400 })
    }

    const { data: brief } = await supabase.from('sea_briefs').select('*').eq('id', briefId).single()
    if (!brief) return NextResponse.json({ error: 'Brief niet gevonden' }, { status: 404 })

    // Per stap een passende system prompt + return type
    const stepConfig: Record<Step, { systemPrompt: string; schema: string }> = {
      strategy: {
        systemPrompt: `You are a senior SEA strategist for ibizz, iterating on a campaign strategy based on user feedback. The user will give you instructions or critique. Apply their feedback while keeping ibizz best practices: phrase + exact match preferred, PMax as base, Search expansion when budget allows.`,
        schema: `{
  "summary": "string",
  "budget_breakdown": [{"name": "Search", "amount": 600, "percentage": 50}],
  "campaign_types": [{"type": "Search", "budget": 600, "share_pct": 50, "reasoning": "..."}],
  "considerations": ["..."]
}`,
      },
      keywords: {
        systemPrompt: `You are a senior SEA keyword researcher for ibizz, iterating on keyword research based on user feedback. Maintain ibizz best practices: phrase + exact match preferred over broad, STAG ad groups, transactional/commercial intent focus.`,
        schema: `{
  "campaigns": [
    {
      "name": "string",
      "type": "Search",
      "segment": "branded" | "non-branded" | "pmax",
      "ad_groups": [
        {
          "name": "string",
          "theme": "string",
          "keywords": [{"text": "string", "match_type": "phrase|exact|broad", "intent": "transactional|commercial|branded|informational"}]
        }
      ]
    }
  ]
}`,
      },
      adcopy: {
        systemPrompt: `You are a senior SEA copywriter for ibizz, iterating on RSA ad copy based on user feedback. Stick to Google's character limits: headlines ≤30, descriptions ≤90. Use brand name in headline position 2 when relevant.`,
        schema: `{
  "ad_groups": [
    {
      "name": "string",
      "ad_copy": {
        "headlines": ["string", ...],
        "descriptions": ["string", ...],
        "final_url": "string|null",
        "display_path_1": "string|null",
        "display_path_2": "string|null"
      }
    }
  ]
}`,
      },
    }

    const cfg = stepConfig[step]

    const fullPrompt = [
      cfg.systemPrompt,
      '',
      briefContext(brief),
      '',
      `CURRENT ${step.toUpperCase()} OUTPUT (in JSON):`,
      JSON.stringify(currentOutput, null, 2),
      '',
      'USER CONVERSATION (apply their latest feedback):',
      messages.map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`).join('\n\n'),
      '',
      `Return ONLY a valid JSON object following this schema (no markdown fences, no commentary outside JSON):`,
      cfg.schema,
      '',
      `Also include a short "reply" field at the top with a 1-2 sentence message back to the user explaining what you changed.`,
      `Final response shape:`,
      `{ "reply": "Ik heb de Search budget verhoogd naar €700 zoals gevraagd...", "updated": <object matching the schema above> }`,
    ].join('\n')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        messages: [{ role: 'user', content: fullPrompt }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('chat-iterate Anthropic error:', res.status, errText)
      return NextResponse.json({ error: 'AI request mislukt' }, { status: 500 })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    const parsed = JSON.parse(extractJson(text)) as { reply: string; updated: unknown }

    // Persist updated output naar de juiste tabel
    if (step === 'strategy') {
      const u = parsed.updated as Partial<SeaStrategy>
      await supabase.from('sea_strategies').update({
        summary: u.summary,
        budget_breakdown: u.budget_breakdown,
        campaign_types: u.campaign_types,
        considerations: u.considerations,
        updated_at: new Date().toISOString(),
      }).eq('brief_id', briefId)
    } else if (step === 'keywords') {
      const u = parsed.updated as { campaigns: SeaCampaign[] }
      await supabase.from('sea_keyword_research').update({
        campaigns: u.campaigns,
        updated_at: new Date().toISOString(),
      }).eq('brief_id', briefId)
    } else if (step === 'adcopy') {
      // Merge: nieuwe ad_copy per ad_group toepassen op de bestaande research.campaigns
      const u = parsed.updated as { ad_groups: { name: string; ad_copy: SeaCampaign['ad_groups'][0]['ad_copy'] }[] }
      const { data: research } = await supabase.from('sea_keyword_research').select('*').eq('brief_id', briefId).single()
      if (research) {
        const r = research as SeaKeywordResearch
        const updated = r.campaigns.map(c => ({
          ...c,
          ad_groups: c.ad_groups.map(g => {
            const match = u.ad_groups.find(ag => ag.name === g.name)
            return match ? { ...g, ad_copy: match.ad_copy } : g
          }),
        }))
        await supabase.from('sea_keyword_research').update({
          campaigns: updated,
          updated_at: new Date().toISOString(),
        }).eq('brief_id', briefId)
      }
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('chat-iterate fout:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Onbekende fout' }, { status: 500 })
  }
}
