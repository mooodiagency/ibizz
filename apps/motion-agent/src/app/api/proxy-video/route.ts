import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Same-origin video proxy. Nodig zodat we de (Supabase-gehoste) video op een
 * <canvas> kunnen tekenen zonder dat 'ie "tainted" raakt (cross-origin) — wat
 * canvas.captureStream() / toDataURL() zou blokkeren bij de tekst-inbrand-export.
 *
 * Alleen Supabase-storage URLs worden geproxied (geen open proxy / SSRF).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const target = searchParams.get('url')
    if (!target) return NextResponse.json({ error: 'url verplicht' }, { status: 400 })

    let host: string
    try {
      host = new URL(target).hostname
    } catch {
      return NextResponse.json({ error: 'ongeldige url' }, { status: 400 })
    }
    if (!host.endsWith('.supabase.co')) {
      return NextResponse.json({ error: 'alleen supabase-storage URLs toegestaan' }, { status: 403 })
    }

    const range = req.headers.get('range')
    const upstream = await fetch(target, {
      headers: range ? { range } : undefined,
    })
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 })
    }

    const headers = new Headers()
    const ct = upstream.headers.get('content-type') ?? 'video/mp4'
    headers.set('Content-Type', ct)
    const cl = upstream.headers.get('content-length')
    if (cl) headers.set('Content-Length', cl)
    const cr = upstream.headers.get('content-range')
    if (cr) headers.set('Content-Range', cr)
    headers.set('Accept-Ranges', 'bytes')
    headers.set('Cache-Control', 'no-store')

    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
