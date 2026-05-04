import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export const runtime = 'nodejs'
export const maxDuration = 300

function getEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key]
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'))
    return match?.[1]?.trim()
  } catch {
    return undefined
  }
}

const MODEL = 'gemini-2.5-flash'
const MAX_FILE_SIZE = 25 * 1024 * 1024     // 25MB per file
const INLINE_LIMIT  = 19 * 1024 * 1024     // <19MB → inline; >=19MB → Files API

const ACCEPTED_AUDIO = [
  'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/flac', 'audio/webm',
]
const ACCEPTED_VIDEO = [
  'video/mp4', 'video/mpeg', 'video/mov', 'video/quicktime',
  'video/webm', 'video/x-msvideo', 'video/avi', 'video/x-flv', 'video/3gpp',
]

function normalizeMime(file: File): string {
  if (file.type) return file.type
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  const map: Record<string, string> = {
    mp3: 'audio/mp3', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
    mp4: 'video/mp4', mov: 'video/mov', avi: 'video/x-msvideo', webm: 'video/webm',
  }
  return map[ext] ?? 'application/octet-stream'
}

async function uploadToFilesApi(
  bytes: ArrayBuffer,
  mime: string,
  displayName: string,
  apiKey: string
): Promise<string> {
  const size = bytes.byteLength

  // Step 1: initiate resumable upload
  const initRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': size.toString(),
        'X-Goog-Upload-Header-Content-Type': mime,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    }
  )
  if (!initRes.ok) {
    throw new Error(`Files API init mislukt (${initRes.status}): ${await initRes.text()}`)
  }
  const uploadUrl = initRes.headers.get('X-Goog-Upload-URL')
  if (!uploadUrl) throw new Error('Geen upload URL ontvangen')

  // Step 2: upload bytes (finalize)
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': size.toString(),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: bytes,
  })
  if (!uploadRes.ok) {
    throw new Error(`Files API upload mislukt (${uploadRes.status})`)
  }
  const uploadJson = await uploadRes.json()
  const fileName: string = uploadJson.file.name  // e.g. "files/abc123"
  let fileUri: string = uploadJson.file.uri
  let state: string = uploadJson.file.state

  // Step 3: wachten tot ACTIVE
  const start = Date.now()
  while (state === 'PROCESSING') {
    if (Date.now() - start > 120_000) throw new Error('Files API processing timeout')
    await new Promise(r => setTimeout(r, 2000))
    const check = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`)
    if (!check.ok) throw new Error(`Files API status check mislukt`)
    const checkJson = await check.json()
    state = checkJson.state
    fileUri = checkJson.uri ?? fileUri
  }
  if (state !== 'ACTIVE') {
    throw new Error(`Files API state: ${state}`)
  }

  return fileUri
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Bestand te groot (${Math.round(file.size / 1024 / 1024)}MB). Max ${MAX_FILE_SIZE / 1024 / 1024}MB per bestand.` },
        { status: 400 }
      )
    }

    const mime = normalizeMime(file)
    const isAudio = ACCEPTED_AUDIO.includes(mime)
    const isVideo = ACCEPTED_VIDEO.includes(mime)
    if (!isAudio && !isVideo) {
      return NextResponse.json(
        { error: `Niet ondersteund formaat: ${mime}. Gebruik mp3, m4a, wav, mp4, mov, avi, webm.` },
        { status: 400 }
      )
    }

    const apiKey = getEnv('GEMINI_API_KEY')
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY ontbreekt' }, { status: 500 })
    }

    const arrayBuf = await file.arrayBuffer()
    const transcribePrompt = `Transcribeer dit ${isVideo ? 'video' : 'audio'} bestand letterlijk in het Nederlands. Geef ALLEEN de transcriptie terug, zonder uitleg of opmaak. Doorlopende tekst, sprekers niet apart aanduiden.`

    // Bouw de parts: kies tussen inline_data en file_data
    let parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string }; file_data?: { mime_type: string; file_uri: string } }>

    if (file.size <= INLINE_LIMIT) {
      const base64 = Buffer.from(arrayBuf).toString('base64')
      parts = [
        { text: transcribePrompt },
        { inline_data: { mime_type: mime, data: base64 } },
      ]
    } else {
      const fileUri = await uploadToFilesApi(arrayBuf, mime, file.name, apiKey)
      parts = [
        { text: transcribePrompt },
        { file_data: { mime_type: mime, file_uri: fileUri } },
      ]
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0, maxOutputTokens: 8000 },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Gemini transcribe fout:', res.status, errText)
      return NextResponse.json({ error: `Transcribe fout (${res.status})` }, { status: 500 })
    }

    const data = await res.json()
    const transcript: string = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    if (!transcript) {
      return NextResponse.json({ error: 'Geen transcriptie ontvangen' }, { status: 500 })
    }

    return NextResponse.json({ transcript, fileName: file.name })
  } catch (err) {
    console.error('transcribe fout:', err)
    const msg = err instanceof Error ? err.message : 'Verwerking mislukt'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
