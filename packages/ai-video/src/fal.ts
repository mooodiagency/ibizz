import type { PollResult } from './types'

/**
 * Gedeelde helpers voor de fal.ai queue-API (gebruikt door Kling + Seedance).
 *
 *   POST {FAL_QUEUE}/{model}                       → { request_id }
 *   GET  {FAL_QUEUE}/{model}/requests/{id}/status  → { status }
 *   GET  {FAL_QUEUE}/{model}/requests/{id}         → { video: { url } }
 */

const FAL_QUEUE = 'https://queue.fal.run'

export async function falSubmit(
  model: string,
  apiKey: string,
  input: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${FAL_QUEUE}/${model}`, {
    method: 'POST',
    headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const errText = await res.text()
    let detail = errText.slice(0, 400)
    try {
      const j = JSON.parse(errText) as { detail?: unknown; error?: string }
      if (typeof j.detail === 'string') detail = j.detail
      else if (j.error) detail = j.error
      else if (j.detail) detail = JSON.stringify(j.detail).slice(0, 400)
    } catch { /* keep raw */ }
    throw new Error(`fal start mislukt (${res.status}): ${detail}`)
  }

  const data = await res.json() as { request_id?: string }
  if (!data.request_id) throw new Error('fal gaf geen request_id terug')
  return data.request_id
}

export async function falPoll(
  model: string,
  apiKey: string,
  requestId: string,
): Promise<PollResult> {
  const statusUrl = `${FAL_QUEUE}/${model}/requests/${requestId}/status`
  const statusRes = await fetch(statusUrl, { headers: { 'Authorization': `Key ${apiKey}` } })

  if (!statusRes.ok) {
    const t = await statusRes.text()
    throw new Error(`fal status mislukt (${statusRes.status}): ${t.slice(0, 250)}`)
  }

  const statusData = await statusRes.json() as { status?: string }
  const status = statusData.status

  if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
    return { done: false }
  }
  if (status !== 'COMPLETED') {
    return { done: true, error: `fal status: ${status ?? 'onbekend'}` }
  }

  const resultUrl = `${FAL_QUEUE}/${model}/requests/${requestId}`
  const resultRes = await fetch(resultUrl, { headers: { 'Authorization': `Key ${apiKey}` } })
  if (!resultRes.ok) {
    const t = await resultRes.text()
    return { done: true, error: `fal resultaat ophalen mislukt (${resultRes.status}): ${t.slice(0, 250)}` }
  }

  const result = await resultRes.json() as { video?: { url?: string } }
  const videoUrl = result.video?.url
  if (!videoUrl) {
    return { done: true, error: 'fal klaar maar geen video-URL in resultaat' }
  }
  return { done: true, videoUri: videoUrl }
}

export async function falDownload(videoUri: string): Promise<ArrayBuffer> {
  // fal media-URLs zijn publieke CDN-links; geen auth nodig
  const res = await fetch(videoUri)
  if (!res.ok) throw new Error(`fal video download mislukt (${res.status})`)
  return res.arrayBuffer()
}
