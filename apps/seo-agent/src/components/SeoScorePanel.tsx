'use client'

import { useMemo, useState } from 'react'
import { Check, X, ChevronDown, Search, Sparkles, BookOpen, Hash, Network, ShieldCheck } from 'lucide-react'
import {
  analyzeSeoBasics,
  analyzeGeo,
  analyzeReadability,
  getWordCount,
  type ScoreResult,
  type AnalysisInput,
} from '@/lib/seo-score'

type Props = {
  input: AnalysisInput
}

type SectionKey = 'seo' | 'geo' | 'readability'

const SECTIONS: { key: SectionKey; label: string; sub: string; icon: typeof Search }[] = [
  { key: 'seo',         label: 'GEO & SEO basics',  sub: 'Standaard SEO + AI visibility', icon: Search },
  { key: 'geo',         label: 'Content gap insights', sub: 'Structuur voor AI search',    icon: Network },
  { key: 'readability', label: 'Readability & structure', sub: 'Vlot leesbaar (NL B1)',   icon: BookOpen },
]

function colorForScore(score: number): { stroke: string; bg: string; text: string; iconBg: string } {
  if (score >= 80) return { stroke: '#22c55e', bg: 'bg-green-50',  text: 'text-green-700',  iconBg: 'bg-green-100 text-green-700' }
  if (score >= 60) return { stroke: '#f97316', bg: 'bg-orange-50', text: 'text-orange-700', iconBg: 'bg-orange-100 text-orange-700' }
  return                  { stroke: '#ef4444', bg: 'bg-red-50',    text: 'text-red-700',    iconBg: 'bg-red-100 text-red-700' }
}

function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const stroke = 3
  const radius = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ
  const c = colorForScore(score)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={c.stroke}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.2s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dy="0.35em"
        fontSize={size * 0.32}
        fontWeight="700"
        fill="#1a1a1a"
      >
        {score}
      </text>
    </svg>
  )
}

export default function SeoScorePanel({ input }: Props) {
  const seo = useMemo(() => analyzeSeoBasics(input), [input])
  const geo = useMemo(() => analyzeGeo(input), [input])
  const readability = useMemo(() => analyzeReadability(input), [input])
  const wordCount = useMemo(() => getWordCount(input.content_markdown), [input.content_markdown])

  const [expanded, setExpanded] = useState<SectionKey | null>(null)

  const sections: Record<SectionKey, ScoreResult> = { seo, geo, readability }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Focus keyword box */}
      <div className="px-4 py-4 border-b border-gray-100 bg-gradient-to-br from-orange-50/50 to-white flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={13} style={{ color: '#EB4628' }} />
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700">Optimize for GEO &amp; SEO</h3>
        </div>
        <div className="space-y-2.5">
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Focus keyword</label>
            <div className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-800 truncate">
              {input.target_keyword || <span className="text-gray-400">geen target keyword</span>}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Search localization</label>
            <div className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-800 flex items-center gap-2">
              <span className="text-base leading-none">🇳🇱</span>
              <span>google.nl</span>
              <span className="text-gray-400 ml-auto text-xs">Dutch</span>
            </div>
          </div>
        </div>
      </div>

      {/* Score cards — vertical list */}
      <div className="flex-1 overflow-y-auto">
        {SECTIONS.map(s => {
          const result = sections[s.key]
          const isOpen = expanded === s.key
          const c = colorForScore(result.score)
          return (
            <div key={s.key} className="border-b border-gray-100">
              <button
                onClick={() => setExpanded(o => o === s.key ? null : s.key)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${c.iconBg}`}>
                  <s.icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{s.label}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{s.sub}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <ScoreRing score={result.score} />
                  <ChevronDown
                    size={14}
                    className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 space-y-1.5 bg-gray-50/50">
                  {result.checks.map(c => (
                    <div key={c.id} className="flex items-start gap-2 text-[11px] py-1">
                      {c.passed ? (
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check size={9} className="text-green-700" strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <X size={9} className="text-red-700" strokeWidth={3} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`leading-tight ${c.passed ? 'text-gray-600' : 'text-gray-900 font-semibold'}`}>
                          {c.label}
                          {c.detail && <span className="text-gray-400 ml-1 font-normal">· {c.detail}</span>}
                        </p>
                        {!c.passed && c.fix && (
                          <p className="text-[10px] text-amber-700 mt-1 leading-snug">→ {c.fix}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Plagiarism placeholder (StoryChief inspired) */}
        <div className="border-b border-gray-100">
          <div className="w-full flex items-center gap-3 px-4 py-3.5 opacity-50">
            <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-gray-900 leading-tight">Plagiarism check</p>
                <span className="text-[9px] font-bold uppercase bg-purple-100 text-purple-700 rounded px-1 py-0.5">Soon</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">Ensure content originality</p>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">—</span>
          </div>
        </div>

        {/* Word count */}
        <div className="border-b border-gray-100">
          <div className="w-full flex items-center gap-3 px-4 py-3.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
              <Hash size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-tight">Word count</p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">In depth overview</p>
            </div>
            <span className="text-lg font-bold text-gray-900 tabular-nums flex-shrink-0">{wordCount}</span>
          </div>
        </div>

        {/* Footer note */}
        <div className="px-4 py-3 text-[10px] text-gray-400 leading-relaxed">
          Score wordt live berekend terwijl je schrijft of de AI itereert. Klik een rij voor details + concrete fixes.
        </div>
      </div>
    </div>
  )
}
