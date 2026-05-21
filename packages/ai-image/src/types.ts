export type ModelId = 'gemini' | 'openai' | 'flux' | 'ideogram'

export type ModelInfo = {
  id: ModelId
  name: string
  description: string
  supportsReferences: boolean
  available: boolean
}

export const MODELS: ModelInfo[] = [
  {
    id: 'gemini',
    name: 'Gemini 2.5 Flash Image',
    description: 'Snel, ondersteunt referentiebeelden, gratis tier',
    supportsReferences: true,
    available: true,
  },
  {
    id: 'openai',
    name: 'OpenAI gpt-image-1',
    description: 'Hoge kwaliteit · echte inpainting · betaald (~$0.04/img)',
    supportsReferences: true,
    available: true,
  },
  {
    id: 'flux',
    name: 'Flux Pro',
    description: 'Goede compositie, geen reference support',
    supportsReferences: false,
    available: false,
  },
  {
    id: 'ideogram',
    name: 'Ideogram v3',
    description: 'Beste kwaliteit, duurste model',
    supportsReferences: true,
    available: false,
  },
]

export type ReferenceImage = {
  url: string
  mimeType: string
}

/** Gemini-supported aspect ratios. Andere providers negeren dit. */
export type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'

export type GenerateInput = {
  prompt: string
  references?: ReferenceImage[]
  model: ModelId
  aspectRatio?: AspectRatio
}

export type GenerateOutput = {
  imageBase64: string
  mimeType: string
}

export interface ImageGenProvider {
  readonly id: ModelId
  generate(input: GenerateInput): Promise<GenerateOutput>
}
