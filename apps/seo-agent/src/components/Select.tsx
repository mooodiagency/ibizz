'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

type Option = { value: string; label?: string }

type Props = {
  value: string
  onChange: (value: string) => void
  options: Option[]
  className?: string
}

export default function Select({ value, onChange, options, className = '' }: Props) {
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

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 w-full text-xs font-medium border rounded-xl pl-3 pr-2.5 py-2 bg-white text-gray-700 transition-colors focus:outline-none ${
          open ? 'border-[#EB4628]' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <span className="flex-1 text-left">{selected?.label ?? selected?.value ?? value}</span>
        <ChevronDown
          size={11}
          className={`text-gray-400 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {options.map(o => {
            const active = value === o.value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors ${
                  active ? 'text-[#EB4628] bg-orange-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="w-3.5 flex-shrink-0">
                  {active && <Check size={12} className="text-[#EB4628]" />}
                </span>
                {o.label ?? o.value}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
