'use client'

import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { Brand, SeaBrief } from '@ibizz/supabase'
import { useAuth } from '@/lib/auth'

type Props = {
  onClose: () => void
  onCreated: (brief: SeaBrief) => void
}

export default function NewBriefModal({ onClose, onCreated }: Props) {
  const { user, userName } = useAuth()
  const [brands, setBrands] = useState<Brand[]>([])
  const [title, setTitle] = useState('')
  const [brandId, setBrandId] = useState<string>('')
  const [goal, setGoal] = useState('')
  const [budget, setBudget] = useState('')
  const [cpa, setCpa] = useState('')
  const [audience, setAudience] = useState('')
  const [icp, setIcp] = useState('')
  const [location, setLocation] = useState('Netherlands')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => {
      setBrands((data ?? []) as Brand[])
      if (data && data.length > 0) setBrandId(data[0].id)
    })
  }, [])

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const { data, error: err } = await supabase.from('sea_briefs').insert({
        title: title.trim(),
        brand_id: brandId || null,
        goal: goal.trim() || null,
        monthly_budget: budget ? parseInt(budget, 10) : null,
        target_cpa: cpa ? parseInt(cpa, 10) : null,
        target_audience: audience.trim() || null,
        icp: icp.trim() || null,
        location: location.trim() || 'Netherlands',
        status: 'draft',
        created_by: user?.id ?? null,
        created_by_name: userName || null,
      }).select().single()
      if (err) throw new Error(err.message)
      if (data) onCreated(data as SeaBrief)
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
          <h2 className="text-base font-bold text-gray-900">New Brief</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Title">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Q1 2026 — Lead generation"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]"
            />
          </Field>

          <Field label="Brand">
            <select
              value={brandId}
              onChange={e => setBrandId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628] bg-white"
            >
              <option value="">— No brand —</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {brands.length === 0 && (
              <p className="text-[11px] text-gray-400 mt-1">No brands yet — create one in Brand Studio first.</p>
            )}
          </Field>

          <Field label="Goal">
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. Sell 10 pools per month → need 40 leads"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628] resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly budget (€)">
              <input
                type="number"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="3000"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]"
              />
            </Field>
            <Field label="Target CPA (€)">
              <input
                type="number"
                value={cpa}
                onChange={e => setCpa(e.target.value)}
                placeholder="75"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]"
              />
            </Field>
          </div>

          <Field label="Location">
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Netherlands"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]"
            />
          </Field>

          <Field label="Target audience">
            <textarea
              value={audience}
              onChange={e => setAudience(e.target.value)}
              placeholder="Homeowners 30–60, sustainability-minded, high income"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628] resize-none"
            />
          </Field>

          <Field label="Ideal Customer Profile (ICP)">
            <textarea
              value={icp}
              onChange={e => setIcp(e.target.value)}
              placeholder="Detailed profile: demographics, pain points, motivations…"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628] resize-none"
            />
          </Field>

          {error && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!title.trim() || saving}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: '#EB4628' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create brief
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
