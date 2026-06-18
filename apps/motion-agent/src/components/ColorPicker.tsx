'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string                 // hex, bv. "#EB4628"
  onChange: (hex: string) => void
  swatches?: string[]
}

// ── Conversies ────────────────────────────────────────────────────────────
function clamp(n: number, min = 0, max = 255) { return Math.max(min, Math.min(max, Math.round(n))) }

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 0, g: 0, b: 0 }
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => clamp(x).toString(16).padStart(2, '0')).join('')
}
function rgbToCmyk(r: number, g: number, b: number): { c: number; m: number; y: number; k: number } {
  const rr = r / 255, gg = g / 255, bb = b / 255
  const k = 1 - Math.max(rr, gg, bb)
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 }
  const c = (1 - rr - k) / (1 - k)
  const m = (1 - gg - k) / (1 - k)
  const y = (1 - bb - k) / (1 - k)
  return { c: Math.round(c * 100), m: Math.round(m * 100), y: Math.round(y * 100), k: Math.round(k * 100) }
}
function cmykToRgb(c: number, m: number, y: number, k: number): { r: number; g: number; b: number } {
  const cc = c / 100, mm = m / 100, yy = y / 100, kk = k / 100
  return {
    r: clamp(255 * (1 - cc) * (1 - kk)),
    g: clamp(255 * (1 - mm) * (1 - kk)),
    b: clamp(255 * (1 - yy) * (1 - kk)),
  }
}

export default function ColorPicker({ value, onChange, swatches }: Props) {
  const [open, setOpen] = useState(false)
  const [hexInput, setHexInput] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  const rgb = hexToRgb(value)
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b)

  useEffect(() => { setHexInput(value) }, [value])
  useEffect(() => {
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function commitHex(v: string) {
    let h = v.trim()
    if (!h.startsWith('#')) h = '#' + h
    if (/^#[0-9a-fA-F]{3}$/.test(h)) h = '#' + h.slice(1).split('').map(c => c + c).join('')
    if (/^#[0-9a-fA-F]{6}$/.test(h)) onChange(h.toLowerCase())
  }
  function setRgb(part: 'r' | 'g' | 'b', n: number) {
    const next = { ...rgb, [part]: clamp(n) }
    onChange(rgbToHex(next.r, next.g, next.b))
  }
  function setCmyk(part: 'c' | 'm' | 'y' | 'k', n: number) {
    const next = { ...cmyk, [part]: Math.max(0, Math.min(100, Math.round(n))) }
    const r = cmykToRgb(next.c, next.m, next.y, next.k)
    onChange(rgbToHex(r.r, r.g, r.b))
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full border border-gray-200 rounded-lg px-2 py-1.5 hover:border-gray-300"
      >
        <span className="w-5 h-5 rounded border border-gray-200 flex-shrink-0" style={{ backgroundColor: value }} />
        <span className="text-xs font-mono text-gray-700 uppercase">{value}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 w-60 bg-white border border-gray-200 rounded-xl shadow-xl p-3 space-y-3">
          {/* Visuele picker + grote swatch */}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value}
              onChange={e => onChange(e.target.value.toLowerCase())}
              className="w-10 h-10 rounded cursor-pointer border border-gray-200 p-0"
              title="Kleurkiezer"
            />
            <div className="flex-1">
              <label className="block text-[9px] font-semibold text-gray-400 uppercase mb-0.5">Hex</label>
              <input
                value={hexInput}
                onChange={e => setHexInput(e.target.value)}
                onBlur={() => commitHex(hexInput)}
                onKeyDown={e => { if (e.key === 'Enter') commitHex(hexInput) }}
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs font-mono uppercase outline-none focus:border-[#EB4628]"
              />
            </div>
          </div>

          {/* RGB */}
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase mb-0.5">RGB</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['r', 'g', 'b'] as const).map(p => (
                <input key={p} type="number" min={0} max={255} value={rgb[p]}
                  onChange={e => setRgb(p, parseInt(e.target.value || '0', 10))}
                  className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs text-center outline-none focus:border-[#EB4628]" />
              ))}
            </div>
          </div>

          {/* CMYK */}
          <div>
            <label className="block text-[9px] font-semibold text-gray-400 uppercase mb-0.5">CMYK</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['c', 'm', 'y', 'k'] as const).map(p => (
                <input key={p} type="number" min={0} max={100} value={cmyk[p]}
                  onChange={e => setCmyk(p, parseInt(e.target.value || '0', 10))}
                  className="w-full border border-gray-200 rounded px-1 py-1 text-xs text-center outline-none focus:border-[#EB4628]" />
              ))}
            </div>
          </div>

          {/* Swatches */}
          {swatches && swatches.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
              {swatches.map(c => (
                <button key={c} type="button" onClick={() => onChange(c)}
                  className={`w-5 h-5 rounded border ${value.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-[#EB4628] ring-offset-1' : 'border-gray-200'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
