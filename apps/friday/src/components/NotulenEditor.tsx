'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Download, Save, Loader2, FileText, Pencil, History, ChevronDown, ChevronRight, ListPlus, CheckCircle2 } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { Select, IbizzMark } from '@ibizz/ui'
import { useAuth } from '@/lib/auth/AuthContext'
import type { Notulen, Project, NotulenEdit, ProjectSection } from '@ibizz/supabase'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

type Props = {
  notulen: Notulen
  projects: Project[]
  onClose: () => void
  onSaved: (updated: Notulen) => void
  onDeleted: (id: string) => void
}

type Mode = 'view' | 'edit' | 'history'
const RED = '#EB4628'

const FIELD_LABELS: Record<string, string> = {
  title: 'Titel',
  client_name: 'Klant',
  project_id: 'Project',
  datum: 'Datum',
  aanwezig: 'Aanwezig',
  samenvatting: 'Samenvatting',
  agendapunten: 'Agendapunten',
  besluiten: 'Besluiten',
  actiepunten: 'Actiepunten',
  volgende_vergadering: 'Volgende vergadering',
}

export default function NotulenEditor({ notulen, projects, onClose, onSaved, onDeleted }: Props) {
  const { profile } = useAuth()
  const [n, setN] = useState<Notulen>(notulen)
  const [original, setOriginal] = useState<Notulen>(notulen)
  const [mode, setMode] = useState<Mode>('view')
  const [saving, setSaving] = useState(false)
  const [fixingName, setFixingName] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addingTaskIdx, setAddingTaskIdx] = useState<number | null>(null)
  const [sectionPickerIdx, setSectionPickerIdx] = useState<number | null>(null)
  const [sections, setSections] = useState<ProjectSection[]>([])
  const [edits, setEdits] = useState<NotulenEdit[]>([])
  const [editsLoaded, setEditsLoaded] = useState(false)
  const lastFixedNameRef = useRef(notulen.client_name ?? '')
  const supabase = createClient()

  useEffect(() => { setN(notulen); setOriginal(notulen) }, [notulen])

  // Sections van het gekoppelde project ophalen
  useEffect(() => {
    if (!n.project_id) { setSections([]); return }
    supabase
      .from('project_sections')
      .select('*')
      .eq('project_id', n.project_id)
      .order('sort_order')
      .then(({ data }) => setSections((data ?? []) as ProjectSection[]))
  }, [n.project_id])

  // Lazy load history when needed
  useEffect(() => {
    if (mode === 'history' && !editsLoaded) {
      supabase
        .from('notulen_edits')
        .select('*')
        .eq('notulen_id', n.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setEdits((data ?? []) as NotulenEdit[])
          setEditsLoaded(true)
        })
    }
  }, [mode, editsLoaded, n.id])

  function update<K extends keyof Notulen>(key: K, value: Notulen[K]) {
    setN(prev => ({ ...prev, [key]: value }))
  }

  function startEdit() {
    setOriginal(n)
    setMode('edit')
  }

  function cancelEdit() {
    setN(original)
    setMode('view')
  }

  function projectName(id: string | null): string {
    if (!id) return ''
    return projects.find(p => p.id === id)?.name ?? ''
  }

  function computeDiff(): { field: string; old: string; new: string }[] {
    const changes: { field: string; old: string; new: string }[] = []
    function check(field: string, o: unknown, c: unknown) {
      const os = typeof o === 'string' ? o : (o == null ? '' : JSON.stringify(o))
      const cs = typeof c === 'string' ? c : (c == null ? '' : JSON.stringify(c))
      if (os !== cs) changes.push({ field, old: os, new: cs })
    }
    check('title', original.title, n.title)
    check('client_name', original.client_name ?? '', n.client_name ?? '')
    check('project_id', projectName(original.project_id), projectName(n.project_id))
    check('datum', original.datum ?? '', n.datum ?? '')
    check('aanwezig', original.aanwezig.join(', '), n.aanwezig.join(', '))
    check('samenvatting', original.samenvatting ?? '', n.samenvatting ?? '')
    check('agendapunten', original.agendapunten, n.agendapunten)
    check('besluiten', original.besluiten, n.besluiten)
    check('actiepunten', original.actiepunten, n.actiepunten)
    check('volgende_vergadering', original.volgende_vergadering ?? '', n.volgende_vergadering ?? '')
    return changes
  }

  async function save() {
    const changes = computeDiff()
    if (changes.length === 0) {
      setMode('view')
      return
    }
    setSaving(true)

    const { data, error } = await supabase
      .from('notulen')
      .update({
        title: n.title,
        client_name: n.client_name,
        project_id: n.project_id,
        datum: n.datum,
        aanwezig: n.aanwezig,
        samenvatting: n.samenvatting,
        agendapunten: n.agendapunten,
        besluiten: n.besluiten,
        actiepunten: n.actiepunten,
        volgende_vergadering: n.volgende_vergadering,
        updated_at: new Date().toISOString(),
      })
      .eq('id', n.id)
      .select()
      .single()

    if (!error && data) {
      // Log de edit
      await supabase.from('notulen_edits').insert({
        notulen_id: n.id,
        user_id: profile?.id ?? null,
        user_name: profile?.name ?? 'Onbekend',
        changes,
      })
      onSaved(data as Notulen)
      setOriginal(data as Notulen)
      setEditsLoaded(false) // forceer reload bij volgende open
      setMode('view')
    }
    setSaving(false)
  }

  async function downloadPDF() {
    const { generateNotulenPDF } = await import('@ibizz/pdf')
    generateNotulenPDF({
      datum: n.datum ?? '',
      aanwezig: n.aanwezig,
      samenvatting: n.samenvatting ?? '',
      agendapunten: n.agendapunten,
      besluiten: n.besluiten,
      actiepunten: n.actiepunten,
      volgende_vergadering: n.volgende_vergadering,
    })
  }

  async function deleteNotulen() {
    await supabase.from('notulen').delete().eq('id', n.id)
    onDeleted(n.id)
    onClose()
  }

  async function addActiepuntAsTask(idx: number, sectionIdInput?: string) {
    const ap = n.actiepunten[idx]
    if (!n.project_id || !ap.actie.trim() || ap.task_id) return
    setSectionPickerIdx(null)
    setAddingTaskIdx(idx)

    // Sectie kiezen, of fallback: eerste sectie / Algemeen aanmaken
    let sectionId: string | null = sectionIdInput ?? null
    if (!sectionId) {
      if (sections.length > 0) {
        sectionId = sections[0].id
      } else {
        const { data: newSec } = await supabase
          .from('project_sections')
          .insert({ project_id: n.project_id, name: 'Algemeen', sort_order: 0 })
          .select('*')
          .single()
        if (newSec) {
          sectionId = newSec.id
          setSections([newSec as ProjectSection])
        }
      }
    }
    if (!sectionId) { setAddingTaskIdx(null); return }

    // Volgorde
    const { count } = await supabase
      .from('project_lines')
      .select('id', { count: 'exact', head: true })
      .eq('section_id', sectionId)

    // Datum parsen
    const due = parseDeadline(ap.deadline)

    const { data: task } = await supabase
      .from('project_lines')
      .insert({
        project_id: n.project_id,
        section_id: sectionId,
        name: ap.actie,
        owner_name: ap.eigenaar,
        due_date: due,
        start_date: new Date().toISOString().split('T')[0],
        sort_order: count ?? 0,
        status: 'todo',
      })
      .select('id')
      .single()

    if (task) {
      const updated = [...n.actiepunten]
      updated[idx] = { ...ap, task_id: task.id }
      await supabase
        .from('notulen')
        .update({ actiepunten: updated, updated_at: new Date().toISOString() })
        .eq('id', n.id)
      const updatedNotulen = { ...n, actiepunten: updated }
      setN(updatedNotulen)
      setOriginal(updatedNotulen)
      onSaved(updatedNotulen)
    }
    setAddingTaskIdx(null)
  }

  async function fixClientName(name: string) {
    const trimmed = name.trim()
    if (!trimmed || trimmed === lastFixedNameRef.current) return
    lastFixedNameRef.current = trimmed
    setFixingName(true)
    try {
      const res = await fetch('/api/notulen-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notulen: {
            datum: n.datum,
            aanwezig: n.aanwezig,
            samenvatting: n.samenvatting,
            agendapunten: n.agendapunten,
            besluiten: n.besluiten,
            actiepunten: n.actiepunten,
            volgende_vergadering: n.volgende_vergadering,
          },
          correctName: trimmed,
        }),
      })
      if (res.ok) {
        const c = await res.json()
        setN(prev => ({
          ...prev,
          datum: c.datum ?? prev.datum,
          aanwezig: c.aanwezig ?? prev.aanwezig,
          samenvatting: c.samenvatting ?? prev.samenvatting,
          agendapunten: c.agendapunten ?? prev.agendapunten,
          besluiten: c.besluiten ?? prev.besluiten,
          actiepunten: c.actiepunten ?? prev.actiepunten,
          volgende_vergadering: c.volgende_vergadering ?? prev.volgende_vergadering,
        }))
      }
    } catch { /* stilletjes */ } finally { setFixingName(false) }
  }

  const project = projects.find(p => p.id === n.project_id)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-1.5" style={{ backgroundColor: RED }} />
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} style={{ color: RED }} className="flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-800 truncate">{n.title}</span>
            {mode === 'edit' && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 flex-shrink-0">Bewerken</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {mode !== 'edit' && (
              <button
                onClick={() => setMode(mode === 'history' ? 'view' : 'history')}
                className={`p-1.5 rounded-lg transition-colors ${mode === 'history' ? 'bg-gray-100 text-gray-700' : 'hover:bg-gray-100 text-gray-400'}`}
                title="Geschiedenis"
              >
                <History size={15} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {mode === 'view' && (
            <ViewMode
              n={n}
              project={project}
              sections={sections}
              addingTaskIdx={addingTaskIdx}
              sectionPickerIdx={sectionPickerIdx}
              onTaskClick={(idx) => {
                if (sections.length <= 1) {
                  addActiepuntAsTask(idx)
                } else {
                  setSectionPickerIdx(idx === sectionPickerIdx ? null : idx)
                }
              }}
              onPickSection={addActiepuntAsTask}
              onClosePicker={() => setSectionPickerIdx(null)}
            />
          )}
          {mode === 'edit' && (
            <EditMode
              n={n}
              update={update}
              projects={projects}
              fixingName={fixingName}
              onFixClient={fixClientName}
            />
          )}
          {mode === 'history' && <HistoryMode edits={edits} loaded={editsLoaded} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          {mode === 'view' && (
            <>
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                Verwijderen
              </button>
              <div className="flex gap-2">
                <button
                  onClick={downloadPDF}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <Download size={14} />
                  PDF
                </button>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: RED }}
                >
                  <Pencil size={14} />
                  Bewerken
                </button>
              </div>
            </>
          )}

          {mode === 'edit' && (
            <>
              <span className="text-xs text-gray-400">Wijzigingen worden gelogd</span>
              <div className="flex gap-2">
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: RED }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Opslaan
                </button>
              </div>
            </>
          )}

          {mode === 'history' && (
            <>
              <span className="text-xs text-gray-400">{edits.length} wijziging{edits.length !== 1 ? 'en' : ''}</span>
              <button
                onClick={() => setMode('view')}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Terug
              </button>
            </>
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">Notulen verwijderen?</h3>
            <p className="text-xs text-gray-400 text-center mb-6">Dit kan niet ongedaan worden gemaakt.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Annuleren
              </button>
              <button onClick={deleteNotulen} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600">
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 8px 14px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        :global(.input:focus) {
          border-color: ${RED};
        }
      `}</style>
    </div>
  )
}

function parseDeadline(s: string | null): string | null {
  if (!s) return null
  const trimmed = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0]
  return null
}

// ─── VIEW MODE ──────────────────────────────────────────────────────────
type ViewModeProps = {
  n: Notulen
  project?: Project
  sections: ProjectSection[]
  addingTaskIdx: number | null
  sectionPickerIdx: number | null
  onTaskClick: (idx: number) => void
  onPickSection: (idx: number, sectionId: string) => void
  onClosePicker: () => void
}

function ViewMode({ n, project, sections, addingTaskIdx, sectionPickerIdx, onTaskClick, onPickSection, onClosePicker }: ViewModeProps) {
  return (
    <div className="px-6 py-5 space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 pb-3 border-b border-gray-100">
        {n.client_name && <span><b className="text-gray-700">Klant:</b> {n.client_name}</span>}
        {project && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color ?? '#6366f1' }} />
            <b className="text-gray-700">Project:</b> {project.name}
          </span>
        )}
        {n.datum && <span><b className="text-gray-700">Datum:</b> {n.datum}</span>}
        {n.aanwezig.length > 0 && <span><b className="text-gray-700">Aanwezig:</b> {n.aanwezig.join(', ')}</span>}
        {n.created_by_name && <span><b className="text-gray-700">Aangemaakt door:</b> {n.created_by_name}</span>}
      </div>

      {n.samenvatting && (
        <ViewSection title="Samenvatting">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{n.samenvatting}</p>
        </ViewSection>
      )}

      {n.agendapunten.length > 0 && (
        <ViewSection title="Agendapunten">
          <div className="space-y-3">
            {n.agendapunten.map((item, i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-gray-800">{i + 1}. {item.titel}</p>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed whitespace-pre-wrap">{item.toelichting}</p>
              </div>
            ))}
          </div>
        </ViewSection>
      )}

      {n.besluiten.length > 0 && (
        <ViewSection title="Besluiten">
          <ul className="space-y-1.5">
            {n.besluiten.map((b, i) => (
              <li key={i} className="text-sm text-gray-600 flex gap-2">
                <span style={{ color: RED }}>→</span>
                {b}
              </li>
            ))}
          </ul>
        </ViewSection>
      )}

      {n.actiepunten.length > 0 && (
        <ViewSection title="Actiepunten">
          <div className="space-y-2">
            {n.actiepunten.map((ap, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-4 h-4 mt-0.5 rounded border-2 border-gray-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{ap.actie}</p>
                  {(ap.eigenaar || ap.deadline) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[ap.eigenaar, ap.deadline].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 relative">
                  {ap.task_id ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 px-2 py-1">
                      <CheckCircle2 size={12} />
                      In project
                    </span>
                  ) : !n.project_id ? (
                    <span className="text-[10px] text-gray-300 italic" title="Koppel eerst een project">
                      geen project
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => onTaskClick(i)}
                        disabled={addingTaskIdx === i}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                        style={{ backgroundColor: RED }}
                        title={`Toevoegen als taak in ${project?.name ?? 'project'}`}
                      >
                        {addingTaskIdx === i
                          ? <Loader2 size={11} className="animate-spin" />
                          : <ListPlus size={11} />}
                        Taak
                      </button>
                      {sectionPickerIdx === i && sections.length > 1 && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={onClosePicker} />
                          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 min-w-[160px]">
                            <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">Kies sectie</p>
                            {sections.map(s => (
                              <button
                                key={s.id}
                                onClick={() => onPickSection(i, s.id)}
                                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                {s.name}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ViewSection>
      )}

      {n.volgende_vergadering && (
        <ViewSection title="Volgende vergadering">
          <p className="text-sm text-gray-600">{n.volgende_vergadering}</p>
        </ViewSection>
      )}
    </div>
  )
}

function ViewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: RED }} />
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ─── EDIT MODE ──────────────────────────────────────────────────────────
type EditModeProps = {
  n: Notulen
  update: <K extends keyof Notulen>(key: K, value: Notulen[K]) => void
  projects: Project[]
  fixingName: boolean
  onFixClient: (name: string) => void
}

function EditMode({ n, update, projects, fixingName, onFixClient }: EditModeProps) {
  return (
    <div className="px-6 py-5 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Titel">
          <input value={n.title} onChange={e => update('title', e.target.value)} className="input" />
        </Field>
        <Field label={
          <span className="flex items-center gap-2">
            Klant
            {fixingName && (
              <span className="flex items-center gap-1 text-[10px] normal-case text-gray-400 font-normal">
                <IbizzMark size={11} animate className="text-[#EB4628]" />
                naam corrigeren…
              </span>
            )}
          </span>
        }>
          <input
            value={n.client_name ?? ''}
            onChange={e => update('client_name', e.target.value || null)}
            onBlur={e => onFixClient(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Datum">
          <input value={n.datum ?? ''} onChange={e => update('datum', e.target.value || null)} className="input" />
        </Field>
        <Field label="Project">
          <Select
            value={n.project_id ?? ''}
            onChange={v => update('project_id', v || null)}
            placeholder="Geen project"
            options={[
              { value: '', label: 'Geen project' },
              ...projects.map(p => ({ value: p.id, label: p.name })),
            ]}
            className="w-full"
          />
        </Field>
      </div>

      <Field label="Aanwezig">
        <ChipInput
          values={n.aanwezig}
          onChange={v => update('aanwezig', v)}
          placeholder="Naam toevoegen + Enter"
        />
      </Field>

      <Field label="Samenvatting">
        <textarea value={n.samenvatting ?? ''} onChange={e => update('samenvatting', e.target.value)} rows={3} className="input resize-none" />
      </Field>

      <SectionGroup label="Agendapunten" onAdd={() => update('agendapunten', [...n.agendapunten, { titel: '', toelichting: '' }])}>
        {n.agendapunten.map((item, i) => (
          <ItemCard key={i} onRemove={() => update('agendapunten', n.agendapunten.filter((_, j) => j !== i))}>
            <input
              value={item.titel}
              onChange={e => {
                const next = [...n.agendapunten]
                next[i] = { ...item, titel: e.target.value }
                update('agendapunten', next)
              }}
              placeholder="Titel"
              className="input font-semibold"
            />
            <textarea
              value={item.toelichting}
              onChange={e => {
                const next = [...n.agendapunten]
                next[i] = { ...item, toelichting: e.target.value }
                update('agendapunten', next)
              }}
              placeholder="Toelichting"
              rows={2}
              className="input mt-2 text-xs resize-none"
            />
          </ItemCard>
        ))}
      </SectionGroup>

      <SectionGroup label="Besluiten" onAdd={() => update('besluiten', [...n.besluiten, ''])}>
        {n.besluiten.map((b, i) => (
          <ItemCard key={i} onRemove={() => update('besluiten', n.besluiten.filter((_, j) => j !== i))}>
            <input
              value={b}
              onChange={e => {
                const next = [...n.besluiten]
                next[i] = e.target.value
                update('besluiten', next)
              }}
              placeholder="Besluit"
              className="input"
            />
          </ItemCard>
        ))}
      </SectionGroup>

      <SectionGroup label="Actiepunten" onAdd={() => update('actiepunten', [...n.actiepunten, { actie: '', eigenaar: null, deadline: null }])}>
        {n.actiepunten.map((ap, i) => (
          <ItemCard key={i} onRemove={() => update('actiepunten', n.actiepunten.filter((_, j) => j !== i))}>
            <input
              value={ap.actie}
              onChange={e => {
                const next = [...n.actiepunten]
                next[i] = { ...ap, actie: e.target.value }
                update('actiepunten', next)
              }}
              placeholder="Actie"
              className="input"
            />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input
                value={ap.eigenaar ?? ''}
                onChange={e => {
                  const next = [...n.actiepunten]
                  next[i] = { ...ap, eigenaar: e.target.value || null }
                  update('actiepunten', next)
                }}
                placeholder="Eigenaar"
                className="input text-xs"
              />
              <input
                value={ap.deadline ?? ''}
                onChange={e => {
                  const next = [...n.actiepunten]
                  next[i] = { ...ap, deadline: e.target.value || null }
                  update('actiepunten', next)
                }}
                placeholder="Deadline"
                className="input text-xs"
              />
            </div>
          </ItemCard>
        ))}
      </SectionGroup>

      <Field label="Volgende vergadering">
        <input
          value={n.volgende_vergadering ?? ''}
          onChange={e => update('volgende_vergadering', e.target.value || null)}
          placeholder="Datum en tijd"
          className="input"
        />
      </Field>
    </div>
  )
}

// ─── HISTORY MODE ───────────────────────────────────────────────────────
function HistoryMode({ edits, loaded }: { edits: NotulenEdit[]; loaded: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!loaded) {
    return <div className="px-6 py-12 text-center text-sm text-gray-400">Laden…</div>
  }

  if (edits.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <History size={28} className="text-gray-200 mx-auto mb-3" />
        <p className="text-sm font-semibold text-gray-700 mb-1">Nog geen wijzigingen</p>
        <p className="text-xs text-gray-400">Bewerkingen verschijnen hier zodra iemand iets aanpast.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-50">
      {edits.map(edit => {
        const isExpanded = expanded === edit.id
        const fields = edit.changes.map(c => FIELD_LABELS[c.field] ?? c.field)
        return (
          <div key={edit.id}>
            <button
              onClick={() => setExpanded(isExpanded ? null : edit.id)}
              className="w-full text-left px-6 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3"
            >
              {isExpanded ? <ChevronDown size={14} className="mt-0.5 text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="mt-0.5 text-gray-400 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-800">{edit.user_name ?? 'Onbekend'}</span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(edit.created_at), "d MMM yyyy 'om' HH:mm", { locale: nl })}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {edit.changes.length} wijziging{edit.changes.length !== 1 ? 'en' : ''} · {fields.slice(0, 3).join(', ')}
                  {fields.length > 3 && ` +${fields.length - 3}`}
                </p>
              </div>
            </button>

            {isExpanded && (
              <div className="px-6 pb-4 pl-12 space-y-3">
                {edit.changes.map((c, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                      {FIELD_LABELS[c.field] ?? c.field}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-[10px] text-gray-400 mb-1 uppercase">Vorig</p>
                        <p className="text-red-700 bg-red-50 rounded p-2 break-words whitespace-pre-wrap font-mono text-[11px]">
                          {c.old || <span className="italic opacity-60">leeg</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-1 uppercase">Nieuw</p>
                        <p className="text-green-700 bg-green-50 rounded p-2 break-words whitespace-pre-wrap font-mono text-[11px]">
                          {c.new || <span className="italic opacity-60">leeg</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── HELPERS ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  )
}

function SectionGroup({ label, onAdd, children }: { label: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#EB4628] transition-colors"
        >
          <Plus size={12} />
          Toevoegen
        </button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ItemCard({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 group relative">
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
      >
        <Trash2 size={12} />
      </button>
      {children}
    </div>
  )
}

function ChipInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setInput('')
  }
  return (
    <div className="border border-gray-200 rounded-xl px-3 py-2 flex flex-wrap gap-2 focus-within:border-[#EB4628]">
      {values.map((v, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-700">
          {v}
          <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
          if (e.key === 'Backspace' && !input && values.length) onChange(values.slice(0, -1))
        }}
        onBlur={add}
        placeholder={values.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] outline-none text-sm"
      />
    </div>
  )
}
