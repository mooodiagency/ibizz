'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Plus, Trash2, Globe } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { Select } from '@ibizz/ui'
import type { Brand, SeoBrief } from '@ibizz/supabase'
import { useAuth } from '@/lib/auth'

type Props = {
  onClose: () => void
  onCreated: (brief: SeoBrief) => void
}

const PROJECT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#EB4628', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#64748b']

export default function NewBriefModal({ onClose, onCreated }: Props) {
  const { user, userName } = useAuth()
  const [brands, setBrands] = useState<Brand[]>([])
  const [title, setTitle] = useState('')
  const [brandId, setBrandId] = useState<string>('')
  const [creatingBrand, setCreatingBrand] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [newBrandColor, setNewBrandColor] = useState(PROJECT_COLORS[3])
  const [goal, setGoal] = useState('')
  const [monthlyTarget, setMonthlyTarget] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [primaryMarket, setPrimaryMarket] = useState('Netherlands')
  const [competitors, setCompetitors] = useState<string[]>([''])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => {
      setBrands((data ?? []) as Brand[])
      if (data && data.length > 0) setBrandId(data[0].id)
    })
  }, [])

  async function createNewBrand() {
    if (!newBrandName.trim()) return
    setError(null)
    const { data, error: err } = await supabase
      .from('brands')
      .insert({
        name: newBrandName.trim(),
        color: newBrandColor,
        created_by: user?.id ?? null,
        created_by_name: userName || null,
      })
      .select()
      .single()
    if (err) { setError(`Kon merk niet aanmaken: ${err.message}`); return }
    if (data) {
      const newBrand = data as Brand
      setBrands(prev => [...prev, newBrand].sort((a, b) => a.name.localeCompare(b.name)))
      setBrandId(newBrand.id)
      setCreatingBrand(false)
      setNewBrandName('')
    }
  }

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const cleanedCompetitors = competitors.map(c => c.trim()).filter(Boolean)
      const { data, error: err } = await supabase.from('seo_briefs').insert({
        title: title.trim(),
        brand_id: brandId || null,
        goal: goal.trim() || null,
        monthly_target: monthlyTarget.trim() || null,
        website_url: websiteUrl.trim() || null,
        primary_market: primaryMarket.trim() || 'Netherlands',
        competitors: cleanedCompetitors,
        status: 'draft',
        created_by: user?.id ?? null,
        created_by_name: userName || null,
      }).select().single()
      if (err) throw new Error(err.message)
      if (data) onCreated(data as SeoBrief)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Nieuwe SEO brief</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Titel">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Bijv. Q1 2026 — Content strategie ZZP doelgroep"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]"
            />
          </Field>

          <Field label="Merk">
            {creatingBrand ? (
              <div className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50">
                <input
                  value={newBrandName}
                  onChange={e => setNewBrandName(e.target.value)}
                  placeholder="Merknaam"
                  autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#EB4628] bg-white"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Kleur</span>
                  <div className="flex gap-1">
                    {PROJECT_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewBrandColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${newBrandColor === c ? 'scale-110 border-gray-600' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setCreatingBrand(false); setNewBrandName('') }}
                    className="px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={createNewBrand}
                    disabled={!newBrandName.trim()}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 hover:opacity-90"
                    style={{ backgroundColor: '#EB4628' }}
                  >
                    Merk aanmaken
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Select
                  value={brandId}
                  onChange={setBrandId}
                  placeholder="— Geen merk —"
                  options={[{ value: '', label: '— Geen merk —' }, ...brands.map(b => ({ value: b.id, label: b.name }))]}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => setCreatingBrand(true)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-[#EB4628] hover:bg-orange-50 border border-orange-200"
                >
                  <Plus size={11} />
                  Nieuw
                </button>
              </div>
            )}
          </Field>

          <Field label="Doel">
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="Bijv. Meer kwalitatieve leads via content over ZZP-belasting"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628] resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Maand doel (organic)">
              <input
                value={monthlyTarget}
                onChange={e => setMonthlyTarget(e.target.value)}
                placeholder="Bijv. 1000 bezoekers/maand"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]"
              />
            </Field>
            <Field label="Primaire markt">
              <input
                value={primaryMarket}
                onChange={e => setPrimaryMarket(e.target.value)}
                placeholder="Netherlands"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]"
              />
            </Field>
          </div>

          <Field label="Klant website">
            <div className="relative">
              <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                placeholder="https://klantwebsite.nl"
                className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-[#EB4628]"
              />
            </div>
          </Field>

          <Field label="Concurrenten">
            <div className="space-y-2">
              {competitors.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Globe size={12} className="text-gray-400 flex-shrink-0" />
                  <input
                    value={url}
                    onChange={e => {
                      const next = [...competitors]
                      next[i] = e.target.value
                      setCompetitors(next)
                    }}
                    placeholder="https://concurrent.nl"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#EB4628]"
                  />
                  {competitors.length > 1 && (
                    <button
                      onClick={() => setCompetitors(competitors.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setCompetitors([...competitors, ''])}
                className="flex items-center gap-1 text-xs font-semibold text-[#EB4628] hover:underline"
              >
                <Plus size={11} /> Concurrent toevoegen
              </button>
            </div>
          </Field>

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
            Annuleren
          </button>
          <button
            onClick={save}
            disabled={!title.trim() || saving}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: '#EB4628' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Brief aanmaken
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
