/**
 * @ibizz/ai-video — abstractielaag voor image-to-video generatie.
 *
 * Async-flow (anders dan @ibizz/ai-image die sync is):
 *   1. startGeneration() → operationName (provider begint async render)
 *   2. pollOperation(operationName) → { done, videoUri?, error? }
 *   3. downloadVideo(videoUri) → bytes (met provider-auth)
 *
 * Basis: Veo 3.1 via Gemini API. Kling/Runway pluggable later.
 */

export type VideoModelId =
  | 'veo-3.1'
  | 'veo-3.1-fast'
  | 'veo-3.1-lite'
  | 'kling'
  | 'seedance'
  | 'runway'

export type VideoModelInfo = {
  id: VideoModelId
  name: string
  description: string
  /** Geschatte kost per seconde output (USD). */
  pricePerSec: number
  /** Max clip-lengte in seconden. */
  maxDurationSec: number
  available: boolean
}

export const VIDEO_MODELS: VideoModelInfo[] = [
  {
    id: 'veo-3.1-lite',
    name: 'Veo 3.1 Lite',
    description: 'Snelste + goedkoopste. Goed voor drafts en social clips.',
    pricePerSec: 0.05,
    maxDurationSec: 8,
    available: true,
  },
  {
    id: 'veo-3.1-fast',
    name: 'Veo 3.1 Fast',
    description: 'Snelle render, goede kwaliteit, native audio.',
    pricePerSec: 0.15,
    maxDurationSec: 8,
    available: true,
  },
  {
    id: 'veo-3.1',
    name: 'Veo 3.1 Standard',
    description: 'Beste kwaliteit + lip-sync + 4K. Duurst.',
    pricePerSec: 0.40,
    maxDurationSec: 8,
    available: true,
  },
  {
    id: 'kling',
    name: 'Kling 2.5 Turbo Pro',
    description: 'Beste labeltekst-behoud — top voor productvideo\'s. Via fal.ai (FAL_KEY).',
    pricePerSec: 0.10,
    maxDurationSec: 10,
    available: true,
  },
  {
    id: 'seedance',
    name: 'Seedance 2.0',
    description: '#1 image-to-video nu — sterk beeldbehoud + camerabeweging. Via fal.ai (FAL_KEY).',
    pricePerSec: 0.15,
    maxDurationSec: 15,
    available: true,
  },
  {
    id: 'runway',
    name: 'Runway Gen-4.5',
    description: 'Beste motion-controls. Vereist eigen API-key.',
    pricePerSec: 0.15,
    maxDurationSec: 10,
    available: false,
  },
]

/** Veo ondersteunt 16:9 (landscape) en 9:16 (vertical, voor reels/tiktok). */
export type VideoAspectRatio = '16:9' | '9:16'
export type VideoResolution = '720p' | '1080p'

export type StartVideoInput = {
  model: VideoModelId
  prompt: string
  /** Bron-afbeelding (eerste frame) als base64, zonder data: prefix. Gebruikt door Veo. */
  imageBase64: string
  imageMimeType: string
  /** Publieke URL van de bron-afbeelding. Gebruikt door providers die geen base64 accepteren (Kling/fal). */
  imageUrl?: string
  aspectRatio: VideoAspectRatio
  resolution: VideoResolution
  /** Gewenste clip-lengte. Provider clampt naar maxDurationSec. */
  durationSeconds?: number
}

export type StartVideoResult = {
  /** Identifier om de async operation te pollen. */
  operationName: string
}

export type PollResult = {
  done: boolean
  /** URI om de video te downloaden (alleen als done && succes). */
  videoUri?: string
  /** Foutmelding als de generatie faalde. */
  error?: string
}

export interface VideoGenProvider {
  readonly id: VideoModelId
  startGeneration(input: StartVideoInput): Promise<StartVideoResult>
  pollOperation(operationName: string): Promise<PollResult>
  /** Download de video-bytes (provider voegt eigen auth toe). */
  downloadVideo(videoUri: string): Promise<ArrayBuffer>
}
