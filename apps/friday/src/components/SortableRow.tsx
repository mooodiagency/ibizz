'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MessageSquare } from 'lucide-react'
import ProgressBar from './ProgressBar'
import StatusBadge from './StatusBadge'
import PrioBadge from './PrioBadge'
import type { ProjectLine, Status } from '@ibizz/supabase'

type Props = {
  line: ProjectLine
  editingName: string | null
  chatLineId: string | null
  selected: boolean
  stats?: { total: number; unread: number }
  onEditName: (id: string) => void
  onSaveName: (id: string, val: string) => void
  onUpdate: (id: string, patch: Partial<ProjectLine>) => void
  onChatToggle: (id: string) => void
  onToggleSelect: (id: string) => void
}

export default function SortableRow({ line, editingName, chatLineId, selected, stats, onEditName, onSaveName, onUpdate, onChatToggle, onToggleSelect }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[44px_2fr_1fr_2fr_1fr_1fr_1fr_40px] gap-4 px-4 py-3 border-b border-gray-100 transition-colors items-center group ${
        selected ? 'bg-orange-50/50 hover:bg-orange-50' : 'bg-white hover:bg-gray-50'
      }`}
    >
      {/* Checkbox + drag handle */}
      <div className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(line.id)}
          className="w-3.5 h-3.5 rounded border-gray-300 cursor-pointer accent-[#EB4628]"
        />
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity touch-none"
        >
          <GripVertical size={13} />
        </button>
      </div>

      {/* Name */}
      <div className="min-w-0">
        {editingName === line.id ? (
          <input
            autoFocus
            defaultValue={line.name}
            className="w-full text-sm text-gray-800 border-b border-gray-300 outline-none bg-transparent pb-0.5"
            onBlur={e => onSaveName(line.id, e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        ) : (
          <div
            className="relative cursor-pointer group/name"
            onClick={() => onEditName(line.id)}
            title={line.name}
          >
            <span className="block text-sm text-gray-800 whitespace-nowrap overflow-hidden group-hover/name:text-[#e63a1e]">
              {line.name}
            </span>
            <span className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white group-hover:from-gray-50 to-transparent pointer-events-none" />
          </div>
        )}
      </div>

      {/* Owner */}
      <input
        defaultValue={line.owner_name ?? ''}
        placeholder="—"
        className="text-sm text-gray-600 bg-transparent outline-none border-b border-transparent focus:border-gray-300 w-full"
        onBlur={e => onUpdate(line.id, { owner_name: e.target.value || null })}
      />

      {/* Progress */}
      <ProgressBar startDate={line.start_date} dueDate={line.due_date} status={line.status} />

      {/* Status */}
      <StatusBadge status={line.status} onChange={s => onUpdate(line.id, { status: s as Status })} />

      {/* Prio */}
      <PrioBadge prio={line.prio} onChange={p => onUpdate(line.id, { prio: p })} />

      {/* Due date */}
      <input
        type="date"
        value={line.due_date ?? ''}
        className="text-xs text-gray-600 bg-transparent outline-none border-b border-transparent focus:border-gray-300"
        onChange={e => onUpdate(line.id, { due_date: e.target.value || null })}
      />

      {/* Chat toggle met read/unread badge */}
      <div className="relative inline-flex">
        <button
          onClick={() => onChatToggle(line.id)}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${chatLineId === line.id ? 'text-[#e63a1e]' : 'text-gray-400'}`}
          title={
            !stats || stats.total === 0
              ? 'Geen berichten'
              : stats.unread > 0
                ? `${stats.unread} ongelezen`
                : `${stats.total} bericht${stats.total !== 1 ? 'en' : ''}`
          }
        >
          <MessageSquare size={15} />
        </button>
        {stats && stats.total > 0 && (
          <span
            className={`pointer-events-none absolute top-0 right-0 min-w-[15px] h-[15px] px-[4px] rounded-full text-[9px] font-bold leading-none flex items-center justify-center ring-2 ring-white ${
              stats.unread > 0 ? 'text-white' : 'text-gray-600 bg-gray-200'
            }`}
            style={stats.unread > 0 ? { backgroundColor: '#EB4628' } : undefined}
          >
            {stats.unread > 0 ? stats.unread : stats.total}
          </span>
        )}
      </div>
    </div>
  )
}
