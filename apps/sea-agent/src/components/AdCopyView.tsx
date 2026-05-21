'use client'

import { useState } from 'react'
import {
  FileText, Loader2, AlertCircle, RotateCcw, ChevronDown, ChevronRight,
  Edit2, Save, X, Plus, Sparkles,
} from 'lucide-react'
import type { SeaKeywordResearch, SeaCampaign, SeaAdCopy } from '@ibizz/supabase'
import { createClient } from '@ibizz/supabase'
import AIChatPanel from './AIChatPanel'

type Props = {
  briefId: string
  research: SeaKeywordResearch | null
  onUpdated: (r: SeaKeywordResearch) => void
}

const HL_LIMIT = 30
const DESC_LIMIT = 90

/**
 * Karakter teller met kleur-feedback:
 *  - grijs: < 80% van limiet
 *  - amber: 80-100% van limiet (laatste 20% — let op)
 *  - rood + vet: over limiet (maxLength voorkomt typen erover, maar bij plakken kan het)
 */
function CharCount({ length, limit, className = '' }: { length: number; limit: number; className?: string }) {
  const ratio = length / limit
  const over = length > limit
  const close = ratio >= 0.8 && !over
  const color = over
    ? 'text-red-600 font-bold'
    : close
      ? 'text-amber-600 font-semibold'
      : 'text-gray-400'
  return (
    <span className={`text-[10px] tabular-nums ${color} ${className}`} title={over ? `Boven limiet (${limit})` : undefined}>
      {length}/{limit}
    </span>
  )
}

const SEGMENT_COLORS: Record<string, string> = {
  branded: 'bg-purple-100 text-purple-700',
  'non-branded': 'bg-blue-100 text-blue-700',
  pmax: 'bg-orange-100 text-orange-700',
}

export default function AdCopyView({ briefId, research, onUpdated }: Props) {
  const [generating, setGenerating] = useState(false)
  const [generatingGroup, setGeneratingGroup] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [expandedCampaign, setExpandedCampaign] = useState<number | null>(0)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null) // "ci-gi"
  const [draftAdCopy, setDraftAdCopy] = useState<SeaAdCopy | null>(null)
  const supabase = createClient()

  // Empty state — no research yet
  if (!research) {
    return (
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={16} style={{ color: '#EB4628' }} />
          <h2 className="text-sm font-bold text-gray-800">Ad Copy</h2>
        </div>
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 bg-gray-100">
            <FileText size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No keywords yet</p>
          <p className="text-xs text-gray-400">Generate keywords first, then come back here.</p>
        </div>
      </section>
    )
  }

  const totalGroups = research.campaigns.reduce((s, c) => s + c.ad_groups.length, 0)
  const groupsWithCopy = research.campaigns.reduce(
    (s, c) => s + c.ad_groups.filter(g => g.ad_copy && g.ad_copy.headlines.length > 0).length,
    0,
  )
  const allDone = groupsWithCopy === totalGroups

  async function generateAll() {
    if (!research) return
    setGenerating(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch('/api/generate-ad-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchId: research.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Generate failed')
      onUpdated(json.research)
      setInfo(`Generated ${json.stats.generated}/${json.stats.total_groups} ad groups${json.stats.errors > 0 ? ` (${json.stats.errors} failed)` : ''}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setGenerating(false)
    }
  }

  async function regenerateGroup(ci: number, gi: number) {
    if (!research) return
    const key = `${ci}-${gi}`
    setGeneratingGroup(key)
    setError(null)
    try {
      const res = await fetch('/api/generate-ad-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchId: research.id, onlyCampaign: ci, onlyGroup: gi }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Regenerate failed')
      onUpdated(json.research)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Regenerate failed')
    } finally {
      setGeneratingGroup(null)
    }
  }

  function startEdit(ci: number, gi: number) {
    const ad = research?.campaigns[ci].ad_groups[gi].ad_copy
    if (!ad) return
    setDraftAdCopy({
      headlines: [...ad.headlines],
      descriptions: [...ad.descriptions],
      generated_at: ad.generated_at,
    })
    setEditing(`${ci}-${gi}`)
  }

  async function saveEdit(ci: number, gi: number) {
    if (!research || !draftAdCopy) return
    const campaigns: SeaCampaign[] = JSON.parse(JSON.stringify(research.campaigns))
    campaigns[ci].ad_groups[gi].ad_copy = draftAdCopy
    const { data, error: err } = await supabase
      .from('sea_keyword_research')
      .update({ campaigns, updated_at: new Date().toISOString() })
      .eq('id', research.id)
      .select()
      .single()
    if (!err && data) {
      onUpdated(data as SeaKeywordResearch)
      setEditing(null)
      setDraftAdCopy(null)
    }
  }

  return (
    <div className="space-y-4">
    <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText size={16} style={{ color: '#EB4628' }} />
          <h2 className="text-sm font-bold text-gray-800">Ad Copy</h2>
          <span className="text-xs text-gray-400">
            · {groupsWithCopy}/{totalGroups} ad groups
          </span>
        </div>
        <button
          onClick={generateAll}
          disabled={generating || totalGroups === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#EB4628' }}
        >
          {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          {generating ? 'Generating…' : allDone ? 'Regenerate all' : 'Generate all'}
        </button>
      </div>

      {info && (
        <div className="px-6 py-2 bg-green-50 border-b border-green-100 text-xs text-green-700">{info}</div>
      )}
      {error && (
        <div className="px-6 py-2 bg-red-50 border-b border-red-100 text-xs text-red-700 flex items-center gap-1.5">
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      {/* Tree */}
      <div className="px-6 py-4 space-y-3">
        {research.campaigns.map((campaign, ci) => {
          const cExpanded = expandedCampaign === ci
          return (
            <div key={ci} className="border border-gray-200 rounded-xl overflow-hidden">
              <div
                className="px-4 py-3 bg-gray-50 flex items-center gap-2 cursor-pointer hover:bg-gray-100"
                onClick={() => setExpandedCampaign(cExpanded ? null : ci)}
              >
                {cExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                <span className="font-semibold text-sm text-gray-800">{campaign.name}</span>
                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${SEGMENT_COLORS[campaign.segment]}`}>
                  {campaign.segment}
                </span>
                <span className="ml-auto text-xs text-gray-500">
                  {campaign.ad_groups.filter(g => g.ad_copy?.headlines.length).length}/{campaign.ad_groups.length} done
                </span>
              </div>

              {cExpanded && (
                <div className="px-4 py-3 space-y-2">
                  {campaign.ad_groups.map((group, gi) => {
                    const gKey = `${ci}-${gi}`
                    const gExpanded = expandedGroup === gKey
                    const isEditing = editing === gKey
                    const isRegenerating = generatingGroup === gKey
                    const ad = group.ad_copy

                    return (
                      <div key={gi} className="border border-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="px-3 py-2 bg-white flex items-center gap-2 cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedGroup(gExpanded ? null : gKey)}
                        >
                          {gExpanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                          <span className="text-sm font-semibold text-gray-800">{group.name}</span>
                          {ad && ad.headlines.length > 0 ? (
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                              {ad.headlines.length}H · {ad.descriptions.length}D
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">empty</span>
                          )}
                          <span className="ml-auto" />
                          <button
                            onClick={e => { e.stopPropagation(); regenerateGroup(ci, gi) }}
                            disabled={!!generatingGroup || generating}
                            className="text-gray-400 hover:text-[#EB4628] flex items-center gap-1 text-[11px] disabled:opacity-50"
                            title={ad ? 'Regenerate this ad group' : 'Generate this ad group'}
                          >
                            {isRegenerating
                              ? <Loader2 size={11} className="animate-spin" />
                              : ad ? <RotateCcw size={11} /> : <Sparkles size={11} />}
                          </button>
                        </div>

                        {gExpanded && (
                          <div className="px-3 py-3 bg-gray-50 space-y-3">
                            {!ad || ad.headlines.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">
                                No ad copy yet. Click ✨ above or use &quot;Generate all&quot;.
                              </p>
                            ) : isEditing && draftAdCopy ? (
                              <EditPanel
                                ad={draftAdCopy}
                                onChange={setDraftAdCopy}
                                onCancel={() => { setEditing(null); setDraftAdCopy(null) }}
                                onSave={() => saveEdit(ci, gi)}
                              />
                            ) : (
                              <ViewPanel ad={ad} onEdit={() => startEdit(ci, gi)} />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>

    {research && (
      <AIChatPanel
        briefId={briefId}
        step="adcopy"
        currentOutput={research.campaigns}
        onIterated={async () => {
          const { data } = await supabase.from('sea_keyword_research').select('*').eq('brief_id', briefId).single()
          if (data) onUpdated(data as SeaKeywordResearch)
        }}
      />
    )}
    </div>
  )
}

function ViewPanel({ ad, onEdit }: { ad: SeaAdCopy; onEdit: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
          Headlines ({ad.headlines.length}/15) · Descriptions ({ad.descriptions.length}/4)
        </p>
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800"
        >
          <Edit2 size={10} />
          Edit
        </button>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Headlines</p>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-1 text-xs">
          {ad.headlines.map((h, i) => (
            <li key={i} className="flex items-center gap-1.5 bg-white rounded px-2 py-1 border border-gray-100">
              <span className="text-gray-300 text-[10px] w-3">{i + 1}</span>
              <span className="flex-1 truncate text-gray-700" title={h}>{h}</span>
              <CharCount length={h.length} limit={HL_LIMIT} />
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Descriptions</p>
        <ol className="space-y-1 text-xs">
          {ad.descriptions.map((d, i) => (
            <li key={i} className="flex items-start gap-1.5 bg-white rounded px-2 py-1.5 border border-gray-100">
              <span className="text-gray-300 text-[10px] w-3 mt-0.5">{i + 1}</span>
              <span className="flex-1 text-gray-700 leading-relaxed">{d}</span>
              <CharCount length={d.length} limit={DESC_LIMIT} className="mt-0.5" />
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function EditPanel({ ad, onChange, onCancel, onSave }: {
  ad: SeaAdCopy
  onChange: (a: SeaAdCopy) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Headlines (max 15, ≤30 chars)</p>
        <div className="space-y-1">
          {ad.headlines.map((h, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-gray-300 text-[10px] w-4">{i + 1}</span>
              <input
                value={h}
                maxLength={30}
                onChange={e => {
                  const next = [...ad.headlines]
                  next[i] = e.target.value
                  onChange({ ...ad, headlines: next })
                }}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-[#EB4628]"
              />
              <CharCount length={h.length} limit={HL_LIMIT} className="w-10 text-right" />
              <button
                onClick={() => onChange({ ...ad, headlines: ad.headlines.filter((_, j) => j !== i) })}
                className="text-gray-400 hover:text-red-500"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          {ad.headlines.length < 15 && (
            <button
              onClick={() => onChange({ ...ad, headlines: [...ad.headlines, ''] })}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#EB4628] mt-1"
            >
              <Plus size={11} />
              Add headline
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Descriptions (max 4, ≤90 chars)</p>
        <div className="space-y-1">
          {ad.descriptions.map((d, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-gray-300 text-[10px] w-4 mt-1.5">{i + 1}</span>
              <textarea
                value={d}
                maxLength={90}
                rows={2}
                onChange={e => {
                  const next = [...ad.descriptions]
                  next[i] = e.target.value
                  onChange({ ...ad, descriptions: next })
                }}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-[#EB4628] resize-none"
              />
              <CharCount length={d.length} limit={DESC_LIMIT} className="w-12 text-right mt-1.5" />
              <button
                onClick={() => onChange({ ...ad, descriptions: ad.descriptions.filter((_, j) => j !== i) })}
                className="text-gray-400 hover:text-red-500 mt-1.5"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          {ad.descriptions.length < 4 && (
            <button
              onClick={() => onChange({ ...ad, descriptions: [...ad.descriptions, ''] })}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-[#EB4628] mt-1"
            >
              <Plus size={11} />
              Add description
            </button>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
          Cancel
        </button>
        <button
          onClick={onSave}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: '#EB4628' }}
        >
          <Save size={11} />
          Save
        </button>
      </div>
    </div>
  )
}

