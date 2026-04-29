'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@ibizz/supabase'
import { Plus, X, ExternalLink, Sparkles, FlaskConical } from 'lucide-react'

type App = {
  id: string
  name: string
  description: string | null
  icon: string
  color: string
  url: string | null
  status: 'active' | 'coming_soon' | 'beta'
  created_at: string
}

const STATUS = {
  active:      { label: 'Actief',        bg: 'bg-green-100',  text: 'text-green-700' },
  beta:        { label: 'Beta',          bg: 'bg-blue-100',   text: 'text-blue-700' },
  coming_soon: { label: 'Coming soon',   bg: 'bg-gray-100',   text: 'text-gray-500' },
}

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#EB4628','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#64748b']
const ICONS  = ['🚀','🎨','📊','🤖','📝','🔍','💡','🛠️','📱','🌐','🎯','⚡']

type AddForm = { name: string; description: string; icon: string; color: string; url: string; status: App['status'] }

export default function AppsPage() {
  const [apps, setApps] = useState<App[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<AddForm>({ name: '', description: '', icon: '🚀', color: '#6366f1', url: '', status: 'coming_soon' })
  const supabase = createClient()

  useEffect(() => {
    supabase.from('apps').select('*').order('created_at').then(({ data }) => setApps((data ?? []) as App[]))
  }, [])

  async function addApp() {
    if (!form.name.trim()) return
    const { data } = await supabase.from('apps').insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      icon: form.icon,
      color: form.color,
      url: form.url.trim() || null,
      status: form.status,
    }).select().single()
    if (data) setApps(prev => [...prev, data as App])
    setForm({ name: '', description: '', icon: '🚀', color: '#6366f1', url: '', status: 'coming_soon' })
    setAdding(false)
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Apps</h1>
            <p className="text-sm text-gray-500 mt-0.5">Interne tools van ibizz</p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#EB4628' }}
          >
            <Plus size={15} />
            App toevoegen
          </button>
        </div>

        {/* Apps grid */}
        {apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mb-4">🚀</div>
            <p className="text-base font-semibold text-gray-700 mb-1">Nog geen apps</p>
            <p className="text-sm text-gray-400">Voeg jullie eerste interne tool toe</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map(app => {
              const s = STATUS[app.status]
              return (
                <div key={app.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                  {/* Top color bar */}
                  <div className="h-1" style={{ backgroundColor: app.color }} />

                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      {/* Icon */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm"
                        style={{ backgroundColor: `${app.color}15` }}
                      >
                        {app.icon}
                      </div>

                      {/* Status badge */}
                      <div className="flex items-center gap-1.5">
                        {app.status === 'beta' && <FlaskConical size={11} className="text-blue-500" />}
                        {app.status === 'coming_soon' && <Sparkles size={11} className="text-gray-400" />}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
                          {s.label}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-1">{app.name}</h3>
                    {app.description && (
                      <p className="text-sm text-gray-500 leading-relaxed mb-4">{app.description}</p>
                    )}

                    {app.url && app.status !== 'coming_soon' ? (
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: app.color }}
                      >
                        Openen
                        <ExternalLink size={13} />
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-400 px-4 py-2 rounded-xl bg-gray-50">
                        <Sparkles size={13} />
                        Binnenkort beschikbaar
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add modal */}
      {adding && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAdding(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">App toevoegen</h2>
              <button onClick={() => setAdding(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${form.color}20` }}>
                {form.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{form.name || 'App naam'}</p>
                <p className="text-xs text-gray-400">{form.description || 'Omschrijving'}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Naam */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Naam</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="AI Image Generator"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#EB4628]"
                />
              </div>

              {/* Omschrijving */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Omschrijving</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Genereer afbeeldingen met AI"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#EB4628]"
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">URL</label>
                <input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#EB4628]"
                />
              </div>

              {/* Icoon */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Icoon</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(ic => (
                    <button
                      key={ic}
                      onClick={() => setForm(f => ({ ...f, icon: ic }))}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${form.icon === ic ? '' : 'hover:bg-gray-100'}`}
                      style={form.icon === ic ? { outline: `2px solid ${form.color}`, outlineOffset: '2px' } : {}}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kleur */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Kleur</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full hover:scale-110 transition-transform"
                      style={{ backgroundColor: c, outline: form.color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
                    />
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
                <div className="flex gap-2">
                  {(['active', 'beta', 'coming_soon'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                        form.status === s
                          ? 'border-[#EB4628] bg-red-50 text-[#EB4628]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {STATUS[s].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={addApp}
              disabled={!form.name.trim()}
              className="w-full mt-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#EB4628' }}
            >
              App toevoegen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
