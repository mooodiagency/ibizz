import type {
  VideoGenProvider, VideoModelId, StartVideoInput, StartVideoResult, PollResult,
} from './types'

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

const MODEL_NAME: Record<string, string> = {
  'veo-3.1': 'veo-3.1-generate-preview',
  'veo-3.1-fast': 'veo-3.1-fast-generate-preview',
  'veo-3.1-lite': 'veo-3.1-lite-generate-preview',
}

/**
 * Veo image-to-video via de Gemini API.
 * REST-flow (geen SDK, conform de rest van de codebase):
 *   POST  /models/{name}:predictLongRunning   → { name: "operations/..." }
 *   GET   /{operationName}                     → { done, response?, error? }
 *   GET   {videoUri}  (met x-goog-api-key)     → mp4 bytes
 */
export class VeoProvider implements VideoGenProvider {
  readonly id: VideoModelId
  private apiKey: string
  private modelName: string

  constructor(apiKey: string, id: VideoModelId = 'veo-3.1-fast') {
    this.apiKey = apiKey
    this.id = id
    this.modelName = MODEL_NAME[id] ?? MODEL_NAME['veo-3.1-fast']
  }

  async startGeneration(input: StartVideoInput): Promise<StartVideoResult> {
    const url = `${BASE}/models/${this.modelName}:predictLongRunning`

    const parameters: Record<string, unknown> = {
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
    }
    if (input.durationSeconds && input.durationSeconds > 0) {
      parameters.durationSeconds = Math.min(input.durationSeconds, 8)
    }

    // Veo predictLongRunning gebruikt het Vertex/Imagen-formaat (bytesBase64Encoded),
    // NIET het generateContent inlineData-formaat.
    const body = {
      instances: [{
        prompt: input.prompt,
        image: {
          bytesBase64Encoded: input.imageBase64,
          mimeType: input.imageMimeType,
        },
      }],
      parameters,
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      let detail = errText.slice(0, 400)
      try {
        const j = JSON.parse(errText) as { error?: { message?: string; status?: string } }
        if (j?.error?.message) detail = `${j.error.status ?? 'error'}: ${j.error.message}`
      } catch { /* keep raw */ }
      throw new Error(`Veo start mislukt (${res.status}): ${detail}`)
    }

    const data = await res.json() as { name?: string }
    if (!data.name) throw new Error('Veo gaf geen operation name terug')
    return { operationName: data.name }
  }

  async pollOperation(operationName: string): Promise<PollResult> {
    // operationName kan al "operations/..." of "models/.../operations/..." zijn
    const path = operationName.startsWith('http') ? operationName : `${BASE}/${operationName}`

    const res = await fetch(path, {
      headers: { 'x-goog-api-key': this.apiKey },
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Veo poll mislukt (${res.status}): ${errText.slice(0, 300)}`)
    }

    const data = await res.json() as {
      done?: boolean
      error?: { message?: string }
      response?: unknown
    }

    if (!data.done) return { done: false }

    if (data.error) {
      return { done: true, error: data.error.message ?? 'Generatie faalde' }
    }

    // Zoek de video-uri ergens in de response (defensief — shape varieert per model-versie)
    const videoUri = findVideoUri(data.response)
    if (!videoUri) {
      return { done: true, error: 'Generatie klaar maar geen video-URI gevonden in response' }
    }
    return { done: true, videoUri }
  }

  async downloadVideo(videoUri: string): Promise<ArrayBuffer> {
    // Zorg dat we de bytes krijgen (sommige uris vereisen alt=media)
    let url = videoUri
    if (url.includes('generativelanguage.googleapis.com') && !url.includes('alt=media')) {
      url += (url.includes('?') ? '&' : '?') + 'alt=media'
    }
    const res = await fetch(url, {
      headers: { 'x-goog-api-key': this.apiKey },
    })
    if (!res.ok) {
      throw new Error(`Video download mislukt (${res.status})`)
    }
    return res.arrayBuffer()
  }
}

/**
 * Deep-search naar een video-URI in de operation response.
 * Veo varieert: response.generateVideoResponse.generatedSamples[].video.uri,
 * of response.videos[].uri, of generatedVideos[].video.uri. We zoeken naar
 * het eerste object met een 'uri' of 'fileUri' string die naar een video wijst.
 */
function findVideoUri(obj: unknown): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined

  const stack: unknown[] = [obj]
  const uriKeys = ['uri', 'fileUri', 'videoUri', 'downloadUri']

  while (stack.length > 0) {
    const cur = stack.pop()
    if (!cur || typeof cur !== 'object') continue
    const record = cur as Record<string, unknown>

    for (const key of uriKeys) {
      const v = record[key]
      if (typeof v === 'string' && v.length > 0) return v
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') stack.push(value)
    }
  }
  return undefined
}
