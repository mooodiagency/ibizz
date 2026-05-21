'use client'

import { FileText, Lightbulb } from 'lucide-react'

export type SidebarView = 'briefs' | 'lessons'

type Props = {
  view: SidebarView
  onSelect: (v: SidebarView) => void
}

export default function Sidebar({ view, onSelect }: Props) {
  return (
    <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="flex-1 px-2 py-3 space-y-0.5">
        <NavBtn
          icon={<FileText size={15} />}
          label="Briefs"
          active={view === 'briefs'}
          onClick={() => onSelect('briefs')}
        />
        <NavBtn
          icon={<Lightbulb size={15} />}
          label="Lessons learned"
          active={view === 'lessons'}
          onClick={() => onSelect('lessons')}
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
