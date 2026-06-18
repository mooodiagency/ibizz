'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Globe } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { Select } from '@ibizz/ui'
import type { Brand, GeoProject } from '@ibizz/supabase'
import { useAuth } from '@/lib/auth'

type Props = {
  onClose: () => void
  onCreated: (project: GeoProject) => void
}

export default function NewProjectModal({ onClose, onCreated }: Props) {
  const { user, userName } = useAuth()
  const [brands, setBrands] = useState<Brand[]>([])
  const [brandId, setBrandId] = useState('')
  const [name, setName] = useState('')
  const [market, setMarket] = useState('Netherlands')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [brandTerms, setBrandTerms] = useState<string[]>([])
  const [competitors, setCompetitors] = useState<string[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => {
      setBrands((data ?? []) as Brand[])
      if (data && data.length > 0) setBrandId(data[0].id)
    })
  }, [])

  // Brand-naam voorvullen als brand-term + project-naam
  useEffect(() => {
    const b = brands.find(x => x.id === brandId)
    if (b) {
      if (brandTerms.length === 0) setBrandTerms([b.name])
      if (!name) setName(`${b.name} — GEO monitor`)
    }
  }, [brandId, brands]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.from('geo_projects').insert({
        brand_id: brandId || null,
        name: name.trim(),
        market: market.trim() || 'Netherlands',
        website_url: websiteUrl.trim() || null,
        brand_terms: brandTerms.map(s => s.trim()).filter(Boolean),
        competitors: competitors.map(s => s.trim()).filter(Boolean),
        topics: topics.map(s => s.trim()).filter(Boolean),
        status: 'active',
        created_by: user?.id ?? null,
        created_by_name: userName || null,
      }).select().single()
      if (err) throw new Error(err.message)
      if (data) onCreated(data as GeoProject)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Nieuw GEO project</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Merk">
            <Select value={brandId} onChange={setBrandId} placeholder="— Geen merk —"
              options={[{ value: '', label: '— Geen merk —' }, ...brands.map(b => ({ value: b.id, label: b.name }))]}
              className="w-full" />
          </Field>

          <Field label="Projectnaam">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Bijv. FRENKY — GEO monitor"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Markt">
              <input value={market} onChange={e => setMarket(e.target.value)} placeholder="Netherlands"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]" />
            </Field>
            <Field label="Website">
              <div className="relative">
                <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://merk.nl"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-[#EB4628]" />
              </div>
            </Field>
          </div>

          <Field label="Merk-termen (waarop we 't merk herkennen in AI-antwoorden)">
            <ChipInput values={brandTerms} onChange={setBrandTerms} placeholder="Merknaam, variant, product…" />
          </Field>

          <Field label="Concurrenten">
            <ChipInput values={competitors} onChange={setCompetitors} placeholder="Concurrent toevoegen + Enter" />
          </Field>

          <Field label="Topics / categorieën">
            <ChipInput values={topics} onChange={setTopics} placeholder="Bijv. reistas, handbagage, weekendtrip" />
            <p className="text-[11px] text-gray-400 mt-1">De AI gebruikt deze topics om realistische vragen te genereren.</p>
          </Field>

          {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Annuleren</button>
          <button onClick={save} disabled={!name.trim() || saving}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: '#EB4628' }}>
            {saving && <Loader2 size={14} className="animate-spin" />} Project aanmaken
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  )
}

function ChipInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setInput('')
  }
  return (
    <div className="border border-gray-200 rounded-xl px-3 py-2 flex flex-wrap gap-2 focus-within:border-[#EB4628]">
      {values.map((v, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-700">
          {v}
          <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><X size={11} /></button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } if (e.key === 'Backspace' && !input && values.length) onChange(values.slice(0, -1)) }}
        onBlur={add} placeholder={values.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[140px] outline-none text-sm bg-transparent" />
    </div>
  )
}
