'use client'

import { Select } from '@ibizz/ui'
import type { Status } from '@ibizz/supabase'

const config: Record<Status, { label: string; className: string }> = {
  todo:        { label: 'To do',       className: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'In progress', className: 'bg-blue-100 text-blue-700' },
  review:      { label: 'Review',      className: 'bg-yellow-100 text-yellow-700' },
  done:        { label: 'Done',        className: 'bg-green-100 text-green-700' },
}

const ORDER: Status[] = ['todo', 'in_progress', 'review', 'done']

type Props = {
  status: Status
  onChange?: (s: Status) => void
}

export default function StatusBadge({ status, onChange }: Props) {
  const { label, className } = config[status]

  if (!onChange) {
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${className}`}>
        {label}
      </span>
    )
  }

  return (
    <Select
      variant="badge"
      value={status}
      onChange={s => onChange(s as Status)}
      options={ORDER.map(s => ({ value: s, label: config[s].label, className: config[s].className }))}
    />
  )
}
