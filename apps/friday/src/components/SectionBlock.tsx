'use client'

import { useState } from 'react'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { ChevronDown, ChevronRight, Plus, Pencil } from 'lucide-react'
import type { ProjectLine, ProjectSection } from '@ibizz/supabase'
import SortableRow from './SortableRow'
import type { MessageStats } from './ProjectDetail'

type Props = {
  section: ProjectSection
  lines: ProjectLine[]
  projectColor: string
  editingName: string | null
  chatLineId: string | null
  selectedIds: Set<string>
  messageStats: Record<string, MessageStats>
  onEditName: (id: string) => void
  onSaveName: (id: string, val: string) => void
  onUpdate: (id: string, patch: Partial<ProjectLine>) => void
  onChatToggle: (id: string) => void
  onAddLine: (sectionId: string) => void
  onRenameSection: (id: string, name: string) => void
  onToggleSelect: (id: string) => void
  onToggleSectionSelect: (sectionId: string) => void
}

export default function SectionBlock({
  section, lines, projectColor, editingName, chatLineId, selectedIds, messageStats,
  onEditName, onSaveName, onUpdate, onChatToggle, onAddLine, onRenameSection,
  onToggleSelect, onToggleSectionSelect,
}: Props) {
  const allSelected = lines.length > 0 && lines.every(l => selectedIds.has(l.id))
  const someSelected = lines.some(l => selectedIds.has(l.id))
  const [collapsed, setCollapsed] = useState(false)
  const [editingSection, setEditingSection] = useState(false)
  const { setNodeRef, isOver } = useDroppable({ id: `section:${section.id}` })

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2 group">
        <button
          onClick={() => setCollapsed(v => !v)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>

        <div
          className="w-1 h-4 rounded-full flex-shrink-0"
          style={{ backgroundColor: projectColor }}
        />

        {editingSection ? (
          <input
            autoFocus
            defaultValue={section.name}
            className="text-sm font-semibold text-gray-800 border-b border-gray-300 outline-none bg-transparent"
            onBlur={e => { onRenameSection(section.id, e.target.value); setEditingSection(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') setEditingSection(false)
            }}
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-700">{section.name}</span>
            <button
              onClick={() => setEditingSection(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 p-0.5 rounded"
            >
              <Pencil size={12} />
            </button>
          </div>
        )}

        <span className="text-xs text-gray-400">({lines.length})</span>
      </div>

      {!collapsed && (
        <div
          ref={setNodeRef}
          className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-colors ${
            isOver ? 'border-[#EB4628] ring-2 ring-[#EB4628]/20' : 'border-gray-200'
          }`}
        >
          {/* Table header */}
          <div className="grid grid-cols-[44px_2fr_1fr_2fr_1fr_1fr_1fr_40px] gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wide">
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = !allSelected && someSelected }}
              onChange={() => onToggleSectionSelect(section.id)}
              className="w-3.5 h-3.5 rounded border-gray-300 cursor-pointer accent-[#EB4628]"
              title={allSelected ? 'Selectie wissen' : 'Alles selecteren'}
            />
            <span>Taak</span>
            <span>Owner</span>
            <span>Voortgang</span>
            <span>Status</span>
            <span>Prio</span>
            <span>Due date</span>
            <span />
          </div>

          <SortableContext items={lines.map(l => l.id)} strategy={verticalListSortingStrategy}>
            {lines.map(line => (
              <SortableRow
                key={line.id}
                line={line}
                editingName={editingName}
                chatLineId={chatLineId}
                selected={selectedIds.has(line.id)}
                stats={messageStats[line.id]}
                onEditName={onEditName}
                onSaveName={onSaveName}
                onUpdate={onUpdate}
                onChatToggle={onChatToggle}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </SortableContext>

          <div className="px-4 py-2.5">
            <button
              onClick={() => onAddLine(section.id)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#e63a1e] transition-colors"
            >
              <Plus size={14} />
              <span>Taak toevoegen</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
