'use client'

import { useEffect, useState } from 'react'
import { X, Check, Layers } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { BrandImage, BrandCategory } from '@ibizz/supabase'

type Props = {
  brandId: string
  initialSelected: string[]
  maxSelect?: number
  onClose: () => void
  onSave: (ids: string[]) => void
}

export default function ReferencePicker({ brandId, initialSelected, maxSelect = 3, onClose, onSave }: Props) {
  const [images, setImages] = useState<BrandImage[]>([])
  const [categories, setCategories] = useState<BrandCategory[]>([])
  const [activeCatId, setActiveCatId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>(initialSelected)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from('brand_images').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }),
      supabase.from('brand_categories').select('*').eq('brand_id', brandId).order('sort_order'),
    ]).then(([imgRes, catRes]) => {
      setImages((imgRes.data ?? []) as BrandImage[])
      setCategories((catRes.data ?? []) as BrandCategory[])
      setLoading(false)
    })
  }, [brandId])

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= maxSelect) return prev
      return [...prev, id]
    })
  }

  const filtered = activeCatId === null ? images : images.filter(i => i.category_id === activeCatId)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Kies referentiebeelden</h2>
            <p className="text-xs text-gray-400 mt-0.5">Max {maxSelect} afbeeldingen — {selected.length} geselecteerd</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Category tabs */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveCatId(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
              activeCatId === null ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Layers size={12} />
            Alles ({images.length})
          </button>
          {categories.map(cat => {
            const count = images.filter(i => i.category_id === cat.id).length
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCatId(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                  activeCatId === cat.id ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {cat.name} ({count})
              </button>
            )
          })}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12 text-sm text-gray-400">Laden…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="text-sm text-gray-400">Nog geen afbeeldingen in deze categorie</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map(img => {
                const isSelected = selected.includes(img.id)
                const order = isSelected ? selected.indexOf(img.id) + 1 : null
                return (
                  <button
                    key={img.id}
                    onClick={() => toggle(img.id)}
                    className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 transition-all"
                    style={{ borderColor: isSelected ? '#EB4628' : 'transparent' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#EB4628]/15 flex items-center justify-center">
                        <span
                          className="w-7 h-7 rounded-full text-white font-bold text-sm flex items-center justify-center shadow-lg"
                          style={{ backgroundColor: '#EB4628' }}
                        >
                          {order}
                        </span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setSelected([])}
            className="text-sm text-gray-500 hover:text-gray-700"
            disabled={selected.length === 0}
          >
            Selectie wissen
          </button>
          <button
            onClick={() => onSave(selected)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#EB4628' }}
          >
            <Check size={14} />
            Klaar ({selected.length})
          </button>
        </div>
      </div>
    </div>
  )
}
