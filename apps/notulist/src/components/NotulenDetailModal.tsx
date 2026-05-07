'use client'

import { useState } from 'react'
import { X, Download, Trash2, Calendar, Users, FileText, CheckCircle2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { createClient } from '@ibizz/supabase'
import type { Notulen, Project } from '@ibizz/supabase'

type Props = {
  notulen: Notulen
  projects: Project[]
  onClose: () => void
  onDeleted: (id: string) => void
}

const RED = '#EB4628'

export default function NotulenDetailModal({ notulen, projects, onClose, onDeleted }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  const project = projects.find(p => p.id === notulen.project_id)

  async function downloadPDF() {
    const { generateNotulenPDF } = await import('@ibizz/pdf')
    generateNotulenPDF({
      datum: notulen.datum ?? format(new Date(notulen.created_at), 'd MMMM yyyy', { locale: nl }),
      aanwezig: notulen.aanwezig ?? [],
      samenvatting: notulen.samenvatting ?? '',
      agendapunten: notulen.agendapunten ?? [],
      besluiten: notulen.besluiten ?? [],
      actiepunten: notulen.actiepunten ?? [],
      volgende_vergadering: notulen.volgende_vergadering ?? null,
    })
  }

  async function handleDelete() {
    setDeleting(true)
    await supabase.from('notulen').delete().eq('id', notulen.id)
    onDeleted(notulen.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Accent line */}
        <div className="h-1.5" style={{ backgroundColor: RED }} />

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900 truncate">{notulen.title}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {notulen.datum ?? format(new Date(notulen.created_at), 'd MMM yyyy', { locale: nl })}
              </span>
              {notulen.client_name && <span>· {notulen.client_name}</span>}
              {project && (
                <span className="flex items-center gap-1">
                  ·
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color ?? '#6366f1' }} />
                  {project.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={downloadPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: RED }}
              title="Download PDF"
            >
              <Download size={12} />
              PDF
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              title="Verwijderen"
            >
              <Trash2 size={14} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Aanwezig */}
          {notulen.aanwezig && notulen.aanwezig.length > 0 && (
            <Section icon={<Users size={14} />} title="Aanwezig">
              <p className="text-sm text-gray-600">{notulen.aanwezig.join(', ')}</p>
            </Section>
          )}

          {/* Samenvatting */}
          {notulen.samenvatting && (
            <Section icon={<FileText size={14} />} title="Samenvatting">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{notulen.samenvatting}</p>
            </Section>
          )}

          {/* Agendapunten */}
          {notulen.agendapunten && notulen.agendapunten.length > 0 && (
            <Section title="Agendapunten">
              <div className="space-y-3">
                {notulen.agendapunten.map((item, i) => (
                  <div key={i}>
                    <p className="text-sm font-semibold text-gray-800">{i + 1}. {item.titel}</p>
                    {item.toelichting && (
                      <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.toelichting}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Besluiten */}
          {notulen.besluiten && notulen.besluiten.length > 0 && (
            <Section title="Besluiten">
              <ul className="space-y-1.5">
                {notulen.besluiten.map((b, i) => (
                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                    <span style={{ color: RED }}>→</span>
                    {b}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Actiepunten */}
          {notulen.actiepunten && notulen.actiepunten.length > 0 && (
            <Section icon={<CheckCircle2 size={14} />} title="Actiepunten">
              <div className="space-y-2">
                {notulen.actiepunten.map((ap, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-4 h-4 mt-0.5 rounded border-2 border-gray-300 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-gray-800">{ap.actie}</p>
                      {(ap.eigenaar || ap.deadline) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {[ap.eigenaar, ap.deadline].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Volgende vergadering */}
          {notulen.volgende_vergadering && (
            <Section title="Volgende vergadering">
              <p className="text-sm text-gray-600">{notulen.volgende_vergadering}</p>
            </Section>
          )}

          {/* Meta */}
          <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
            <span>
              {notulen.created_by_name && `Opgenomen door ${notulen.created_by_name}`}
            </span>
            <span>{format(new Date(notulen.created_at), "d MMM yyyy 'om' HH:mm", { locale: nl })}</span>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">Notulen verwijderen?</h3>
            <p className="text-xs text-gray-400 text-center mb-6">&quot;{notulen.title}&quot; wordt permanent verwijderd.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Annuleren
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: RED }} />
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          {icon && <span className="text-gray-400">{icon}</span>}
          {title}
        </h3>
      </div>
      {children}
    </div>
  )
}
