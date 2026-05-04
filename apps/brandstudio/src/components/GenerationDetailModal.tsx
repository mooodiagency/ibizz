'use client'

import { useState, useEffect } from 'react'
import {
  X, Check, XCircle, Pencil, Loader2, Download, AlertCircle, RotateCcw, Layers,
} from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { Generation, BrandImage } from '@ibizz/supabase'
import IbizzMark from './IbizzMark'
import FormatPicker from './FormatPicker'
import type { SelectedFormat } from './FormatPicker'
import { downloadResized } from '@/lib/resize'

type Props = {
  generation: Generation
  onClose: () => void
  onUpdated: (g: Generation) => void
  onDeleted: (id: string) => void
  onRegenerated: (g: Generation) => void
}

export default function GenerationDetailModal({ generation, onClose, onUpdated, onDeleted, onRegenerated }: Props) {
  const [g, setG] = useState<Generation>(generation)
  const [refImages, setRefImages] = useState<BrandImage[]>([])
  const [editing, setEditing] = useState(false)
  const [editedPrompt, setEditedPrompt] = useState(generation.prompt)
  const [regenerating, setRegenerating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportPickerOpen, setExportPickerOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setG(generation)
    setEditedPrompt(generation.prompt)
    setEditing(false)
    setError(null)
  }, [generation.id])

  // Load reference images
  useEffect(() => {
    if (g.reference_image_ids.length === 0) { setRefImages([]); return }
    supabase.from('brand_images').select('*').in('id', g.reference_image_ids).then(({ data }) => {
      const list = (data ?? []) as BrandImage[]
      const ordered = g.reference_image_ids.map(id => list.find(i => i.id === id)).filter(Boolean) as BrandImage[]
      setRefImages(ordered)
    })
  }, [g.reference_image_ids.join(',')])

  async function setStatus(status: Generation['status']) {
    setUpdating(true)
    const { data, error: updErr } = await supabase
      .from('generations')
      .update({ status })
      .eq('id', g.id)
      .select()
      .single()
    setUpdating(false)
    if (updErr || !data) {
      setError(updErr?.message ?? 'Update mislukt')
      return
    }
    const next = data as Generation
    setG(next)
    onUpdated(next)
    if (status === 'approved') onClose()
  }

  async function regenerate() {
    if (!editedPrompt.trim()) return
    setRegenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: g.brand_id,
          prompt: editedPrompt.trim(),
          model: g.model,
          referenceImageIds: g.reference_image_ids,
        }),
      })
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'Onbekende fout' }))
        throw new Error(msg)
      }
      const newGen: Generation = await res.json()
      onRegenerated(newGen)
      setG(newGen)
      setEditedPrompt(newGen.prompt)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regenereren mislukt')
    } finally {
      setRegenerating(false)
    }
  }

  function download() {
    if (!g.result_url) return
    const ext = g.result_url.includes('.png') ? 'png' : 'jpg'
    const link = document.createElement('a')
    link.href = g.result_url
    link.download = `gen-${g.id.slice(0, 8)}.${ext}`
    link.click()
  }

  async function exportFormats(formats: SelectedFormat[]) {
    if (!g.result_url || formats.length === 0) return
    setExportPickerOpen(false)
    setExporting(true)
    try {
      for (const f of formats) {
        const safeName = f.name.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
        const filename = `gen-${g.id.slice(0, 8)}-${safeName}-${f.width}x${f.height}.jpg`
        await downloadResized(g.result_url, f.width, f.height, filename, 'jpeg')
        await new Promise(r => setTimeout(r, 250)) // browsers struikelen anders over rapid downloads
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export mislukt')
    } finally {
      setExporting(false)
    }
  }

  async function deleteGen() {
    onDeleted(g.id)
    onClose()
    await supabase.from('generations').delete().eq('id', g.id)
    if (g.result_storage_path) {
      await supabase.storage.from('brand-generations').remove([g.result_storage_path]).catch(() => {})
    }
  }

  const statusColors = {
    draft: 'bg-gray-100 text-gray-600 border-gray-200',
    approved: 'bg-green-100 text-green-700 border-green-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  }
  const statusLabels = {
    draft: 'Concept',
    approved: 'Goedgekeurd',
    rejected: 'Afgekeurd',
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex"
        onClick={e => e.stopPropagation()}
      >
        {/* Image preview */}
        <div className="flex-1 bg-gray-900 flex items-center justify-center p-6 min-w-0 relative">
          {regenerating ? (
            <div className="flex flex-col items-center gap-3 text-white/80">
              <IbizzMark size={48} animate className="text-[#EB4628]" />
              <span className="text-sm">Genereren…</span>
            </div>
          ) : g.result_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={g.result_url}
              alt={g.prompt}
              className="max-w-full max-h-[82vh] object-contain rounded-lg"
            />
          ) : (
            <div className="text-white/40 text-sm">Geen output</div>
          )}
        </div>

        {/* Side panel */}
        <div className="w-96 flex-shrink-0 flex flex-col border-l border-gray-200">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded-full border ${statusColors[g.status]}`}>
                {statusLabels[g.status]}
              </span>
              <span className="text-xs text-gray-400">{g.model}</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* References */}
            {refImages.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Referenties</p>
                <div className="flex gap-2 flex-wrap">
                  {refImages.map((ref, i) => (
                    <div key={ref.id} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ref.url} alt={ref.name} className="w-full h-full object-cover" />
                      <span
                        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                        style={{ backgroundColor: '#EB4628' }}
                      >
                        {i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Prompt</p>
                {!editing && g.status !== 'approved' && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#EB4628] hover:underline"
                  >
                    <Pencil size={10} />
                    Aanpassen
                  </button>
                )}
              </div>
              {editing ? (
                <div className="space-y-2">
                  <textarea
                    value={editedPrompt}
                    onChange={e => setEditedPrompt(e.target.value)}
                    rows={5}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628] resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditedPrompt(g.prompt); setEditing(false) }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200"
                    >
                      Annuleren
                    </button>
                    <button
                      onClick={regenerate}
                      disabled={regenerating || !editedPrompt.trim() || editedPrompt.trim() === g.prompt}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                      style={{ backgroundColor: '#EB4628' }}
                    >
                      <IbizzMark size={13} animate={regenerating} />
                      Opnieuw genereren
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-3">
                  {g.prompt}
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-xl">
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}

            {g.user_name && (
              <p className="text-xs text-gray-400 pt-3 border-t border-gray-100">
                Gegenereerd door <span className="font-semibold text-gray-600">{g.user_name}</span>
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 space-y-2">
            {g.status === 'draft' ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setStatus('rejected')}
                  disabled={updating}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <XCircle size={14} />
                  Afkeuren
                </button>
                <button
                  onClick={() => setStatus('approved')}
                  disabled={updating}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: '#22c55e' }}
                >
                  <Check size={14} />
                  Goedkeuren
                </button>
              </div>
            ) : (
              <button
                onClick={() => setStatus('draft')}
                disabled={updating}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                <RotateCcw size={12} />
                Terugzetten naar concept
              </button>
            )}
            <div className="flex gap-2">
              <button
                onClick={download}
                disabled={!g.result_url}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <Download size={12} />
                Origineel
              </button>
              <button
                onClick={() => setExportPickerOpen(true)}
                disabled={!g.result_url || exporting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#EB4628' }}
              >
                {exporting ? <Loader2 size={12} className="animate-spin" /> : <Layers size={12} />}
                {exporting ? 'Exporteren…' : 'Formaten'}
              </button>
              <button
                onClick={deleteGen}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      </div>

      {exportPickerOpen && (
        <FormatPicker
          initialSelected={[]}
          multi
          onClose={() => setExportPickerOpen(false)}
          onSave={exportFormats}
        />
      )}
    </div>
  )
}
