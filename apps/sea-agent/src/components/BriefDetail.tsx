'use client'

import { ArrowLeft, Trash2, Ban, Download, FileText, KeyRound, Sparkles, Info, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import type { SeaBrief, Brand, SeaStrategy, SeaKeywordResearch } from '@ibizz/supabase'
import { createClient } from '@ibizz/supabase'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import StrategyView from './StrategyView'
import KeywordResearchView from './KeywordResearchView'
import AdCopyView from './AdCopyView'
import NegativesView from './NegativesView'
import { strategyStatus, keywordsStatus, adCopyStatus, negativesStatus, STATUS_DOT_COLOR, STATUS_LABEL } from '@/lib/step-status'
import type { StepStatus } from '@/lib/step-status'

type Step = 'overview' | 'strategy' | 'keywords' | 'adcopy' | 'negatives' | 'export'

type Props = {
  brief: SeaBrief
  brand?: Brand
  onBack: () => void
  onUpdated: (b: SeaBrief) => void
  onDeleted: (id: string) => void
}

export default function BriefDetail({ brief, brand, onBack, onDeleted }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [strategy, setStrategy] = useState<SeaStrategy | null>(null)
  const [research, setResearch] = useState<SeaKeywordResearch | null>(null)
  const [negativeCount, setNegativeCount] = useState(0)
  const [activeStep, setActiveStep] = useState<Step>('overview')
  const supabase = createClient()

  useEffect(() => {
    supabase.from('sea_strategies').select('*').eq('brief_id', brief.id).maybeSingle().then(({ data }) => {
      setStrategy((data ?? null) as SeaStrategy | null)
    })
    supabase.from('sea_keyword_research').select('*').eq('brief_id', brief.id).maybeSingle().then(({ data }) => {
      setResearch((data ?? null) as SeaKeywordResearch | null)
    })
    // Globaal + brand-specifiek tellen
    Promise.all([
      supabase.from('sea_negative_keywords').select('*', { count: 'exact', head: true }).is('brand_id', null),
      brief.brand_id
        ? supabase.from('sea_negative_keywords').select('*', { count: 'exact', head: true }).eq('brand_id', brief.brand_id)
        : Promise.resolve({ count: 0 } as { count: number }),
    ]).then(([globalRes, brandRes]) => {
      setNegativeCount((globalRes.count ?? 0) + (brandRes.count ?? 0))
    })
  }, [brief.id, brief.brand_id])

  async function deleteBrief() {
    onDeleted(brief.id)
    await supabase.from('sea_briefs').delete().eq('id', brief.id)
  }

  const stepStatuses: Record<Exclude<Step, 'overview' | 'export'>, StepStatus> = {
    strategy: strategyStatus(strategy),
    keywords: keywordsStatus(research),
    adcopy: adCopyStatus(research),
    negatives: negativesStatus(negativeCount),
  }

  const allApproved =
    stepStatuses.strategy === 'approved' &&
    stepStatuses.keywords === 'approved' &&
    stepStatuses.adcopy === 'approved' &&
    stepStatuses.negatives === 'approved'

  return (
    <div className="flex h-full">
      {/* Pipeline rail */}
      <div className="w-60 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
            title="Back to briefs"
          >
            <ArrowLeft size={14} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-800 truncate">{brief.title}</p>
            {brand && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand.color }} />
                <span className="text-[10px] text-gray-400">{brand.name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          <RailItem
            icon={<Info size={14} />}
            label="Overview"
            active={activeStep === 'overview'}
            onClick={() => setActiveStep('overview')}
          />
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 mt-3 mb-1">Pipeline</p>
          <RailItem
            icon={<Sparkles size={14} />}
            label="Strategy"
            status={stepStatuses.strategy}
            active={activeStep === 'strategy'}
            onClick={() => setActiveStep('strategy')}
          />
          <RailItem
            icon={<KeyRound size={14} />}
            label="Keywords"
            status={stepStatuses.keywords}
            active={activeStep === 'keywords'}
            onClick={() => setActiveStep('keywords')}
          />
          <RailItem
            icon={<FileText size={14} />}
            label="Ad copy"
            status={stepStatuses.adcopy}
            active={activeStep === 'adcopy'}
            onClick={() => setActiveStep('adcopy')}
          />
          <RailItem
            icon={<Ban size={14} />}
            label="Negatives"
            status={stepStatuses.negatives}
            active={activeStep === 'negatives'}
            onClick={() => setActiveStep('negatives')}
            sublabel={`${negativeCount}`}
          />
        </div>

        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => setActiveStep('export')}
            disabled={!allApproved}
            title={allApproved ? 'Export to Google Ads Editor' : 'Approve all steps first'}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
            style={{ backgroundColor: allApproved ? '#22c55e' : '#9ca3af' }}
          >
            <Download size={13} />
            {allApproved ? 'Push to Google Ads' : 'Locked'}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={11} />
            Delete brief
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-8 py-6">
          {activeStep === 'overview' && (
            <OverviewSection brief={brief} brand={brand} />
          )}

          {activeStep === 'strategy' && (
            <StrategyView briefId={brief.id} strategy={strategy} onUpdated={setStrategy} />
          )}

          {activeStep === 'keywords' && (
            <KeywordResearchView briefId={brief.id} research={research} onUpdated={setResearch} />
          )}

          {activeStep === 'adcopy' && (
            <AdCopyView research={research} onUpdated={setResearch} />
          )}

          {activeStep === 'negatives' && (
            <NegativesView
              brandId={brief.brand_id ?? null}
              brandName={brand?.name}
              onCountChanged={setNegativeCount}
            />
          )}

          {activeStep === 'export' && (
            <ExportView brief={brief} research={research} strategy={strategy} />
          )}
        </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">Delete brief?</h3>
            <p className="text-xs text-gray-400 text-center mb-6">&quot;{brief.title}&quot; will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={deleteBrief} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RailItem({ icon, label, status, active, onClick, sublabel }: {
  icon: React.ReactNode
  label: string
  status?: StepStatus
  active: boolean
  onClick: () => void
  sublabel?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
        active ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className={active ? 'text-[#EB4628]' : 'text-gray-400'}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {status && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: STATUS_DOT_COLOR[status] }}
          title={STATUS_LABEL[status]}
        />
      )}
      {sublabel && (
        <span className="text-[9px] text-gray-400">{sublabel.split(' ')[0]}</span>
      )}
    </button>
  )
}

function OverviewSection({ brief, brand }: { brief: SeaBrief; brand?: Brand }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Info size={16} className="text-[#EB4628]" />
        <h2 className="text-sm font-bold text-gray-800">Brief overview</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <Field label="Brand" value={brand?.name ?? '—'} />
        <Field label="Status" value={brief.status} />
        <Field label="Monthly budget" value={brief.monthly_budget ? `€${brief.monthly_budget}` : '—'} />
        <Field label="Target CPA" value={brief.target_cpa ? `€${brief.target_cpa}` : '—'} />
        <Field label="Location" value={brief.location} />
        <Field label="Created" value={format(new Date(brief.created_at), 'd MMM yyyy')} />
      </div>

      {brief.goal && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Goal</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{brief.goal}</p>
        </div>
      )}

      {brief.target_audience && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Target audience</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{brief.target_audience}</p>
        </div>
      )}

      {brief.icp && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">ICP</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{brief.icp}</p>
        </div>
      )}

      <p className="text-[11px] text-gray-400 mt-5 pt-4 border-t border-gray-100">
        {brief.created_by_name && `Created by ${brief.created_by_name} · `}
        {format(new Date(brief.created_at), "d MMM yyyy 'at' HH:mm")}
      </p>
    </section>
  )
}


function ExportView({ brief, research, strategy }: {
  brief: SeaBrief
  research: SeaKeywordResearch | null
  strategy: SeaStrategy | null
}) {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Compute summary stats
  const campaigns = research?.campaigns ?? []
  const adGroups = campaigns.flatMap(c => c.ad_groups)
  const keywords = adGroups.flatMap(g => g.keywords)
  const ads = adGroups.filter(g => g.ad_copy && g.ad_copy.headlines.length > 0)
  const pmaxCount = campaigns.filter(c => c.type === 'Performance Max').length

  async function downloadExport() {
    setExporting(true)
    setError(null)
    try {
      const res = await fetch('/api/export-google-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId: brief.id }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Export mislukt')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = cd.match(/filename="([^"]+)"/)
      a.download = match?.[1] ?? `google-ads-export.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export mislukt')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header card */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Download size={16} className="text-[#22c55e]" />
          <h2 className="text-sm font-bold text-gray-800">Export naar Google Ads Editor</h2>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Campagnes', value: campaigns.length },
            { label: 'Ad groups', value: adGroups.length },
            { label: 'Keywords', value: keywords.length },
            { label: 'RSA advertenties', value: ads.length },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl px-4 py-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {pmaxCount > 0 && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              <strong>{pmaxCount} Performance Max</strong> campagne{pmaxCount > 1 ? 's' : ''} zijn opgenomen zonder ad groups — asset groups configureer je handmatig in Google Ads.
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <button
          onClick={downloadExport}
          disabled={exporting || campaigns.length === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#22c55e' }}
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {exporting ? 'Exporteren…' : 'Download Google Ads Editor XLSX'}
        </button>
      </section>

      {/* Import instructions */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-gray-800 mb-3">Hoe importeer je in Google Ads Editor?</h3>
        <ol className="space-y-2.5">
          {[
            'Download het XLSX bestand via de knop hierboven.',
            'Open Google Ads Editor en selecteer het juiste account.',
            'Ga naar File → Import → Import File…',
            'Selecteer het gedownloade XLSX bestand.',
            'Controleer de preview — klik op Apply All om te importeren.',
            'Review de wijzigingen in Google Ads Editor en klik op Post om live te zetten.',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                style={{ backgroundColor: '#22c55e' }}
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>

        <a
          href="https://support.google.com/google-ads/editor/answer/38657"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ExternalLink size={11} />
          Google Ads Editor importeer documentatie
        </a>
      </section>

      {/* Roadmap: Google Ads API */}
      <section className="bg-white border border-dashed border-gray-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles size={15} className="text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-0.5">
            Directe Google Ads API koppeling — coming soon
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            In een volgende sprint bouwen we een directe OAuth2 koppeling met de Google Ads API, zodat campagnes automatisch worden aangemaakt in het live account — zonder handmatige import via Editor. Dit vereist een Google developer token en OAuth credentials per klant.
          </p>
        </div>
      </section>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  )
}
