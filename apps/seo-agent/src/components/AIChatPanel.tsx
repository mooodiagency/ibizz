'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { IbizzMark } from '@ibizz/ui'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

type Props = {
  briefId: string
  step: 'strategy' | 'keywords' | 'adcopy'
  currentOutput: unknown
  /** Wordt aangeroepen na een succesvolle iteratie zodat parent kan reloaden. */
  onIterated: () => void
  className?: string
}

const STEP_LABEL: Record<Props['step'], string> = {
  strategy: 'strategie',
  keywords: 'keyword research',
  adcopy: 'ad copy',
}

const SUGGESTIONS: Record<Props['step'], string[]> = {
  strategy: [
    'Verhoog het Search budget met €200',
    'Voeg een PMax campagne toe',
    'Maak de doelgroep specifieker',
  ],
  keywords: [
    'Splits deze ad group in twee thematische groepen',
    'Voeg meer long-tail keywords toe',
    'Maak alle non-branded keywords phrase match',
  ],
  adcopy: [
    'Maak de headlines actiegerichter',
    'Voeg "Solipower" toe op headline positie 2',
    'Verkort de descriptions die over 90 karakters gaan',
  ],
}

export default function AIChatPanel({ briefId, step, currentOutput, onIterated, className = '' }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Reset bij wisselen van brief/step
  useEffect(() => {
    setMessages([])
    setInput('')
    setError(null)
  }, [briefId, step])

  // Auto-scroll naar onder
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages, loading])

  async function send(message?: string) {
    const content = (message ?? input).trim()
    if (!content || loading) return

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/chat-iterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, step, currentOutput, messages: newMessages }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'AI iteratie mislukt')
      setMessages([...newMessages, { role: 'assistant', content: json.reply ?? 'Aangepast.' }])
      onIterated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Onbekende fout')
      // Rol de user message terug niet — laat staan zodat de gebruiker kan retryen
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-[#EB4628]" />
          <span className="text-sm font-bold text-gray-800">Chat met AI</span>
          <span className="text-xs text-gray-400">— geef extra feedback om de {STEP_LABEL[step]} bij te schaven</span>
          {messages.length > 0 && (
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
              {Math.ceil(messages.length / 2)} {Math.ceil(messages.length / 2) === 1 ? 'iteratie' : 'iteraties'}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Body: messages */}
          <div ref={bodyRef} className="max-h-72 overflow-y-auto px-5 py-4 space-y-3">
            {messages.length === 0 && !loading && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Probeer bijvoorbeeld:</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS[step].map((s, i) => (
                    <button
                      key={i}
                      onClick={() => send(s)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:border-[#EB4628] hover:text-[#EB4628] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#EB4628] text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.role === 'assistant' && (
                    <div className="flex items-center gap-1 mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      <Sparkles size={9} /> AI
                    </div>
                  )}
                  <span className="whitespace-pre-wrap break-words">{m.content}</span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-3 py-2 flex items-center gap-2 text-sm text-gray-500">
                  <IbizzMark size={14} animate className="text-[#EB4628]" />
                  AI denkt na en past aan…
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={`Vraag de AI om de ${STEP_LABEL[step]} aan te passen…`}
              disabled={loading}
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#EB4628] disabled:bg-gray-50"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="p-2 rounded-xl text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: '#EB4628' }}
              title="Verstuur"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
