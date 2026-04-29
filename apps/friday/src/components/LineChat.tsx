'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@ibizz/supabase'
import type { Attachment, LineMessage } from '@ibizz/supabase'
import { format } from 'date-fns'
import { X, Send, Paperclip, FileText, Download, ImageIcon, AtSign } from 'lucide-react'

type Props = {
  lineId: string
  lineName: string
  userName: string
  onClose: () => void
}

type MentionItem = {
  type: 'user' | 'file'
  id: string
  label: string
  sub?: string
  url?: string
  color?: string
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function AttachmentPreview({ a }: { a: Attachment }) {
  const isImage = a.type.startsWith('image/')
  if (isImage) {
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img src={a.url} alt={a.name} className="max-w-full rounded-lg border border-gray-200 max-h-48 object-cover" />
      </a>
    )
  }
  return (
    <a href={a.url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 mt-1 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors group max-w-xs">
      <FileText size={16} className="text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{a.name}</p>
        <p className="text-xs text-gray-400">{formatSize(a.size)}</p>
      </div>
      <Download size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
    </a>
  )
}

const IBIZZ_RED = '#EB4628'

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderContent(content: string, colorMap: Record<string, string>) {
  const names = Object.keys(colorMap).sort((a, b) => b.length - a.length)
  const pattern = names.length
    ? new RegExp(`(@(?:${names.map(escapeRegex).join('|')}))`, 'gi')
    : /(@\S+)/g

  const parts = content.split(pattern)
  return parts.map((part, i) => {
    if (!part.startsWith('@')) return <span key={i}>{part}</span>
    const name = part.slice(1).toLowerCase()
    const isKnown = colorMap[name] !== undefined
    return (
      <span
        key={i}
        className="font-semibold rounded px-1 py-0.5 text-xs"
        style={isKnown
          ? { color: IBIZZ_RED, backgroundColor: 'rgba(235, 70, 40, 0.10)' }
          : { color: '#9ca3af' }
        }
      >
        {part}
      </span>
    )
  })
}

export default function LineChat({ lineId, lineName, userName, onClose }: Props) {
  const [messages, setMessages] = useState<LineMessage[]>([])
  const [input, setInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  // Mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([])
  const [mentionIndex, setMentionIndex] = useState(0)
  const [allItems, setAllItems] = useState<MentionItem[]>([])
  const [colorMap, setColorMap] = useState<Record<string, string>>({})

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  // Load users + files for mention
  useEffect(() => {
    async function loadMentionData() {
      const [{ data: profiles }, { data: msgs }] = await Promise.all([
        supabase.from('profiles').select('id, name, color'),
        supabase.from('line_messages').select('attachments').eq('line_id', lineId),
      ])

      const users: MentionItem[] = (profiles ?? []).map(p => ({
        type: 'user',
        id: p.id,
        label: p.name,
        color: p.color,
      }))

      // Build color map: lowercase name → color
      const map: Record<string, string> = {}
      ;(profiles ?? []).forEach(p => { map[p.name.toLowerCase()] = p.color })
      setColorMap(map)

      const files: MentionItem[] = (msgs ?? [])
        .flatMap(m => (m.attachments as Attachment[]) ?? [])
        .map(a => ({
          type: 'file',
          id: a.url,
          label: a.name,
          sub: formatSize(a.size),
          url: a.url,
        }))

      // deduplicate files by url
      const seen = new Set<string>()
      const uniqueFiles = files.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true })

      setAllItems([...users, ...uniqueFiles])
    }
    loadMentionData()
  }, [lineId, messages])

  // Load messages + realtime
  useEffect(() => {
    supabase
      .from('line_messages')
      .select('*')
      .eq('line_id', lineId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages((data ?? []) as LineMessage[]))

    const channel = supabase
      .channel(`chat-${lineId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'line_messages', filter: `line_id=eq.${lineId}` }, (payload) => {
        setMessages(prev => [...prev, payload.new as LineMessage])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [lineId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Detect @mention in input
  function detectMention(value: string, cursor: number) {
    const textBefore = value.slice(0, cursor)
    const match = textBefore.match(/@(\w*)$/)
    if (match) {
      const q = match[1].toLowerCase()
      setMentionQuery(q)
      const filtered = allItems.filter(item => item.label.toLowerCase().includes(q))
      setMentionItems(filtered.slice(0, 6))
      setMentionIndex(0)
    } else {
      setMentionQuery(null)
      setMentionItems([])
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setInput(val)
    detectMention(val, e.target.selectionStart ?? val.length)
  }

  function insertMention(item: MentionItem) {
    const cursor = textareaRef.current?.selectionStart ?? input.length
    const textBefore = input.slice(0, cursor)
    const textAfter = input.slice(cursor)
    const atIndex = textBefore.lastIndexOf('@')
    const mention = item.type === 'file' ? `@${item.label}` : `@${item.label}`
    const newText = textBefore.slice(0, atIndex) + mention + ' ' + textAfter
    setInput(newText)
    setMentionQuery(null)
    setMentionItems([])
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function onKey(e: React.KeyboardEvent) {
    if (mentionItems.length > 0 && mentionQuery !== null) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionItems.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); if (mentionItems[mentionIndex]) insertMention(mentionItems[mentionIndex]); return }
      if (e.key === 'Escape') { setMentionQuery(null); setMentionItems([]); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  async function uploadFiles(files: File[]): Promise<Attachment[]> {
    const results: Attachment[] = []
    for (const file of files) {
      const path = `${lineId}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('chat-files').upload(path, file)
      if (error) {
        console.error('Upload mislukt:', error.message)
        setUploadError(`Upload mislukt: ${error.message}`)
        continue
      }
      const { data } = supabase.storage.from('chat-files').getPublicUrl(path)
      results.push({ name: file.name, url: data.publicUrl, type: file.type, size: file.size })
    }
    return results
  }

  async function send() {
    const text = input.trim()
    if (!text && pendingFiles.length === 0) return
    setUploading(true)
    setInput('')
    setMentionQuery(null)
    setMentionItems([])
    const attachments = pendingFiles.length > 0 ? await uploadFiles(pendingFiles) : []
    setPendingFiles([])
    await supabase.from('line_messages').insert({
      line_id: lineId,
      user_name: userName,
      content: text || '',
      attachments,
    })
    setUploading(false)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) setPendingFiles(prev => [...prev, ...files])
    e.target.value = ''
  }

  const canSend = (input.trim().length > 0 || pendingFiles.length > 0) && !uploading

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Chat</p>
          <p className="text-sm font-semibold text-gray-800 truncate max-w-48">{lineName}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={16} /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">Nog geen berichten</p>
        )}
        {messages.map(m => (
          <div key={m.id}>
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-xs font-semibold text-gray-700">{m.user_name}</span>
              <span className="text-xs text-gray-400">{format(new Date(m.created_at), 'HH:mm')}</span>
            </div>
            {m.content && <p className="text-sm text-gray-800 leading-relaxed">{renderContent(m.content, colorMap)}</p>}
            {m.attachments?.map((a, i) => <AttachmentPreview key={i} a={a} />)}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="mx-3 mb-1 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <p className="text-xs text-red-600">{uploadError}</p>
          <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600 ml-2"><X size={12} /></button>
        </div>
      )}

      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div className="px-3 pt-2 flex flex-wrap gap-2 border-t border-gray-100">
          {pendingFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 py-1 text-xs text-gray-700">
              {f.type.startsWith('image/') ? <ImageIcon size={12} /> : <FileText size={12} />}
              <span className="max-w-24 truncate">{f.name}</span>
              <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-gray-600"><X size={10} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Mention dropdown */}
      {mentionItems.length > 0 && (
        <div className="mx-3 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-1.5">
            <AtSign size={11} className="text-gray-400" />
            <span className="text-xs text-gray-400">Taggen</span>
          </div>
          {mentionItems.map((item, i) => (
            <button
              key={item.id}
              onClick={() => insertMention(item)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${i === mentionIndex ? 'bg-gray-50' : ''}`}
            >
              {item.type === 'user' ? (
                <>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: item.color ?? '#6366f1' }}>
                    {item.label[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-800">{item.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">persoon</span>
                </>
              ) : (
                <>
                  <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <FileText size={12} className="text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{item.label}</p>
                    {item.sub && <p className="text-xs text-gray-400">{item.sub}</p>}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">bestand</span>
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-200">
        <div className="flex items-end gap-2 bg-gray-50 rounded-lg px-3 py-2">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileChange} />
          <button onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-[#e63a1e] transition-colors flex-shrink-0" title="Bestand toevoegen">
            <Paperclip size={16} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={onKey}
            placeholder="Stuur een bericht of typ @ om te taggen..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-800 resize-none outline-none placeholder-gray-400"
          />
          <button onClick={send} disabled={!canSend} className="text-[#e63a1e] disabled:opacity-30 hover:opacity-70 transition-opacity flex-shrink-0">
            {uploading
              ? <div className="w-4 h-4 border-2 border-[#e63a1e] border-t-transparent rounded-full animate-spin" />
              : <Send size={16} />}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 px-1">Typ <span className="font-medium">@</span> om een persoon of bestand te taggen</p>
      </div>
    </div>
  )
}
