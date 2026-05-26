'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Ban, Plus, Trash2, Upload, Search, AlertCircle, CheckCircle2, Loader2, Sparkles, Globe,
} from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { SeaNegativeKeyword, SeaMatchType } from '@ibizz/supabase'
import { Select } from '@ibizz/ui'

const MATCH_TYPES: SeaMatchType[] = ['broad', 'phrase', 'exact']

type Props = {
  brandId: string | null
  brandName?: string
  onCountChanged: (total: number) => void
}

export default function NegativesView({ brandId, brandName, onCountChanged }: Props) {
  const [brandItems, setBrandItems] = useState<SeaNegativeKeyword[]>([])
  const [globalCount, setGlobalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [newMatchType, setNewMatchType] = useState<SeaMatchType>('broad')
  const [newCategory, setNewCategory] = useState('general')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function reload() {
    setLoading(true)
    const [brandRes, globalRes] = await Promise.all([
      brandId
        ? supabase.from('sea_negative_keywords').select('*').eq('brand_id', brandId).order('category').order('keyword').limit(5000)
        : Promise.resolve({ data: [] as SeaNegativeKeyword[] }),
      supabase.from('sea_negative_keywords').select('*', { count: 'exact', head: true }).is('brand_id', null),
    ])
    const brand = (brandRes.data ?? []) as SeaNegativeKeyword[]
    const global = globalRes.count ?? 0
    setBrandItems(brand)
    setGlobalCount(global)
    onCountChanged(brand.length + global)
    setLoading(false)
  }

  useEffect(() => { reload() }, [brandId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return brandItems
    return brandItems.filter(i => i.keyword.toLowerCase().includes(q))
  }, [brandItems, search])

  async function addManual() {
    if (!newKeyword.trim() || !brandId) return
    const { error: err } = await supabase.from('sea_negative_keywords').insert({
      brand_id: brandId,
      keyword: newKeyword.trim().toLowerCase(),
      match_type: newMatchType,
      category: newCategory.trim() || 'general',
    })
    if (!err) {
      const kw = newKeyword
      setNewKeyword('')
      setInfo(`"${kw}" toegevoegd`)
      await reload()
    } else {
      setError(err.message)
    }
  }

  async function deleteOne(id: string) {
    await supabase.from('sea_negative_keywords').delete().eq('id', id)
    setBrandItems(prev => {
      const next = prev.filter(i => i.id !== id)
      onCountChanged(next.length + globalCount)
      return next
    })
  }

  async function uploadFile(file: File) {
    if (!brandId) return
    setUploading(true)
    setError(null)
    setInfo(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mode', 'append')
      fd.append('brandId', brandId)
      const res = await fetch('/api/upload-negatives', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload mislukt')
      setInfo(`Geüpload: ${json.parsed} regels (${json.inserted} nieuw).`)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload mislukt')
    } finally {
      setUploading(false)
    }
  }

  async function generateAI() {
    if (!brandId) return
    setGenerating(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch('/api/generate-negatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'append', brandId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generate mislukt')
      setInfo(`AI gegenereerd: ${json.generated} keywords (${json.inserted} nieuw).`)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI genereren mislukt')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Ban size={16} className="text-[#EB4628]" />
            <h2 className="text-sm font-bold text-gray-800">Negative keywords</h2>
          </div>
          <button
            onClick={generateAI}
            disabled={generating || !brandId}
            title={!brandId ? 'Koppel eerst een brand aan deze brief' : undefined}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: '#EB4628' }}
          >
            {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            AI genereren
          </button>
        </div>

        {/* Counts */}
        <div className="flex items-center gap-5 text-sm mb-5">
          <span className="flex items-center gap-1.5 text-gray-500">
            <Globe size={13} className="text-gray-400" />
            Globaal:
            <strong className="text-gray-700 ml-0.5">{globalCount}</strong>
          </span>
          {brandName && (
            <span className="flex items-center gap-1.5 text-gray-500">
              <Ban size={13} className="text-gray-400" />
              {brandName}:
              <strong className="text-gray-700 ml-0.5">{brandItems.length}</strong>
            </span>
          )}
        </div>

        {/* Manual add row */}
        {brandId ? (
          <div className="flex items-center gap-2 mb-3">
            <Plus size={13} className="text-gray-400 flex-shrink-0" />
            <input
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addManual() }}
              placeholder="Keyword toevoegen…"
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#EB4628]"
            />
            <Select
              value={newMatchType}
              onChange={v => setNewMatchType(v as SeaMatchType)}
              options={MATCH_TYPES.map(m => ({ value: m }))}
              className="w-24"
            />
            <input
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              placeholder="categorie"
              className="text-xs border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#EB4628] w-28"
            />
            <button
              onClick={addManual}
              disabled={!newKeyword.trim()}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90"
              style={{ backgroundColor: '#EB4628' }}
            >
              Toevoegen
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic mb-3">
            Geen brand gekoppeld aan deze brief — keywords worden globaal beheerd.
          </p>
        )}

        {/* Upload + search row */}
        <div className="flex items-center gap-2">
          <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors ${!brandId || uploading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
            Upload bestand
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={!brandId || uploading}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) uploadFile(f)
                e.target.value = ''
              }}
            />
          </label>
          <span className="text-xs text-gray-400">xlsx · xls · csv</span>

          <div className="ml-auto relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Zoeken…"
              className="text-xs border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 outline-none focus:border-[#EB4628] w-40"
            />
          </div>
        </div>

        {info && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
            <CheckCircle2 size={12} /> {info}
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            <AlertCircle size={12} /> {error}
          </div>
        )}
      </section>

      {/* Keyword list */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : brandItems.length === 0 ? (
          <div className="py-12 text-center">
            <Ban size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700 mb-1">
              {brandId
                ? `Nog geen brand-specifieke negatives voor ${brandName ?? 'dit brand'}`
                : 'Geen brand gekoppeld'}
            </p>
            <p className="text-xs text-gray-400">
              {brandId
                ? 'Voeg handmatig toe, upload een bestand, of klik op AI genereren.'
                : 'Koppel een brand aan de brief om keywords toe te voegen.'}
            </p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-2">Keyword</th>
                  <th className="px-2 py-2 w-20">Match</th>
                  <th className="px-2 py-2 w-32">Categorie</th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(item => (
                  <tr key={item.id} className="group hover:bg-gray-50">
                    <td className="px-6 py-1.5 text-gray-800">{item.keyword}</td>
                    <td className="px-2 py-1.5 text-[11px] font-mono text-gray-500">{item.match_type}</td>
                    <td className="px-2 py-1.5">
                      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        onClick={() => deleteOne(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {search && filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Geen resultaten voor &quot;{search}&quot;</p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
