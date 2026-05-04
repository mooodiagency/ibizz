'use client'

import { useState } from 'react'
import {
  KeyRound, Loader2, AlertCircle, Globe, Check, XCircle, RotateCcw, ChevronDown, ChevronRight,
  Edit2, Plus, Trash2, X, Save, BarChart3,
} from 'lucide-react'
import type { SeaKeywordResearch, SeaCampaign, SeaKeyword, SeaMatchType, SeaIntent } from '@ibizz/supabase'
import { createClient } from '@ibizz/supabase'

type Props = {
  briefId: string
  research: SeaKeywordResearch | null
  onUpdated: (r: SeaKeywordResearch) => void
}

const SEGMENT_COLORS: Record<string, string> = {
  branded: 'bg-purple-100 text-purple-700',
  'non-branded': 'bg-blue-100 text-blue-700',
  pmax: 'bg-orange-100 text-orange-700',
}

const INTENT_COLORS: Record<string, string> = {
  branded: 'bg-purple-50 text-purple-600',
  transactional: 'bg-green-50 text-green-600',
  commercial: 'bg-blue-50 text-blue-600',
  informational: 'bg-gray-50 text-gray-600',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
}

export default function KeywordResearchView({ briefId, research, onUpdated }: Props) {
  const [generating, setGenerating] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enrichInfo, setEnrichInfo] = useState<string | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState(research?.website_url ?? '')
  const [expandedCampaign, setExpandedCampaign] = useState<number | null>(0)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftCampaigns, setDraftCampaigns] = useState<SeaCampaign[]>(research?.campaigns ?? [])
  const supabase = createClient()

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, websiteUrl: websiteUrl.trim() || undefined }),
      })
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(msg)
      }
      const r: SeaKeywordResearch = await res.json()
      onUpdated(r)
      setDraftCampaigns(r.campaigns)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setGenerating(false)
    }
  }

  async function enrichWithAhrefs() {
    if (!research) return
    setEnriching(true)
    setError(null)
    setEnrichInfo(null)
    try {
      const res = await fetch('/api/enrich-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchId: research.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Enrich failed')
      const updated: SeaKeywordResearch = json.research
      onUpdated(updated)
      setDraftCampaigns(updated.campaigns)
      setEnrichInfo(`Enriched ${json.stats.enriched}/${json.stats.total_keywords} keywords (${json.stats.country.toUpperCase()})`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enrich failed')
    } finally {
      setEnriching(false)
    }
  }

  async function setStatus(status: SeaKeywordResearch['status']) {
    if (!research) return
    setUpdating(true)
    const { data, error: err } = await supabase
      .from('sea_keyword_research')
      .update({ status })
      .eq('id', research.id)
      .select()
      .single()
    setUpdating(false)
    if (!err && data) onUpdated(data as SeaKeywordResearch)
  }

  async function saveEdits() {
    if (!research) return
    setUpdating(true)
    const { data, error: err } = await supabase
      .from('sea_keyword_research')
      .update({ campaigns: draftCampaigns, updated_at: new Date().toISOString() })
      .eq('id', research.id)
      .select()
      .single()
    setUpdating(false)
    if (!err && data) {
      onUpdated(data as SeaKeywordResearch)
      setEditing(false)
    }
  }

  function startEdit() {
    setDraftCampaigns(research?.campaigns ?? [])
    setEditing(true)
  }

  function cancelEdit() {
    setDraftCampaigns(research?.campaigns ?? [])
    setEditing(false)
  }

  // Empty state
  if (!research) {
    return (
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={16} style={{ color: '#EB4628' }} />
          <h2 className="text-sm font-bold text-gray-800">Keyword Research</h2>
        </div>

        <div className="flex flex-col items-center text-center py-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#EB462815' }}>
            <KeyRound size={22} style={{ color: '#EB4628' }} />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No keywords yet</p>
          <p className="text-xs text-gray-400 mb-5 max-w-sm">
            Optionally paste a website URL — the AI will scrape it for context. Then it generates branded + non-branded campaigns with STAG ad groups.
          </p>

          <div className="w-full max-w-md flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com (optional)"
                className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-[#EB4628]"
              />
            </div>
          </div>

          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#EB4628' }}
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            {generating ? 'Generating…' : 'Generate keywords'}
          </button>

          {error && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={12} />
              {error}
            </p>
          )}
        </div>
      </section>
    )
  }

  const campaigns = editing ? draftCampaigns : research.campaigns
  const totalKeywords = campaigns.reduce((sum, c) => sum + c.ad_groups.reduce((s, g) => s + g.keywords.length, 0), 0)
  const totalAdGroups = campaigns.reduce((sum, c) => sum + c.ad_groups.length, 0)

  return (
    <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <KeyRound size={16} style={{ color: '#EB4628' }} />
          <h2 className="text-sm font-bold text-gray-800">Keyword Research</h2>
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_COLORS[research.status]}`}>
            {research.status}
          </span>
          <span className="text-xs text-gray-400">
            · {campaigns.length} campaigns · {totalAdGroups} ad groups · {totalKeywords} keywords
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!editing && (
            <>
              <button
                onClick={enrichWithAhrefs}
                disabled={enriching}
                className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-[#EB4628] disabled:opacity-50"
                title="Pull search volume + CPC + KD via Ahrefs"
              >
                {enriching ? <Loader2 size={11} className="animate-spin" /> : <BarChart3 size={11} />}
                Enrich (Ahrefs)
              </button>
              <button
                onClick={startEdit}
                className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
              >
                <Edit2 size={11} />
                Edit
              </button>
              <button
                onClick={generate}
                disabled={generating}
                className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-[#EB4628] disabled:opacity-50"
              >
                {generating ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>

      {enrichInfo && (
        <div className="px-6 py-2 bg-green-50 border-b border-green-100 text-xs text-green-700 flex items-center gap-1.5">
          <Check size={12} />
          {enrichInfo}
        </div>
      )}

      {research.scraped_summary && !editing && (
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Globe size={10} />
            Website context
          </p>
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{research.scraped_summary}</p>
        </div>
      )}

      {/* Campaigns */}
      <div className="px-6 py-4 space-y-3">
        {campaigns.map((campaign, ci) => {
          const campaignExpanded = expandedCampaign === ci
          return (
            <div key={ci} className="border border-gray-200 rounded-xl overflow-hidden">
              <div
                className="px-4 py-3 bg-gray-50 flex items-center gap-2 cursor-pointer hover:bg-gray-100"
                onClick={() => setExpandedCampaign(campaignExpanded ? null : ci)}
              >
                {campaignExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                {editing ? (
                  <input
                    value={campaign.name}
                    onChange={e => {
                      const next = [...draftCampaigns]
                      next[ci] = { ...next[ci], name: e.target.value }
                      setDraftCampaigns(next)
                    }}
                    onClick={e => e.stopPropagation()}
                    className="font-semibold text-sm text-gray-800 bg-white border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-[#EB4628]"
                  />
                ) : (
                  <span className="font-semibold text-sm text-gray-800">{campaign.name}</span>
                )}
                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${SEGMENT_COLORS[campaign.segment]}`}>
                  {campaign.segment}
                </span>
                <span className="text-[10px] text-gray-400">{campaign.type}</span>
                <span className="ml-auto text-xs text-gray-500">
                  {campaign.ad_groups.length} groups · {campaign.ad_groups.reduce((s, g) => s + g.keywords.length, 0)} kw
                </span>
                {editing && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setDraftCampaigns(prev => prev.filter((_, i) => i !== ci))
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {campaignExpanded && (
                <div className="px-4 py-3 space-y-2">
                  {campaign.ad_groups.map((group, gi) => {
                    const groupKey = `${ci}-${gi}`
                    const groupExpanded = expandedGroup === groupKey
                    return (
                      <div key={gi} className="border border-gray-100 rounded-lg overflow-hidden">
                        <div
                          className="px-3 py-2 bg-white flex items-center gap-2 cursor-pointer hover:bg-gray-50"
                          onClick={() => setExpandedGroup(groupExpanded ? null : groupKey)}
                        >
                          {groupExpanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                          {editing ? (
                            <input
                              value={group.name}
                              onChange={e => {
                                const next = [...draftCampaigns]
                                next[ci].ad_groups[gi] = { ...next[ci].ad_groups[gi], name: e.target.value }
                                setDraftCampaigns(next)
                              }}
                              onClick={e => e.stopPropagation()}
                              className="text-sm font-semibold text-gray-800 bg-white border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-[#EB4628]"
                            />
                          ) : (
                            <span className="text-sm font-semibold text-gray-800">{group.name}</span>
                          )}
                          <span className="text-xs text-gray-400 truncate flex-1">{group.theme}</span>
                          {(() => {
                            const totals = adGroupTotals(group.keywords)
                            return totals ? (
                              <>
                                <span className="text-[10px] text-gray-500" title="Total search volume">
                                  Vol: <b className="text-gray-700">{formatNumber(totals.totalVol)}</b>
                                </span>
                                {totals.avgCpc != null && (
                                  <span className="text-[10px] text-gray-500" title="Average CPC">
                                    CPC: <b className="text-gray-700">€{totals.avgCpc.toFixed(2)}</b>
                                  </span>
                                )}
                              </>
                            ) : null
                          })()}
                          <span className="text-xs text-gray-500">{group.keywords.length} kw</span>
                          {editing && (
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                const next = [...draftCampaigns]
                                next[ci].ad_groups = next[ci].ad_groups.filter((_, i) => i !== gi)
                                setDraftCampaigns(next)
                              }}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>

                        {groupExpanded && (
                          <div className="px-3 py-2 bg-gray-50 space-y-1">
                            {group.keywords.map((kw, ki) => (
                              <KeywordRow
                                key={ki}
                                keyword={kw}
                                editing={editing}
                                onChange={(updated) => {
                                  const next = [...draftCampaigns]
                                  next[ci].ad_groups[gi].keywords[ki] = updated
                                  setDraftCampaigns(next)
                                }}
                                onRemove={() => {
                                  const next = [...draftCampaigns]
                                  next[ci].ad_groups[gi].keywords = next[ci].ad_groups[gi].keywords.filter((_, i) => i !== ki)
                                  setDraftCampaigns(next)
                                }}
                              />
                            ))}
                            {editing && (
                              <button
                                onClick={() => {
                                  const next = [...draftCampaigns]
                                  next[ci].ad_groups[gi].keywords.push({
                                    text: '',
                                    match_type: 'phrase',
                                    intent: 'commercial',
                                  })
                                  setDraftCampaigns(next)
                                }}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#EB4628] py-1"
                              >
                                <Plus size={11} />
                                Add keyword
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {editing && (
                    <button
                      onClick={() => {
                        const next = [...draftCampaigns]
                        next[ci].ad_groups.push({
                          name: 'New ad group',
                          theme: '',
                          keywords: [],
                        })
                        setDraftCampaigns(next)
                      }}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#EB4628] py-1"
                    >
                      <Plus size={12} />
                      Add ad group
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={12} />
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">
          {research.created_by_name && `Generated by ${research.created_by_name}`}
        </span>
        {editing ? (
          <div className="flex gap-2">
            <button onClick={cancelEdit} className="px-4 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
              Cancel
            </button>
            <button
              onClick={saveEdits}
              disabled={updating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#EB4628' }}
            >
              {updating ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              Save
            </button>
          </div>
        ) : research.status === 'draft' ? (
          <div className="flex gap-2">
            <button
              onClick={() => setStatus('rejected')}
              disabled={updating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
            >
              <XCircle size={12} />
              Reject
            </button>
            <button
              onClick={() => setStatus('approved')}
              disabled={updating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#22c55e' }}
            >
              <Check size={12} />
              Approve
            </button>
          </div>
        ) : (
          <button
            onClick={() => setStatus('draft')}
            disabled={updating}
            className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800"
          >
            <RotateCcw size={11} />
            Reset to draft
          </button>
        )}
      </div>
    </section>
  )
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

function kdColor(kd: number | null | undefined): string {
  if (kd == null) return 'text-gray-400 bg-gray-50'
  if (kd < 30) return 'text-green-700 bg-green-50'
  if (kd < 60) return 'text-yellow-700 bg-yellow-50'
  return 'text-red-700 bg-red-50'
}

function adGroupTotals(keywords: SeaKeyword[]) {
  const enriched = keywords.filter(k => k.search_volume != null)
  if (enriched.length === 0) return null
  const totalVol = enriched.reduce((s, k) => s + (k.search_volume ?? 0), 0)
  const cpcVals = enriched.map(k => k.cpc).filter((v): v is number => v != null)
  const avgCpc = cpcVals.length > 0 ? cpcVals.reduce((a, b) => a + b, 0) / cpcVals.length : null
  return { totalVol, avgCpc, enrichedCount: enriched.length }
}

function KeywordRow({ keyword, editing, onChange, onRemove }: {
  keyword: SeaKeyword
  editing: boolean
  onChange: (k: SeaKeyword) => void
  onRemove: () => void
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-2 bg-white rounded-lg p-1.5">
        <input
          value={keyword.text}
          onChange={e => onChange({ ...keyword, text: e.target.value })}
          placeholder="keyword"
          className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 outline-none focus:border-[#EB4628]"
        />
        <select
          value={keyword.match_type}
          onChange={e => onChange({ ...keyword, match_type: e.target.value as SeaMatchType })}
          className="text-xs border border-gray-200 rounded px-2 py-1 outline-none bg-white"
        >
          <option value="broad">broad</option>
          <option value="phrase">phrase</option>
          <option value="exact">exact</option>
        </select>
        <select
          value={keyword.intent}
          onChange={e => onChange({ ...keyword, intent: e.target.value as SeaIntent })}
          className="text-xs border border-gray-200 rounded px-2 py-1 outline-none bg-white"
        >
          <option value="branded">branded</option>
          <option value="transactional">transactional</option>
          <option value="commercial">commercial</option>
          <option value="informational">informational</option>
        </select>
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 p-1">
          <X size={11} />
        </button>
      </div>
    )
  }

  const isEnriched = keyword.search_volume != null

  return (
    <div className="flex items-center gap-2 px-2 py-1.5">
      <span className="text-sm text-gray-800 flex-1">{keyword.text}</span>
      <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{keyword.match_type}</span>
      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${INTENT_COLORS[keyword.intent]}`}>
        {keyword.intent}
      </span>

      {isEnriched && (
        <>
          <span className="text-[10px] text-gray-500 w-12 text-right" title="Search volume">
            {formatNumber(keyword.search_volume)}
          </span>
          <span className="text-[10px] text-gray-500 w-12 text-right" title="CPC">
            {keyword.cpc != null ? `€${keyword.cpc.toFixed(2)}` : '—'}
          </span>
          <span
            className={`text-[10px] font-semibold w-10 text-center px-1.5 py-0.5 rounded ${kdColor(keyword.keyword_difficulty)}`}
            title="Keyword difficulty"
          >
            {keyword.keyword_difficulty ?? '—'}
          </span>
        </>
      )}
    </div>
  )
}
