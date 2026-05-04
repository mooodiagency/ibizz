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
    description: 'Hoge kwaliteit, langzamer',
    supportsReferences: true,
    available: false,
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

export type GenerateInput = {
  prompt: string
  references?: ReferenceImage[]
  model: ModelId
}

export type GenerateOutput = {
  imageBase64: string
  mimeType: string
}

export interface ImageGenProvider {
  readonly id: ModelId
  generate(input: GenerateInput): Promise<GenerateOutput>
}
