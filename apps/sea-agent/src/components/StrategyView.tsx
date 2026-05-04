'use client'

import { useState } from 'react'
import { Loader2, Sparkles, Check, XCircle, RotateCcw, AlertCircle, TrendingUp, Calendar, ListChecks, PieChart } from 'lucide-react'
import type { SeaStrategy } from '@ibizz/supabase'
import { createClient } from '@ibizz/supabase'

type Props = {
  briefId: string
  strategy: SeaStrategy | null
  onUpdated: (s: SeaStrategy) => void
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved',
  rejected: 'Rejected',
}

export default function StrategyView({ briefId, strategy, onUpdated }: Props) {
  const [generating, setGenerating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId }),
      })
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(msg)
      }
      const s: SeaStrategy = await res.json()
      onUpdated(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setGenerating(false)
    }
  }

  async function setStatus(status: SeaStrategy['status']) {
    if (!strategy) return
    setUpdating(true)
    const { data, error: err } = await supabase
      .from('sea_strategies')
      .update({ status })
      .eq('id', strategy.id)
      .select()
      .single()
    setUpdating(false)
    if (!err && data) onUpdated(data as SeaStrategy)
  }

  // Empty state
  if (!strategy) {
    return (
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} style={{ color: '#EB4628' }} />
          <h2 className="text-sm font-bold text-gray-800">Strategy</h2>
        </div>

        <div className="flex flex-col items-center text-center py-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#EB462815' }}>
            <Sparkles size={22} style={{ color: '#EB4628' }} />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No strategy yet</p>
          <p className="text-xs text-gray-400 mb-5 max-w-xs">
            Generate a complete campaign strategy from this brief — budget split, campaign types, timeline.
          </p>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#EB4628' }}
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? 'Generating…' : 'Generate strategy'}
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

  // Strategy exists
  return (
    <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: '#EB4628' }} />
          <h2 className="text-sm font-bold text-gray-800">Strategy</h2>
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_COLORS[strategy.status]}`}>
            {STATUS_LABELS[strategy.status]}
          </span>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-[#EB4628] transition-colors disabled:opacity-50"
          title="Regenerate"
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
          Regenerate
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-6">
        {/* Summary */}
        {strategy.summary && (
          <div>
            <p className="text-sm text-gray-700 leading-relaxed">{strategy.summary}</p>
          </div>
        )}

        {/* Expected results */}
        {strategy.expected_results && (
          <Block icon={<TrendingUp size={14} />} title="Expected results">
            <div className="grid grid-cols-3 gap-3">
              {strategy.expected_results.estimated_leads != null && (
                <Stat label="Leads / month" value={strategy.expected_results.estimated_leads.toString()} />
              )}
              {strategy.expected_results.estimated_cpa != null && (
                <Stat label="CPA" value={`€${strategy.expected_results.estimated_cpa}`} />
              )}
              {strategy.expected_results.conversion_rate_pct != null && (
                <Stat label="Conv. rate" value={`${strategy.expected_results.conversion_rate_pct}%`} />
              )}
            </div>
            {strategy.expected_results.notes && (
              <p className="text-xs text-gray-500 mt-3 italic">{strategy.expected_results.notes}</p>
            )}
          </Block>
        )}

        {/* Budget breakdown */}
        {strategy.budget_breakdown.length > 0 && (
          <Block icon={<PieChart size={14} />} title="Budget breakdown">
            <div className="space-y-2">
              {strategy.budget_breakdown.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-700 flex-1">{item.name}</span>
                  <div className="flex-1 max-w-[160px] h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.percentage}%`, backgroundColor: '#EB4628' }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-800 w-16 text-right">€{item.amount}</span>
                  <span className="text-[10px] text-gray-400 w-10 text-right">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </Block>
        )}

        {/* Campaign types */}
        {strategy.campaign_types.length > 0 && (
          <Block icon={<ListChecks size={14} />} title="Campaign types">
            <div className="space-y-2">
              {strategy.campaign_types.map((ct, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-800">{ct.type}</span>
                    <span className="text-xs text-gray-500">€{ct.budget} · {ct.share_pct}%</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{ct.reasoning}</p>
                </div>
              ))}
            </div>
          </Block>
        )}

        {/* Timeline */}
        {strategy.timeline.length > 0 && (
          <Block icon={<Calendar size={14} />} title="Timeline">
            <div className="space-y-1.5">
              {strategy.timeline.map((t, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#EB4628] w-16 flex-shrink-0 pt-0.5">
                    {t.week}
                  </span>
                  <span className="text-sm text-gray-700 leading-relaxed">{t.focus}</span>
                </div>
              ))}
            </div>
          </Block>
        )}

        {/* Considerations */}
        {strategy.considerations.length > 0 && (
          <Block icon={<AlertCircle size={14} />} title="Considerations">
            <ul className="space-y-1">
              {strategy.considerations.map((c, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2">
                  <span style={{ color: '#EB4628' }}>•</span>
                  <span className="leading-relaxed">{c}</span>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle size={12} />
            {error}
          </p>
        )}
      </div>

      {/* Footer — approve/reject */}
      <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">
          {strategy.created_by_name && `Generated by ${strategy.created_by_name}`}
        </span>
        {strategy.status === 'draft' ? (
          <div className="flex gap-2">
            <button
              onClick={() => setStatus('rejected')}
              disabled={updating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <XCircle size={12} />
              Reject
            </button>
            <button
              onClick={() => setStatus('approved')}
              disabled={updating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
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

function Block({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
    </div>
  )
}
