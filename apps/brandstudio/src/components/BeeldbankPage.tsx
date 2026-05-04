'use client'

import { useEffect, useState, useCallback } from 'react'
import { Images, Plus, Pencil, Trash2, Layers } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { BrandCategory, BrandImage } from '@ibizz/supabase'
import { useBrand } from '@/lib/brand'
import BrandSwitcher from './BrandSwitcher'
import ImageGrid from './ImageGrid'

export default function BeeldbankPage() {
  const { current } = useBrand()
  const [categories, setCategories] = useState<BrandCategory[]>([])
  const [images, setImages] = useState<BrandImage[]>([])
  const [activeCatId, setActiveCatId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'all' | 'category'>('category')
  const [loading, setLoading] = useState(false)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(null)
  const supabase = createClient()

  const loadCategories = useCallback(async () => {
    if (!current) return
    const { data } = await supabase
      .from('brand_categories')
      .select('*')
      .eq('brand_id', current.id)
      .order('sort_order')
    setCategories((data ?? []) as BrandCategory[])
  }, [current?.id])

  const loadImages = useCallback(async () => {
    if (!current) return
    setLoading(true)
    const { data } = await supabase
      .from('brand_images')
      .select('*')
      .eq('brand_id', current.id)
      .order('created_at', { ascending: false })
    setImages((data ?? []) as BrandImage[])
    setLoading(false)
  }, [current?.id])

  useEffect(() => {
    if (current) {
      loadCategories()
      loadImages()
    } else {
      setCategories([])
      setImages([])
    }
  }, [current?.id, loadCategories, loadImages])

  useEffect(() => {
    if (categories.length > 0 && !categories.some(c => c.id === activeCatId)) {
      setActiveCatId(categories[0].id)
    }
  }, [categories, activeCatId])

  async function addCategory() {
    if (!current) return
    const { data } = await supabase
      .from('brand_categories')
      .insert({ brand_id: current.id, name: 'Nieuwe categorie', sort_order: categories.length })
      .select()
      .single()
    if (data) {
      setCategories(prev => [...prev, data as BrandCategory])
      setEditingCatId(data.id)
    }
  }

  async function renameCategory(id: string, name: string) {
    await supabase.from('brand_categories').update({ name }).eq('id', id)
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c))
  }

  async function deleteCategory(id: string) {
    await supabase.from('brand_categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
    if (activeCatId === id) setActiveCatId(categories.find(c => c.id !== id)?.id ?? null)
    setConfirmDeleteCatId(null)
  }

  function handleImagesAdded(newImages: BrandImage[]) {
    setImages(prev => [...newImages, ...prev])
  }

  async function handleImageDeleted(id: string) {
    setImages(prev => prev.filter(i => i.id !== id))
  }

  function handleImageUpdated(id: string, patch: Partial<BrandImage>) {
    setImages(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  if (!current) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">Beeldbank</h1>
            <BrandSwitcher />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#EB462815' }}>
            <Images size={28} style={{ color: '#EB4628' }} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Nog geen merk</h1>
          <p className="text-sm text-gray-500 max-w-sm">
            Klik linksboven op "Geen merk" → "+ Nieuw merk" om je eerste merk aan te maken.
          </p>
        </div>
      </div>
    )
  }

  const filteredImages = viewMode === 'all'
    ? images
    : images.filter(i => i.category_id === activeCatId)
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]))
  const confirmCat = categories.find(c => c.id === confirmDeleteCatId)

  return (
    <div className="flex h-full">
      {/* Categories rail */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-2 pt-3 pb-1">
          <button
            onClick={() => setViewMode('all')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              viewMode === 'all' ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Layers size={14} className={viewMode === 'all' ? 'text-[#EB4628]' : 'text-gray-400'} />
            <span className="flex-1 text-left">Alles</span>
            <span className="text-xs text-gray-400">{images.length}</span>
          </button>
        </div>

        <div className="px-4 pt-3 pb-1 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Categorieën</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
          {categories.map(cat => {
            const count = images.filter(i => i.category_id === cat.id).length
            const isActive = viewMode === 'category' && activeCatId === cat.id
            const isEditing = editingCatId === cat.id
            return (
              <div key={cat.id} className="group relative">
                <button
                  onClick={() => !isEditing && (setActiveCatId(cat.id), setViewMode('category'))}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                    isActive ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: isActive ? current.color : 'transparent' }} />
                  {isEditing ? (
                    <input
                      autoFocus
                      defaultValue={cat.name}
                      onBlur={e => { renameCategory(cat.id, e.target.value); setEditingCatId(null) }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') setEditingCatId(null)
                      }}
                      className="flex-1 bg-transparent border-b border-gray-300 outline-none text-sm"
                    />
                  ) : (
                    <span className="flex-1 truncate">{cat.name}</span>
                  )}
                  <span className="text-xs text-gray-400">{count}</span>
                </button>
                {!isEditing && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 bg-gray-50 rounded">
                    <button
                      onClick={() => setEditingCatId(cat.id)}
                      className="p-1 text-gray-400 hover:text-gray-700"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteCatId(cat.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="px-2 py-2 border-t border-gray-100">
          <button
            onClick={addCategory}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-[#EB4628] transition-colors"
          >
            <Plus size={13} />
            Categorie toevoegen
          </button>
        </div>
      </div>

      {/* Main: header + grid */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">Beeldbank</h1>
            <BrandSwitcher />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {viewMode === 'all' ? (
            <ImageGrid
              brandId={current.id}
              categoryId={null}
              images={filteredImages}
              loading={loading}
              categories={categories}
              categoryMap={categoryMap}
              onImagesAdded={handleImagesAdded}
              onImageDeleted={handleImageDeleted}
              onImageUpdated={handleImageUpdated}
            />
          ) : activeCatId ? (
            <ImageGrid
              brandId={current.id}
              categoryId={activeCatId}
              images={filteredImages}
              loading={loading}
              categories={categories}
              categoryMap={categoryMap}
              onImagesAdded={handleImagesAdded}
              onImageDeleted={handleImageDeleted}
              onImageUpdated={handleImageUpdated}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Maak een categorie om te beginnen
            </div>
          )}
        </div>
      </div>

      {confirmCat && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDeleteCatId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">Categorie verwijderen?</h3>
            <p className="text-xs text-gray-400 text-center mb-6">
              "{confirmCat.name}" wordt verwijderd. Afbeeldingen blijven bestaan maar verliezen hun categorie.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteCatId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Annuleren
              </button>
              <button onClick={() => deleteCategory(confirmCat.id)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600">
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
