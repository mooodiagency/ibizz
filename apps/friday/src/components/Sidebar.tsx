'use client'

import { useState, useEffect, useRef } from 'react'
import type { Project } from '@ibizz/supabase'
import { Plus, Trash2, LayoutDashboard, AppWindow } from 'lucide-react'

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#e63a1e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
]

type Props = {
  projects: Project[]
  activeId: string | null
  showOverview: boolean
  showApps: boolean
  onSelect: (id: string) => void
  onOverview: () => void
  onApps: () => void
  onAdd: () => void
  onColorChange: (id: string, color: string) => void
  onDelete: (id: string) => void
}

export default function Sidebar({ projects, activeId, showOverview, showApps, onSelect, onOverview, onApps, onAdd, onColorChange, onDelete }: Props) {
  const [openPickerId, setOpenPickerId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpenPickerId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const confirmProject = projects.find(p => p.id === confirmDeleteId)

  return (
    <div className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Nav */}
      <div className="px-2 py-3 border-b border-gray-100 space-y-0.5">
        <button
          onClick={onOverview}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            showOverview ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <LayoutDashboard size={15} className={showOverview ? 'text-[#EB4628]' : 'text-gray-400'} />
          Overzicht
        </button>
        <button
          onClick={onApps}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            showApps ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <AppWindow size={15} className={showApps ? 'text-[#EB4628]' : 'text-gray-400'} />
          Apps
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        <div className="px-4 mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Projecten</span>
          <button
            onClick={onAdd}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-[#EB4628] transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="space-y-0.5 px-2">
          {projects.map(p => (
            <div key={p.id} className="group relative">
              <button
                onClick={() => onSelect(p.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  activeId === p.id ? 'bg-gray-100 font-medium' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {/* Color dot */}
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-transparent hover:ring-gray-300 transition-all cursor-pointer"
                  style={{ backgroundColor: p.color ?? '#6366f1' }}
                  onClick={e => {
                    e.stopPropagation()
                    setOpenPickerId(prev => prev === p.id ? null : p.id)
                  }}
                />
                <span className="truncate flex-1" style={{ color: activeId === p.id ? (p.color ?? '#6366f1') : undefined }}>
                  {p.name}
                </span>

                {/* Delete button — verschijnt bij hover */}
                <span
                  onClick={e => { e.stopPropagation(); setConfirmDeleteId(p.id) }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-50 text-gray-300 hover:text-red-400"
                >
                  <Trash2 size={13} />
                </span>
              </button>

              {/* Color picker */}
              {openPickerId === p.id && (
                <div
                  ref={pickerRef}
                  className="absolute left-8 top-9 z-50 bg-white border border-gray-200 rounded-xl shadow-lg p-3 flex flex-wrap gap-2 w-40"
                  onClick={e => e.stopPropagation()}
                >
                  {COLORS.map(c => (
                    <button
                      key={c}
                      className="w-6 h-6 rounded-full hover:scale-110 transition-transform"
                      style={{
                        backgroundColor: c,
                        outline: p.color === c ? `3px solid ${c}` : 'none',
                        outlineOffset: '2px',
                      }}
                      onClick={() => { onColorChange(p.id, c); setOpenPickerId(null) }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmProject && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-1">Project verwijderen</h3>
            <p className="text-sm text-gray-500 text-center mb-1">
              Weet je zeker dat je
            </p>
            <p className="text-sm font-semibold text-gray-800 text-center mb-4">
              "{confirmProject.name}"
            </p>
            <p className="text-xs text-gray-400 text-center mb-6">
              Alle taken, secties en chatberichten worden permanent verwijderd. Dit kan niet ongedaan worden.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={() => { onDelete(confirmProject.id); setConfirmDeleteId(null) }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
