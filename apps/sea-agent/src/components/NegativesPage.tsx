'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import {
  Loader2, Sparkles, Download, Upload, Search, Plus, Trash2, AlertCircle, CheckCircle2, Ban, Globe, Building2,
} from 'lucide-react'
import Select from './Select'
import * as XLSX from 'xlsx'
import { createClient } from '@ibizz/supabase'
import type { SeaNegativeKeyword, SeaMatchType, Brand } from '@ibizz/supabase'

const MATCH_TYPES: SeaMatchType[] = ['broad', 'phrase', 'exact']

type Scope = 'global' | { brandId: string }

export default function NegativesPage() {
  const [scope, setScope] = useState<Scope>('global')
  const [brands, setBrands] = useState<Brand[]>([])
  const [items, setItems] = useState<SeaNegativeKeyword[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [confirmReplace, setConfirmReplace] = useState<'generate' | 'upload' | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [newKeyword, setNewKeyword] = useState('')
  const [newMatchType, setNewMatchType] = useState<SeaMatchType>('broad')
  const [newCategory, setNewCategory] = useState('general')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const scopedBrandId = scope === 'global' ? null : scope.brandId
  const currentBrand = scopedBrandId ? brands.find(b => b.id === scopedBrandId) : null

  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => {
      setBrands((data ?? []) as Brand[])
    })
  }, [])

  async function reload() {
    setLoading(true)
    const q = supabase.from('sea_negative_keywords').select('*').order('category').order('keyword').limit(5000)
    const { data } = scopedBrandId ? await q.eq('brand_id', scopedBrandId) : await q.is('brand_id', null)
    setItems((data ?? []) as SeaNegativeKeyword[])
    setLoading(false)
  }

  useEffect(() => { reload() }, [scopedBrandId])

  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category))).sort(), [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter(i => {
      if (categoryFilter !== 'all' && i.category !== categoryFilter) return false
      if (q && !i.keyword.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, search, categoryFilter])

  async function generateAI(mode: 'replace' | 'append') {
    setGenerating(true); setError(null); setInfo(null)
    try {
      const res = await fetch('/api/generate-negatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, brandId: scopedBrandId ?? undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generate failed')
      setInfo(`AI generated ${json.generated} keywords (${json.inserted} new). Total in scope: ${json.total_in_db}`)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setGenerating(false); setConfirmReplace(null)
    }
  }

  async function uploadFile(file: File, mode: 'replace' | 'append') {
    setUploading(true); setError(null); setInfo(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mode', mode)
      if (scopedBrandId) fd.append('brandId', scopedBrandId)
      const res = await fetch('/api/upload-negatives', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      setInfo(`Uploaded ${json.parsed} rows (${json.inserted} new). Total in scope: ${json.total_in_db}`)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false); setConfirmReplace(null); setPendingFile(null)
    }
  }

  function downloadXlsx() {
    const data = items.map(i => ({ keyword: i.keyword, match_type: i.match_type, category: i.category, notes: i.notes ?? '' }))
    const ws = XLSX.utils.json_to_sheet(data, { header: ['keyword', 'match_type', 'category', 'notes'] })
    ws['!cols'] = [{ wch: 35 }, { wch: 12 }, { wch: 18 }, { wch: 40 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Negatives')
    const scopeName = currentBrand ? currentBrand.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() : 'global'
    XLSX.writeFile(wb, `ibizz-negatives-${scopeName}-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function downloadTemplate() {
    const data = [{ keyword: 'voorbeeld', match_type: 'broad', category: 'general', notes: 'optioneel' }]
    const ws = XLSX.utils.json_to_sheet(data, { header: ['keyword', 'match_type', 'category', 'notes'] })
    ws['!cols'] = [{ wch: 35 }, { wch: 12 }, { wch: 18 }, { wch: 40 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Negatives')
    XLSX.writeFile(wb, 'ibizz-negatives-template.xlsx')
  }

  async function addManual() {
    if (!newKeyword.trim()) return
    const { error: err } = await supabase.from('sea_negative_keywords').insert({
      brand_id: scopedBrandId,
      keyword: newKeyword.trim().toLowerCase(),
      match_type: newMatchType,
      category: newCategory.trim() || 'general',
    })
    if (!err) { setNewKeyword(''); setInfo(`Added "${newKeyword}"`); await reload() }
    else setError(err.message)
  }

  async function deleteOne(id: string) {
    await supabase.from('sea_negative_keywords').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Ban size={18} style={{ color: '#EB4628' }} />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Negative keywords</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {scope === 'global'
                ? `Globale lijst — toegepast op alle SEA campagnes · ${items.length} totaal`
                : `Brand-specifiek voor ${currentBrand?.name ?? '…'} · ${items.length} extra termen bovenop globaal`}
            </p>
          </div>
        </div>
      </div>

      {/* Scope tabs */}
      <div className="px-8 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setScope('global')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            scope === 'global' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Globe size={12} />
          Global
        </button>
        <span className="w-px h-5 bg-gray-200" />
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1">
          <Building2 size={10} />
          Per brand:
        </span>
        {brands.length === 0 ? (
          <span className="text-xs text-gray-400 italic">No brands yet — create one in Brand Studio</span>
        ) : (
          brands.map(b => {
            const active = scope !== 'global' && scope.brandId === b.id
            return (
              <button
                key={b.id}
                onClick={() => setScope({ brandId: b.id })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: b.color }} />
                {b.name}
              </button>
            )
          })
        )}
      </div>

      {/* Toolbar */}
      <div className="px-8 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
        <button
          onClick={() => items.length === 0 ? generateAI('append') : setConfirmReplace('generate')}
          disabled={generating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#EB4628' }}
        >
          {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          {items.length === 0 ? 'Generate AI defaults' : 'Regenerate AI'}
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
        >
          {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          Upload .xlsx
        </button>
        <button onClick={downloadXlsx} disabled={items.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-40">
          <Download size={11} />
          Download .xlsx
        </button>
        <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-800">
          Download template
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            if (!f) return
            if (items.length === 0) uploadFile(f, 'append')
            else { setPendingFile(f); setConfirmReplace('upload') }
            e.target.value = ''
          }}
        />

        <div className="ml-auto flex items-center gap-2">
          <Select
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[{ value: 'all', label: 'All categories' }, ...categories.map(c => ({ value: c }))]}
            className="w-36"
          />
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search keyword…" className="text-xs border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 outline-none focus:border-[#EB4628] w-44" />
          </div>
        </div>
      </div>

      <div className="px-8 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <Plus size={12} className="text-gray-400" />
        <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addManual() }} placeholder="Add keyword manually" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-[#EB4628] bg-white" />
        <Select
          value={newMatchType}
          onChange={v => setNewMatchType(v as SeaMatchType)}
          options={MATCH_TYPES.map(m => ({ value: m }))}
          className="w-24"
        />
        <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="category" className="text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-[#EB4628] bg-white w-28" />
        <button onClick={addManual} disabled={!newKeyword.trim()} className="text-xs font-semibold text-[#EB4628] hover:underline disabled:opacity-40">
          Add
        </button>
      </div>

      {info && <div className="px-8 py-2 bg-green-50 border-b border-green-100 text-xs text-green-700 flex items-center gap-1.5"><CheckCircle2 size={12} />{info}</div>}
      {error && <div className="px-8 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700 flex items-center gap-1.5"><AlertCircle size={12} />{error}</div>}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16 text-sm text-gray-400"><Loader2 size={20} className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            {items.length === 0 ? (
              <>
                <Ban size={28} className="text-gray-200 mb-3" />
                <p className="text-sm font-semibold text-gray-700 mb-1">
                  {scope === 'global' ? 'No global negatives yet' : `No negatives for ${currentBrand?.name} yet`}
                </p>
                <p className="text-xs text-gray-400 mb-5">
                  {scope === 'global'
                    ? 'Generate AI defaults for a Dutch baseline (~500 terms)'
                    : 'Add brand-specific negatives on top of the global list'}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400">No results for &quot;{search}&quot;</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-gray-100">
              <tr className="text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-8 py-2">Keyword</th>
                <th className="px-2 py-2 w-20">Match</th>
                <th className="px-2 py-2 w-32">Category</th>
                <th className="px-2 py-2 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(item => (
                <tr key={item.id} className="group hover:bg-gray-50">
                  <td className="px-8 py-1.5 text-gray-800">{item.keyword}</td>
                  <td className="px-2 py-1.5 text-[11px] font-mono text-gray-500">{item.match_type}</td>
                  <td className="px-2 py-1.5">
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{item.category}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button onClick={() => deleteOne(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {confirmReplace && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setConfirmReplace(null); setPendingFile(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 mb-2">Replace existing or append?</h3>
            <p className="text-xs text-gray-500 mb-5">
              You have {items.length} keywords in this scope ({scope === 'global' ? 'global' : currentBrand?.name}). Replace = delete in this scope + insert new. Append = keep + add new.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => confirmReplace === 'generate' ? generateAI('append') : pendingFile && uploadFile(pendingFile, 'append')} className="py-2.5 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200">
                Append (safe)
              </button>
              <button onClick={() => confirmReplace === 'generate' ? generateAI('replace') : pendingFile && uploadFile(pendingFile, 'replace')} className="py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600">
                Replace all in this scope ({items.length} → 0 → new)
              </button>
              <button onClick={() => { setConfirmReplace(null); setPendingFile(null) }} className="py-2 text-xs text-gray-500 hover:text-gray-800">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
