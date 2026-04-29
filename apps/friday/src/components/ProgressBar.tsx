'use client'

import { calcProgress } from '@/lib/progress'

type Props = {
  startDate: string
  dueDate: string | null
  status: string
}

export default function ProgressBar({ startDate, dueDate, status }: Props) {
  const { percent, color } = calcProgress(startDate, dueDate, status)

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{percent}%</span>
    </div>
  )
}
