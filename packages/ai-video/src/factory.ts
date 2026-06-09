import { VeoProvider } from './veo'
import { KlingProvider } from './kling'
import { SeedanceProvider } from './seedance'
import type { VideoGenProvider, VideoModelId } from './types'

export function getVideoProvider(model: VideoModelId): VideoGenProvider {
  switch (model) {
    case 'veo-3.1':
    case 'veo-3.1-fast':
    case 'veo-3.1-lite': {
      const key = process.env.GEMINI_API_KEY
      if (!key) throw new Error('GEMINI_API_KEY ontbreekt in .env.local')
      return new VeoProvider(key, model)
    }
    case 'kling': {
      const key = process.env.FAL_KEY
      if (!key) throw new Error('FAL_KEY ontbreekt in .env.local (nodig voor Kling via fal.ai)')
      return new KlingProvider(key)
    }
    case 'seedance': {
      const key = process.env.FAL_KEY
      if (!key) throw new Error('FAL_KEY ontbreekt in .env.local (nodig voor Seedance via fal.ai)')
      return new SeedanceProvider(key)
    }
    case 'runway':
      throw new Error('Runway provider nog niet geïmplementeerd (vereist eigen API-key)')
    default:
      throw new Error(`Onbekend video-model: ${model}`)
  }
}
