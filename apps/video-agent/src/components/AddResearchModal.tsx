'use client'

import { useState } from 'react'
import { X, Hash, AtSign, Link as LinkIcon, AlertCircle, ExternalLink } from 'lucide-react'
import { IbizzMark } from '@ibizz/ui'
import type { VideoResearch } from '@ibizz/supabase'

type Mode = 'hashtag' | 'account' | 'url'

type Props = {
  briefId: string
  initialMode?: Mode
  onClose: () => void
  onAdded: (items: VideoResearch[]) => void
}

export default function AddResearchModal({ briefId, initialMode = 'url', onClose, onAdded }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [limit, setLimit] = useState(12)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

  async function run() {
    if (!value.trim()) return
    setBusy(true)
    setError(null)
    setHint(null)
    try {
      let res: Response
      if (mode === 'url') {
        res = await fetch('/api/research-add-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ briefId, url: value.trim(), notes: notes.trim() || undefined }),
        })
      } else {
        res = await fetch('/api/research-scrape-tiktok', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ briefId, mode, value: value.trim(), limit }),
        })
      }
      const data = await res.json()
      if (!res.ok) {
        if (data.hint) setHint(data.hint)
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      if (mode === 'url') {
        onAdded([data.research as VideoResearch])
      } else {
        onAdded((data.research ?? []) as VideoResearch[])
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toevoegen mislukt')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={busy ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Research toevoegen</h2>
          <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30">
            <X size={18} />
          </button>
        </div>

        {busy ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16 px-8 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EB462812' }}>
              <IbizzMark size={36} animate className="text-[#EB4628]" />
            </div>
            <p className="text-base font-semibold text-gray-800">
              {mode === 'url' ? 'URL ophalen en opslaan…' : `TikTok ${mode === 'hashtag' ? 'hashtag' : 'account'} scrapen…`}
            </p>
            <p className="text-sm text-gray-400 max-w-xs">
              {mode === 'url'
                ? 'oEmbed haalt caption + thumbnail op'
                : 'Best-effort fetch + parse — TikTok kan weigeren, dan zie je een heldere fout.'}
            </p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="px-6 pt-4 flex gap-1 border-b border-gray-100">
              <Tab icon={<Hash size={12} />} label="Hashtag" active={mode === 'hashtag'} onClick={() => { setMode('hashtag'); setValue('') }} />
              <Tab icon={<AtSign size={12} />} label="Account" active={mode === 'account'} onClick={() => { setMode('account'); setValue('') }} />
              <Tab icon={<LinkIcon size={12} />} label="Plak URL" active={mode === 'url'} onClick={() => { setMode('url'); setValue('') }} />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {mode === 'hashtag' && (
                <>
                  <Field label="TikTok hashtag">
                    <div className="relative">
                      <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        autoFocus
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) run() }}
                        placeholder="reizen, of frenky, of luggagehack"
                        className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-[#EB4628]"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Met of zonder #. Wordt: tiktok.com/tag/&lt;hashtag&gt;</p>
                  </Field>
                  <LimitField limit={limit} onChange={setLimit} />
                </>
              )}

              {mode === 'account' && (
                <>
                  <Field label="TikTok gebruikersnaam">
                    <div className="relative">
                      <AtSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        autoFocus
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) run() }}
                        placeholder="khaby.lame, bv. een concurrent of inspiratie-account"
                        className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-[#EB4628]"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">Met of zonder @. Wordt: tiktok.com/@&lt;user&gt;</p>
                  </Field>
                  <LimitField limit={limit} onChange={setLimit} />
                </>
              )}

              {mode === 'url' && (
                <>
                  <Field label="Video URL">
                    <div className="relative">
                      <LinkIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        autoFocus
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && value.trim()) run() }}
                        placeholder="https://www.tiktok.com/@user/video/123… of IG reel of YT short"
                        className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-[#EB4628]"
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      TikTok + YouTube: caption + thumbnail worden automatisch opgehaald. Instagram: vul zelf in.
                    </p>
                  </Field>
                  <Field label="Notities (optioneel)">
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Waarom werkt deze video? Welk hook-type? Wat kunnen we lenen?"
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628] resize-none leading-relaxed"
                    />
                  </Field>
                </>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-[11px] text-gray-600 leading-relaxed">
                <p className="font-semibold text-gray-700 mb-1">Verwachting per modus</p>
                {mode === 'url' && <p>Werkt altijd — gebruikt officiële oEmbed endpoints van TikTok en YouTube.</p>}
                {(mode === 'hashtag' || mode === 'account') && (
                  <p>Best-effort scrape zonder Playwright. Werkt vaak, maar TikTok kan blokkeren met een captcha. Bij fout: gebruik Plak URL voor specifieke videos.</p>
                )}
              </div>

              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="flex items-start gap-1.5">
                    <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </p>
                  {hint && (
                    <p className="mt-1 ml-4 italic text-red-600 text-[11px]">{hint}</p>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
              <a
                href="https://www.tiktok.com/explore"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-gray-400 hover:text-gray-700 flex items-center gap-1"
              >
                <ExternalLink size={10} />
                TikTok Explore openen
              </a>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                  Annuleren
                </button>
                <button
                  onClick={run}
                  disabled={!value.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: '#EB4628' }}
                >
                  {mode === 'url' ? 'Toevoegen' : `Scrape ${limit}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Tab({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
        active
          ? 'text-[#EB4628] border-b-2 border-[#EB4628] -mb-px'
          : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
      }`}
    >
      {icon}
      {label}
    </button>
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

function LimitField({ limit, onChange }: { limit: number; onChange: (n: number) => void }) {
  return (
    <Field label="Aantal videos">
      <input
        type="number"
        min={1}
        max={20}
        value={limit}
        onChange={e => onChange(Math.max(1, Math.min(20, parseInt(e.target.value || '12', 10))))}
        className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628] text-center"
      />
      <p className="text-[11px] text-gray-400 mt-1">1-20, default 12. TikTok geeft meestal de top performers eerst.</p>
    </Field>
  )
}
