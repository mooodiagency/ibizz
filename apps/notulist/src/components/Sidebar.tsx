'use client'

import { Mic, Archive } from 'lucide-react'

export type NotulistView = 'recorder' | 'archive'

type Props = {
  view: NotulistView
  onSelect: (v: NotulistView) => void
}

export default function Sidebar({ view, onSelect }: Props) {
  return (
    <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="flex-1 px-2 py-3 space-y-0.5">
        <NavBtn
          icon={<Mic size={15} />}
          label="Nieuw opnemen"
          active={view === 'recorder'}
          onClick={() => onSelect('recorder')}
        />
        <NavBtn
          icon={<Archive size={15} />}
          label="Archief"
          active={view === 'archive'}
          onClick={() => onSelect('archive')}
        />
      </div>
    </div>
  )
}

function NavBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        active ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      <span className={active ? 'text-[#EB4628]' : 'text-gray-400'}>{icon}</span>
      {label}
    </button>
  )
}
