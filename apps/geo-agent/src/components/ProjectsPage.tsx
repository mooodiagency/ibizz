'use client'

import { useEffect, useState } from 'react'
import { Plus, Satellite, Loader2 } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { GeoProject, Brand } from '@ibizz/supabase'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import NewProjectModal from './NewProjectModal'
import ProjectDetail from './ProjectDetail'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-400',
}
const STATUS_LABELS: Record<string, string> = {
  active: 'Actief', paused: 'Gepauzeerd', archived: 'Gearchiveerd',
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<GeoProject[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from('geo_projects').select('*').order('created_at', { ascending: false }),
      supabase.from('brands').select('*'),
    ]).then(([pRes, bRes]) => {
      setProjects((pRes.data ?? []) as GeoProject[])
      setBrands((bRes.data ?? []) as Brand[])
      setLoading(false)
    })
  }, [])

  function brandById(id: string | null) { return id ? brands.find(b => b.id === id) : undefined }
  const active = projects.find(p => p.id === activeId)

  if (active) {
    return (
      <ProjectDetail
        project={active}
        brand={brandById(active.brand_id)}
        onBack={() => setActiveId(null)}
        onUpdated={u => setProjects(prev => prev.map(p => p.id === u.id ? u : p))}
        onDeleted={id => { setProjects(prev => prev.filter(p => p.id !== id)); setActiveId(null) }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">GEO Projecten</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitor je AI-zichtbaarheid per merk</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: '#EB4628' }}>
          <Plus size={15} /> Nieuw project
        </button>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Satellite size={26} className="text-gray-300" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">Nog geen projecten</p>
            <p className="text-sm text-gray-400 mb-5">Maak een project aan om te meten hoe vaak je merk in AI-antwoorden verschijnt</p>
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: '#EB4628' }}>
              <Plus size={14} /> Nieuw project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => {
              const brand = brandById(p.brand_id)
              return (
                <button key={p.id} onClick={() => setActiveId(p.id)}
                  className="bg-white border border-gray-200 rounded-2xl p-5 text-left hover:shadow-md hover:border-gray-300 transition-all">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-sm font-bold text-gray-900 line-clamp-2">{p.name}</h3>
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded flex-shrink-0 ${STATUS_COLORS[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  {brand && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand.color }} />
                      <span className="text-xs text-gray-600">{brand.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {p.topics.slice(0, 3).map(t => (
                      <span key={t} className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{t}</span>
                    ))}
                    {p.topics.length > 3 && <span className="text-[10px] text-gray-400">+{p.topics.length - 3}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 pt-3 border-t border-gray-100">
                    <span>{p.market}</span>
                    <span>· {p.competitors.length} concurrenten</span>
                    <span className="ml-auto">{format(new Date(p.created_at), 'd MMM yyyy', { locale: nl })}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {creating && (
        <NewProjectModal onClose={() => setCreating(false)} onCreated={p => setProjects(prev => [p, ...prev])} />
      )}
    </div>
  )
}
