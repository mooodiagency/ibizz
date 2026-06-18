'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Film, Download, Trash2, AlertCircle, RefreshCw, Clock, Type } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { Select } from '@ibizz/ui'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import type { Brand, MotionGeneration } from '@ibizz/supabase'
import VideoTextEditor from './VideoTextEditor'

const STATUS_PILL: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700',
  succeeded: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  running: 'Bezig',
  succeeded: 'Klaar',
  failed: 'Mislukt',
}

export default function GalleryPage() {
  const [items, setItems] = useState<MotionGeneration[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [brandFilter, setBrandFilter] = useState('all')
  const [editing, setEditing] = useState<MotionGeneration | null>(null)
  const supabase = createClient()

  const load = useCallback(() => {
    Promise.all([
      supabase.from('motion_generations').select('*').order('created_at', { ascending: false }),
      supabase.from('brands').select('*').order('name'),
    ]).then(([gRes, bRes]) => {
      setItems((gRes.data ?? []) as MotionGeneration[])
      setBrands((bRes.data ?? []) as Brand[])
      setLoading(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  async function repoll(id: string) {
    const res = await fetch(`/api/poll-video?id=${id}`)
    const data = await res.json()
    if (res.ok && data.generation) {
      setItems(prev => prev.map(i => i.id === id ? data.generation as MotionGeneration : i))
    }
  }

  async function remove(item: MotionGeneration) {
    setItems(prev => prev.filter(i => i.id !== item.id))
    // storage opruimen (best-effort)
    const paths = [item.source_image_path, item.result_storage_path].filter(Boolean) as string[]
    if (paths.length) await supabase.storage.from('motion-generations').remove(paths)
    await supabase.from('motion_generations').delete().eq('id', item.id)
  }

  function brandName(id: string | null): string | null {
    if (!id) return null
    return brands.find(b => b.id === id)?.name ?? null
  }

  const filtered = items.filter(i => {
    if (brandFilter === 'all') return true
    if (brandFilter === 'none') return !i.brand_id
    return i.brand_id === brandFilter
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Galerij</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} {items.length === 1 ? 'generatie' : 'generaties'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={brandFilter}
            onChange={setBrandFilter}
            options={[
              { value: 'all', label: 'Alle merken' },
              { value: 'none', label: 'Zonder merk' },
              ...brands.map(b => ({ value: b.id, label: b.name })),
            ]}
            className="w-44"
            compact
          />
          <button
            onClick={load}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
            title="Verversen"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Film size={26} className="text-gray-300" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">Nog geen video&apos;s</p>
            <p className="text-sm text-gray-400">Maak je eerste video in de Generator-tab</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => (
              <article key={item.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {/* Video / status */}
                <div className="relative bg-black aspect-video flex items-center justify-center">
                  {item.status === 'succeeded' && item.result_url ? (
                    <video src={item.result_url} controls loop playsInline className="w-full h-full object-contain" />
                  ) : item.status === 'running' ? (
                    <div className="text-center text-white/70">
                      <Clock size={22} className="mx-auto mb-2 animate-pulse" />
                      <p className="text-xs">Bezig met genereren…</p>
                      <button
                        onClick={() => repoll(item.id)}
                        className="mt-2 text-[11px] underline text-white/80 hover:text-white"
                      >
                        Status verversen
                      </button>
                    </div>
                  ) : (
                    <div className="text-center text-red-300 px-4">
                      <AlertCircle size={22} className="mx-auto mb-2" />
                      <p className="text-xs line-clamp-3">{item.error ?? 'Mislukt'}</p>
                    </div>
                  )}
                  {/* source thumb */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.source_image_url}
                    alt="bron"
                    className="absolute bottom-2 left-2 w-10 h-10 object-cover rounded-md border-2 border-white/80 shadow"
                    title="Bron-foto"
                  />
                </div>

                {/* Meta */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_PILL[item.status]}`}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    <span className="text-[10px] text-gray-400">{item.aspect_ratio} · {item.resolution} · {item.duration_sec ?? '?'}s</span>
                    {brandName(item.brand_id) && (
                      <span className="text-[10px] text-gray-500 ml-auto truncate">{brandName(item.brand_id)}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">{item.prompt}</p>
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                    <span className="text-[10px] text-gray-400">{format(new Date(item.created_at), 'd MMM HH:mm', { locale: nl })}</span>
                    <div className="flex items-center gap-1">
                      {item.status === 'succeeded' && item.result_url && (
                        <>
                          <button
                            onClick={() => setEditing(item)}
                            className="p-1 rounded text-gray-400 hover:text-[#EB4628]"
                            title="Tekst toevoegen"
                          >
                            <Type size={13} />
                          </button>
                          <a
                            href={item.result_url}
                            download
                            className="p-1 rounded text-gray-400 hover:text-[#EB4628]"
                            title="Download"
                          >
                            <Download size={13} />
                          </a>
                        </>
                      )}
                      <button
                        onClick={() => remove(item)}
                        className="p-1 rounded text-gray-300 hover:text-red-500"
                        title="Verwijderen"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {editing && editing.result_url && (
        <VideoTextEditor
          videoUrl={editing.result_url}
          aspectRatio={editing.aspect_ratio}
          durationSec={editing.duration_sec}
          generationId={editing.id}
          initialLayers={editing.text_overlays}
          onClose={() => setEditing(null)}
          onSaved={layers => {
            setItems(prev => prev.map(i => i.id === editing.id ? { ...i, text_overlays: layers } : i))
            setEditing(e => e ? { ...e, text_overlays: layers } : e)
          }}
        />
      )}
    </div>
  )
}
