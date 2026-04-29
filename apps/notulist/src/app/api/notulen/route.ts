import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Je bent een professionele notulist voor ibizz, een creatief en digitaal bureau. Verwerk het volgende vergaderingstranscript naar gestructureerde notulen in het Nederlands.

Vandaag is het: ${today}

TRANSCRIPT:
${transcript}

Geef je antwoord als ALLEEN geldige JSON (geen markdown, geen uitleg):
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
    const notulen = JSON.parse(text)
    return NextResponse.json(notulen)
  } catch (err) {
    console.error('Notulen fout:', err)
    return NextResponse.json({ error: 'Verwerking mislukt' }, { status: 500 })
  }
}
