'use client'

import { useState } from 'react'
import { ArrowLeft, Trash2, MessageCircleQuestion, Radar, Settings } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { Select } from '@ibizz/ui'
import type { GeoProject, GeoProjectStatus, Brand } from '@ibizz/supabase'
import PromptsView from './PromptsView'

type Props = {
  project: GeoProject
  brand: Brand | undefined
  onBack: () => void
  onUpdated: (p: GeoProject) => void
  onDeleted: (id: string) => void
}

type Tab = 'prompts' | 'simulations' | 'settings'

const STATUS_PILL: Record<GeoProjectStatus, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  archived: 'bg-gray-100 text-gray-400',
}
const STATUS_LABEL: Record<GeoProjectStatus, string> = {
  active: 'Actief', paused: 'Gepauzeerd', archived: 'Gearchiveerd',
}

export default function ProjectDetail({ project, brand, onBack, onUpdated, onDeleted }: Props) {
  const [tab, setTab] = useState<Tab>('prompts')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const supabase = createClient()

  async function patch(partial: Partial<Omit<GeoProject, 'id' | 'created_at'>>) {
    const { data } = await supabase.from('geo_projects').update(partial).eq('id', project.id).select().single()
    if (data) onUpdated(data as GeoProject)
  }
  async function deleteProject() {
    await supabase.from('geo_projects').delete().eq('id', project.id)
    onDeleted(project.id)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800">
            <ArrowLeft size={14} /> Projecten
          </button>
          <div className="flex items-center gap-2">
            <Select variant="badge" value={project.status}
              onChange={v => patch({ status: v as GeoProjectStatus })}
              options={(Object.keys(STATUS_LABEL) as GeoProjectStatus[]).map(s => ({ value: s, label: STATUS_LABEL[s], className: STATUS_PILL[s] }))} />
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-1">
          {brand && (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand.color }} />
              <span className="font-semibold">{brand.name}</span>
            </span>
          )}
          <span className="text-xs text-gray-400">· {project.market} · {project.competitors.length} concurrenten</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>

        {/* Tabs */}
        <div className="flex gap-1 mt-3 -mb-px">
          <TabBtn icon={<MessageCircleQuestion size={13} />} label="Vragen" active={tab === 'prompts'} onClick={() => setTab('prompts')} />
          <TabBtn icon={<Radar size={13} />} label="Simulaties" active={tab === 'simulations'} onClick={() => setTab('simulations')} />
          <TabBtn icon={<Settings size={13} />} label="Instellingen" active={tab === 'settings'} onClick={() => setTab('settings')} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'prompts' && <PromptsView project={project} />}
        {tab === 'simulations' && (
          <div className="px-8 py-10 max-w-2xl">
            <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center mx-auto mb-3">
                <Radar size={20} className="text-[#7c3aed]" />
              </div>
              <p className="text-sm font-semibold text-gray-800 mb-1">Simulaties komen in de volgende stap</p>
              <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
                Hier draaien we straks de vragen écht tegen Claude (+ later Gemini/GPT/Perplexity): word je merk genoemd?
                op welke positie? welke concurrenten en bronnen worden geciteerd? Met een scorecard (Share of Voice,
                citatie-bronnen, sentiment) en tracking over tijd. Vul eerst je vragen-set onder &ldquo;Vragen&rdquo;.
              </p>
            </div>
          </div>
        )}
        {tab === 'settings' && (
          <div className="px-8 py-6 max-w-2xl space-y-4">
            <SettingsBlock label="Merk-termen" values={project.brand_terms}
              onSave={v => patch({ brand_terms: v })} placeholder="Naam/variant waarop we 't merk herkennen" />
            <SettingsBlock label="Concurrenten" values={project.competitors}
              onSave={v => patch({ competitors: v })} placeholder="Concurrent" />
            <SettingsBlock label="Topics" values={project.topics}
              onSave={v => patch({ topics: v })} placeholder="Topic / categorie" />
          </div>
        )}
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4"><Trash2 size={22} className="text-red-500" /></div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">Project verwijderen?</h3>
            <p className="text-xs text-gray-400 text-center mb-6">&ldquo;{project.name}&rdquo; en alle vragen/simulaties worden permanent verwijderd.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">Annuleren</button>
              <button onClick={deleteProject} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600">Verwijderen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
        active ? 'text-[#EB4628] border-[#EB4628]' : 'text-gray-500 hover:text-gray-700 border-transparent'
      }`}>
      {icon}{label}
    </button>
  )
}

function SettingsBlock({ label, values, onSave, placeholder }: { label: string; values: string[]; onSave: (v: string[]) => void; placeholder: string }) {
  const [local, setLocal] = useState(values.join(', '))
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input value={local} onChange={e => setLocal(e.target.value)}
        onBlur={() => onSave(local.split(',').map(s => s.trim()).filter(Boolean))}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628]" />
      <p className="text-[10px] text-gray-400 mt-1">Komma-gescheiden. Opslaan bij verlaten veld.</p>
    </div>
  )
}
