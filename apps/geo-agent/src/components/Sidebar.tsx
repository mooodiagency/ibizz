'use client'

import { Satellite } from 'lucide-react'

export type SidebarView = 'projects'

type Props = {
  view: SidebarView
  onSelect: (v: SidebarView) => void
}

export default function Sidebar({ view, onSelect }: Props) {
  return (
    <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="flex-1 px-2 py-3 space-y-0.5">
        <button
          onClick={() => onSelect('projects')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            view === 'projects' ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span className={view === 'projects' ? 'text-[#EB4628]' : 'text-gray-400'}><Satellite size={15} /></span>
          Projecten
        </button>
      </div>
    </div>
  )
}
