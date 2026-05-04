import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export const runtime = 'nodejs'
export const maxDuration = 300

function getApiKey(): string | undefined {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    const match = content.match(/^ANTHROPIC_API_KEY=(.+)$/m)
    return match?.[1]?.trim()
  } catch {
    return undefined
  }
}

/** Trim markdown fences en extract JSON object uit Claude's antwoord */
function extractJson(text: string): string {
  let t = text.trim()
  // Strip markdown fences: ```json ... ``` of ``` ... ```
  const fenceMatch = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenceMatch) t = fenceMatch[1].trim()
  // Pak vanaf eerste { tot laatste }
  const first = t.indexOf('{')
  const last = t.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1)
  }
  return t
}

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json()
    if (!transcript?.trim()) {
      return NextResponse.json({ error: 'Geen transcript' }, { status: 400 })
    }

    const apiKey = getApiKey()
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY niet gevonden')
      return NextResponse.json({ error: 'API key ontbreekt' }, { status: 500 })
    }

    const today = new Date().toLocaleDateString('nl-NL', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

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
        messages: [{
          role: 'user',
          content: `Je bent een professionele notulist voor ibizz, een creatief en digitaal bureau. Verwerk het volgende vergaderingstranscript naar gestructureerde notulen in het Nederlands.

Vandaag is het: ${today}

TRANSCRIPT:
${transcript}

BELANGRIJK: geef ALLEEN geldige JSON terug. Geen markdown code fences, geen uitleg, geen tekst eromheen. Begin direct met { en eindig met }. Escape dubbele quotes binnen string-velden als \\".

Format:
{
  "datum": "volledige datum van de vergadering",
  "aanwezig": ["naam1", "naam2"],
  "samenvatting": "korte heldere samenvatting van de vergadering in 2-3 zinnen",
  "agendapunten": [
    {"titel": "onderwerp", "toelichting": "wat is er besproken en geconcludeerd"}
  ],
  "besluiten": ["besluit 1", "besluit 2"],
  "actiepunten": [
    {"actie": "wat moet er gebeuren", "eigenaar": "naam of null", "deadline": "datum of null"}
  ],
  "volgende_vergadering": "datum en tijd of null"
}`,
        }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Anthropic API fout:', res.status, errText)
      return NextResponse.json({ error: 'Anthropic fout' }, { status: 500 })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    const cleaned = extractJson(text)
    let notulen
    try {
      notulen = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('Notulen JSON parse fout. Raw text:', text.slice(0, 500))
      console.error('Cleaned:', cleaned.slice(0, 500))
      throw parseErr
    }
    return NextResponse.json(notulen)
  } catch (err) {
    console.error('Notulen fout:', err)
    const msg = err instanceof Error ? err.message : 'Verwerking mislukt'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
