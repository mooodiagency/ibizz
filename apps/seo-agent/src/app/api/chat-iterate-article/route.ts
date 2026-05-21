import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database, SeoArticle } from '@ibizz/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const maxDuration = 240

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

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Strip em-dashes, en-dashes en horizontale separators uit de output. */
function stripAiTells(text: string): string {
  return text
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')  // --- separators weg
    .replace(/\s+—\s+/g, '. ')
    .replace(/\s+–\s+/g, '. ')
    .replace(/—/g, ',')
    .replace(/–/g, '-')
    .replace(/\.\s+\./g, '.')
    .replace(/\.\s+([a-z])/g, (_, c) => `. ${c.toUpperCase()}`)
    .replace(/\n{3,}/g, '\n\n')
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = getEnv('ANTHROPIC_API_KEY')
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY ontbreekt' }, { status: 500 })

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json() as {
      articleId: string
      messages: ChatMessage[]
    }
    const { articleId, messages } = body
    if (!articleId || !messages?.length) {
      return NextResponse.json({ error: 'articleId en messages verplicht' }, { status: 400 })
    }

    const { data: artData } = await supabase.from('seo_articles').select('*').eq('id', articleId).single()
    if (!artData) return NextResponse.json({ error: 'Article niet gevonden' }, { status: 404 })
    const article = artData as SeoArticle

    const prompt = `Je bent een ervaren Nederlandse SEO content schrijver bij ibizz. Je werkt aan een artikel. De gebruiker geeft feedback en jij past het artikel aan.

HUIDIGE TITLE: ${article.title}
HUIDIGE META TITLE: ${article.meta_title ?? '—'}
HUIDIGE META DESCRIPTION: ${article.meta_description ?? '—'}

HUIDIGE CONTENT (markdown):
${article.content_markdown}

GEBRUIKER FEEDBACK CONVERSATIE:
${messages.map(m => `${m.role === 'user' ? 'GEBRUIKER' : 'ASSISTENT'}: ${m.content}`).join('\n\n')}

Pas het artikel aan op basis van de laatste feedback. Houd alles wat goed is. Verander alleen wat nodig is.

⛔ ABSOLUTE VERBODEN tijdens je aanpassingen:
- GEEN em-dashes (—) of en-dashes (–). NOOIT. Vervang door komma, punt of dubbele punt.
- Geen "het is essentieel om", "uiteindelijk", "tot slot", "kortom", "laten we eens kijken naar..."
- Geen overdreven adjectieven (revolutionair, baanbrekend, ongelooflijk)
- Korte zinnen, B1 niveau, jij-vorm, actief

VEREIST:
- Eerste regel blijft een H1 met \`#\`
- Heading hiërarchie netjes: H1 → H2 → H3 (alleen verder als echt nodig)
- Interne links (\`[tekst](/pad)\`) en externe links (\`[tekst](https://...)\`) behouden waar mogelijk
- Als er nog geen externe links zijn, voeg er 1-3 toe naar bekende NL bronnen (belastingdienst, rijksoverheid, kvk, etc.)

OUTPUT — geldige JSON, geen markdown fences:
{
  "reply": "string — 1-2 zinnen waarin je uitlegt wat je hebt aangepast",
  "updated": {
    "title": "string — actuele titel (mag identiek blijven)",
    "meta_title": "string",
    "meta_description": "string",
    "content_markdown": "string — VOLLEDIGE bijgewerkte artikel in markdown"
  }
}`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error('Anthropic error:', aiRes.status, errText.slice(0, 500))
      return NextResponse.json({ error: 'AI request mislukt' }, { status: 500 })
    }

    const aiData = await aiRes.json()
    const text = aiData.content?.[0]?.text ?? ''
    const parsed = JSON.parse(extractJson(text)) as {
      reply: string
      updated: {
        title: string
        meta_title: string
        meta_description: string
        content_markdown: string
      }
    }

    const cleanMarkdown = stripAiTells(parsed.updated.content_markdown)
    const cleanMetaDesc = stripAiTells(parsed.updated.meta_description)

    // Persist updated artikel
    const { data: updated } = await supabase.from('seo_articles').update({
      title: parsed.updated.title,
      meta_title: parsed.updated.meta_title,
      meta_description: cleanMetaDesc,
      content_markdown: cleanMarkdown,
      word_count: countWords(cleanMarkdown),
      updated_at: new Date().toISOString(),
    }).eq('id', articleId).select().single()

    return NextResponse.json({
      reply: parsed.reply,
      article: updated as SeoArticle,
    })
  } catch (err) {
    console.error('chat-iterate-article fout:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Onbekende fout' }, { status: 500 })
  }
}
