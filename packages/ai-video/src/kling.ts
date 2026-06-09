import type {
  VideoGenProvider, VideoModelId, StartVideoInput, StartVideoResult, PollResult,
} from './types'
import { falSubmit, falPoll, falDownload } from './fal'

const KLING_MODEL = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video'

/**
 * Kling 2.5 Turbo Pro image-to-video via fal.ai.
 * Sterkst in het behouden van leesbare labeltekst — top voor productvideo's.
 * Vereist een FAL_KEY en een publieke image-URL (input.imageUrl).
 */
export class KlingProvider implements VideoGenProvider {
  readonly id: VideoModelId = 'kling'
  constructor(private apiKey: string) {}

  async startGeneration(input: StartVideoInput): Promise<StartVideoResult> {
    if (!input.imageUrl) {
      throw new Error('Kling vereist een publieke image-URL (input.imageUrl ontbreekt)')
    }
    const duration = (input.durationSeconds ?? 5) <= 5 ? '5' : '10'
    const requestId = await falSubmit(KLING_MODEL, this.apiKey, {
      prompt: input.prompt,
      image_url: input.imageUrl,
      duration,
      aspect_ratio: input.aspectRatio,
      negative_prompt: 'vervormd, wazig, morphing, veranderend etiket, verkeerde tekst, gewijzigde verpakking, artefacten, distortion, warped text, flickering',
    })
    return { operationName: requestId }
  }

  pollOperation(operationName: string): Promise<PollResult> {
    return falPoll(KLING_MODEL, this.apiKey, operationName)
  }

  downloadVideo(videoUri: string): Promise<ArrayBuffer> {
    return falDownload(videoUri)
  }
}
