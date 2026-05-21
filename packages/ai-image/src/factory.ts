import { GeminiProvider } from './gemini'
import { OpenAIProvider } from './openai'
import type { ImageGenProvider, ModelId } from './types'

export function getProvider(model: ModelId): ImageGenProvider {
  switch (model) {
    case 'gemini': {
      const key = process.env.GEMINI_API_KEY
      if (!key) throw new Error('GEMINI_API_KEY ontbreekt in .env.local')
      return new GeminiProvider(key)
    }
    case 'openai': {
      const key = process.env.OPENAI_API_KEY
      if (!key) throw new Error('OPENAI_API_KEY ontbreekt in .env.local')
      return new OpenAIProvider(key)
    }
    case 'flux':
    case 'ideogram':
      throw new Error(`Provider "${model}" nog niet geïmplementeerd`)
    default:
      throw new Error(`Onbekend model: ${model}`)
  }
}
