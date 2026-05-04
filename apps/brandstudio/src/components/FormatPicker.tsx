'use client'

import { useState, useMemo } from 'react'
import { X, Check, Plus } from 'lucide-react'
import { FORMATS, aspectLabel } from '@ibizz/ai-image'
import type { FormatDef, FormatGroup } from '@ibizz/ai-image'

export type SelectedFormat = {
  id: string
  name: string
  width: number
  height: number
}

type Props = {
  initialSelected: SelectedFormat[]
  multi?: boolean
  onClose: () => void
  onSave: (formats: SelectedFormat[]) => void
}

const GROUPS: FormatGroup[] = [
  'Social — Promotioneel',
  'Social — Organisch',
  'Google Ads',
  'DPG Media',
  'Funda',
]

export default function FormatPicker({ initialSelected, multi = true, onClose, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<FormatGroup | 'custom'>('Social — Promotioneel')
  const [selected, setSelected] = useState<SelectedFormat[]>(initialSelected)
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const [customName, setCustomName] = useState('')

  const grouped = useMemo(() => {
    const m = new Map<FormatGroup, FormatDef[]>()
    for (const f of FORMATS) {
      if (!m.has(f.group)) m.set(f.group, [])
      m.get(f.group)!.push(f)
    }
    return m
  }, [])

  function toggle(f: FormatDef) {
    setSelected(prev => {
      const exists = prev.find(s => s.id === f.id)
      if (exists) return prev.filter(s => s.id !== f.id)
      const next = { id: f.id, name: `${f.platform} — ${f.name}`, width: f.width, height: f.height }
      return multi ? [...prev, next] : [next]
    })
  }

  function addCustom() {
    const w = parseInt(customW, 10)
    const h = parseInt(customH, 10)
    if (!w || !h || w < 50 || h < 50 || w > 8192 || h > 8192) return
    const id = `custom-${w}x${h}-${Date.now()}`
    const next: SelectedFormat = {
      id,
      name: customName.trim() || `Custom ${w}×${h}`,
      width: w,
      height: h,
    }
    setSelected(prev => multi ? [...prev, next] : [next])
    setCustomW('')
    setCustomH('')
    setCustomName('')
  }

  // Group selected by platform for display
  const platformsByGroup = useMemo(() => {
    if (activeTab === 'custom') return new Map<string, FormatDef[]>()
    const list = grouped.get(activeTab) ?? []
    const m = new Map<string, FormatDef[]>()
    for (const f of list) {
      if (!m.has(f.platform)) m.set(f.platform, [])
      m.get(f.platform)!.push(f)
    }
    return m
  }, [activeTab, grouped])

  function isSelected(id: string) {
    return selected.some(s => s.id === id)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Formaten kiezen</h2>
            <p className="text-xs text-gray-400 mt-0.5">{selected.length} geselecteerd</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-1 overflow-x-auto">
          {GROUPS.map(g => (
            <button
              key={g}
              onClick={() => setActiveTab(g)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                activeTab === g ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {g}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
              activeTab === 'custom' ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Custom
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'custom' ? (
            <div className="max-w-md mx-auto space-y-4">
              <p className="text-sm text-gray-500">Voeg een eigen formaat toe in pixels.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Breedte (px)</label>
                  <input
                    type="number"
                    value={customW}
                    onChange={e => setCustomW(e.target.value)}
                    placeholder="1080"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Hoogte (px)</label>
                  <input
                    type="number"
                    value={customH}
                    onChange={e => setCustomH(e.target.value)}
                    placeholder="1080"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Naam (optioneel)</label>
                <input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Bijv. Email header"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]"
                />
              </div>
              <button
                onClick={addCustom}
                disabled={!customW || !customH}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                style={{ backgroundColor: '#EB4628' }}
              >
                <Plus size={14} />
                Toevoegen
              </button>

              {/* Lijst van custom formats in selectie */}
              {selected.filter(s => s.id.startsWith('custom-')).length > 0 && (
                <div className="pt-4 border-t border-gray-100 space-y-2">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Toegevoegd</p>
                  {selected.filter(s => s.id.startsWith('custom-')).map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.width} × {s.height} · {aspectLabel(s.width, s.height)}</p>
                      </div>
                      <button
                        onClick={() => setSelected(prev => prev.filter(x => x.id !== s.id))}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {Array.from(platformsByGroup.entries()).map(([platform, formats]) => (
                <div key={platform}>
                  <p className="text-xs font-semibold text-gray-700 mb-2">{platform}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {formats.map(f => {
                      const sel = isSelected(f.id)
                      return (
                        <button
                          key={f.id}
                          onClick={() => toggle(f)}
                          className="relative text-left rounded-xl transition-all"
                          style={{
                            padding: '12px',
                            border: `2px solid ${sel ? '#EB4628' : '#e5e7eb'}`,
                            backgroundColor: sel ? 'rgba(235, 70, 40, 0.06)' : 'white',
                          }}
                        >
                          <FormatThumb width={f.width} height={f.height} active={sel} />
                          <p className="text-xs font-semibold text-gray-800 mt-2">{f.name}</p>
                          <p className="text-[10px] text-gray-400">{f.width} × {f.height}</p>
                          {sel && (
                            <span
                              className="absolute rounded-full text-white flex items-center justify-center"
                              style={{
                                backgroundColor: '#EB4628',
                                top: '8px',
                                right: '8px',
                                width: '16px',
                                height: '16px',
                              }}
                            >
                              <Check size={10} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setSelected([])}
            disabled={selected.length === 0}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
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

function FormatThumb({ width, height, active }: { width: number; height: number; active: boolean }) {
  const max = Math.max(width, height)
  const w = (width / max) * 50
  const h = (height / max) * 50
  return (
    <div className="h-14 flex items-end justify-center">
      <div
        className={`rounded transition-colors ${active ? 'bg-[#EB4628]' : 'bg-gray-300'}`}
        style={{ width: `${w}px`, height: `${h}px` }}
      />
    </div>
  )
}
