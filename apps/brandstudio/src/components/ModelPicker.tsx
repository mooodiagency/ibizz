'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check, Lock } from 'lucide-react'
import { MODELS } from '@ibizz/ai-image'
import type { ModelId } from '@ibizz/ai-image'

type Props = {
  value: ModelId
  onChange: (id: ModelId) => void
}

export default function ModelPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const current = MODELS.find(m => m.id === value)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white hover:border-gray-300 focus:border-[#EB4628] outline-none transition-colors"
      >
        <span className="font-semibold text-gray-800 truncate">{current?.name ?? 'Kies model'}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 overflow-hidden">
          {MODELS.map(m => {
            const selected = m.id === value
            const disabled = !m.available
            return (
              <button
                key={m.id}
                type="button"
                disabled={disabled}
                onClick={() => { onChange(m.id); setOpen(false) }}
                className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors ${
                  disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : selected
                      ? 'bg-gray-50'
                      : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-semibold ${selected ? 'text-gray-900' : 'text-gray-800'}`}>
                      {m.name}
                    </span>
                    {disabled && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                        <Lock size={9} />
                        Binnenkort
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{m.description}</p>
                </div>
                {selected && !disabled && (
                  <Check size={15} style={{ color: '#EB4628' }} className="mt-0.5 flex-shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
