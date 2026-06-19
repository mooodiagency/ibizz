import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, GeoProject } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 60

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

type SeoIntent = 'informational' | 'commercial' | 'transactional' | 'navigational'
function mapIntent(geo: string): SeoIntent {
  if (geo === 'comparison' || geo === 'commercial') return 'commercial'
  if (geo === 'transactional') return 'transactional'
  if (geo === 'navigational') return 'navigational'
  return 'informational'
}

type Item = {
  question: string
  intent: string
  desired_answer: string | null
  competitors: string[]
  sources: string[]
}

function buildNotes(brandName: string, it: Item): string {
  const parts: string[] = []
  parts.push('GEO-kans — schrijf deze pagina zó dat AI-assistenten (ChatGPT/Claude/Perplexity) hem citeren.')
  parts.push(`Originele vraag van de doelgroep: "${it.question}"`)
  if (it.desired_answer) parts.push(`Gezocht antwoord (dit MOET de pagina leveren): ${it.desired_answer}`)
  if (it.competitors.length) parts.push(`Concurrenten die de AI nu noemt: ${it.competitors.join(', ')}. Positioneer ${brandName} als minstens gelijkwaardig of beter.`)
  if (it.sources.length) parts.push(`AI citeert nu o.a.: ${it.sources.join(', ')}. Evenaar of overtref die bron-autoriteit.`)
  parts.push('GEO-schrijfregels: geef bovenaan een bondig, direct antwoord op de vraag; gebruik duidelijke H2/H3-koppen die de vraag letterlijk bevatten; voeg een korte FAQ toe; onderbouw met feiten/cijfers; noem het merk expliciet als de oplossing.')
  return parts.join('\n')
}

const GEO_PERSONA_NAME = 'Doelgroep (via GEO)'
const GEO_THEME_NAME = 'GEO-kansen'

/**
 * Zorgt voor één default GEO-persona + thema in de SEO-brief en geeft hun ids terug.
 * Nodig omdat de SEO-writer-flow alleen pagina's mét persona_id én theme_id toont.
 */
async function ensurePersonaTheme(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  briefId: string,
): Promise<{ personaId: string | null; themeId: string | null }> {
  let personaId: string | null = null
  const ep = await supabase.from('seo_personas').select('id').eq('brief_id', briefId).eq('name', GEO_PERSONA_NAME).maybeSingle()
  if (ep.data) personaId = ep.data.id as string
  else {
    const c = await supabase.from('seo_personas').insert({ brief_id: briefId, name: GEO_PERSONA_NAME, avatar_emoji: '🛰️', one_liner: 'Automatisch aangemaakt vanuit GEO-kansen' }).select('id').single()
    if (c.data) personaId = c.data.id as string
    else if (c.error) console.warn('[push-to-seo] GEO-persona aanmaken mislukt:', c.error.message)
  }

  let themeId: string | null = null
  const et = await supabase.from('seo_themes').select('id').eq('brief_id', briefId).eq('name', GEO_THEME_NAME).maybeSingle()
  if (et.data) themeId = et.data.id as string
  else {
    const c = await supabase.from('seo_themes').insert({ brief_id: briefId, name: GEO_THEME_NAME, description: 'Vragen waar het merk nog niet in AI-antwoorden verschijnt.' }).select('id').single()
    if (c.data) themeId = c.data.id as string
    else if (c.error) console.warn('[push-to-seo] GEO-thema aanmaken mislukt:', c.error.message)
  }
  return { personaId, themeId }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as { projectId: string; items: Item[] }
    if (!body.projectId) return NextResponse.json({ error: 'projectId verplicht' }, { status: 400 })
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Geen kansen geselecteerd' }, { status: 400 })
    }

    const projRes = await supabase.from('geo_projects').select('*').eq('id', body.projectId).single()
    if (projRes.error || !projRes.data) return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    const project = projRes.data as GeoProject

    let brandName = project.brand_terms[0] ?? project.name
    if (project.brand_id) {
      const b = await supabase.from('brands').select('name').eq('id', project.brand_id).maybeSingle()
      if (b.data?.name) brandName = b.data.name
    }

    // 1. SEO-brief vinden of aanmaken
    let briefId = project.seo_brief_id
    if (briefId) {
      const check = await supabase.from('seo_briefs').select('id').eq('id', briefId).maybeSingle()
      if (!check.data) briefId = null   // gekoppelde brief bestaat niet meer
    }
    let briefCreated = false
    if (!briefId) {
      const created = await supabase.from('seo_briefs').insert({
        brand_id: project.brand_id,
        title: `${project.name} — GEO content`,
        goal: 'Content geschreven op basis van GEO-kansen: vragen waar het merk nog niet in AI-antwoorden verschijnt.',
        primary_market: project.market,
        website_url: project.website_url,
        competitors: project.competitors,
        status: 'draft',
        created_by: user.id,
        created_by_name: project.created_by_name,
      }).select('id').single()
      if (created.error || !created.data) {
        return NextResponse.json({ error: `Kon SEO-brief niet aanmaken: ${created.error?.message ?? 'onbekend'}` }, { status: 500 })
      }
      briefId = created.data.id as string
      briefCreated = true
      const linkRes = await supabase.from('geo_projects').update({ seo_brief_id: briefId }).eq('id', project.id)
      if (linkRes.error) console.warn('[push-to-seo] kon seo_brief_id-link niet opslaan:', linkRes.error.message)
    }

    // 2. Default GEO-persona + thema zorgen → pagina's worden zo schrijfbaar in de SEO-writer-flow
    //    (die filtert op p.persona_id && p.theme_id).
    const { personaId, themeId } = await ensurePersonaTheme(supabase, briefId)

    // 3. Pagina's aanmaken — skip vragen die al als page-topic bestaan (dedupe)
    const existingPages = await supabase.from('seo_pages').select('topic').eq('brief_id', briefId)
    if (existingPages.error) console.warn('[push-to-seo] dedup-check pagina\'s mislukt, mogelijk duplicaten:', existingPages.error.message)
    const existingTopics = new Set((existingPages.data ?? []).map(p => (p.topic as string).toLowerCase().trim()))

    const inserts = body.items
      .filter(it => it.question?.trim() && !existingTopics.has(it.question.toLowerCase().trim()))
      .map(it => ({
        brief_id: briefId!,
        persona_id: personaId,
        theme_id: themeId,
        topic: it.question.trim(),
        search_intent: mapIntent(it.intent),
        status: 'planned' as const,
        notes: buildNotes(brandName, it),
      }))

    if (inserts.length === 0) {
      return NextResponse.json({ briefId, created: 0, briefCreated, message: 'Alle geselecteerde vragen stonden al als pagina in de SEO-brief.' })
    }

    const pagesRes = await supabase.from('seo_pages').insert(inserts).select('id')
    if (pagesRes.error) return NextResponse.json({ error: `Pagina's aanmaken mislukt: ${pagesRes.error.message}` }, { status: 500 })

    return NextResponse.json({
      briefId,
      created: pagesRes.data?.length ?? 0,
      duplicatesSkipped: body.items.length - inserts.length,
      briefCreated,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('push-to-seo crash:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
