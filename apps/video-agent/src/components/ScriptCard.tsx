'use client'

import { useEffect, useState } from 'react'
import {
  ChevronDown, ChevronRight, Trash2, Plus, X, GripVertical,
  Target, Lightbulb, MapPin, Clock, Users, ClipboardList, Zap, Wand2,
  Mic, Camera, Type, Film, Megaphone, Hash, Shuffle,
} from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { Select } from '@ibizz/ui'
import type {
  VideoScript, VideoCastRole, VideoProductieToets, VideoScriptLine,
  VideoShot, VideoTextOverlay, VideoShotTag, VideoKostencategorie,
} from '@ibizz/supabase'

type Props = {
  script: VideoScript
  expandedDefault?: boolean
  onUpdated: (s: VideoScript) => void
  onDeleted: (id: string) => void
}

const KOST_PILL: Record<VideoKostencategorie, string> = {
  'LAAG':         'bg-green-100 text-green-700',
  'LAAG-MIDDEL':  'bg-emerald-100 text-emerald-700',
  'MIDDEL':       'bg-yellow-100 text-yellow-700',
  'MIDDEL-HOOG':  'bg-orange-100 text-orange-700',
  'HOOG':         'bg-red-100 text-red-700',
}

const KOST_OPTIONS: VideoKostencategorie[] = ['LAAG', 'LAAG-MIDDEL', 'MIDDEL', 'MIDDEL-HOOG', 'HOOG']
const SHOT_TAGS: VideoShotTag[] = ['REAL', 'CGI', 'STOCK']

export default function ScriptCard({ script, expandedDefault = false, onUpdated, onDeleted }: Props) {
  const [local, setLocal] = useState<VideoScript>(script)
  const [expanded, setExpanded] = useState(expandedDefault)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const supabase = createClient()

  useEffect(() => { setLocal(script) }, [script])

  async function patch(partial: Partial<Omit<VideoScript, 'id' | 'brief_id' | 'created_at'>>) {
    const next = { ...local, ...partial, updated_at: new Date().toISOString() }
    setLocal(next)
    const { data } = await supabase
      .from('video_scripts')
      .update(partial)
      .eq('id', local.id)
      .select()
      .single()
    if (data) onUpdated(data as VideoScript)
  }

  async function deleteScript() {
    await supabase.from('video_scripts').delete().eq('id', local.id)
    onDeleted(local.id)
  }

  const kost = local.productie_toets?.kostencategorie ?? null

  return (
    <article className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => setExpanded(e => !e)}
          className="p-0.5 rounded text-gray-400 hover:text-gray-700"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold">
          {local.nummer}
        </span>

        <input
          value={local.titel}
          onChange={e => setLocal(prev => ({ ...prev, titel: e.target.value }))}
          onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== script.titel) patch({ titel: e.target.value.trim() }) }}
          className="flex-1 text-sm font-bold text-gray-900 outline-none focus:border-b focus:border-[#EB4628] bg-transparent pb-0.5"
        />

        <div className="flex items-center gap-2 flex-shrink-0">
          {local.lengte_sec && (
            <span className="text-[10px] font-medium text-gray-500 px-1.5 py-0.5 bg-gray-100 rounded">
              ~{local.lengte_sec}s
            </span>
          )}
          {kost && (
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${KOST_PILL[kost]}`}>
              {kost}
            </span>
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50"
            title="Script verwijderen"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Collapsed preview */}
      {!expanded && (local.hook || local.doel) && (
        <div className="px-5 py-3 text-xs text-gray-500 line-clamp-2 leading-relaxed">
          {local.hook ?? local.doel}
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div className="px-5 py-4 space-y-5">
          <Row icon={<Target size={12} />} label="Doel">
            <TextArea
              value={local.doel ?? ''}
              placeholder="Direct laten zien dat ... — 1-2 zinnen, waarom bestaat deze video"
              onLocal={v => setLocal(prev => ({ ...prev, doel: v }))}
              onCommit={v => patch({ doel: v || null })}
            />
          </Row>

          <Row icon={<Lightbulb size={12} />} label="Inzicht">
            <TextArea
              value={local.inzicht ?? ''}
              placeholder="Het psychologische of culturele inzicht waar het concept op leunt"
              onLocal={v => setLocal(prev => ({ ...prev, inzicht: v }))}
              onCommit={v => patch({ inzicht: v || null })}
            />
          </Row>

          <div className="grid grid-cols-3 gap-3">
            <Row icon={<MapPin size={12} />} label="Locatie" className="col-span-2">
              <TextInput
                value={local.locatie ?? ''}
                placeholder="Bijv. Eindhoven Airport check-in zone"
                onLocal={v => setLocal(prev => ({ ...prev, locatie: v }))}
                onCommit={v => patch({ locatie: v || null })}
              />
            </Row>
            <Row icon={<Clock size={12} />} label="Lengte (sec)">
              <input
                type="number"
                min={5}
                max={180}
                value={local.lengte_sec ?? ''}
                onChange={e => setLocal(prev => ({ ...prev, lengte_sec: e.target.value === '' ? null : parseInt(e.target.value, 10) }))}
                onBlur={e => patch({ lengte_sec: e.target.value === '' ? null : Math.max(5, Math.min(180, parseInt(e.target.value, 10))) })}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#EB4628]"
              />
            </Row>
          </div>

          <Row icon={<Users size={12} />} label="Cast (rollen)">
            <CastList cast={local.cast_rollen ?? []} onChange={cast => patch({ cast_rollen: cast })} />
          </Row>

          <Row icon={<ClipboardList size={12} />} label="Productie-toets">
            <ProductieToetsForm
              value={local.productie_toets}
              onChange={pt => patch({ productie_toets: pt })}
            />
          </Row>

          <Row icon={<Zap size={12} />} label="Hook">
            <TextArea
              value={local.hook ?? ''}
              placeholder="De fysieke/visuele openingsmove — 1-2 zinnen, geen praat-opening"
              rows={3}
              onLocal={v => setLocal(prev => ({ ...prev, hook: v }))}
              onCommit={v => patch({ hook: v || null })}
            />
          </Row>

          <Row icon={<Wand2 size={12} />} label="Concept">
            <TextArea
              value={local.concept ?? ''}
              placeholder="Hoe de scene zich ontvouwt — 2-4 zinnen"
              rows={3}
              onLocal={v => setLocal(prev => ({ ...prev, concept: v }))}
              onCommit={v => patch({ concept: v || null })}
            />
          </Row>

          <Row icon={<Mic size={12} />} label="Script (voice-over + directions)">
            <ScriptLinesEditor
              lines={local.script_lines ?? []}
              onChange={lines => patch({ script_lines: lines })}
            />
          </Row>

          <Row icon={<Camera size={12} />} label="Shotlist">
            <ShotlistEditor
              shots={local.shotlist ?? []}
              onChange={shots => patch({ shotlist: shots })}
            />
          </Row>

          <Row icon={<Type size={12} />} label="Tekst in beeld">
            <OverlayEditor
              overlays={local.tekst_in_beeld ?? []}
              onChange={ovs => patch({ tekst_in_beeld: ovs })}
            />
          </Row>

          <Row icon={<Film size={12} />} label="Montage">
            <TextArea
              value={local.montage ?? ''}
              placeholder="Editing-aanwijzingen: slow-mo, sound design, muziek, ritme"
              rows={3}
              onLocal={v => setLocal(prev => ({ ...prev, montage: v }))}
              onCommit={v => patch({ montage: v || null })}
            />
          </Row>

          <div className="grid grid-cols-2 gap-4">
            <Row icon={<Megaphone size={12} />} label="Call-to-action">
              <TextArea
                value={local.cta ?? ''}
                placeholder="Korte krachtige afsluiter"
                rows={2}
                onLocal={v => setLocal(prev => ({ ...prev, cta: v }))}
                onCommit={v => patch({ cta: v || null })}
              />
            </Row>
            <Row icon={<Hash size={12} />} label="Caption">
              <TextArea
                value={local.caption ?? ''}
                placeholder="Social caption"
                rows={2}
                onLocal={v => setLocal(prev => ({ ...prev, caption: v }))}
                onCommit={v => patch({ caption: v || null })}
              />
            </Row>
          </div>

          <Row icon={<Shuffle size={12} />} label="Variaties (alternatieve hook/CTA)">
            <VariatiesEditor
              variaties={local.variaties ?? []}
              onChange={vs => patch({ variaties: vs })}
            />
          </Row>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">Script verwijderen?</h3>
            <p className="text-xs text-gray-400 text-center mb-6">
              Script {local.nummer} (&ldquo;{local.titel}&rdquo;) wordt permanent verwijderd.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
                Annuleren
              </button>
              <button onClick={deleteScript} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600">
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

// ─── Generic Row ────────────────────────────────────────────────────────
function Row({ icon, label, children, className = '' }: { icon: React.ReactNode; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        <span className="text-[#EB4628]">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── Inputs with onBlur commit ──────────────────────────────────────────
function TextInput({ value, placeholder, onLocal, onCommit }: { value: string; placeholder?: string; onLocal: (v: string) => void; onCommit: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={e => onLocal(e.target.value)}
      onBlur={e => onCommit(e.target.value.trim())}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#EB4628]"
    />
  )
}

function TextArea({ value, placeholder, rows = 2, onLocal, onCommit }: { value: string; placeholder?: string; rows?: number; onLocal: (v: string) => void; onCommit: (v: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={e => onLocal(e.target.value)}
      onBlur={e => onCommit(e.target.value.trim())}
      placeholder={placeholder}
      rows={rows}
      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs leading-relaxed outline-none focus:border-[#EB4628] resize-none"
    />
  )
}

// ─── Cast list ──────────────────────────────────────────────────────────
function CastList({ cast, onChange }: { cast: VideoCastRole[]; onChange: (c: VideoCastRole[]) => void }) {
  function update(i: number, p: Partial<VideoCastRole>) { onChange(cast.map((c, j) => j === i ? { ...c, ...p } : c)) }
  function remove(i: number) { onChange(cast.filter((_, j) => j !== i)) }
  function add() { onChange([...cast, { rol: '', aantal: 1, omschrijving: null }]) }

  return (
    <div className="space-y-1.5">
      {cast.map((role, i) => (
        <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
          <input
            type="number" min={1}
            value={role.aantal}
            onChange={e => update(i, { aantal: Math.max(1, parseInt(e.target.value || '1', 10)) })}
            className="col-span-1 border border-gray-200 rounded-lg px-1.5 py-1 text-xs outline-none focus:border-[#EB4628] text-center"
          />
          <input
            value={role.rol}
            onChange={e => update(i, { rol: e.target.value })}
            placeholder="Rol"
            className="col-span-4 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#EB4628]"
          />
          <input
            value={role.omschrijving ?? ''}
            onChange={e => update(i, { omschrijving: e.target.value || null })}
            placeholder="Omschrijving"
            className="col-span-6 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#EB4628]"
          />
          <button onClick={() => remove(i)} className="col-span-1 p-1 rounded text-gray-300 hover:text-red-500 justify-self-end">
            <X size={11} />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 text-[11px] font-semibold text-[#EB4628] hover:underline">
        <Plus size={10} /> Cast-rol
      </button>
    </div>
  )
}

// ─── Productie-toets ────────────────────────────────────────────────────
function ProductieToetsForm({ value, onChange }: { value: VideoProductieToets | null; onChange: (v: VideoProductieToets) => void }) {
  const pt: VideoProductieToets = value ?? {
    cast: '', locatie: '', props: '', permits: '', productietijd: '', risico: '', kostencategorie: 'MIDDEL',
  }
  function field(key: keyof VideoProductieToets, val: VideoProductieToets[keyof VideoProductieToets]) {
    onChange({ ...pt, [key]: val })
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <PtField label="Cast" value={pt.cast} onChange={v => field('cast', v)} placeholder="1 actrice" />
        <PtField label="Locatie" value={pt.locatie} onChange={v => field('locatie', v)} placeholder="Eindhoven Airport publiek" />
        <PtField label="Props" value={pt.props} onChange={v => field('props', v)} placeholder="Het product, casual outfit" />
        <PtField label="Permits" value={pt.permits} onChange={v => field('permits', v)} placeholder="Geen — DJI OSMO Pocket 3" />
        <PtField label="Productietijd" value={pt.productietijd} onChange={v => field('productietijd', v)} placeholder="3 uur incl. reis" />
        <PtField label="Risico" value={pt.risico} onChange={v => field('risico', v)} placeholder="Drukte kan opnames hinderen" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Kostencategorie</label>
        <Select
          variant="badge"
          compact
          value={pt.kostencategorie}
          onChange={v => field('kostencategorie', v as VideoKostencategorie)}
          options={KOST_OPTIONS.map(k => ({ value: k, label: k, className: KOST_PILL[k] }))}
        />
      </div>
    </div>
  )
}

function PtField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-500 mb-0.5">{label}</div>
      <input
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onChange(local) }}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#EB4628] bg-white"
      />
    </div>
  )
}

// ─── Script lines ───────────────────────────────────────────────────────
function ScriptLinesEditor({ lines, onChange }: { lines: VideoScriptLine[]; onChange: (l: VideoScriptLine[]) => void }) {
  function update(i: number, p: Partial<VideoScriptLine>) { onChange(lines.map((l, j) => j === i ? { ...l, ...p } : l)) }
  function remove(i: number) { onChange(lines.filter((_, j) => j !== i)) }
  function add(type: 'vo' | 'direction') { onChange([...lines, { type, text: '' }]) }

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <button
            type="button"
            onClick={() => update(i, { type: line.type === 'vo' ? 'direction' : 'vo' })}
            className={`flex-shrink-0 mt-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded transition-colors ${
              line.type === 'vo'
                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
            title="Klik om te wisselen tussen voice-over en direction"
          >
            {line.type === 'vo' ? 'VO' : 'DIR'}
          </button>
          <input
            value={line.text}
            onChange={e => update(i, { text: e.target.value })}
            placeholder={line.type === 'vo' ? '"Twee soorten reizigers."' : '(beat)'}
            className={`flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#EB4628] ${line.type === 'vo' ? 'italic' : 'text-gray-500'}`}
          />
          <button onClick={() => remove(i)} className="mt-1 p-0.5 rounded text-gray-300 hover:text-red-500">
            <X size={11} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={() => add('vo')} className="flex items-center gap-1 text-[11px] font-semibold text-[#EB4628] hover:underline">
          <Plus size={10} /> Voice-over regel
        </button>
        <button onClick={() => add('direction')} className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:underline">
          <Plus size={10} /> (Direction)
        </button>
      </div>
    </div>
  )
}

// ─── Shotlist ───────────────────────────────────────────────────────────
function ShotlistEditor({ shots, onChange }: { shots: VideoShot[]; onChange: (s: VideoShot[]) => void }) {
  function update(i: number, p: Partial<VideoShot>) { onChange(shots.map((s, j) => j === i ? { ...s, ...p } : s)) }
  function remove(i: number) {
    // Renumber after removal
    onChange(shots.filter((_, j) => j !== i).map((s, idx) => ({ ...s, nummer: idx + 1 })))
  }
  function add() {
    const last = shots[shots.length - 1]
    const startSec = last ? last.end_sec : 0
    onChange([...shots, { nummer: shots.length + 1, tag: 'REAL', beschrijving: '', start_sec: startSec, end_sec: startSec + 3 }])
  }

  return (
    <div className="space-y-1.5">
      {shots.map((shot, i) => (
        <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
          <span className="col-span-1 flex items-center justify-center text-[10px] font-bold text-gray-400">
            <GripVertical size={10} />{shot.nummer}
          </span>
          <select
            value={shot.tag}
            onChange={e => update(i, { tag: e.target.value as VideoShotTag })}
            className="col-span-1 border border-gray-200 rounded-lg px-1 py-1 text-[10px] font-bold outline-none focus:border-[#EB4628] bg-white"
          >
            {SHOT_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            value={shot.beschrijving}
            onChange={e => update(i, { beschrijving: e.target.value })}
            placeholder="Wide — vrouw staat op vliegveld, tas vliegt in beeld"
            className="col-span-7 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#EB4628]"
          />
          <div className="col-span-2 flex items-center gap-1">
            <input
              type="number" min={0}
              value={shot.start_sec}
              onChange={e => update(i, { start_sec: parseInt(e.target.value || '0', 10) })}
              className="w-12 border border-gray-200 rounded-lg px-1 py-1 text-xs outline-none focus:border-[#EB4628] text-center"
            />
            <span className="text-[10px] text-gray-400">→</span>
            <input
              type="number" min={0}
              value={shot.end_sec}
              onChange={e => update(i, { end_sec: parseInt(e.target.value || '0', 10) })}
              className="w-12 border border-gray-200 rounded-lg px-1 py-1 text-xs outline-none focus:border-[#EB4628] text-center"
            />
          </div>
          <button onClick={() => remove(i)} className="col-span-1 p-0.5 rounded text-gray-300 hover:text-red-500 justify-self-end">
            <X size={11} />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 text-[11px] font-semibold text-[#EB4628] hover:underline">
        <Plus size={10} /> Shot toevoegen
      </button>
    </div>
  )
}

// ─── Overlays (tekst in beeld) ──────────────────────────────────────────
function OverlayEditor({ overlays, onChange }: { overlays: VideoTextOverlay[]; onChange: (o: VideoTextOverlay[]) => void }) {
  function update(i: number, p: Partial<VideoTextOverlay>) { onChange(overlays.map((o, j) => j === i ? { ...o, ...p } : o)) }
  function remove(i: number) { onChange(overlays.filter((_, j) => j !== i)) }
  function add() { onChange([...overlays, { start_sec: 0, end_sec: null, text: '' }]) }

  return (
    <div className="space-y-1.5">
      {overlays.map((ov, i) => (
        <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
          <div className="col-span-3 flex items-center gap-1">
            <input
              type="number" min={0}
              value={ov.start_sec}
              onChange={e => update(i, { start_sec: parseInt(e.target.value || '0', 10) })}
              className="w-12 border border-gray-200 rounded-lg px-1 py-1 text-xs outline-none focus:border-[#EB4628] text-center"
            />
            <span className="text-[10px] text-gray-400">→</span>
            <input
              type="number" min={0}
              value={ov.end_sec ?? ''}
              onChange={e => update(i, { end_sec: e.target.value === '' ? null : parseInt(e.target.value, 10) })}
              placeholder="Eind"
              className="w-14 border border-gray-200 rounded-lg px-1 py-1 text-xs outline-none focus:border-[#EB4628] text-center"
            />
          </div>
          <input
            value={ov.text}
            onChange={e => update(i, { text: e.target.value })}
            placeholder='"Twee soorten reizigers."'
            className="col-span-8 italic border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#EB4628]"
          />
          <button onClick={() => remove(i)} className="col-span-1 p-0.5 rounded text-gray-300 hover:text-red-500 justify-self-end">
            <X size={11} />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 text-[11px] font-semibold text-[#EB4628] hover:underline">
        <Plus size={10} /> Overlay toevoegen
      </button>
    </div>
  )
}

// ─── Variaties ──────────────────────────────────────────────────────────
function VariatiesEditor({ variaties, onChange }: { variaties: string[]; onChange: (v: string[]) => void }) {
  function update(i: number, v: string) { onChange(variaties.map((x, j) => j === i ? v : x)) }
  function remove(i: number) { onChange(variaties.filter((_, j) => j !== i)) }
  function add() { onChange([...variaties, '']) }

  return (
    <div className="space-y-1.5">
      {variaties.map((v, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="mt-1 text-[10px] font-bold text-[#EB4628]">→</span>
          <input
            value={v}
            onChange={e => update(i, e.target.value)}
            placeholder='Alternatieve hook of CTA — bv. "Twee soorten reizigers. Welke ben jij?"'
            className="flex-1 italic border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-[#EB4628]"
          />
          <button onClick={() => remove(i)} className="mt-1 p-0.5 rounded text-gray-300 hover:text-red-500">
            <X size={11} />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 text-[11px] font-semibold text-[#EB4628] hover:underline">
        <Plus size={10} /> Variatie
      </button>
    </div>
  )
}

