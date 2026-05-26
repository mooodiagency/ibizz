'use client'

import { useState } from 'react'
import { X, Download, Edit2, Save, Loader2, Target, User, Tag, Hash, Volume2, BookOpen, ListChecks, AlertTriangle, Lightbulb, Link as LinkIcon, ThumbsUp, ThumbsDown, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { Select } from '@ibizz/ui'
import type { SeoWriterBrief, SeoBrief } from '@ibizz/supabase'
import { generateWriterBriefPDF } from '@/lib/writer-brief-pdf'

type Props = {
  writerBrief: SeoWriterBrief
  pageTopic: string
  brief: SeoBrief | null
  onClose: () => void
  onUpdated: (wb: SeoWriterBrief) => void
}

type Content = SeoWriterBrief['content']

export default function WriterBriefDetailModal({ writerBrief, pageTopic, brief, onClose, onUpdated }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Content>(writerBrief.content)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function save() {
    setSaving(true)
    const { data, error } = await supabase
      .from('seo_writer_briefs')
      .update({ content: draft })
      .eq('id', writerBrief.id)
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      onUpdated(data as SeoWriterBrief)
      setEditing(false)
    }
  }

  function downloadPDF() {
    if (!brief) return
    const tempWb: SeoWriterBrief = { ...writerBrief, content: editing ? draft : writerBrief.content }
    generateWriterBriefPDF(tempWb, brief, pageTopic)
  }

  const c = editing ? draft : writerBrief.content

  function updateContent<K extends keyof Content>(key: K, value: Content[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  function ArrayEditor({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
    return (
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <textarea
              value={item}
              onChange={e => {
                const next = [...items]
                next[i] = e.target.value
                onChange(next)
              }}
              rows={item.length > 80 ? 2 : 1}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-[#EB4628] resize-none"
              placeholder={placeholder}
            />
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-gray-400 hover:text-red-500 p-1 mt-1"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...items, ''])}
          className="flex items-center gap-1 text-[11px] font-semibold text-[#EB4628] hover:underline"
        >
          <Plus size={10} /> Item toevoegen
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Accent + header */}
        <div className="h-1.5" style={{ backgroundColor: '#EB4628' }} />
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#EB4628' }}>SEO Content Brief</p>
            <h2 className="text-base font-bold text-gray-900 mt-0.5">{pageTopic}</h2>
            {brief && (
              <p className="text-xs text-gray-400 mt-0.5">Project: {brief.title}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button
                  onClick={() => { setEditing(false); setDraft(writerBrief.content) }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200"
                >
                  Annuleren
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#EB4628' }}
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Opslaan
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200"
                >
                  <Edit2 size={11} />
                  Bewerken
                </button>
                <button
                  onClick={downloadPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90"
                  style={{ backgroundColor: '#EB4628' }}
                >
                  <Download size={11} />
                  Download PDF
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Persona + Thema header card */}
          <div className="grid grid-cols-2 gap-3">
            <Card icon={<User size={14} />} label="Persona">
              {editing ? (
                <input
                  value={c.persona_name}
                  onChange={e => updateContent('persona_name', e.target.value)}
                  className="w-full text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#EB4628]"
                />
              ) : (
                <p className="text-sm font-semibold text-gray-900">{c.persona_name || '—'}</p>
              )}
            </Card>
            <Card icon={<Tag size={14} />} label="Thema">
              {editing ? (
                <input
                  value={c.theme}
                  onChange={e => updateContent('theme', e.target.value)}
                  className="w-full text-sm font-semibold border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#EB4628]"
                />
              ) : (
                <p className="text-sm font-semibold text-gray-900">{c.theme || '—'}</p>
              )}
            </Card>
          </div>

          {/* Pijnpunt */}
          <Section icon={<Target size={14} />} title="Pijnpunt geadresseerd">
            {editing ? (
              <textarea
                value={c.pain_addressed}
                onChange={e => updateContent('pain_addressed', e.target.value)}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#EB4628] resize-none"
              />
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">{c.pain_addressed || '—'}</p>
            )}
          </Section>

          {/* Kernboodschap */}
          <Section icon={<BookOpen size={14} />} title="Kernboodschap">
            {editing ? (
              <textarea
                value={c.message}
                onChange={e => updateContent('message', e.target.value)}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#EB4628] resize-none"
              />
            ) : (
              <p className="text-sm font-semibold text-gray-900 leading-relaxed">{c.message || '—'}</p>
            )}
          </Section>

          {/* SEO setup */}
          <Section icon={<Hash size={14} />} title="SEO setup">
            <div className="space-y-2">
              <KV label="Target keyword">
                {editing ? (
                  <input value={c.target_keyword} onChange={e => updateContent('target_keyword', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#EB4628]" />
                ) : (
                  <span className="text-sm font-semibold text-gray-900">{c.target_keyword || '—'}</span>
                )}
              </KV>
              <KV label="Secundaire keywords">
                {editing ? (
                  <input
                    value={c.secondary_keywords.join(', ')}
                    onChange={e => updateContent('secondary_keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#EB4628]"
                    placeholder="komma-gescheiden"
                  />
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {c.secondary_keywords.map((k, i) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-700 rounded px-1.5 py-0.5">{k}</span>
                    ))}
                  </div>
                )}
              </KV>
              <KV label="Search intent">
                {editing ? (
                  <Select
                    value={c.search_intent}
                    onChange={v => updateContent('search_intent', v)}
                    options={[
                      { value: '', label: '—' },
                      { value: 'informational', label: 'Informational' },
                      { value: 'commercial', label: 'Commercial' },
                      { value: 'transactional', label: 'Transactional' },
                      { value: 'navigational', label: 'Navigational' },
                    ]}
                    className="w-44"
                  />
                ) : (
                  <span className="text-sm font-semibold uppercase tracking-wide text-gray-600">{c.search_intent || '—'}</span>
                )}
              </KV>
              <KV label="Word count">
                {editing ? (
                  <input
                    type="number"
                    value={c.word_count_target}
                    onChange={e => updateContent('word_count_target', Number(e.target.value))}
                    className="w-24 text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#EB4628]"
                  />
                ) : (
                  <span className="text-sm font-semibold text-gray-900">{c.word_count_target} woorden</span>
                )}
              </KV>
            </div>
          </Section>

          {/* Tone of voice */}
          <Section icon={<Volume2 size={14} />} title="Tone of voice">
            {editing ? (
              <textarea
                value={c.tone_of_voice}
                onChange={e => updateContent('tone_of_voice', e.target.value)}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#EB4628] resize-none"
              />
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">{c.tone_of_voice || '—'}</p>
            )}
          </Section>

          {/* Headings */}
          <Section icon={<ListChecks size={14} />} title="Voorgestelde heading structuur">
            {editing ? (
              <ArrayEditor
                items={c.headings_structure}
                onChange={v => updateContent('headings_structure', v)}
                placeholder="H2: ..."
              />
            ) : (
              <ol className="space-y-1 list-decimal list-inside text-sm text-gray-700">
                {c.headings_structure.map((h, i) => <li key={i}>{h}</li>)}
              </ol>
            )}
          </Section>

          {/* Must include */}
          <Section icon={<ListChecks size={14} />} title="Verplichte elementen">
            {editing ? (
              <ArrayEditor items={c.must_include} onChange={v => updateContent('must_include', v)} />
            ) : (
              <ul className="space-y-1 text-sm text-gray-700">
                {c.must_include.map((m, i) => (
                  <li key={i} className="flex gap-2"><span style={{ color: '#EB4628' }}>•</span>{m}</li>
                ))}
              </ul>
            )}
          </Section>

          {/* Must avoid */}
          <Section icon={<AlertTriangle size={14} />} title="Vermijd">
            {editing ? (
              <ArrayEditor items={c.must_avoid} onChange={v => updateContent('must_avoid', v)} />
            ) : (
              <ul className="space-y-1 text-sm text-gray-700">
                {c.must_avoid.map((m, i) => (
                  <li key={i} className="flex gap-2"><span className="text-red-500">×</span>{m}</li>
                ))}
              </ul>
            )}
          </Section>

          {/* Lessons learned */}
          {(c.lessons_learned.length > 0 || editing) && (
            <Section icon={<Lightbulb size={14} />} title="Lessons learned">
              {editing ? (
                <ArrayEditor items={c.lessons_learned} onChange={v => updateContent('lessons_learned', v)} />
              ) : (
                <ul className="space-y-1 text-sm text-gray-700">
                  {c.lessons_learned.map((l, i) => (
                    <li key={i} className="flex gap-2"><span className="text-amber-500">💡</span>{l}</li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {/* Internal links */}
          {(c.internal_links.length > 0 || editing) && (
            <Section icon={<LinkIcon size={14} />} title="Internal links">
              {editing ? (
                <ArrayEditor items={c.internal_links} onChange={v => updateContent('internal_links', v)} />
              ) : (
                <ul className="space-y-1 text-sm text-gray-700">
                  {c.internal_links.map((l, i) => (
                    <li key={i} className="flex gap-2"><LinkIcon size={11} className="text-gray-400 flex-shrink-0 mt-1" />{l}</li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {/* Voorbeelden */}
          {(c.examples_good || c.examples_bad || editing) && (
            <div className="grid grid-cols-2 gap-3">
              <Card icon={<ThumbsUp size={14} className="text-green-600" />} label="Voorbeeld goed">
                {editing ? (
                  <textarea
                    value={c.examples_good ?? ''}
                    onChange={e => updateContent('examples_good', e.target.value)}
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#EB4628] resize-none"
                  />
                ) : (
                  <p className="text-sm text-gray-700 italic leading-relaxed">&ldquo;{c.examples_good || '—'}&rdquo;</p>
                )}
              </Card>
              <Card icon={<ThumbsDown size={14} className="text-red-500" />} label="Voorbeeld vermijden">
                {editing ? (
                  <textarea
                    value={c.examples_bad ?? ''}
                    onChange={e => updateContent('examples_bad', e.target.value)}
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#EB4628] resize-none"
                  />
                ) : (
                  <p className="text-sm text-gray-700 italic leading-relaxed">&ldquo;{c.examples_bad || '—'}&rdquo;</p>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Card({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-gray-400">{icon}</span>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      </div>
      {children}
    </div>
  )
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-32 flex-shrink-0 pt-1">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
