'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MessageSquare, Plus, Trash2, Edit2, Save, X, Loader2, Users } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import type { SeoMessage, SeoPersona, SeoMessagePersona } from '@ibizz/supabase'

type Props = {
  briefId: string
  onCountChanged?: (n: number) => void
}

type MessageWithPersonas = SeoMessage & { personaIds: string[] }

export default function MessagesView({ briefId, onCountChanged }: Props) {
  const [messages, setMessages] = useState<MessageWithPersonas[]>([])
  const [personas, setPersonas] = useState<SeoPersona[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [draftNotes, setDraftNotes] = useState('')
  const [draftPersonaIds, setDraftPersonaIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const reload = useCallback(async () => {
    const [mRes, pRes] = await Promise.all([
      supabase.from('seo_messages').select('*').eq('brief_id', briefId).order('created_at', { ascending: false }),
      supabase.from('seo_personas').select('*').eq('brief_id', briefId).order('sort_order'),
    ])
    const msgList = (mRes.data ?? []) as SeoMessage[]
    const personaList = (pRes.data ?? []) as SeoPersona[]
    setPersonas(personaList)

    if (msgList.length === 0) {
      setMessages([])
      onCountChanged?.(0)
      setLoading(false)
      return
    }

    const { data: linkData } = await supabase
      .from('seo_message_personas')
      .select('*')
      .in('message_id', msgList.map(m => m.id))

    const links = (linkData ?? []) as SeoMessagePersona[]
    const enriched: MessageWithPersonas[] = msgList.map(m => ({
      ...m,
      personaIds: links.filter(l => l.message_id === m.id).map(l => l.persona_id),
    }))

    setMessages(enriched)
    onCountChanged?.(enriched.length)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefId])

  useEffect(() => { reload() }, [reload])

  function startCreate() {
    setEditingId('new')
    setDraftMessage('')
    setDraftNotes('')
    setDraftPersonaIds([])
  }

  function startEdit(m: MessageWithPersonas) {
    setEditingId(m.id)
    setDraftMessage(m.message)
    setDraftNotes(m.notes ?? '')
    setDraftPersonaIds([...m.personaIds])
  }

  function cancelEdit() {
    setEditingId(null)
    setDraftMessage('')
    setDraftNotes('')
    setDraftPersonaIds([])
  }

  async function save() {
    if (!draftMessage.trim()) return
    setSaving(true)

    let messageId: string

    if (editingId === 'new') {
      const { data, error } = await supabase
        .from('seo_messages')
        .insert({
          brief_id: briefId,
          message: draftMessage.trim(),
          notes: draftNotes.trim() || null,
        })
        .select()
        .single()
      if (error || !data) { setSaving(false); return }
      messageId = data.id
    } else {
      messageId = editingId!
      await supabase.from('seo_messages').update({
        message: draftMessage.trim(),
        notes: draftNotes.trim() || null,
      }).eq('id', messageId)

      // Verwijder bestaande koppelingen — opnieuw aanmaken
      await supabase.from('seo_message_personas').delete().eq('message_id', messageId)
    }

    // Voeg nieuwe persona koppelingen toe
    if (draftPersonaIds.length > 0) {
      await supabase.from('seo_message_personas').insert(
        draftPersonaIds.map(personaId => ({ message_id: messageId, persona_id: personaId }))
      )
    }

    setSaving(false)
    cancelEdit()
    await reload()
  }

  async function remove(id: string) {
    await supabase.from('seo_messages').delete().eq('id', id)
    await reload()
  }

  function togglePersona(id: string) {
    setDraftPersonaIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const personasById = useMemo(() => {
    const m = new Map<string, SeoPersona>()
    for (const p of personas) m.set(p.id, p)
    return m
  }, [personas])

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} style={{ color: '#EB4628' }} />
          <h2 className="text-base font-bold text-gray-900">Boodschappen</h2>
          <span className="text-xs text-gray-400">· {messages.length}</span>
        </div>
        {editingId === null && (
          <button
            onClick={startCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white hover:opacity-90"
            style={{ backgroundColor: '#EB4628' }}
          >
            <Plus size={12} />
            Boodschap toevoegen
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        Per klant heb je vaak meerdere kernboodschappen — elk gekoppeld aan andere persona&apos;s. Eén boodschap raakt nooit alle persona&apos;s, dus wissel per persona.
      </p>

      {/* Editor */}
      {editingId !== null && (
        <div className="bg-white border-2 border-[#EB4628] rounded-2xl p-5 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Boodschap</label>
            <textarea
              value={draftMessage}
              onChange={e => setDraftMessage(e.target.value)}
              placeholder="Bijv. 'Solipower maakt thuis-energie eenvoudig en betaalbaar voor ZZP'ers'"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#EB4628] resize-none"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notities (optioneel)</label>
            <textarea
              value={draftNotes}
              onChange={e => setDraftNotes(e.target.value)}
              placeholder="Context, achtergrond, do's en don'ts voor deze boodschap"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#EB4628] resize-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Voor welke persona&apos;s? <span className="text-gray-400 normal-case font-normal">({draftPersonaIds.length} geselecteerd)</span>
            </label>
            {personas.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Geen personas in deze brief — voeg eerst personas toe.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {personas.map(p => {
                  const selected = draftPersonaIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePersona(p.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selected
                          ? 'text-white shadow-sm'
                          : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                      }`}
                      style={selected ? { backgroundColor: '#EB4628' } : {}}
                    >
                      <span>{p.avatar_emoji}</span>
                      {p.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button onClick={cancelEdit} className="flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200">
              <X size={13} /> Annuleren
            </button>
            <button
              onClick={save}
              disabled={!draftMessage.trim() || saving}
              className="flex items-center gap-1 px-5 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: '#EB4628' }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Opslaan
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {messages.length === 0 && editingId === null ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 mx-auto mb-3 flex items-center justify-center">
            <MessageSquare size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Nog geen boodschappen</p>
          <p className="text-xs text-gray-400">Begin met je sterkste kernboodschap, koppel hem aan de relevante persona&apos;s.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map(m => (
            <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-relaxed">{m.message}</p>
                  {m.notes && (
                    <p className="text-xs text-gray-500 mt-1.5 leading-relaxed italic">{m.notes}</p>
                  )}
                  {m.personaIds.length > 0 ? (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2 text-[10px]">
                      <Users size={10} className="text-gray-400" />
                      {m.personaIds.map(pid => {
                        const p = personasById.get(pid)
                        if (!p) return null
                        return (
                          <span key={pid} className="flex items-center gap-1 bg-gray-100 rounded px-1.5 py-0.5">
                            <span>{p.avatar_emoji}</span>
                            <span className="font-semibold text-gray-700">{p.name}</span>
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-amber-600 mt-2 italic">⚠ Geen persona&apos;s gekoppeld</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(m)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#EB4628] hover:bg-gray-100"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => remove(m.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
