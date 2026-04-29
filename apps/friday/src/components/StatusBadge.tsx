'use client'

import type { Status } from '@ibizz/supabase'

const config: Record<Status, { label: string; bg: string; text: string }> = {
  todo:        { label: 'To do',       bg: 'bg-gray-100',   text: 'text-gray-600' },
  in_progress: { label: 'In progress', bg: 'bg-blue-100',   text: 'text-blue-700' },
  review:      { label: 'Review',      bg: 'bg-yellow-100', text: 'text-yellow-700' },
  done:        { label: 'Done',        bg: 'bg-green-100',  text: 'text-green-700' },
}

const ORDER: Status[] = ['todo', 'in_progress', 'review', 'done']

type Props = {
  status: Status
  onChange?: (s: Status) => void
}

export default function StatusBadge({ status, onChange }: Props) {
  const { label, bg, text } = config[status]

  if (!onChange) {
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
    )
  }

  return (
    <div className="relative">
      <select
        value={status}
        onChange={e => onChange(e.target.value as Status)}
        className={`appearance-none px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${bg} ${text} border-0 outline-none pr-5`}
      >
        {ORDER.map(s => (
          <option key={s} value={s}>{config[s].label}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-current opacity-50 text-[10px]">▾</span>
    </div>
  )
}
