import type {
  VideoGenProvider, VideoModelId, StartVideoInput, StartVideoResult, PollResult,
} from './types'
import { falSubmit, falPoll, falDownload } from './fal'

const SEEDANCE_MODEL = 'bytedance/seedance-2.0/image-to-video'

/**
 * Seedance 2.0 (ByteDance) image-to-video via fal.ai.
 * Huidige #1 op de image-to-video leaderboards — sterke beeldbehoud +
 * director-level camerabeweging. Vereist FAL_KEY en een publieke image-URL.
 */
export class SeedanceProvider implements VideoGenProvider {
  readonly id: VideoModelId = 'seedance'
  constructor(private apiKey: string) {}

  async startGeneration(input: StartVideoInput): Promise<StartVideoResult> {
    if (!input.imageUrl) {
      throw new Error('Seedance vereist een publieke image-URL (input.imageUrl ontbreekt)')
    }
    // Seedance accepteert duration 4-15 (of 'auto') en resolution 480p/720p/1080p
    const duration = input.durationSeconds && input.durationSeconds >= 4
      ? Math.min(input.durationSeconds, 15)
      : undefined

    const inputBody: Record<string, unknown> = {
      prompt: input.prompt,
      image_url: input.imageUrl,
      resolution: input.resolution,
      aspect_ratio: input.aspectRatio,
      generate_audio: false,
    }
    if (duration) inputBody.duration = duration

    const requestId = await falSubmit(SEEDANCE_MODEL, this.apiKey, inputBody)
    return { operationName: requestId }
  }

  pollOperation(operationName: string): Promise<PollResult> {
    return falPoll(SEEDANCE_MODEL, this.apiKey, operationName)
  }

  downloadVideo(videoUri: string): Promise<ArrayBuffer> {
    return falDownload(videoUri)
  }
}
