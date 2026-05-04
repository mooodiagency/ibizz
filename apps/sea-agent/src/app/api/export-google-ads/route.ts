import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

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

// Google Ads Editor column name mapping
const MATCH_LABEL: Record<string, string> = { broad: 'Broad', phrase: 'Phrase', exact: 'Exact' }
const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  'Search': 'Search',
  'Performance Max': 'Performance max',
  'Display': 'Display',
  'Demand Gen': 'Demand gen',
  'YouTube': 'Video',
}

// Column order for Google Ads Editor
const HEADERS = [
  'Campaign', 'Campaign type', 'Campaign status', 'Campaign daily budget', 'Bid strategy type', 'Target CPA',
  'Ad group', 'Ad group status',
  'Keyword', 'Match type', 'Status',
  'Negative keyword', 'Negative keyword Match type',
  'Ad type',
  'Headline 1', 'Headline 2', 'Headline 3', 'Headline 4', 'Headline 5',
  'Headline 6', 'Headline 7', 'Headline 8', 'Headline 9', 'Headline 10',
  'Headline 11', 'Headline 12', 'Headline 13', 'Headline 14', 'Headline 15',
  'Description 1', 'Description 2', 'Description 3', 'Description 4',
  'Final URL', 'Path 1', 'Path 2',
]

type Row = Partial<Record<typeof HEADERS[number], string | number>>

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { briefId } = await req.json()
    if (!briefId) return NextResponse.json({ error: 'briefId required' }, { status: 400 })

    // Load all data in parallel
    const [briefRes, strategyRes, researchRes] = await Promise.all([
      supabase.from('sea_briefs').select('*').eq('id', briefId).single(),
      supabase.from('sea_strategies').select('*').eq('brief_id', briefId).maybeSingle(),
      supabase.from('sea_keyword_research').select('*').eq('brief_id', briefId).maybeSingle(),
    ])

    const brief = briefRes.data
    const strategy = strategyRes.data
    const research = researchRes.data

    if (!brief) return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
    if (!research || research.campaigns.length === 0) {
      return NextResponse.json({ error: 'Geen keyword research gevonden. Genereer eerst keywords.' }, { status: 400 })
    }

    // Load negatives: global + brand-specific
    const negQueries = [
      supabase.from('sea_negative_keywords').select('keyword,match_type').is('brand_id', null),
    ]
    if (brief.brand_id) {
      negQueries.push(
        supabase.from('sea_negative_keywords').select('keyword,match_type').eq('brand_id', brief.brand_id)
      )
    }
    const negResults = await Promise.all(negQueries)
    const allNegatives = negResults.flatMap(r => r.data ?? [])

    const rows: Row[] = []

    for (const campaign of research.campaigns) {
      // Find matching budget from strategy
      const campaignType = strategy?.campaign_types?.find(
        ct => ct.type.toLowerCase() === campaign.type.toLowerCase()
      )
      const rawBudget = campaignType?.budget ?? brief.monthly_budget ?? null
      const dailyBudget = rawBudget ? Number((rawBudget / 30.4).toFixed(2)) : ''

      // Bid strategy
      const bidStrategy = brief.target_cpa ? 'Target CPA' : 'Maximize conversions'
      const targetCpa = brief.target_cpa ?? ''

      // ── Campaign row ──────────────────────────────────────────────
      rows.push({
        'Campaign': campaign.name,
        'Campaign type': CAMPAIGN_TYPE_LABEL[campaign.type] ?? campaign.type,
        'Campaign status': 'Enabled',
        'Campaign daily budget': dailyBudget,
        'Bid strategy type': bidStrategy,
        'Target CPA': targetCpa,
      })

      // Performance Max: no ad groups / keywords in standard format
      if (campaign.type === 'Performance Max') continue

      for (const adGroup of campaign.ad_groups) {
        // ── Ad group row ──────────────────────────────────────────
        rows.push({
          'Campaign': campaign.name,
          'Ad group': adGroup.name,
          'Ad group status': 'Enabled',
        })

        // ── Keyword rows ──────────────────────────────────────────
        for (const kw of adGroup.keywords) {
          rows.push({
            'Campaign': campaign.name,
            'Ad group': adGroup.name,
            'Keyword': kw.text,
            'Match type': MATCH_LABEL[kw.match_type] ?? 'Broad',
            'Status': 'Enabled',
          })
        }

        // ── RSA ad row ────────────────────────────────────────────
        const copy = adGroup.ad_copy
        if (copy && copy.headlines.length > 0) {
          const adRow: Row = {
            'Campaign': campaign.name,
            'Ad group': adGroup.name,
            'Ad type': 'Responsive search ad',
            'Final URL': copy.final_url ?? '',
            'Path 1': copy.display_path_1 ?? '',
            'Path 2': copy.display_path_2 ?? '',
            'Status': 'Enabled',
          }
          copy.headlines.slice(0, 15).forEach((h, i) => { adRow[`Headline ${i + 1}` as keyof Row] = h })
          copy.descriptions.slice(0, 4).forEach((d, i) => { adRow[`Description ${i + 1}` as keyof Row] = d })
          rows.push(adRow)
        }
      }

      // ── Campaign-level negative keywords ─────────────────────────
      for (const neg of allNegatives) {
        rows.push({
          'Campaign': campaign.name,
          'Negative keyword': neg.keyword,
          'Negative keyword Match type': MATCH_LABEL[neg.match_type] ?? 'Broad',
        })
      }
    }

    // ── Generate XLSX ─────────────────────────────────────────────
    const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS })

    // Column widths
    ws['!cols'] = [
      { wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 12 },
      { wch: 28 }, { wch: 14 },
      { wch: 35 }, { wch: 10 }, { wch: 10 },
      { wch: 35 }, { wch: 26 },
      { wch: 22 },
      ...Array(15).fill({ wch: 32 }),
      ...Array(4).fill({ wch: 90 }),
      { wch: 40 }, { wch: 14 }, { wch: 14 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Google Ads Import')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const slug = brief.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    const date = new Date().toISOString().slice(0, 10)
    const filename = `google-ads-${slug}-${date}.xlsx`

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('export-google-ads error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Export mislukt' }, { status: 500 })
  }
}
