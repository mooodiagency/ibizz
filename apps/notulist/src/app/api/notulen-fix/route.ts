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

export async function POST(req: NextRequest) {
  try {
    const { notulen, correctName } = await req.json()
    if (!notulen || !correctName?.trim()) {
      return NextResponse.json({ error: 'Notulen of naam ontbreekt' }, { status: 400 })
    }

    const apiKey = getApiKey()
    if (!apiKey) {
      return NextResponse.json({ error: 'API key ontbreekt' }, { status: 500 })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `In de volgende notulen kan de klantnaam verkeerd gespeld zijn door spraakherkenning. De juiste schrijfwijze is: "${correctName}".

Zoek alle variaties of misspellingen van deze klantnaam in de notulen en vervang ze door de juiste schrijfwijze. Wees conservatief: alleen vervangen als je zeker weet dat het om dezelfde naam gaat (fonetisch lijkende namen, gedeeltelijke matches, etc). Laat alle andere tekst exact zoals het is.

NOTULEN:
${JSON.stringify(notulen, null, 2)}

Geef ALLEEN geldige JSON terug in exact hetzelfde formaat als hierboven, met de naam waar nodig gecorrigeerd. Geen uitleg, geen markdown.`,
        }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Anthropic fix fout:', res.status, errText)
      return NextResponse.json({ error: 'Anthropic fout' }, { status: 500 })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    const corrected = JSON.parse(extractJson(text))
    return NextResponse.json(corrected)
  } catch (err) {
    console.error('Fix-name fout:', err)
    return NextResponse.json({ error: 'Verwerking mislukt' }, { status: 500 })
  }
}
