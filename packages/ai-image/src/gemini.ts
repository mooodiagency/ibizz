import type { GenerateInput, GenerateOutput, ImageGenProvider, ReferenceImage } from './types'

const MODEL = 'gemini-2.5-flash-image'

async function fetchAsBase64(ref: ReferenceImage): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(ref.url)
  if (!res.ok) throw new Error(`Reference fetch fout: ${res.status}`)
  const buf = await res.arrayBuffer()
  const base64 = Buffer.from(buf).toString('base64')
  return { data: base64, mimeType: ref.mimeType }
}

export class GeminiProvider implements ImageGenProvider {
  readonly id = 'gemini' as const
  constructor(private apiKey: string) {}

  async generate({ prompt, references }: GenerateInput): Promise<GenerateOutput> {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
    parts.push({ text: prompt })

    if (references && references.length > 0) {
      for (const ref of references) {
        const { data, mimeType } = await fetchAsBase64(ref)
        parts.push({ inlineData: { mimeType, data } })
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${this.apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini fout (${res.status}): ${errText}`)
    }

    const data = await res.json()
    const candidate = data.candidates?.[0]
    const imagePart = candidate?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData)
    if (!imagePart?.inlineData) {
      throw new Error('Geen afbeelding ontvangen van Gemini')
    }

    return {
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType ?? 'image/png',
    }
  }
}
