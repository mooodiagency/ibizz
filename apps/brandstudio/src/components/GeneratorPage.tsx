'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, X, AlertCircle, Download, Image as ImageIcon } from 'lucide-react'
import IbizzMark from './IbizzMark'
import { createClient } from '@ibizz/supabase'
import type { BrandImage, Generation } from '@ibizz/supabase'
import type { ModelId } from '@ibizz/ai-image'
import { useBrand } from '@/lib/brand'
import BrandSwitcher from './BrandSwitcher'
import ReferencePicker from './ReferencePicker'
import GenerationDetailModal from './GenerationDetailModal'
import ModelPicker from './ModelPicker'
import FormatPicker from './FormatPicker'
import type { SelectedFormat } from './FormatPicker'

export default function GeneratorPage() {
  const { current } = useBrand()
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<ModelId>('gemini')
  const [refIds, setRefIds] = useState<string[]>([])
  const [refImages, setRefImages] = useState<BrandImage[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [formatPickerOpen, setFormatPickerOpen] = useState(false)
  const [selectedFormats, setSelectedFormats] = useState<SelectedFormat[]>([{
    id: 'default-square',
    name: 'Vierkant',
    width: 1080,
    height: 1080,
  }])
  const primaryFormat = selectedFormats[0]
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generations, setGenerations] = useState<Generation[]>([])
  const [activeGenId, setActiveGenId] = useState<string | null>(null)
  const supabase = createClient()

  // Load past generations for current brand
  const loadGenerations = useCallback(async () => {
    if (!current) return
    const { data } = await supabase
      .from('generations')
      .select('*')
      .eq('brand_id', current.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setGenerations((data ?? []) as Generation[])
  }, [current?.id])

  useEffect(() => { loadGenerations() }, [loadGenerations])

  // Load reference image details when refIds change
  useEffect(() => {
    if (refIds.length === 0) { setRefImages([]); return }
    supabase.from('brand_images').select('*').in('id', refIds).then(({ data }) => {
      const list = (data ?? []) as BrandImage[]
      // Behoud volgorde van refIds
      const ordered = refIds.map(id => list.find(i => i.id === id)).filter(Boolean) as BrandImage[]
      setRefImages(ordered)
    })
  }, [refIds.join(',')])

  // Reset op brand switch
  useEffect(() => {
    setPrompt('')
    setRefIds([])
    setError(null)
  }, [current?.id])

  async function generate() {
    if (!current || !prompt.trim()) return
    setError(null)
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: current.id,
          prompt: prompt.trim(),
          model,
          referenceImageIds: refIds,
          width: primaryFormat.width,
          height: primaryFormat.height,
        }),
      })
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'Onbekende fout' }))
        throw new Error(msg)
      }
      const generation: Generation = await res.json()
      setGenerations(prev => [generation, ...prev])
      setActiveGenId(generation.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generatie mislukt')
    } finally {
      setGenerating(false)
    }
  }

  if (!current) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <IbizzMark size={20} className="text-[#EB4628]" />
            <h1 className="text-lg font-bold text-gray-900">Generator</h1>
          </div>
          <BrandSwitcher />
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
          Maak eerst een merk aan in de Beeldbank
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <IbizzMark size={20} className="text-[#EB4628]" />
          <h1 className="text-lg font-bold text-gray-900">Generator</h1>
        </div>
        <BrandSwitcher />
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">

          {/* Reference images */}
          <section>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Referentiebeelden ({refImages.length}/3)
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {refImages.map((img, i) => (
                <div key={img.id} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                  <span
                    className="absolute top-1 left-1 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: '#EB4628' }}
                  >
                    {i + 1}
                  </span>
                  <button
                    onClick={() => setRefIds(prev => prev.filter(id => id !== img.id))}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-white/90 text-gray-500 hover:text-red-500"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {refImages.length < 3 && (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-[#EB4628] hover:text-[#EB4628] transition-colors"
                >
                  <Plus size={20} />
                </button>
              )}
            </div>
          </section>

          {/* Prompt */}
          <section>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Beschrijf wat je wil genereren…"
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#EB4628] resize-none"
            />
          </section>

          {/* Format */}
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                Formaten ({selectedFormats.length})
              </label>
              <span className="text-[10px] text-gray-400">
                Eerste = aspect ratio voor AI · alle worden geëxporteerd
              </span>
            </div>
            <div className="border border-gray-200 rounded-xl p-3 bg-white">
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedFormats.map((f, i) => (
                  <div
                    key={f.id}
                    className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                    style={{
                      backgroundColor: i === 0 ? 'rgba(235, 70, 40, 0.08)' : '#f3f4f6',
                      border: i === 0 ? '1px solid rgba(235, 70, 40, 0.2)' : '1px solid transparent',
                    }}
                  >
                    {i === 0 && (
                      <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: '#EB4628' }}>
                        Primair
                      </span>
                    )}
                    <FormatBadge width={f.width} height={f.height} />
                    <span className="text-xs font-semibold text-gray-800">{f.name}</span>
                    <span className="text-[10px] text-gray-400">{f.width}×{f.height}</span>
                    {selectedFormats.length > 1 && (
                      <button
                        onClick={() => setSelectedFormats(prev => prev.filter(x => x.id !== f.id))}
                        className="text-gray-400 hover:text-red-500 ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setFormatPickerOpen(true)}
                className="text-xs font-semibold text-[#EB4628] hover:underline flex items-center gap-1"
              >
                <Plus size={12} />
                Formaten kiezen
              </button>
            </div>
          </section>

          {/* Model + generate */}
          <section className="flex items-stretch gap-3">
            <div className="w-56 flex-shrink-0">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Model
              </label>
              <ModelPicker value={model} onChange={setModel} />
            </div>
            <div className="flex-1 flex flex-col">
              <span className="block text-[11px] mb-1.5 invisible select-none" aria-hidden>spacer</span>
              <button
                onClick={generate}
                disabled={generating || !prompt.trim()}
                className="flex-1 flex items-center justify-center gap-2.5 px-6 rounded-xl text-base font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-40 shadow-md"
                style={{ backgroundColor: '#EB4628' }}
              >
                <IbizzMark size={20} animate={generating} />
                {generating ? 'Genereren…' : 'Genereer'}
              </button>
            </div>
          </section>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl">
              <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {/* Results */}
          <section className="pt-4 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Recente generaties</h2>
            {generations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ImageIcon size={28} className="text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Nog geen generaties</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {generations.map(g => (
                  <GenerationCard
                    key={g.id}
                    generation={g}
                    onClick={() => setActiveGenId(g.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {pickerOpen && (
        <ReferencePicker
          brandId={current.id}
          initialSelected={refIds}
          maxSelect={3}
          onClose={() => setPickerOpen(false)}
          onSave={(ids) => { setRefIds(ids); setPickerOpen(false) }}
        />
      )}

      {formatPickerOpen && (
        <FormatPicker
          initialSelected={selectedFormats}
          multi
          onClose={() => setFormatPickerOpen(false)}
          onSave={(formats) => {
            if (formats.length > 0) setSelectedFormats(formats)
            setFormatPickerOpen(false)
          }}
        />
      )}

      {activeGenId && (() => {
        const active = generations.find(g => g.id === activeGenId)
        if (!active) return null
        return (
          <GenerationDetailModal
            generation={active}
            onClose={() => setActiveGenId(null)}
            onUpdated={(updated) => setGenerations(prev => prev.map(g => g.id === updated.id ? updated : g))}
            onDeleted={(id) => setGenerations(prev => prev.filter(g => g.id !== id))}
            onRegenerated={(newGen) => {
              setGenerations(prev => [newGen, ...prev])
              setActiveGenId(newGen.id)
            }}
          />
        )
      })()}
    </div>
  )
}

function FormatBadge({ width, height }: { width: number; height: number }) {
  const max = Math.max(width, height)
  const w = (width / max) * 18
  const h = (height / max) * 18
  return (
    <span className="inline-flex w-5 h-5 items-end justify-center">
      <span className="bg-gray-300 rounded-sm" style={{ width: `${w}px`, height: `${h}px` }} />
    </span>
  )
}

function GenerationCard({ generation, onClick }: { generation: Generation; onClick: () => void }) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-600',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }

  function download(e: React.MouseEvent) {
    e.stopPropagation()
    if (!generation.result_url) return
    const link = document.createElement('a')
    link.href = generation.result_url
    link.download = `gen-${generation.id.slice(0, 8)}.${generation.result_url.endsWith('.png') ? 'png' : 'jpg'}`
    link.click()
  }

  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl overflow-hidden group cursor-pointer hover:shadow-md transition-shadow text-left"
    >
      {generation.result_url ? (
        <div className="relative aspect-square bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={generation.result_url}
            alt={generation.prompt}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
          <span
            onClick={download}
            role="button"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-white/90 hover:bg-white text-gray-600"
            title="Download"
          >
            <Download size={13} />
          </span>
        </div>
      ) : (
        <div className="aspect-square bg-gray-50 flex items-center justify-center text-gray-300">
          <ImageIcon size={28} />
        </div>
      )}
      <div className="p-3 space-y-1.5">
        <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">{generation.prompt}</p>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${statusColors[generation.status]}`}>
            {generation.status === 'draft' ? 'Concept' : generation.status === 'approved' ? 'Goedgekeurd' : 'Afgekeurd'}
          </span>
          <span className="text-[10px] text-gray-400">{generation.model}</span>
        </div>
      </div>
    </button>
  )
}
