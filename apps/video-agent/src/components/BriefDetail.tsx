'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Trash2, Plus, X, MapPin, Users, FileText, History, Film, BookOpen, CheckCircle2 } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { Select } from '@ibizz/ui'
import type { VideoBrief, VideoBriefStatus, Brand, VideoCastRole, VideoLocation } from '@ibizz/supabase'
import ScriptsView from './ScriptsView'

type Props = {
  brief: VideoBrief
  brand: Brand | undefined
  onBack: () => void
  onUpdated: (b: VideoBrief) => void
  onDeleted: (id: string) => void
}

const STATUS_PILL: Record<VideoBriefStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  in_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  archived: 'bg-gray-50 text-gray-400',
}

const STATUS_LABEL: Record<VideoBriefStatus, string> = {
  draft: 'Concept',
  in_review: 'In review',
  approved: 'Goedgekeurd',
  archived: 'Gearchiveerd',
}

export default function BriefDetail({ brief, brand, onBack, onUpdated, onDeleted }: Props) {
  const [local, setLocal] = useState<VideoBrief>(brief)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const supabase = createClient()

  // Sync wanneer parent een geupdate brief stuurt (bv. na save elders)
  useEffect(() => { setLocal(brief) }, [brief])

  async function patch(partial: Partial<Omit<VideoBrief, 'id' | 'created_at'>>) {
    const next = { ...local, ...partial, updated_at: new Date().toISOString() }
    setLocal(next)
    const { data, error } = await supabase
      .from('video_briefs')
      .update(partial)
      .eq('id', local.id)
      .select()
      .single()
    if (!error && data) {
      onUpdated(data as VideoBrief)
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(s => (s && Date.now() - s > 1800 ? null : s)), 2000)
    }
  }

  async function deleteBrief() {
    await supabase.from('video_briefs').delete().eq('id', local.id)
    onDeleted(local.id)
  }

  function setCastTotaal(cast: VideoCastRole[]) { patch({ cast_totaal: cast }) }
  function setLocaties(locs: VideoLocation[]) { patch({ locaties: locs }) }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-8 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft size={14} />
            Briefs
          </button>
          <div className="flex items-center gap-2">
            {savedAt && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-green-700">
                <CheckCircle2 size={11} />
                Opgeslagen
              </span>
            )}
            <Select
              variant="badge"
              value={local.status}
              onChange={v => patch({ status: v as VideoBriefStatus })}
              options={(Object.keys(STATUS_LABEL) as VideoBriefStatus[]).map(s => ({
                value: s,
                label: STATUS_LABEL[s],
                className: STATUS_PILL[s],
              }))}
            />
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              v{local.versie}
            </span>
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Brief verwijderen"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-1.5">
          {brand && (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand.color }} />
              <span className="font-semibold">{brand.name}</span>
            </span>
          )}
          {local.intro_subtitel && (
            <span className="text-xs text-gray-400">· {local.intro_subtitel}</span>
          )}
        </div>

        <input
          value={local.dag_titel}
          onChange={e => setLocal(prev => ({ ...prev, dag_titel: e.target.value }))}
          onBlur={e => { if (e.target.value.trim() !== brief.dag_titel) patch({ dag_titel: e.target.value.trim() }) }}
          placeholder="Dag-titel"
          className="w-full text-xl font-bold text-gray-900 outline-none focus:border-b focus:border-[#EB4628] pb-1"
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {/* Overzicht */}
        <Section title="Overzicht" icon={<FileText size={14} />}>
          <textarea
            value={local.overzicht ?? ''}
            onChange={e => setLocal(prev => ({ ...prev, overzicht: e.target.value }))}
            onBlur={e => patch({ overzicht: e.target.value.trim() || null })}
            placeholder="Korte beschrijving wat in deze dag zit. Bijv: '8 unieke boodschappen. Per script: doel, cast, productie-toets, hook, concept, script, shotlist, tekst in beeld, montage, CTA, caption en variaties.'"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-[#EB4628] resize-none bg-white"
          />
        </Section>

        {/* Brand context */}
        <Section
          title="Brand context"
          icon={<BookOpen size={14} />}
          subtitle="Wat de AI moet weten over het merk om scripts te schrijven"
        >
          <textarea
            value={local.brand_context ?? ''}
            onChange={e => setLocal(prev => ({ ...prev, brand_context: e.target.value }))}
            onBlur={e => patch({ brand_context: e.target.value.trim() || null })}
            placeholder={`Beschrijf: product/dienst, USP's, doelgroep, tone-of-voice, positionering, do's & don'ts. Bijv:\n\nFRENKY is een reistas die niet hoeft te worden ingecheckt. Past in elke handbagage-eis. Doelgroep: 25-40 jaar, frequent weekend-reiziger. Tone: droog, rustig, zelfverzekerd. Vermijd: lifestyle-clichés, "ervaar de revolutie", overdreven emotie.`}
            rows={6}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-[#EB4628] resize-none bg-white"
          />
        </Section>

        {/* Cast totaal */}
        <Section
          title="Cast totaal"
          icon={<Users size={14} />}
          subtitle="Alle rollen gebundeld over alle scripts in deze dag"
        >
          <CastEditor cast={local.cast_totaal ?? []} onChange={setCastTotaal} />
        </Section>

        {/* Locaties */}
        <Section
          title="Locaties"
          icon={<MapPin size={14} />}
          subtitle="Productielocaties met welke scripts er gefilmd worden"
        >
          <LocationsEditor locaties={local.locaties ?? []} onChange={setLocaties} />
        </Section>

        {/* Scripts */}
        <Section title="Scripts" icon={<Film size={14} />}>
          <ScriptsView briefId={local.id} />
        </Section>

        {/* Wijzigingen / versies (placeholder voor Fase 5) */}
        <Section title="Wijzigingen / Versies" icon={<History size={14} />}>
          <div className="bg-white border border-gray-200 border-dashed rounded-2xl p-6 text-xs text-gray-500">
            <p className="font-semibold text-gray-700 mb-1">Auto-changelog komt in Fase 5</p>
            <p>
              Elke keer als je een nieuwe versie opslaat, bumpt het versienummer en genereert
              de AI automatisch een <span className="font-semibold">&ldquo;→ Script X: nieuwe vang-hook&rdquo;</span> changelog
              van wat er feitelijk is veranderd t.o.v. de vorige versie.
            </p>
          </div>
        </Section>
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">Brief verwijderen?</h3>
            <p className="text-xs text-gray-400 text-center mb-6">
              &ldquo;{local.dag_titel}&rdquo; en alle gekoppelde scripts/research/versies worden permanent verwijderd.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Annuleren
              </button>
              <button onClick={deleteBrief} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600">
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Section wrapper ────────────────────────────────────────────────────
function Section({
  title, subtitle, icon, children,
}: {
  title: string
  subtitle?: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#EB4628]">{icon}</span>
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
        {subtitle && <span className="text-xs text-gray-400">— {subtitle}</span>}
      </div>
      {children}
    </section>
  )
}

// ─── Cast editor ────────────────────────────────────────────────────────
function CastEditor({ cast, onChange }: { cast: VideoCastRole[]; onChange: (c: VideoCastRole[]) => void }) {
  function update(i: number, patch: Partial<VideoCastRole>) {
    onChange(cast.map((c, j) => j === i ? { ...c, ...patch } : c))
  }
  function remove(i: number) {
    onChange(cast.filter((_, j) => j !== i))
  }
  function add() {
    onChange([...cast, { rol: '', aantal: 1, omschrijving: '' }])
  }

  if (cast.length === 0) {
    return (
      <button
        onClick={add}
        className="w-full border border-gray-200 border-dashed rounded-xl px-3 py-4 text-xs text-gray-500 hover:border-[#EB4628] hover:text-[#EB4628] transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus size={12} />
        Cast-rol toevoegen
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {cast.map((role, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 grid grid-cols-12 gap-2 items-start">
          <div className="col-span-1">
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">#</label>
            <input
              type="number"
              min={1}
              value={role.aantal}
              onChange={e => update(i, { aantal: Math.max(1, parseInt(e.target.value || '1', 10)) })}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#EB4628] text-center"
            />
          </div>
          <div className="col-span-4">
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Rol</label>
            <input
              value={role.rol}
              onChange={e => update(i, { rol: e.target.value })}
              placeholder="Bijv. hoofdactrice (FRENKY-drager)"
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#EB4628]"
            />
          </div>
          <div className="col-span-6">
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Omschrijving</label>
            <input
              value={role.omschrijving ?? ''}
              onChange={e => update(i, { omschrijving: e.target.value || null })}
              placeholder="Bijv. 25–40 jaar, sterke uitstraling, casual reisstijl"
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#EB4628]"
            />
          </div>
          <div className="col-span-1 flex justify-end pt-5">
            <button
              onClick={() => remove(i)}
              className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50"
              title="Verwijderen"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-1 text-xs font-semibold text-[#EB4628] hover:underline"
      >
        <Plus size={11} /> Cast-rol toevoegen
      </button>
    </div>
  )
}

// ─── Locations editor ───────────────────────────────────────────────────
function LocationsEditor({ locaties, onChange }: { locaties: VideoLocation[]; onChange: (l: VideoLocation[]) => void }) {
  function update(i: number, patch: Partial<VideoLocation>) {
    onChange(locaties.map((l, j) => j === i ? { ...l, ...patch } : l))
  }
  function remove(i: number) {
    onChange(locaties.filter((_, j) => j !== i))
  }
  function add() {
    onChange([...locaties, { naam: '', scripts: [], toelichting: '' }])
  }

  // Parse "1, 2, 3" or "1,2,3" → number[]
  function parseScripts(s: string): number[] {
    return s.split(',').map(x => parseInt(x.trim(), 10)).filter(n => Number.isFinite(n) && n > 0)
  }
  function formatScripts(nums: number[]): string {
    return nums.join(', ')
  }

  if (locaties.length === 0) {
    return (
      <button
        onClick={add}
        className="w-full border border-gray-200 border-dashed rounded-xl px-3 py-4 text-xs text-gray-500 hover:border-[#EB4628] hover:text-[#EB4628] transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus size={12} />
        Locatie toevoegen
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {locaties.map((loc, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-6">
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Naam</label>
              <input
                value={loc.naam}
                onChange={e => update(i, { naam: e.target.value })}
                placeholder="Bijv. Eindhoven Airport (publiek)"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#EB4628]"
              />
            </div>
            <div className="col-span-5">
              <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Scripts (nummers, komma-separated)
              </label>
              <input
                value={formatScripts(loc.scripts)}
                onChange={e => update(i, { scripts: parseScripts(e.target.value) })}
                placeholder="1, 2, 3, 4"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#EB4628]"
              />
            </div>
            <div className="col-span-1 flex justify-end pt-5">
              <button
                onClick={() => remove(i)}
                className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50"
                title="Verwijderen"
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Toelichting</label>
            <input
              value={loc.toelichting ?? ''}
              onChange={e => update(i, { toelichting: e.target.value || null })}
              placeholder="Bijv. 5 scripts op één halve dag"
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#EB4628]"
            />
          </div>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-1 text-xs font-semibold text-[#EB4628] hover:underline"
      >
        <Plus size={11} /> Locatie toevoegen
      </button>
    </div>
  )
}
