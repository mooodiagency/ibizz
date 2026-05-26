'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, Loader2, Sparkles, Calendar, Layers } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { Select } from '@ibizz/ui'
import type { BrandImage, BrandCategory } from '@ibizz/supabase'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

type Props = {
  image: BrandImage
  categories: BrandCategory[]
  onClose: () => void
  onUpdated: (id: string, patch: Partial<BrandImage>) => void
  onDeleted: (id: string) => void
}

export default function ImageDetailModal({ image, categories, onClose, onUpdated, onDeleted }: Props) {
  const [name, setName] = useState(image.name)
  const [categoryId, setCategoryId] = useState<string | null>(image.category_id)
  const [saving, setSaving] = useState(false)
  const [reCategorizing, setReCategorizing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setName(image.name)
    setCategoryId(image.category_id)
  }, [image.id, image.name, image.category_id])

  const dirty = name.trim() !== image.name || categoryId !== image.category_id

  async function save() {
    if (!dirty || !name.trim()) return
    setSaving(true)
    const patch: { name?: string; category_id?: string | null } = {}
    if (name.trim() !== image.name) patch.name = name.trim()
    if (categoryId !== image.category_id) patch.category_id = categoryId
    await supabase.from('brand_images').update(patch).eq('id', image.id)
    onUpdated(image.id, patch as Partial<BrandImage>)
    setSaving(false)
  }

  async function reCategorize() {
    if (categories.length === 0) return
    setReCategorizing(true)
    try {
      const res = await fetch('/api/categorize-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: image.url,
          categories: categories.map(c => ({ id: c.id, name: c.name })),
        }),
      })
      if (res.ok) {
        const { categoryId: newId } = await res.json()
        if (newId) setCategoryId(newId)
      }
    } finally {
      setReCategorizing(false)
    }
  }

  async function deleteImage() {
    onDeleted(image.id)
    setConfirmDelete(false)
    onClose()
    await supabase.from('brand_images').delete().eq('id', image.id)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex"
        onClick={e => e.stopPropagation()}
      >
        {/* Image preview */}
        <div className="flex-1 bg-gray-900 flex items-center justify-center p-6 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.name}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
        </div>

        {/* Side panel */}
        <div className="w-80 flex-shrink-0 flex flex-col border-l border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Details</span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Naam */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Naam</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]"
              />
            </div>

            {/* Categorie */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <Layers size={11} />
                  Categorie
                </label>
                <button
                  onClick={reCategorize}
                  disabled={reCategorizing || categories.length === 0}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#EB4628] hover:underline disabled:opacity-50"
                  title="Laat AI opnieuw categoriseren"
                >
                  {reCategorizing
                    ? <Loader2 size={10} className="animate-spin" />
                    : <Sparkles size={10} />}
                  AI
                </button>
              </div>
              <Select
                value={categoryId ?? ''}
                onChange={v => setCategoryId(v || null)}
                placeholder="— Geen categorie —"
                options={[
                  { value: '', label: '— Geen categorie —' },
                  ...categories.map(c => ({ value: c.id, label: c.name })),
                ]}
                className="w-full"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</label>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${
                  image.status === 'approved' ? 'bg-green-100 text-green-700'
                  : image.status === 'pending' ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
                }`}
              >
                {image.status === 'approved' ? 'Goedgekeurd' : image.status === 'pending' ? 'In behandeling' : 'Afgekeurd'}
              </span>
            </div>

            {/* Meta */}
            <div className="text-xs text-gray-400 space-y-1 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                <Calendar size={11} />
                Toegevoegd: {format(new Date(image.created_at), "d MMM yyyy 'om' HH:mm", { locale: nl })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
              Verwijderen
            </button>
            <button
              onClick={save}
              disabled={!dirty || saving || !name.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#EB4628' }}
            >
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">Afbeelding verwijderen?</h3>
            <p className="text-xs text-gray-400 text-center mb-6">"{image.name}" wordt permanent verwijderd.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Annuleren
              </button>
              <button onClick={deleteImage} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600">
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
