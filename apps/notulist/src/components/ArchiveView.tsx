'use client'

import { useEffect, useMemo, useState } from 'react'
import { Archive, Search, FileText, Loader2, Calendar, Users } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { createClient } from '@ibizz/supabase'
import type { Notulen, Project } from '@ibizz/supabase'
import NotulenDetailModal from './NotulenDetailModal'

const RED = '#EB4628'

export default function ArchiveView() {
  const [notulen, setNotulen] = useState<Notulen[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [detail, setDetail] = useState<Notulen | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Belangrijk: GEEN transcript ophalen in de lijst — die kan megabytes groot
    // zijn (vooral met WhisperX + speaker labels) en faalt dan met "Load failed".
    // Transcript wordt apart geladen in NotulenDetailModal.
    const NOTULEN_LIST_FIELDS = 'id,project_id,title,client_name,datum,aanwezig,samenvatting,agendapunten,besluiten,actiepunten,volgende_vergadering,created_by,created_by_name,created_at'

    Promise.all([
      supabase.from('notulen').select(NOTULEN_LIST_FIELDS).order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('name'),
    ]).then(([nRes, pRes]) => {
      if (nRes.error) console.error('Notulen fetch error:', nRes.error)
      // transcript wordt null gezet voor list view — pas gefetched in detail
      const list = (nRes.data ?? []).map(n => ({ ...n, transcript: null })) as Notulen[]
      setNotulen(list)
      setProjects((pRes.data ?? []) as Project[])
      setLoading(false)
    }).catch(err => {
      console.error('Archive load failed:', err)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return notulen.filter(n => {
      if (projectFilter === 'no-project' && n.project_id) return false
      if (projectFilter !== 'all' && projectFilter !== 'no-project' && n.project_id !== projectFilter) return false
      if (q) {
        const haystack = [
          n.title,
          n.client_name ?? '',
          n.samenvatting ?? '',
          (n.aanwezig ?? []).join(' '),
        ].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [notulen, search, projectFilter])

  function projectFor(id: string | null): Project | undefined {
    return projects.find(p => p.id === id)
  }

  function handleDeleted(id: string) {
    setNotulen(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Archive size={18} style={{ color: RED }} />
          <div>
            <h1 className="text-lg font-bold text-gray-900">Archief</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {notulen.length} {notulen.length === 1 ? 'notulen' : 'notulen'} totaal
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-8 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none bg-white focus:border-[#EB4628] cursor-pointer font-medium text-gray-700 transition-colors appearance-none pr-8 bg-no-repeat bg-right"
          style={{
            backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundPosition: 'right 0.5rem center',
            backgroundSize: '12px',
          }}
        >
          <option value="all">Alle projecten</option>
          <option value="no-project">Zonder project</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="ml-auto relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Zoeken in titel, klant, samenvatting…"
            className="text-xs border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 outline-none focus:border-[#EB4628] w-72"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={20} className="animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <FileText size={32} className="text-gray-200 mb-3" />
            <p className="text-sm font-semibold text-gray-700 mb-1">
              {notulen.length === 0 ? 'Nog geen notulen' : 'Geen resultaten'}
            </p>
            <p className="text-xs text-gray-400">
              {notulen.length === 0
                ? 'Neem je eerste vergadering op via "Nieuw opnemen"'
                : 'Probeer een andere zoekterm of filter'}
            </p>
          </div>
        ) : (
          <div className="px-8 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(n => {
              const project = projectFor(n.project_id)
              return (
                <button
                  key={n.id}
                  onClick={() => setDetail(n)}
                  className="text-left bg-white border border-gray-200 rounded-2xl p-5 hover:border-[#EB4628] hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1">{n.title}</h3>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                      {format(new Date(n.created_at), 'd MMM', { locale: nl })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-3 text-xs">
                    {n.client_name && (
                      <span className="text-gray-500">{n.client_name}</span>
                    )}
                    {project && (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color ?? '#6366f1' }} />
                        {project.name}
                      </span>
                    )}
                    {!project && !n.client_name && (
                      <span className="text-gray-300 italic text-[11px]">geen project</span>
                    )}
                  </div>

                  {n.samenvatting && (
                    <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed mb-3">
                      {n.samenvatting}
                    </p>
                  )}

                  <div className="flex items-center gap-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                    {n.aanwezig && n.aanwezig.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users size={10} />
                        {n.aanwezig.length}
                      </span>
                    )}
                    {n.actiepunten && n.actiepunten.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {n.actiepunten.length} acties
                      </span>
                    )}
                    {n.created_by_name && (
                      <span className="ml-auto italic truncate">{n.created_by_name}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {detail && (
        <NotulenDetailModal
          notulen={detail}
          projects={projects}
          onClose={() => setDetail(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
