'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export type SelectOption = {
  value: string
  label?: string
  /** Gekleurde pill-classes (bg + text) voor de 'badge' variant. */
  className?: string
  /** Kortere tekst die alleen op de ingeklapte badge-trigger getoond wordt. */
  triggerLabel?: string
}

export type SelectProps = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
  /** Compactere variant (kleiner padding/tekst). Default false. */
  compact?: boolean
  placeholder?: string
  disabled?: boolean
  /** 'default' = witte box; 'badge' = gekleurde pill-trigger (gebruikt option.className). */
  variant?: 'default' | 'badge'
}

/**
 * Gedeelde custom dropdown voor alle ibizz apps.
 * Vervangt de native <select> (die OS-styling toont) met een volledig
 * gestylde versie in ibizz huisstijl: afgeronde hoeken, rode focus,
 * checkmark op actieve optie.
 *
 * variant="badge" houdt de gekleurde pill-look (bv. status/prioriteit) maar
 * gebruikt hetzelfde gestylde dropdown-paneel i.p.v. de native OS-lijst.
 */
export function Select({
  value,
  onChange,
  options,
  className = '',
  compact = false,
  placeholder,
  disabled = false,
  variant = 'default',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const selected = options.find(o => o.value === value)

  // ── Badge variant: gekleurde pill-trigger + gestyld paneel ──────────────
  if (variant === 'badge') {
    const pill = selected?.className ?? 'bg-gray-100 text-gray-600'
    const badgeText = selected?.triggerLabel ?? selected?.label ?? selected?.value ?? placeholder ?? value
    return (
      <div ref={ref} className={`relative inline-block ${className}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setOpen(o => !o)}
          className={`inline-flex items-center gap-1 rounded text-xs font-semibold cursor-pointer transition-opacity hover:opacity-80 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
            compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5'
          } ${pill}`}
        >
          <span className="truncate">{badgeText}</span>
          <ChevronDown
            size={10}
            className={`flex-shrink-0 opacity-60 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 min-w-[9rem] bg-white border border-gray-200 rounded-xl shadow-lg p-1">
            {options.map(o => {
              const active = value === o.value
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false) }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                    active ? 'bg-gray-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`inline-flex items-center rounded text-xs font-semibold px-2 py-0.5 ${o.className ?? 'bg-gray-100 text-gray-600'}`}>
                    {o.label ?? o.value}
                  </span>
                  {active && <Check size={12} className="text-[#EB4628] ml-auto flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Default variant: witte box ──────────────────────────────────────────
  const display = selected?.label ?? selected?.value ?? placeholder ?? value
  const pad = compact ? 'pl-2.5 pr-2 py-1' : 'pl-3 pr-2.5 py-2'
  const text = compact ? 'text-[11px]' : 'text-xs'

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`flex items-center gap-1.5 w-full ${text} font-medium border rounded-xl ${pad} bg-white text-gray-700 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? 'border-[#EB4628]' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <span className={`flex-1 text-left truncate ${!selected ? 'text-gray-400' : ''}`}>{display}</span>
        <ChevronDown
          size={11}
          className={`text-gray-400 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
          {options.map(o => {
            const active = value === o.value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 ${text} font-medium text-left transition-colors ${
                  active ? 'text-[#EB4628] bg-orange-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="w-3.5 flex-shrink-0">
                  {active && <Check size={12} className="text-[#EB4628]" />}
                </span>
                <span className="truncate">{o.label ?? o.value}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Select
