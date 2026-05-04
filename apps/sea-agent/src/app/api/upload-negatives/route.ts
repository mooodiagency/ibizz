import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@ibizz/supabase'
import { cookies } from 'next/headers'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const maxDuration = 120

function getEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key]
  try {
    const content = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
    const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'))
    return match?.[1]?.trim()
  } catch { return undefined }
}

async function getSupabase() {
  const cookieStore = await cookies()
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')!
  const key = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')!
  return createServerClient<Database>(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const mode = (formData.get('mode') as string) ?? 'append' // 'replace' | 'append'
    const brandIdRaw = formData.get('brandId') as string | null
    const scopedBrandId: string | null = brandIdRaw && brandIdRaw.length > 0 ? brandIdRaw : null

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buf, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return NextResponse.json({ error: 'No sheet found' }, { status: 400 })
    const sheet = workbook.Sheets[sheetName]

    type Row = { keyword?: string; match_type?: string; category?: string; notes?: string }
    const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' })

    const cleaned = rows
      .map(r => ({
        brand_id: scopedBrandId,
        keyword: String(r.keyword ?? '').trim().toLowerCase(),
        match_type: (['broad', 'phrase', 'exact'].includes(String(r.match_type)) ? String(r.match_type) : 'broad') as 'broad' | 'phrase' | 'exact',
        category: String(r.category ?? 'general').trim() || 'general',
        notes: r.notes ? String(r.notes).trim() : null,
        created_by: user.id,
      }))
      .filter(r => r.keyword.length > 0)

    if (cleaned.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. Make sure the first column is named "keyword".' }, { status: 400 })
    }

    if (mode === 'replace') {
      const del = supabase.from('sea_negative_keywords').delete()
      if (scopedBrandId) await del.eq('brand_id', scopedBrandId)
      else await del.is('brand_id', null)
    }

    // Dedup binnen scope
    const existingQuery = supabase.from('sea_negative_keywords').select('keyword,match_type')
    const { data: existing } = scopedBrandId
      ? await existingQuery.eq('brand_id', scopedBrandId)
      : await existingQuery.is('brand_id', null)
    const existingKeys = new Set((existing ?? []).map(e => `${e.keyword}|${e.match_type}`))
    const toInsert = cleaned.filter(r => !existingKeys.has(`${r.keyword}|${r.match_type}`))

    let inserted = 0
    const chunkSize = 200
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize)
      const { error } = await supabase.from('sea_negative_keywords').insert(chunk)
      if (!error) inserted += chunk.length
      else console.error('insert error:', error)
    }

    const countQuery = supabase.from('sea_negative_keywords').select('*', { count: 'exact', head: true })
    const { count } = scopedBrandId
      ? await countQuery.eq('brand_id', scopedBrandId)
      : await countQuery.is('brand_id', null)

    return NextResponse.json({
      parsed: cleaned.length,
      inserted,
      total_in_db: count ?? 0,
    })
  } catch (err) {
    console.error('upload-negatives error:', err)
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
