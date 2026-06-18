'use client'

import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { GeoRun } from '@ibizz/supabase'

type Props = { runs: GeoRun[] }   // chronologisch (oud → nieuw), alleen status 'done' met summary

const W = 640, H = 240, PADL = 36, PADR = 14, PADT = 30, PADB = 28
const PLOTW = W - PADL - PADR
const PLOTH = H - PADT - PADB

const SOV_COLOR = '#7c3aed'
const FIT_COLOR = '#c084fc'

export default function RunTrend({ runs }: Props) {
  if (runs.length < 2) return null

  const n = runs.length
  const x = (i: number) => PADL + (n > 1 ? (i / (n - 1)) * PLOTW : PLOTW / 2)
  const y = (v: number) => PADT + (1 - Math.max(0, Math.min(100, v)) / 100) * PLOTH

  const sovPts = runs.map((r, i) => `${x(i)},${y(r.summary!.sov)}`).join(' ')
  const fitRuns = runs.map((r, i) => ({ i, v: r.summary!.avgAnswerFit })).filter(p => p.v != null) as { i: number; v: number }[]
  const fitPts = fitRuns.map(p => `${x(p.i)},${y(p.v)}`).join(' ')

  // Delta laatste t.o.v. vorige
  const last = runs[n - 1].summary!
  const prev = runs[n - 2].summary!
  const sovDelta = last.sov - prev.sov
  const fitDelta = (last.avgAnswerFit != null && prev.avgAnswerFit != null) ? last.avgAnswerFit - prev.avgAnswerFit : null

  // X-labels: toon alle als ≤ 8 runs, anders ~6 verspreid
  const labelEvery = n <= 8 ? 1 : Math.ceil(n / 6)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <TrendingUp size={12} /> Trend over {n} runs
        </div>
        <div className="flex items-center gap-4">
          <Stat label="Share of Voice" value={`${last.sov}%`} delta={sovDelta} color={SOV_COLOR} />
          {last.avgAnswerFit != null && <Stat label="Answer-fit" value={`${last.avgAnswerFit}%`} delta={fitDelta} color={FIT_COLOR} />}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 240 }}>
        {/* Gridlines + y-labels */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1={PADL} y1={y(v)} x2={W - PADR} y2={y(v)} stroke="#f1f1ef" strokeWidth={1} />
            <text x={PADL - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill="#9ca3af">{v}</text>
          </g>
        ))}

        {/* Answer-fit lijn */}
        {fitRuns.length >= 2 && <polyline points={fitPts} fill="none" stroke={FIT_COLOR} strokeWidth={2} strokeLinejoin="round" />}
        {fitRuns.map(p => <circle key={`f${p.i}`} cx={x(p.i)} cy={y(p.v)} r={3} fill={FIT_COLOR} />)}

        {/* SoV lijn */}
        <polyline points={sovPts} fill="none" stroke={SOV_COLOR} strokeWidth={2.5} strokeLinejoin="round" />
        {runs.map((r, i) => (
          <g key={`s${i}`}>
            <circle cx={x(i)} cy={y(r.summary!.sov)} r={3.5} fill={SOV_COLOR}>
              <title>{format(new Date(r.created_at), 'd MMM HH:mm', { locale: nl })} — SoV {r.summary!.sov}%{r.summary!.avgAnswerFit != null ? `, fit ${r.summary!.avgAnswerFit}%` : ''}</title>
            </circle>
            {(i % labelEvery === 0 || i === n - 1) && (
              <text x={x(i)} y={H - 9} textAnchor="middle" fontSize={8.5} fill="#9ca3af">
                {format(new Date(r.created_at), 'd/M', { locale: nl })}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-1 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ backgroundColor: SOV_COLOR }} /> Share of Voice</span>
        {fitRuns.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ backgroundColor: FIT_COLOR }} /> Answer-fit</span>}
      </div>
    </div>
  )
}

function Stat({ label, value, delta, color }: { label: string; value: string; delta: number | null; color: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-base font-bold" style={{ color }}>{value}</span>
        {delta != null && delta !== 0 && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}{delta > 0 ? '+' : ''}{delta}
          </span>
        )}
        {delta === 0 && <span className="inline-flex items-center text-[10px] text-gray-400"><Minus size={10} /></span>}
      </div>
    </div>
  )
}
