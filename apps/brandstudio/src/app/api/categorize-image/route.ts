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

type Category = { id: string; name: string }

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, categories } = await req.json() as { imageUrl: string; categories: Category[] }
    if (!imageUrl || !Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ error: 'Ongeldige input' }, { status: 400 })
    }

    const apiKey = getApiKey()
    if (!apiKey) return NextResponse.json({ error: 'API key ontbreekt' }, { status: 500 })

    const categoryList = categories.map(c => `- ${c.name}`).join('\n')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: imageUrl },
            },
            {
              type: 'text',
              text: `Categoriseer deze afbeelding in één van deze categorieën voor een merk-beeldbank:

${categoryList}

Hints:
- "Producten" = foto's van producten zelf, productshots, packshots
- "Modellen" = foto's met mensen/modellen die producten dragen of gebruiken
- "Details" = close-up van details, materiaal, textuur, onderdelen
- "Icons" = pictogrammen, symbolen, logo's, illustraties (geen fotografie)

Antwoord met ALLEEN de naam van de best passende categorie, exact zoals hierboven gespeld. Geen uitleg.`,
            },
          ],
        }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Anthropic vision fout:', res.status, errText)
      return NextResponse.json({ error: 'Anthropic fout' }, { status: 500 })
    }

    const data = await res.json()
    const text: string = data.content?.[0]?.text?.trim() ?? ''
    const matched = categories.find(c => c.name.toLowerCase() === text.toLowerCase())

    return NextResponse.json({
      categoryId: matched?.id ?? null,
      categoryName: matched?.name ?? null,
      raw: text,
    })
  } catch (err) {
    console.error('categorize-image fout:', err)
    return NextResponse.json({ error: 'Verwerking mislukt' }, { status: 500 })
  }
}
