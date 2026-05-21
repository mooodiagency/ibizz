import type { GenerateInput, GenerateOutput, ImageGenProvider, ReferenceImage, AspectRatio } from './types'

const MODEL = 'gpt-image-1'

/** gpt-image-1 ondersteunt deze 3 formaten + 'auto'. */
type OpenAISize = '1024x1024' | '1024x1536' | '1536x1024' | 'auto'

/** Map aspect ratio → dichtstbijzijnde gpt-image-1 formaat. */
function sizeFromAspectRatio(ratio: AspectRatio | undefined): OpenAISize {
  if (!ratio) return '1024x1024'
  // Portrait varianten
  if (ratio === '2:3' || ratio === '3:4' || ratio === '4:5' || ratio === '9:16') return '1024x1536'
  // Landscape varianten
  if (ratio === '3:2' || ratio === '4:3' || ratio === '5:4' || ratio === '16:9' || ratio === '21:9') return '1536x1024'
  // Vierkant
  return '1024x1024'
}

async function fetchAsBlob(ref: ReferenceImage): Promise<Blob> {
  // Ondersteunt zowel http(s) urls als data: urls (voor masks).
  if (ref.url.startsWith('data:')) {
    const res = await fetch(ref.url)
    return res.blob()
  }
  const res = await fetch(ref.url)
  if (!res.ok) throw new Error(`Reference fetch fout: ${res.status}`)
  return res.blob()
}

export class OpenAIProvider implements ImageGenProvider {
  readonly id = 'openai' as const
  constructor(private apiKey: string) {}

  async generate({ prompt, references, aspectRatio }: GenerateInput): Promise<GenerateOutput> {
    const size = sizeFromAspectRatio(aspectRatio)

    // Geen references → text-to-image via /images/generations
    if (!references || references.length === 0) {
      return this.generations(prompt, size)
    }

    // Wél references → image-to-image via /images/edits (multipart)
    return this.edits(prompt, references, size, undefined)
  }

  /**
   * Echte inpainting: image + mask + prompt. Mask = PNG met transparante (alpha=0)
   * pixels op de te vervangen gebieden. Onze MaskBrushOverlay levert wit-op-zwart;
   * we converteren intern naar het OpenAI formaat.
   */
  async inpaint(prompt: string, image: ReferenceImage, mask: ReferenceImage, aspectRatio?: AspectRatio): Promise<GenerateOutput> {
    const size = sizeFromAspectRatio(aspectRatio)
    return this.edits(prompt, [image], size, mask)
  }

  // ────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────

  private async generations(prompt: string, size: OpenAISize): Promise<GenerateOutput> {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        size,
        n: 1,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenAI fout (${res.status}): ${errText.slice(0, 400)}`)
    }

    const data = await res.json()
    const b64 = data.data?.[0]?.b64_json
    if (!b64) throw new Error('Geen afbeelding ontvangen van OpenAI')

    return { imageBase64: b64, mimeType: 'image/png' }
  }

  private async edits(
    prompt: string,
    references: ReferenceImage[],
    size: OpenAISize,
    mask: ReferenceImage | undefined,
  ): Promise<GenerateOutput> {
    const form = new FormData()
    form.set('model', MODEL)
    form.set('prompt', prompt)
    form.set('size', size)
    form.set('n', '1')

    // Meerdere referenties → image[] array
    for (let i = 0; i < references.length; i++) {
      const blob = await fetchAsBlob(references[i])
      const ext = references[i].mimeType.includes('png') ? 'png' : 'jpg'
      // OpenAI verwacht "image" of "image[]" — beide werken; multi-input gebruikt array
      const fieldName = references.length === 1 ? 'image' : 'image[]'
      form.append(fieldName, blob, `ref-${i}.${ext}`)
    }

    if (mask) {
      // Mask is een PNG met alpha=0 op te vervangen gebieden, alpha=255 elders.
      // De client-side MaskBrushOverlay levert deze al in dit formaat aan via
      // getOpenAIMaskDataUrl().
      const maskBlob = await fetchAsBlob(mask)
      form.append('mask', maskBlob, 'mask.png')
    }

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: form,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenAI edits fout (${res.status}): ${errText.slice(0, 400)}`)
    }

    const data = await res.json()
    const b64 = data.data?.[0]?.b64_json
    if (!b64) throw new Error('Geen afbeelding ontvangen van OpenAI edits')

    return { imageBase64: b64, mimeType: 'image/png' }
  }
}

