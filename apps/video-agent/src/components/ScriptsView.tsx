'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Loader2, Film, Plus, ChevronsUpDown, ChevronsDownUp } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { VideoScript } from '@ibizz/supabase'
import GenerateScriptsModal from './GenerateScriptsModal'
import ScriptCard from './ScriptCard'

type Props = {
  briefId: string
  onCountChanged?: (n: number) => void
}

export default function ScriptsView({ briefId, onCountChanged }: Props) {
  const [scripts, setScripts] = useState<VideoScript[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [allExpanded, setAllExpanded] = useState(false)
  const [expandedKey, setExpandedKey] = useState(0)  // bump on expand-all to remount cards
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('video_scripts')
      .select('*')
      .eq('brief_id', briefId)
      .order('nummer', { ascending: true })
      .then(({ data }) => {
        const list = (data ?? []) as VideoScript[]
        setScripts(list)
        onCountChanged?.(list.length)
        setLoading(false)
      })
  }, [briefId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleGenerated(newScripts: VideoScript[], mode: 'replace' | 'append') {
    const updated = mode === 'replace' ? newScripts : [...scripts, ...newScripts].sort((a, b) => a.nummer - b.nummer)
    setScripts(updated)
    onCountChanged?.(updated.length)
  }

  function handleScriptUpdated(updated: VideoScript) {
    setScripts(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  function handleScriptDeleted(id: string) {
    const next = scripts.filter(s => s.id !== id)
    setScripts(next)
    onCountChanged?.(next.length)
  }

  function toggleAll() {
    setAllExpanded(!allExpanded)
    setExpandedKey(k => k + 1)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    )
  }

  if (scripts.length === 0) {
    return (
      <>
        <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-50 to-rose-50 flex items-center justify-center mb-3">
            <Film size={20} className="text-[#EB4628]" />
          </div>
          <p className="text-sm font-semibold text-gray-800 mb-1">Nog geen scripts</p>
          <p className="text-xs text-gray-500 mb-4 max-w-md leading-relaxed">
            Laat AI scripts genereren op basis van de brand-context, cast en locaties die je
            hierboven hebt ingevuld. Elk script krijgt alle 14 velden ingevuld.
          </p>
          <button
            onClick={() => setGenerating(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: '#EB4628' }}
          >
            <Sparkles size={14} />
            Genereer scripts
          </button>
        </div>

        {generating && (
          <GenerateScriptsModal
            briefId={briefId}
            existingCount={0}
            onClose={() => setGenerating(false)}
            onGenerated={handleGenerated}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {scripts.length} {scripts.length === 1 ? 'script' : 'scripts'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAll}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100"
            >
              {allExpanded ? <ChevronsDownUp size={12} /> : <ChevronsUpDown size={12} />}
              {allExpanded ? 'Klap alles in' : 'Klap alles uit'}
            </button>
            <button
              onClick={() => setGenerating(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: '#EB4628' }}
            >
              <Plus size={12} />
              Meer scripts
            </button>
          </div>
        </div>

        {/* Cards */}
        {scripts.map(s => (
          <ScriptCard
            key={`${s.id}-${expandedKey}`}
            script={s}
            expandedDefault={allExpanded}
            onUpdated={handleScriptUpdated}
            onDeleted={handleScriptDeleted}
          />
        ))}
      </div>

      {generating && (
        <GenerateScriptsModal
          briefId={briefId}
          existingCount={scripts.length}
          onClose={() => setGenerating(false)}
          onGenerated={handleGenerated}
        />
      )}
    </>
  )
}
