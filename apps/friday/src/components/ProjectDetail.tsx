'use client'

import { useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { createClient } from '@ibizz/supabase'
import { useAuth } from '@/lib/auth/AuthContext'
import type { ProjectLine, ProjectSection } from '@ibizz/supabase'

export type MessageStats = { total: number; unread: number }
import SectionBlock from './SectionBlock'
import LineChat from './LineChat'
import NotulenPanel from './NotulenPanel'
import { Plus, FileText, Trash2, X } from 'lucide-react'

type Props = { projectId: string; projectName: string; projectColor: string; userName: string }

export default function ProjectDetail({ projectId, projectName, projectColor, userName }: Props) {
  const { user } = useAuth()
  const [sections, setSections] = useState<ProjectSection[]>([])
  const [lines, setLines] = useState<ProjectLine[]>([])
  const [chatLineId, setChatLineId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string | null>(null)
  const [notulenOpen, setNotulenOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [messageStats, setMessageStats] = useState<Record<string, MessageStats>>({})
  const supabase = createClient()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    setChatLineId(null)
    setSelectedIds(new Set())

    // Load sections
    supabase
      .from('project_sections')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const secs = data ?? []
        setSections(secs)
        // Auto-create a default section if none exist
        if (secs.length === 0) {
          supabase
            .from('project_sections')
            .insert({ project_id: projectId, name: 'Algemeen', sort_order: 0 })
            .select()
            .single()
            .then(({ data: s }) => { if (s) setSections([s]) })
        }
      })

    // Load lines
    supabase
      .from('project_lines')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => setLines(data ?? []))

    // Realtime
    const ch = supabase
      .channel(`detail-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_lines', filter: `project_id=eq.${projectId}` }, () => {
        supabase.from('project_lines').select('*').eq('project_id', projectId).order('sort_order').then(({ data }) => setLines(data ?? []))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_sections', filter: `project_id=eq.${projectId}` }, () => {
        supabase.from('project_sections').select('*').eq('project_id', projectId).order('sort_order').then(({ data }) => setSections(data ?? []))
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [projectId])

  // Berichten stats per taak (totaal + ongelezen voor huidige user)
  useEffect(() => {
    if (!user || lines.length === 0) { setMessageStats({}); return }
    const lineIds = lines.map(l => l.id)

    Promise.all([
      supabase.from('line_messages').select('line_id, created_at').in('line_id', lineIds),
      supabase.from('line_views').select('line_id, last_viewed_at').eq('user_id', user.id).in('line_id', lineIds),
    ]).then(([msgRes, viewRes]) => {
      const viewedAt = new Map<string, number>()
      ;(viewRes.data ?? []).forEach(v => viewedAt.set(v.line_id, new Date(v.last_viewed_at).getTime()))

      const stats: Record<string, MessageStats> = {}
      ;(msgRes.data ?? []).forEach(m => {
        if (!stats[m.line_id]) stats[m.line_id] = { total: 0, unread: 0 }
        stats[m.line_id].total++
        const v = viewedAt.get(m.line_id)
        if (!v || new Date(m.created_at).getTime() > v) stats[m.line_id].unread++
      })
      setMessageStats(stats)
    })

    // Realtime: nieuwe berichten verhogen unread voor andere users
    const ch = supabase
      .channel(`msg-stats-${projectId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'line_messages' },
        (payload) => {
          const m = payload.new as { line_id: string; user_id: string | null }
          if (!lineIds.includes(m.line_id)) return
          setMessageStats(prev => {
            const next = { ...prev }
            const cur = next[m.line_id] ?? { total: 0, unread: 0 }
            const isOwnMessage = m.user_id === user.id
            next[m.line_id] = {
              total: cur.total + 1,
              unread: isOwnMessage ? cur.unread : cur.unread + 1,
            }
            return next
          })
        })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [lines.map(l => l.id).join(','), user?.id])

  async function addSection() {
    const { data } = await supabase
      .from('project_sections')
      .insert({ project_id: projectId, name: 'Nieuwe sectie', sort_order: sections.length })
      .select().single()
    if (data) setSections(prev => [...prev, data])
  }

  async function renameSection(id: string, name: string) {
    await supabase.from('project_sections').update({ name }).eq('id', id)
    setSections(prev => prev.map(s => s.id === id ? { ...s, name } : s))
  }

  async function addLine(sectionId: string) {
    const sectionLines = lines.filter(l => l.section_id === sectionId)
    await supabase.from('project_lines').insert({
      project_id: projectId,
      section_id: sectionId,
      name: 'Nieuwe taak',
      start_date: new Date().toISOString().split('T')[0],
      sort_order: sectionLines.length,
    })
  }

  async function markLineViewed(lineId: string) {
    if (!user) return
    setMessageStats(prev => {
      const cur = prev[lineId]
      if (!cur || cur.unread === 0) return prev
      return { ...prev, [lineId]: { ...cur, unread: 0 } }
    })
    const { error } = await supabase.from('line_views').upsert(
      {
        user_id: user.id,
        line_id: lineId,
        last_viewed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,line_id' }
    )
    if (error) {
      console.error('line_views upsert raw:', error)
      console.error('line_views upsert keys:', Object.keys(error))
      console.error('line_views upsert string:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
  }

  function handleChatToggle(id: string) {
    const opening = chatLineId !== id
    setChatLineId(opening ? id : null)
    if (opening) markLineViewed(id)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSectionSelect(sectionId: string) {
    const sectionLineIds = lines.filter(l => l.section_id === sectionId).map(l => l.id)
    const allSelected = sectionLineIds.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) {
        sectionLineIds.forEach(id => next.delete(id))
      } else {
        sectionLineIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds)
    setSelectedIds(new Set())
    setConfirmBulkDelete(false)
    setLines(prev => prev.filter(l => !ids.includes(l.id)))
    await supabase.from('project_lines').delete().in('id', ids)
  }

  async function updateLine(id: string, patch: Partial<ProjectLine>) {
    await supabase.from('project_lines').update(patch).eq('id', id)
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeLine = lines.find(l => l.id === active.id)
    if (!activeLine) return

    // Bepaal target sectie + index
    const overId = String(over.id)
    let targetSectionId: string | null
    let targetIndex: number

    if (overId.startsWith('section:')) {
      // Gedropt op leeg sectie-gebied → onderaan toevoegen
      targetSectionId = overId.slice('section:'.length)
      targetIndex = lines.filter(l => l.section_id === targetSectionId).length
    } else {
      const overLine = lines.find(l => l.id === over.id)
      if (!overLine) return
      targetSectionId = overLine.section_id
      const targetSecLines = lines.filter(l => l.section_id === targetSectionId)
      targetIndex = targetSecLines.findIndex(l => l.id === over.id)
    }

    if (activeLine.section_id === targetSectionId) {
      // Reorder binnen dezelfde sectie
      const sectionLines = lines.filter(l => l.section_id === targetSectionId)
      const oldIndex = sectionLines.findIndex(l => l.id === active.id)
      if (oldIndex === targetIndex) return
      const reordered = arrayMove(sectionLines, oldIndex, targetIndex)
      setLines(prev => {
        const others = prev.filter(l => l.section_id !== targetSectionId)
        return [...others, ...reordered]
      })
      await Promise.all(
        reordered.map((line, i) =>
          supabase.from('project_lines').update({ sort_order: i }).eq('id', line.id)
        )
      )
    } else {
      // Cross-section move
      const sourceLines = lines
        .filter(l => l.section_id === activeLine.section_id && l.id !== active.id)
      const targetLines = lines.filter(l => l.section_id === targetSectionId)
      const moved: ProjectLine = { ...activeLine, section_id: targetSectionId }
      targetLines.splice(targetIndex, 0, moved)

      const otherLines = lines.filter(
        l => l.section_id !== activeLine.section_id && l.section_id !== targetSectionId
      )
      setLines([...otherLines, ...sourceLines, ...targetLines])

      // Persist: section_id + sort_order van beide secties
      await supabase
        .from('project_lines')
        .update({ section_id: targetSectionId })
        .eq('id', String(active.id))
      await Promise.all([
        ...sourceLines.map((line, i) =>
          supabase.from('project_lines').update({ sort_order: i }).eq('id', line.id)
        ),
        ...targetLines.map((line, i) =>
          supabase.from('project_lines').update({ sort_order: i }).eq('id', line.id)
        ),
      ])
    }
  }

  const chatLine = lines.find(l => l.id === chatLineId)

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Project header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: projectColor }} />
              <h1 className="text-xl font-bold text-gray-900">{projectName}</h1>
            </div>
            <button
              onClick={() => setNotulenOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              title="Notulen van dit project"
            >
              <FileText size={13} />
              Notulen
            </button>
          </div>

          {/* Sections */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            {sections.map(section => (
              <SectionBlock
                key={section.id}
                section={section}
                lines={lines.filter(l => l.section_id === section.id)}
                projectColor={projectColor}
                editingName={editingName}
                chatLineId={chatLineId}
                selectedIds={selectedIds}
                onEditName={setEditingName}
                onSaveName={(id, val) => { updateLine(id, { name: val }); setEditingName(null) }}
                onUpdate={updateLine}
                onChatToggle={handleChatToggle}
                messageStats={messageStats}
                onAddLine={addLine}
                onRenameSection={renameSection}
                onToggleSelect={toggleSelect}
                onToggleSectionSelect={toggleSectionSelect}
              />
            ))}
          </DndContext>

          {/* Add section */}
          <button
            onClick={addSection}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#e63a1e] transition-colors mt-2"
          >
            <Plus size={15} />
            <span>Sectie toevoegen</span>
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white rounded-2xl shadow-2xl border border-gray-200 px-2 py-2 flex items-center gap-1">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#EB4628' }}>
              {selectedIds.size}
            </span>
            <span className="text-sm font-semibold text-gray-700">geselecteerd</span>
          </div>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <button
            onClick={() => setConfirmBulkDelete(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
            Verwijderen
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <button
            onClick={clearSelection}
            className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="Selectie wissen"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Bulk delete confirm */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmBulkDelete(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">
              {selectedIds.size === 1 ? '1 taak' : `${selectedIds.size} taken`} verwijderen?
            </h3>
            <p className="text-xs text-gray-400 text-center mb-6">
              Dit kan niet ongedaan worden gemaakt. Alle bijbehorende chatberichten worden ook verwijderd.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmBulkDelete(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Annuleren
              </button>
              <button onClick={bulkDelete} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600">
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notulen panel */}
      {notulenOpen && (
        <NotulenPanel
          projectId={projectId}
          projectName={projectName}
          onClose={() => setNotulenOpen(false)}
        />
      )}

      {/* Chat panel */}
      {chatLine && (
        <div className="w-72 flex-shrink-0">
          <LineChat
            lineId={chatLine.id}
            lineName={chatLine.name}
            userName={userName}
            onClose={() => setChatLineId(null)}
          />
        </div>
      )}
    </div>
  )
}
