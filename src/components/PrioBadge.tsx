'use client'

const config = [
  null,
  { label: 'P1 — Kritiek',  bg: 'bg-red-100',    text: 'text-red-700' },
  { label: 'P2 — Hoog',     bg: 'bg-orange-100', text: 'text-orange-700' },
  { label: 'P3 — Normaal',  bg: 'bg-yellow-100', text: 'text-yellow-700' },
  { label: 'P4 — Laag',     bg: 'bg-blue-100',   text: 'text-blue-600' },
  { label: 'P5 — Minimaal', bg: 'bg-gray-100',   text: 'text-gray-500' },
]

const short = ['', 'P1', 'P2', 'P3', 'P4', 'P5']

type Props = { prio: number; onChange?: (p: number) => void }

export default function PrioBadge({ prio, onChange }: Props) {
  const c = config[prio] ?? config[3]!

  if (!onChange) {
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-bold ${c.bg} ${c.text}`}>
        {short[prio]}
      </span>
    )
  }

  return (
    <div className="relative">
      <select
        value={prio}
        onChange={e => onChange(Number(e.target.value))}
        className={`appearance-none px-2 py-0.5 rounded text-xs font-bold cursor-pointer ${c.bg} ${c.text} border-0 outline-none pr-5`}
      >
        {[1, 2, 3, 4, 5].map(p => (
          <option key={p} value={p}>{config[p]!.label}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-current opacity-50 text-[10px]">▾</span>
    </div>
  )
}
