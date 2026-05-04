'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Trash2, Loader2, AlertCircle, ImageOff, Sparkles } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { getStorage } from '@ibizz/storage'
import type { BrandImage, BrandCategory } from '@ibizz/supabase'
import { ensureJpgOrPng, validateImageFile, slugifyFileName } from '@/lib/image'
import ImageDetailModal from './ImageDetailModal'
import { useAuth } from '@/lib/auth'

const BUCKET = 'brand-assets'

type Props = {
  brandId: string
  categoryId: string | null
  images: BrandImage[]
  loading: boolean
  categories?: BrandCategory[]
  categoryMap?: Record<string, string>
  onImagesAdded: (images: BrandImage[]) => void
  onImageDeleted: (id: string) => void
  onImageUpdated?: (id: string, patch: Partial<BrandImage>) => void
}

export default function ImageGrid({
  brandId, categoryId, images, loading, categories, categoryMap,
  onImagesAdded, onImageDeleted, onImageUpdated,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<BrandImage | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [categorizingIds, setCategorizingIds] = useState<Set<string>>(new Set())
  const [detailImage, setDetailImage] = useState<BrandImage | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const storage = getStorage()
  const { user, userName } = useAuth()

  const isAllView = categoryId === null
  const canAutoCategorize = isAllView && categories && categories.length > 0

  async function autoCategorize(image: BrandImage) {
    if (!categories || categories.length === 0) return
    setCategorizingIds(prev => new Set(prev).add(image.id))
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
        const { categoryId: catId } = await res.json()
        if (catId) {
          await supabase.from('brand_images').update({ category_id: catId }).eq('id', image.id)
          onImageUpdated?.(image.id, { category_id: catId })
        }
      }
    } catch (e) {
      console.error('auto-categorize fout:', e)
    } finally {
      setCategorizingIds(prev => {
        const next = new Set(prev)
        next.delete(image.id)
        return next
      })
    }
  }

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!categoryId && !canAutoCategorize) {
      setError('Kies eerst een categorie om te uploaden')
      return
    }
    setError(null)

    // Validate
    const errors: string[] = []
    for (const f of files) {
      const err = validateImageFile(f)
      if (err) errors.push(err)
    }
    if (errors.length > 0) {
      setError(errors.join(' · '))
      if (errors.length === files.length) return
    }
    const validFiles = files.filter(f => !validateImageFile(f))
    if (validFiles.length === 0) return

    setUploading(true)
    setUploadProgress({ done: 0, total: validFiles.length })
    const created: BrandImage[] = []

    for (const file of validFiles) {
      try {
        const safe = await ensureJpgOrPng(file)
        const stamp = Date.now()
        const fname = slugifyFileName(safe.name)
        const folder = categoryId ?? 'unsorted'
        const path = `${brandId}/${folder}/${stamp}-${fname}`

        const { url } = await storage.upload({
          bucket: BUCKET,
          path,
          file: safe,
          contentType: safe.type,
        })

        const { data } = await supabase.from('brand_images').insert({
          brand_id: brandId,
          category_id: categoryId,
          name: safe.name,
          storage_path: path,
          url,
          status: 'approved',
          uploaded_by: user?.id ?? null,
          uploaded_by_name: userName || null,
        }).select().single()

        if (data) {
          const img = data as BrandImage
          created.push(img)
          // Trigger AI categorisatie als geen category_id en mogelijk
          if (!img.category_id && canAutoCategorize) {
            autoCategorize(img)
          }
        }
      } catch (e) {
        console.error('upload fout:', e)
        setError(`Upload mislukt: ${file.name}`)
      }
      setUploadProgress(p => ({ ...p, done: p.done + 1 }))
    }

    if (created.length > 0) onImagesAdded(created)
    setUploading(false)
  }, [brandId, categoryId, onImagesAdded, storage])

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) uploadFiles(files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length > 0) uploadFiles(files)
  }

  async function deleteImage(img: BrandImage) {
    setConfirmDelete(null)
    onImageDeleted(img.id)
    await Promise.all([
      supabase.from('brand_images').delete().eq('id', img.id),
      storage.remove(BUCKET, img.storage_path).catch(() => {}),
    ])
  }

  return (
    <div
      className="p-6 min-h-full"
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">
          {images.length} {images.length === 1 ? 'afbeelding' : 'afbeeldingen'}
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || (isAllView && !canAutoCategorize)}
          title={isAllView && !canAutoCategorize ? 'Kies eerst een categorie om te uploaden' : isAllView ? 'AI bepaalt automatisch de juiste categorie' : undefined}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#EB4628' }}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : isAllView ? <Sparkles size={14} /> : <Upload size={14} />}
          {uploading ? `Uploaden ${uploadProgress.done}/${uploadProgress.total}…` : isAllView ? 'Upload met AI' : 'Upload'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          multiple
          onChange={onFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center bg-[#EB4628]/10 border-4 border-dashed border-[#EB4628]">
          <div className="bg-white rounded-2xl shadow-xl px-6 py-4 flex items-center gap-3">
            <Upload size={20} style={{ color: '#EB4628' }} />
            <span className="text-sm font-semibold text-gray-800">Drop hier om te uploaden</span>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">Laden…</div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <ImageOff size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Nog geen afbeeldingen</p>
          <p className="text-xs text-gray-400">Klik op Upload of sleep bestanden hierheen (JPG, PNG, WebP, SVG)</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map(img => {
            const catName = categoryMap && img.category_id ? categoryMap[img.category_id] : null
            const isCategorizing = categorizingIds.has(img.id)
            return (
              <button
                key={img.id}
                onClick={() => setDetailImage(img)}
                className="group relative aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200 cursor-zoom-in text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                {isCategorizing ? (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-white/90 text-[#EB4628] px-1.5 py-0.5 rounded">
                    <Loader2 size={9} className="animate-spin" />
                    AI…
                  </span>
                ) : catName ? (
                  <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wide bg-white/90 text-gray-700 px-1.5 py-0.5 rounded">
                    {catName}
                  </span>
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); setConfirmDelete(img) }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-white/90 hover:bg-white text-gray-500 hover:text-red-500"
                >
                  <Trash2 size={13} />
                </span>
                <p className="absolute bottom-2 left-2 right-2 text-[11px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity truncate">
                  {img.name}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {/* Detail modal */}
      {detailImage && (
        <ImageDetailModal
          image={detailImage}
          categories={categories ?? []}
          onClose={() => setDetailImage(null)}
          onUpdated={(id, patch) => {
            onImageUpdated?.(id, patch)
            setDetailImage(prev => prev && prev.id === id ? { ...prev, ...patch } : prev)
          }}
          onDeleted={onImageDeleted}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">Afbeelding verwijderen?</h3>
            <p className="text-xs text-gray-400 text-center mb-6">"{confirmDelete.name}" wordt permanent verwijderd.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Annuleren
              </button>
              <button onClick={() => deleteImage(confirmDelete)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600">
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
