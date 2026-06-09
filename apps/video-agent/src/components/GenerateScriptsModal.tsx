'use client'

import { useState } from 'react'
import { X, Sparkles, AlertCircle } from 'lucide-react'
import { IbizzMark } from '@ibizz/ui'
import type { VideoScript } from '@ibizz/supabase'

type Props = {
  briefId: string
  existingCount: number
  onClose: () => void
  onGenerated: (scripts: VideoScript[], mode: 'replace' | 'append') => void
}

export default function GenerateScriptsModal({ briefId, existingCount, onClose, onGenerated }: Props) {
  const [aantal, setAantal] = useState(8)
  const [lengteSec, setLengteSec] = useState(35)
  const [mode, setMode] = useState<'replace' | 'append'>(existingCount === 0 ? 'replace' : 'append')
  const [creatieveRichting, setCreatieveRichting] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId,
          aantal,
          lengteSec,
          creatieveRichting: creatieveRichting.trim(),
          mode,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { scripts: VideoScript[]; warning?: string }
      onGenerated(data.scripts ?? [], mode)
      if (data.warning) {
        // korte alert — niet super UX-rijk maar je weet 't tenminste
        alert(data.warning)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generatie mislukt')
      setGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={generating ? undefined : onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#EB4628]" />
            <h2 className="text-base font-bold text-gray-900">Genereer scripts</h2>
          </div>
          <button
            onClick={onClose}
            disabled={generating}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"
          >
            <X size={18} />
          </button>
        </div>

        {generating ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EB462812' }}>
              <IbizzMark size={36} animate className="text-[#EB4628]" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800 mb-1">
                AI schrijft {aantal} {aantal === 1 ? 'script' : 'scripts'}…
              </p>
              <p className="text-sm text-gray-400">
                Dit duurt ongeveer 30-60 seconden. Niet wegklikken.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {existingCount > 0 && (
                <Field label="Wat moet er gebeuren met bestaande scripts?">
                  <div className="flex gap-2">
                    <ModeBtn
                      active={mode === 'append'}
                      onClick={() => setMode('append')}
                      title="Toevoegen"
                      sub={`Bestaande ${existingCount} blijven`}
                    />
                    <ModeBtn
                      active={mode === 'replace'}
                      onClick={() => setMode('replace')}
                      title="Vervangen"
                      sub="Alle bestaande worden verwijderd"
                      destructive
                    />
                  </div>
                  {mode === 'replace' && (
                    <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                      <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                      Alle bestaande {existingCount} {existingCount === 1 ? 'script wordt' : 'scripts worden'} permanent verwijderd.
                    </p>
                  )}
                </Field>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Aantal scripts">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={aantal}
                    onChange={e => setAantal(Math.max(1, Math.min(20, parseInt(e.target.value || '1', 10))))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">1-20, default 8</p>
                </Field>
                <Field label="Lengte per script (sec)">
                  <input
                    type="number"
                    min={10}
                    max={120}
                    step={5}
                    value={lengteSec}
                    onChange={e => setLengteSec(Math.max(10, Math.min(120, parseInt(e.target.value || '15', 10))))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">10-120 sec, default 35</p>
                </Field>
              </div>

              <Field label="Creatieve richting">
                <textarea
                  value={creatieveRichting}
                  onChange={e => setCreatieveRichting(e.target.value)}
                  rows={5}
                  placeholder={`Beschrijf de boodschap, doelgroep, hook-stijl, tone-of-voice. Bijv:\n\n"FRENKY is een reistas die niet hoeft te worden ingecheckt. Doelgroep: 25-40 reizigers die weekendtripjes maken. Toon: rustig, droog, zelfverzekerd. Hook-stijlen: vergelijking, fysieke actie, walk-by. Vermijd lifestyle-clichés."`}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628] resize-none leading-relaxed"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Hoe specifieker, hoe beter. De AI gebruikt ook de brand-context en cast/locaties uit de brief.
                </p>
              </Field>

              {error && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                Annuleren
              </button>
              <button
                onClick={generate}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: '#EB4628' }}
              >
                <Sparkles size={14} />
                Genereer {aantal} {aantal === 1 ? 'script' : 'scripts'}
              </button>
            </div>
          </>
        )}
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

function ModeBtn({
  active, onClick, title, sub, destructive = false,
}: {
  active: boolean
  onClick: () => void
  title: string
  sub: string
  destructive?: boolean
}) {
  const activeColor = destructive ? '#dc2626' : '#EB4628'
  const activeBg = destructive ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-300'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-left rounded-xl border px-3 py-2.5 transition-colors ${
        active ? activeBg : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="text-sm font-semibold" style={{ color: active ? activeColor : '#374151' }}>
        {title}
      </div>
      <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>
    </button>
  )
}
