import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, VideoBrief, Brand } from '@ibizz/supabase'
import { cookies } from 'next/headers'
import { crawlSite, pagesToLlmContext } from '@/lib/scraper'

export const runtime = 'nodejs'
export const maxDuration = 300

const MODEL = 'claude-sonnet-4-6'
const MAX_PAGES = 12

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

function buildSynthesisPrompt(args: {
  brandName: string
  rootUrl: string
  scrapedContent: string
  pageCount: number
}): string {
  const { brandName, rootUrl, scrapedContent, pageCount } = args
  return `Je bent een ervaren brand strateeg die snel een merkdossier opbouwt voor een creative team dat TikTok en Reels scripts gaat schrijven. Je krijgt content van ${pageCount} pagina's van een merkwebsite. Synthesize een compact brand-dossier dat een scriptwriter direct kan gebruiken.

**Merk:** ${brandName}
**Bron:** ${rootUrl}

# CONTENT VAN ${pageCount} PAGINA'S

${scrapedContent}

# OPDRACHT

Schrijf een brand context in **markdown**, in het **Nederlands**, max **600 woorden**. Houd je aan deze structuur:

## Wat is het merk
2-3 zinnen — wat doet het bedrijf, voor wie, sinds wanneer (als bekend). Geen marketing-fluff.

## Producten / diensten
Bullet list van de belangrijkste 3-6 product/dienst-categorieën met 1 zin per stuk.

## Positionering & USPs
Wat onderscheidt dit merk van concurrenten? 3-5 USP's. Wees concreet, geen "wij zijn de beste".

## Doelgroep
Wie is de typische klant? Demografie, levensfase, situatie waar dit product/dienst voor relevant is. 2-4 zinnen.

## Tone of voice
Hoe communiceert het merk? Formeel/informeel, droog/speels, technisch/visueel. Concrete voorbeelden of patronen uit de content.

## Do's & Don'ts voor video content
- 3-5 do's (bv. "gebruik praktische demo's", "klantverhalen werken")
- 3-5 don'ts (bv. "geen jargon", "vermijd celebrity-clichés")

# REGELS

- **Alleen feiten uit de scraped content**. Verzin niets. Als iets onduidelijk is, schrijf "(niet expliciet vermeld)".
- **Nederlands**, droog en direct.
- **Geen em-dashes** in lopende tekst.
- **Geen quotes** rond losse termen.
- Begin direct met "## Wat is het merk", geen inleiding.`
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
      websiteUrl: string
      maxPages?: number
    }
    if (!body.briefId) return NextResponse.json({ error: 'briefId verplicht' }, { status: 400 })
    if (!body.websiteUrl) return NextResponse.json({ error: 'websiteUrl verplicht' }, { status: 400 })

    const maxPages = Math.max(1, Math.min(20, body.maxPages ?? MAX_PAGES))

    // Brief + brand laden voor naam
    const briefRes = await supabase.from('video_briefs').select('*').eq('id', body.briefId).single()
    if (briefRes.error || !briefRes.data) {
      return NextResponse.json({ error: 'Brief niet gevonden' }, { status: 404 })
    }
    const brief = briefRes.data as VideoBrief

    let brandName = 'het merk'
    if (brief.brand_id) {
      const brRes = await supabase.from('brands').select('*').eq('id', brief.brand_id).single()
      if (brRes.data) brandName = (brRes.data as Brand).name
    }

    // Crawl
    const t0 = Date.now()
    const crawl = await crawlSite(body.websiteUrl, maxPages)
    const crawlMs = Date.now() - t0

    if (crawl.pages.length === 0) {
      return NextResponse.json({
        error: `Geen pagina's konden worden gescraped (${crawl.failed.length} pogingen mislukt). Check of de URL klopt en publiek bereikbaar is.`,
        failed: crawl.failed.slice(0, 5),
      }, { status: 500 })
    }

    // Synthesize via Claude
    const scrapedContent = pagesToLlmContext(crawl.pages)
    const prompt = buildSynthesisPrompt({
      brandName,
      rootUrl: crawl.rootUrl,
      scrapedContent,
      pageCount: crawl.pages.length,
    })

    // Rough token estimate — Claude rekent ~3.5-4 chars/token voor NL/EN mix
    const promptChars = prompt.length
    const tokenEstimate = Math.round(promptChars / 3.5)
    console.log(`[scrape-brand-context] prompt: ${promptChars} chars (~${tokenEstimate} tokens), ${crawl.pages.length} pages`)

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('Anthropic error:', aiRes.status, errText.slice(0, 1000))
      // Probeer de specifieke error message uit het JSON antwoord te halen
      let detail = errText.slice(0, 300)
      try {
        const errJson = JSON.parse(errText) as { error?: { type?: string; message?: string } }
        if (errJson?.error?.message) {
          detail = `${errJson.error.type ?? 'error'}: ${errJson.error.message}`
        }
      } catch { /* not JSON, keep raw text */ }
      return NextResponse.json({
        error: `AI synthesis mislukt (${aiRes.status}): ${detail}`,
        debug: { promptChars, tokenEstimate, pageCount: crawl.pages.length },
      }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const brandContext = ((aiData.content?.[0]?.text ?? '') as string).trim()
    if (!brandContext) {
      return NextResponse.json({ error: 'Lege AI response' }, { status: 500 })
    }

    // Opslaan in brief
    const updateRes = await supabase
      .from('video_briefs')
      .update({ brand_context: brandContext })
      .eq('id', body.briefId)
      .select()
      .single()

    if (updateRes.error) {
      return NextResponse.json({ error: `Opslaan mislukt: ${updateRes.error.message}` }, { status: 500 })
    }

    return NextResponse.json({
      brief: updateRes.data as VideoBrief,
      stats: {
        pagesScraped: crawl.pages.length,
        pagesFailed: crawl.failed.length,
        crawlMs,
        source: crawl.source,
        scrapedUrls: crawl.pages.map(p => p.finalUrl),
        failed: crawl.failed.slice(0, 10),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('scrape-brand-context crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
