'use client'

import { Select } from '@ibizz/ui'

const config = [
  null,
  { label: 'P1 — Kritiek',  className: 'bg-red-100 text-red-700' },
  { label: 'P2 — Hoog',     className: 'bg-orange-100 text-orange-700' },
  { label: 'P3 — Normaal',  className: 'bg-yellow-100 text-yellow-700' },
  { label: 'P4 — Laag',     className: 'bg-blue-100 text-blue-600' },
  { label: 'P5 — Minimaal', className: 'bg-gray-100 text-gray-500' },
]

const short = ['', 'P1', 'P2', 'P3', 'P4', 'P5']

type Props = { prio: number; onChange?: (p: number) => void }

export default function PrioBadge({ prio, onChange }: Props) {
  const c = config[prio] ?? config[3]!

  if (!onChange) {
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-bold ${c.className}`}>
        {short[prio]}
      </span>
    )
  }

  return (
    <Select
      variant="badge"
      value={String(prio)}
      onChange={v => onChange(Number(v))}
      options={[1, 2, 3, 4, 5].map(p => ({
        value: String(p),
        label: config[p]!.label,
        triggerLabel: short[p],
        className: config[p]!.className,
      }))}
    />
  )
}
