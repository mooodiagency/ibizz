'use client'

import { useEffect, useState } from 'react'
import { FileText, ExternalLink, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Notulen, Project } from '@/lib/supabase/types'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import NotulenEditor from './NotulenEditor'

type Props = {
  onClose: () => void
  projectId?: string
  projectName?: string
}

const RED = '#EB4628'

export default function NotulenPanel({ onClose, projectId, projectName }: Props) {
  const [notulen, setNotulen] = useState<Notulen[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Notulen | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const notulenQuery = projectId
      ? supabase.from('notulen').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
      : supabase.from('notulen').select('*').order('created_at', { ascending: false })

    Promise.all([
      notulenQuery,
      supabase.from('projects').select('*').order('created_at'),
    ]).then(([notRes, projRes]) => {
      setNotulen((notRes.data ?? []) as Notulen[])
      setProjects((projRes.data ?? []) as Project[])
      setLoading(false)
    })
  }, [projectId])

  function projectFor(id: string | null): Project | undefined {
    return projects.find(p => p.id === id)
  }

  function handleSaved(updated: Notulen) {
    setNotulen(prev => prev.map(n => n.id === updated.id ? updated : n))
  }

  function handleDeleted(id: string) {
    setNotulen(prev => prev.filter(n => n.id !== id))
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 flex items-start justify-end" onClick={onClose}>
        <div
          className="h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="h-1.5" style={{ backgroundColor: RED }} />
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={16} style={{ color: RED }} className="flex-shrink-0" />
              <h2 className="text-sm font-semibold text-gray-800 truncate">
                {projectName ? `Notulen — ${projectName}` : 'Notulen'}
              </h2>
              <span className="text-xs text-gray-400 flex-shrink-0">{notulen.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <a
                href="/notulist"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#EB4628] transition-colors"
                title="Nieuwe notulen opnemen"
              >
                <ExternalLink size={15} />
              </a>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-5 py-12 text-center text-sm text-gray-400">Laden…</div>
            ) : notulen.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <FileText size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700 mb-1">Nog geen notulen</p>
                <p className="text-xs text-gray-400 mb-4">Open de Notulist app om je eerste vergadering op te nemen</p>
                <a
                  href="/notulist"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: RED }}
                >
                  <ExternalLink size={12} />
                  Open Notulist
                </a>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notulen.map(n => {
                  const project = projectFor(n.project_id)
                  return (
                    <button
                      key={n.id}
                      onClick={() => setEditing(n)}
                      className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{n.title}</h3>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {format(new Date(n.created_at), 'd MMM', { locale: nl })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {n.client_name && (
                          <span className="text-xs text-gray-500">{n.client_name}</span>
                        )}
                        {project && !projectId && (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color ?? '#6366f1' }} />
                            <span className="text-gray-500">{project.name}</span>
                          </span>
                        )}
                        {!project && !n.client_name && !projectId && (
                          <span className="text-xs text-gray-300 italic">geen project</span>
                        )}
                      </div>
                      {n.samenvatting && (
                        <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
                          {n.samenvatting}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <NotulenEditor
          notulen={editing}
          projects={projects}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </>
  )
}
