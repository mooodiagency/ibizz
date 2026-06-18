'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  X, Type, Plus, Trash2, Play, Pause, Download, Copy, Save, CheckCircle2,
  AlignLeft, AlignCenter, AlignRight, Bold, CaseSensitive, AlertCircle,
} from 'lucide-react'
import { Select, IbizzMark } from '@ibizz/ui'
import { createClient } from '@ibizz/supabase'
import type { MotionAspectRatio, MotionTextOverlay } from '@ibizz/supabase'
import ColorPicker from './ColorPicker'

export type TextLayer = MotionTextOverlay

type Props = {
  videoUrl: string
  aspectRatio: MotionAspectRatio
  durationSec: number | null
  generationId: string
  initialLayers?: TextLayer[]
  onClose: () => void
  onSaved?: (layers: TextLayer[]) => void
}

const FONTS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"Arial Black", sans-serif', label: 'Arial Black' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: '"Courier New", monospace', label: 'Courier New' },
]

const SWATCHES = ['#ffffff', '#000000', '#EB4628', '#facc15', '#22c55e', '#3b82f6', '#ec4899', '#f97316']

let idCounter = 0
function newId() { idCounter += 1; return `t${idCounter}_${Date.now()}` }

function makeLayer(partial?: Partial<TextLayer>): TextLayer {
  return {
    id: newId(),
    text: 'Tekst',
    xPct: 50,
    yPct: 50,
    fontSizePct: 7,
    color: '#ffffff',
    fontFamily: 'Arial, sans-serif',
    weight: 700,
    align: 'center',
    uppercase: false,
    bg: null,
    shadow: true,
    startSec: 0,
    endSec: null,
    ...partial,
  }
}

export default function VideoTextEditor({ videoUrl, aspectRatio, durationSec, generationId, initialLayers, onClose, onSaved }: Props) {
  const [layers, setLayers] = useState<TextLayer[]>(initialLayers ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(durationSec ?? 8)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const dragState = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const supabase = createClient()

  async function saveLayers() {
    setSaving(true)
    try {
      await supabase.from('motion_generations').update({ text_overlays: layers }).eq('id', generationId)
      onSaved?.(layers)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    } catch { /* stil */ } finally {
      setSaving(false)
    }
  }

  const selected = layers.find(l => l.id === selectedId) ?? null
  const isVertical = aspectRatio === '9:16'

  // Video tijd bijhouden
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => setCurrentTime(v.currentTime)
    const onMeta = () => setDuration(v.duration || durationSec || 8)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
    }
  }, [durationSec])

  function update(id: string, patch: Partial<TextLayer>) {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }
  function addLayer() {
    const l = makeLayer({ text: 'Nieuwe tekst' })
    setLayers(prev => [...prev, l])
    setSelectedId(l.id)
  }
  function removeLayer(id: string) {
    setLayers(prev => prev.filter(l => l.id !== id))
    if (selectedId === id) setSelectedId(null)
  }
  function duplicateLayer(id: string) {
    const src = layers.find(l => l.id === id)
    if (!src) return
    const copy = { ...src, id: newId(), xPct: Math.min(src.xPct + 5, 95), yPct: Math.min(src.yPct + 5, 95) }
    setLayers(prev => [...prev, copy])
    setSelectedId(copy.id)
  }

  function layerVisibleAt(l: TextLayer, t: number): boolean {
    return t >= l.startSec && (l.endSec == null || t < l.endSec)
  }

  // ── Drag ────────────────────────────────────────────────────────────
  function onLayerPointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    setSelectedId(id)
    const stage = stageRef.current
    const layer = layers.find(l => l.id === id)
    if (!stage || !layer) return
    const rect = stage.getBoundingClientRect()
    const px = (layer.xPct / 100) * rect.width
    const py = (layer.yPct / 100) * rect.height
    dragState.current = { id, dx: e.clientX - (rect.left + px), dy: e.clientY - (rect.top + py) }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onStagePointerMove(e: React.PointerEvent) {
    const d = dragState.current
    const stage = stageRef.current
    if (!d || !stage) return
    const rect = stage.getBoundingClientRect()
    const x = e.clientX - rect.left - d.dx
    const y = e.clientY - rect.top - d.dy
    update(d.id, {
      xPct: Math.max(0, Math.min(100, (x / rect.width) * 100)),
      yPct: Math.max(0, Math.min(100, (y / rect.height) * 100)),
    })
  }
  function onStagePointerUp() { dragState.current = null }

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }

  // ── Export (canvas + MediaRecorder, tekst ingebrand) ────────────────
  const exportVideo = useCallback(async () => {
    setExporting(true)
    setExportError(null)
    try {
      // Same-origin proxy → canvas niet tainted
      const proxied = `/api/proxy-video?url=${encodeURIComponent(videoUrl)}`
      const v = document.createElement('video')
      v.src = proxied
      v.crossOrigin = 'anonymous'
      v.muted = false
      v.playsInline = true
      await new Promise<void>((res, rej) => {
        v.onloadedmetadata = () => res()
        v.onerror = () => rej(new Error('Kon video niet laden voor export'))
      })

      const cw = v.videoWidth || (isVertical ? 720 : 1280)
      const ch = v.videoHeight || (isVertical ? 1280 : 720)
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas context')

      const canvasStream = canvas.captureStream(30)
      // Audio van de bron meenemen indien aanwezig
      try {
        const vidStream = (v as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.()
        const audioTracks = vidStream?.getAudioTracks?.() ?? []
        audioTracks.forEach(t => canvasStream.addTrack(t))
      } catch { /* geen audio — niet erg */ }

      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
      const rec = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
      const chunks: BlobPart[] = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

      const done = new Promise<Blob>(resolve => {
        rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
      })

      rec.start()
      v.currentTime = 0
      await v.play()

      const draw = () => {
        ctx.drawImage(v, 0, 0, cw, ch)
        const t = v.currentTime
        for (const l of layers) {
          if (layerVisibleAt(l, t)) drawLayer(ctx, l, cw, ch)
        }
        if (!v.ended && !v.paused) requestAnimationFrame(draw)
      }
      requestAnimationFrame(draw)

      await new Promise<void>(res => { v.onended = () => res() })
      // nog 1 frame + kleine buffer
      ctx.drawImage(v, 0, 0, cw, ch)
      rec.stop()
      const blob = await done

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `motion-met-tekst-${Date.now()}.webm`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export mislukt')
    } finally {
      setExporting(false)
    }
  }, [videoUrl, layers, isVertical])

  return (
    <div className="fixed inset-0 bg-gray-900/95 z-50 flex flex-col">
      {/* Topbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-white">
          <Type size={16} className="text-[#EB4628]" />
          <span className="text-sm font-bold">Tekst-editor</span>
        </div>
        <div className="flex items-center gap-2">
          {savedFlash && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-green-400">
              <CheckCircle2 size={12} /> Opgeslagen
            </span>
          )}
          <button
            onClick={saveLayers}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-white border border-white/20 hover:bg-white/10 disabled:opacity-60"
            title="Tekst-lagen opslaan zonder te exporteren (non-destructief)"
          >
            {saving ? <IbizzMark size={13} animate /> : <Save size={13} />}
            Opslaan
          </button>
          <button
            onClick={exportVideo}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#EB4628' }}
          >
            {exporting ? <IbizzMark size={13} animate /> : <Download size={13} />}
            {exporting ? 'Exporteren…' : 'Exporteer met tekst'}
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Stage */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 min-w-0">
          <div
            ref={stageRef}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            onPointerLeave={onStagePointerUp}
            onClick={() => setSelectedId(null)}
            className="relative bg-black rounded-xl overflow-hidden shadow-2xl"
            style={{
              aspectRatio: isVertical ? '9 / 16' : '16 / 9',
              height: isVertical ? 'min(72vh, 640px)' : 'auto',
              width: isVertical ? 'auto' : 'min(72vw, 960px)',
              maxHeight: '72vh',
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              src={videoUrl}
              className="absolute inset-0 w-full h-full object-contain"
              playsInline
              loop={false}
            />

            {/* Tekst-lagen */}
            {layers.map(l => {
              const visible = !playing || layerVisibleAt(l, currentTime) || l.id === selectedId
              if (!visible) return null
              return (
                <div
                  key={l.id}
                  onPointerDown={e => onLayerPointerDown(e, l.id)}
                  onClick={e => { e.stopPropagation(); setSelectedId(l.id) }}
                  className={`absolute cursor-move select-none ${l.id === selectedId ? 'outline outline-2 outline-[#EB4628] outline-offset-2' : ''}`}
                  style={{
                    left: `${l.xPct}%`,
                    top: `${l.yPct}%`,
                    transform: 'translate(-50%, -50%)',
                    maxWidth: '92%',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      whiteSpace: 'pre-wrap',
                      textAlign: l.align,
                      fontFamily: l.fontFamily,
                      fontWeight: l.weight,
                      color: l.color,
                      fontSize: `calc(${l.fontSizePct} * (${isVertical ? 'min(72vh,640px)' : 'min(72vw,960px) * 9 / 16'}) / 100)`,
                      lineHeight: 1.1,
                      textTransform: l.uppercase ? 'uppercase' : 'none',
                      padding: l.bg ? '0.12em 0.4em' : 0,
                      borderRadius: l.bg ? '0.2em' : 0,
                      backgroundColor: l.bg ?? 'transparent',
                      textShadow: l.shadow ? '0 2px 8px rgba(0,0,0,0.6)' : 'none',
                    }}
                  >
                    {l.text || ' '}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Transport */}
          <div className="mt-4 flex items-center gap-3 w-full max-w-xl">
            <button onClick={togglePlay} className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20">
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.05}
              value={currentTime}
              onChange={e => { const v = videoRef.current; if (v) { v.currentTime = parseFloat(e.target.value) } }}
              className="flex-1 accent-[#EB4628]"
            />
            <span className="text-xs text-white/60 tabular-nums w-16 text-right">
              {currentTime.toFixed(1)} / {duration.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Rechter panel */}
        <div className="w-80 flex-shrink-0 bg-white overflow-y-auto flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-800">Lagen</span>
            <button
              onClick={addLayer}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: '#EB4628' }}
            >
              <Plus size={12} /> Tekst
            </button>
          </div>

          {/* Lagenlijst */}
          <div className="px-3 py-2 space-y-1 border-b border-gray-100">
            {layers.length === 0 && (
              <p className="text-xs text-gray-400 px-1 py-2">Nog geen tekst. Klik op &ldquo;Tekst&rdquo; om een laag toe te voegen.</p>
            )}
            {layers.map(l => (
              <div
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs ${
                  l.id === selectedId ? 'bg-orange-50 text-[#EB4628]' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <Type size={11} className="flex-shrink-0" />
                <span className="flex-1 truncate">{l.text || '(leeg)'}</span>
                <button onClick={e => { e.stopPropagation(); duplicateLayer(l.id) }} className="p-0.5 text-gray-400 hover:text-gray-700"><Copy size={11} /></button>
                <button onClick={e => { e.stopPropagation(); removeLayer(l.id) }} className="p-0.5 text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
              </div>
            ))}
          </div>

          {/* Controls geselecteerde laag */}
          {selected ? (
            <div className="flex-1 px-4 py-3 space-y-4">
              <Ctrl label="Tekst">
                <textarea
                  value={selected.text}
                  onChange={e => update(selected.id, { text: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-[#EB4628] resize-none"
                  placeholder="Typ je tekst… (Enter = nieuwe regel)"
                />
              </Ctrl>

              <Ctrl label="Lettertype">
                <Select
                  value={selected.fontFamily}
                  onChange={v => update(selected.id, { fontFamily: v })}
                  options={FONTS}
                  className="w-full"
                />
              </Ctrl>

              <Ctrl label={`Grootte: ${selected.fontSizePct}`}>
                <input type="range" min={2} max={20} step={0.5} value={selected.fontSizePct}
                  onChange={e => update(selected.id, { fontSizePct: parseFloat(e.target.value) })}
                  className="w-full accent-[#EB4628]" />
              </Ctrl>

              <Ctrl label="Tekstkleur">
                <ColorPicker value={selected.color} onChange={c => update(selected.id, { color: c })} swatches={SWATCHES} />
              </Ctrl>

              <div className="grid grid-cols-2 gap-3">
                <Ctrl label="Uitlijning">
                  <div className="flex gap-1">
                    <IconToggle active={selected.align === 'left'} onClick={() => update(selected.id, { align: 'left' })}><AlignLeft size={13} /></IconToggle>
                    <IconToggle active={selected.align === 'center'} onClick={() => update(selected.id, { align: 'center' })}><AlignCenter size={13} /></IconToggle>
                    <IconToggle active={selected.align === 'right'} onClick={() => update(selected.id, { align: 'right' })}><AlignRight size={13} /></IconToggle>
                  </div>
                </Ctrl>
                <Ctrl label="Stijl">
                  <div className="flex gap-1">
                    <IconToggle active={selected.weight >= 700} onClick={() => update(selected.id, { weight: selected.weight >= 700 ? 400 : 900 })}><Bold size={13} /></IconToggle>
                    <IconToggle active={selected.uppercase} onClick={() => update(selected.id, { uppercase: !selected.uppercase })}><CaseSensitive size={13} /></IconToggle>
                    <IconToggle active={selected.shadow} onClick={() => update(selected.id, { shadow: !selected.shadow })} title="Schaduw"><span className="text-[10px] font-bold">S</span></IconToggle>
                  </div>
                </Ctrl>
              </div>

              <Ctrl label="Achtergrond">
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <button onClick={() => update(selected.id, { bg: null })}
                      className={`flex-1 px-2 py-1 rounded-lg text-[11px] font-semibold border ${selected.bg == null ? 'border-[#EB4628] bg-orange-50 text-[#EB4628]' : 'border-gray-200 text-gray-500'}`}>Geen</button>
                    <button onClick={() => update(selected.id, { bg: selected.bg ?? '#000000' })}
                      className={`flex-1 px-2 py-1 rounded-lg text-[11px] font-semibold border ${selected.bg != null ? 'border-[#EB4628] bg-orange-50 text-[#EB4628]' : 'border-gray-200 text-gray-500'}`}>Kleur</button>
                  </div>
                  {selected.bg != null && (
                    <ColorPicker value={selected.bg} onChange={c => update(selected.id, { bg: c })} swatches={SWATCHES} />
                  )}
                </div>
              </Ctrl>

              <Ctrl label={`Timing: ${selected.startSec.toFixed(1)}s → ${selected.endSec == null ? 'eind' : selected.endSec.toFixed(1) + 's'}`}>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-8">Start</span>
                    <input type="range" min={0} max={duration} step={0.1} value={selected.startSec}
                      onChange={e => update(selected.id, { startSec: parseFloat(e.target.value) })} className="flex-1 accent-[#EB4628]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-8">Eind</span>
                    <input type="range" min={0} max={duration} step={0.1} value={selected.endSec ?? duration}
                      onChange={e => update(selected.id, { endSec: parseFloat(e.target.value) >= duration ? null : parseFloat(e.target.value) })} className="flex-1 accent-[#EB4628]" />
                  </div>
                </div>
              </Ctrl>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center px-6 text-center">
              <p className="text-xs text-gray-400">Selecteer een laag om te bewerken, of voeg een nieuwe toe.</p>
            </div>
          )}

          {exportError && (
            <div className="px-4 py-2 border-t border-gray-100">
              <p className="flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
                {exportError}
              </p>
            </div>
          )}
          <div className="px-4 py-2 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 leading-snug">Export = .webm met tekst ingebrand (audio blijft behouden). Sleep tekst direct op de video om te plaatsen.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Canvas tekenfunctie (export) ────────────────────────────────────────
function drawLayer(ctx: CanvasRenderingContext2D, l: TextLayer, cw: number, ch: number) {
  const fontPx = (l.fontSizePct / 100) * ch
  ctx.save()
  ctx.font = `${l.weight} ${fontPx}px ${l.fontFamily}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = l.align as CanvasTextAlign

  const rawLines = (l.text || ' ').split('\n')
  const lines = l.uppercase ? rawLines.map(s => s.toUpperCase()) : rawLines
  const lineHeight = fontPx * 1.15
  const cx = (l.xPct / 100) * cw
  const cy = (l.yPct / 100) * ch
  const totalH = lineHeight * lines.length
  const startY = cy - totalH / 2 + lineHeight / 2

  // Achtergrond-pill
  if (l.bg) {
    const padX = fontPx * 0.4
    const padY = fontPx * 0.18
    let maxW = 0
    for (const ln of lines) maxW = Math.max(maxW, ctx.measureText(ln).width)
    const boxW = maxW + padX * 2
    const boxH = totalH + padY * 2
    let boxX = cx - boxW / 2
    if (l.align === 'left') boxX = cx - padX
    if (l.align === 'right') boxX = cx - boxW + padX
    ctx.fillStyle = l.bg
    const r = fontPx * 0.18
    roundRect(ctx, boxX, cy - boxH / 2, boxW, boxH, r)
    ctx.fill()
  }

  if (l.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = fontPx * 0.18
    ctx.shadowOffsetY = fontPx * 0.06
  }
  ctx.fillStyle = l.color
  lines.forEach((ln, i) => ctx.fillText(ln, cx, startY + i * lineHeight))
  ctx.restore()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// ─── Kleine UI helpers ───────────────────────────────────────────────────
function Ctrl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function IconToggle({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center w-8 h-7 rounded-lg border transition-colors ${
        active ? 'border-[#EB4628] bg-orange-50 text-[#EB4628]' : 'border-gray-200 text-gray-500 hover:border-gray-300'
      }`}
    >
      {children}
    </button>
  )
}
