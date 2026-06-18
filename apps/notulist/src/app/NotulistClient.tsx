'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, FileText, Download, RotateCcw, Loader2, Clock, CheckCircle2, AlertCircle, Save, FolderOpen, Upload } from 'lucide-react'
import type { NotulenData } from '@ibizz/pdf'
import { createClient } from '@ibizz/supabase'
import type { Project } from '@ibizz/supabase'
import { TopBar, Select, IbizzMark } from '@ibizz/ui'
import type { AppId } from '@ibizz/ui'
import { useAuth } from '@/lib/auth'
import Sidebar, { type NotulistView } from '@/components/Sidebar'
import ArchiveView from '@/components/ArchiveView'

const APP_URLS: Record<AppId, string> = {
  friday: process.env.NEXT_PUBLIC_FRIDAY_URL ?? 'http://localhost:3000',
  notulist: process.env.NEXT_PUBLIC_NOTULIST_URL ?? 'http://localhost:3001',
  brandstudio: process.env.NEXT_PUBLIC_BRANDSTUDIO_URL ?? 'http://localhost:3002',
  'sea-agent': process.env.NEXT_PUBLIC_SEA_AGENT_URL ?? 'http://localhost:3003',
  'seo-agent': process.env.NEXT_PUBLIC_SEO_AGENT_URL ?? 'http://localhost:3005',
  'video-agent': process.env.NEXT_PUBLIC_VIDEO_AGENT_URL ?? 'http://localhost:3006',
  'motion-agent': process.env.NEXT_PUBLIC_MOTION_AGENT_URL ?? 'http://localhost:3007',
  'geo-agent': process.env.NEXT_PUBLIC_GEO_AGENT_URL ?? 'http://localhost:3008',
}

type Phase = 'idle' | 'recording' | 'transcribing' | 'generating' | 'done'

declare global {
  interface Window {
    SpeechRecognition: { new(): SpeechRecognition }
    webkitSpeechRecognition: { new(): SpeechRecognition }
  }
}

export default function NotulistClient() {
  const { user, userName, signOut } = useAuth()
  const [view, setView] = useState<NotulistView>('recorder')
  const [phase, setPhase] = useState<Phase>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [notulen, setNotulen] = useState<NotulenData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  // Save flow
  const [projects, setProjects] = useState<Project[]>([])
  const [saveTitle, setSaveTitle] = useState('')
  const [saveClient, setSaveClient] = useState('')
  const [saveProjectId, setSaveProjectId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Upload progress
  const [uploadQueue, setUploadQueue] = useState<{ name: string; status: 'pending' | 'uploading' | 'done' | 'error'; error?: string }[]>([])
  const [fixingName, setFixingName] = useState(false)
  const lastFixedNameRef = useRef('')

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptRef = useRef('')
  const transcriptBoxRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Load projects for the dropdown
  useEffect(() => {
    supabase.from('projects').select('*').order('created_at').then(({ data }) => {
      setProjects((data ?? []) as Project[])
    })
  }, [])

  useEffect(() => {
    if (phase === 'recording') {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptBoxRef.current) {
      transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight
    }
  }, [transcript, interimText])

  const startRecording = useCallback(() => {
    setError(null)
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setError('Je browser ondersteunt geen spraakherkenning. Gebruik Chrome of Edge.')
      return
    }

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'nl-NL'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = transcriptRef.current
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += (final && !final.endsWith(' ') ? ' ' : '') + text
        } else {
          interim = text
        }
      }
      transcriptRef.current = final
      setTranscript(final)
      setInterimText(interim)
    }

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'no-speech') {
        setError(`Microfoon fout: ${e.error}`)
      }
    }

    // Restart on end (browser stops after ~60s silence)
    recognition.onend = () => {
      if (phase === 'recording' || recognitionRef.current === recognition) {
        try { recognition.start() } catch { /* already stopped intentionally */ }
      }
    }

    recognition.start()
    recognitionRef.current = recognition
    setPhase('recording')
    setElapsed(0)
    setTranscript('')
    setInterimText('')
    transcriptRef.current = ''
  }, [phase])

  const generateFromTranscript = useCallback(async (full: string) => {
    setPhase('generating')
    try {
      const res = await fetch('/api/notulen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: full }),
      })
      if (!res.ok) throw new Error('API fout')
      const data: NotulenData = await res.json()
      setNotulen(data)
      setSaveTitle(`Notulen ${new Date().toLocaleDateString('nl-NL')}`)
      setPhase('done')
    } catch {
      setError('Notulen genereren mislukt. Probeer opnieuw.')
      setPhase('idle')
    }
  }, [])

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    setError(null)
    setPhase('transcribing')
    setTranscript('')
    transcriptRef.current = ''

    const queue = files.map(f => ({ name: f.name, status: 'pending' as const }))
    setUploadQueue(queue)

    const transcripts: string[] = []
    let anyError = false

    for (let i = 0; i < files.length; i++) {
      setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'uploading' } : q))
      try {
        const fd = new FormData()
        fd.append('file', files[i])
        const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
        if (!res.ok) {
          const { error: msg } = await res.json().catch(() => ({ error: 'Transcribe fout' }))
          throw new Error(msg)
        }
        const { transcript: t } = await res.json()
        transcripts.push(`[${files[i].name}]\n${t}`)
        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'done' } : q))
      } catch (e) {
        anyError = true
        const msg = e instanceof Error ? e.message : 'Fout'
        setUploadQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'error', error: msg } : q))
      }
    }

    if (transcripts.length === 0) {
      setError('Alle bestanden zijn mislukt.')
      setPhase('idle')
      return
    }

    if (anyError) {
      // doorgaan met wat we hebben, maar log
      console.warn('Sommige bestanden zijn mislukt')
    }

    const combined = transcripts.join('\n\n--- volgende opname ---\n\n')
    transcriptRef.current = combined
    setTranscript(combined)
    await generateFromTranscript(combined)
  }, [generateFromTranscript])

  const stopAndGenerate = useCallback(async () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.stop()
    setInterimText('')

    const full = transcriptRef.current.trim()
    if (!full) {
      setError('Geen spraak herkend. Probeer opnieuw.')
      setPhase('idle')
      return
    }

    await generateFromTranscript(full)
  }, [generateFromTranscript])

  const reset = useCallback(() => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    recognition?.stop()
    setPhase('idle')
    setTranscript('')
    setInterimText('')
    setNotulen(null)
    setError(null)
    setElapsed(0)
    setSaveTitle('')
    setSaveClient('')
    setSaveProjectId('')
    setSaved(false)
    transcriptRef.current = ''
  }, [])

  const fixClientName = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed || !notulen || trimmed === lastFixedNameRef.current) return
    lastFixedNameRef.current = trimmed
    setFixingName(true)
    try {
      const res = await fetch('/api/notulen-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notulen, correctName: trimmed }),
      })
      if (res.ok) {
        const corrected: NotulenData = await res.json()
        setNotulen(corrected)
      }
    } catch {
      // stilletjes falen — gebruiker behoudt origineel
    } finally {
      setFixingName(false)
    }
  }, [notulen])

  const saveToProject = useCallback(async () => {
    if (!notulen || !saveTitle.trim()) return
    setSaving(true)
    const { error: insertError } = await supabase.from('notulen').insert({
      project_id: saveProjectId || null,
      title: saveTitle.trim(),
      client_name: saveClient.trim() || null,
      datum: notulen.datum,
      aanwezig: notulen.aanwezig,
      samenvatting: notulen.samenvatting,
      agendapunten: notulen.agendapunten,
      besluiten: notulen.besluiten,
      actiepunten: notulen.actiepunten,
      volgende_vergadering: notulen.volgende_vergadering,
      transcript: transcriptRef.current,
      created_by: user?.id ?? null,
      created_by_name: userName || null,
    })
    setSaving(false)
    if (insertError) {
      setError('Opslaan mislukt: ' + insertError.message)
    } else {
      setSaved(true)
    }
  }, [notulen, saveTitle, saveClient, saveProjectId])

  const downloadPDF = useCallback(async () => {
    if (!notulen) return
    const { generateNotulenPDF } = await import('@ibizz/pdf')
    generateNotulenPDF(notulen)
  }, [notulen])

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    return `${m}:${(s % 60).toString().padStart(2, '0')}`
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      <TopBar
        currentApp="notulist"
        appUrls={APP_URLS}
        userName={userName}
        userColor="#EB4628"
        onSignOut={signOut}
        extras={view === 'recorder' && phase !== 'idle' ? (
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors px-2"
          >
            <RotateCcw size={14} />
            Nieuwe vergadering
          </button>
        ) : null}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar view={view} onSelect={setView} />

        {view === 'archive' ? (
          <main className="flex-1 overflow-hidden bg-gray-50">
            <ArchiveView />
          </main>
        ) : (
      /* ── Recorder content ─────────────────────────────── */
      <main className="flex-1 overflow-y-auto flex flex-col items-center py-12 px-4">

        {/* Error banner */}
        {error && (
          <div className="w-full max-w-2xl mb-6 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* ── IDLE ─────────────────────────────────────────── */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center text-center max-w-md">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: '#EB462815' }}>
              <Mic size={40} style={{ color: '#EB4628' }} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Vergadering opnemen</h1>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              Start de opname, of upload een bestaande opname (m4a, mp3, mp4, mov, etc.) en ontvang automatisch professionele notulen.
            </p>

            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-8 py-3.5 rounded-2xl text-white font-semibold text-sm shadow-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#EB4628' }}
            >
              <Mic size={17} />
              Start vergadering
            </button>

            <div className="flex items-center gap-3 my-5 w-full max-w-xs">
              <span className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">of</span>
              <span className="flex-1 h-px bg-gray-200" />
            </div>

            <label className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border border-gray-200 hover:border-[#EB4628] cursor-pointer text-sm font-semibold text-gray-700 transition-colors">
              <Upload size={15} />
              Upload bestanden
              <input
                type="file"
                multiple
                accept="audio/*,video/*,.m4a,.mp3,.wav,.mp4,.mov,.avi,.webm,.ogg,.flac"
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length > 0) uploadFiles(files)
                  e.target.value = ''
                }}
              />
            </label>

            <p className="text-xs text-gray-400 mt-4">Max 25MB per bestand · meerdere tegelijk · Nederlands</p>
          </div>
        )}

        {/* ── TRANSCRIBING ──────────────────────────────────── */}
        {phase === 'transcribing' && (
          <div className="w-full max-w-md flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EB462812' }}>
              <IbizzMark size={36} animate className="text-[#EB4628]" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-800 mb-1">
                {uploadQueue.length > 1 ? `Bestanden worden getranscribeerd…` : `Bestand wordt getranscribeerd…`}
              </p>
              <p className="text-sm text-gray-400">Gemini analyseert je opname{uploadQueue.length > 1 ? 's' : ''}. Dit kan even duren.</p>
            </div>

            {uploadQueue.length > 0 && (
              <div className="w-full bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
                {uploadQueue.map((q, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    {q.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200" />}
                    {q.status === 'uploading' && <Loader2 size={14} className="animate-spin" style={{ color: '#EB4628' }} />}
                    {q.status === 'done' && <CheckCircle2 size={14} className="text-green-500" />}
                    {q.status === 'error' && <AlertCircle size={14} className="text-red-500" />}
                    <span className="flex-1 truncate text-gray-700">{q.name}</span>
                    {q.status === 'uploading' && <span className="text-xs text-gray-400">bezig…</span>}
                    {q.status === 'done' && <span className="text-xs text-green-600">klaar</span>}
                    {q.status === 'error' && (
                      <span className="text-xs text-red-500 truncate max-w-[180px]" title={q.error}>{q.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── RECORDING ────────────────────────────────────── */}
        {phase === 'recording' && (
          <div className="w-full max-w-2xl flex flex-col gap-5">

            {/* Recording status bar */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-red-400 animate-ping opacity-50" />
                </div>
                <span className="text-sm font-semibold text-gray-800">Opname bezig</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Clock size={14} />
                <span className="text-sm font-mono">{fmt(elapsed)}</span>
              </div>
            </div>

            {/* Live transcript */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <FileText size={14} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Live transcript</span>
              </div>
              <div
                ref={transcriptBoxRef}
                className="h-72 overflow-y-auto p-5 text-sm text-gray-700 leading-relaxed"
              >
                {transcript || interimText ? (
                  <>
                    <span>{transcript}</span>
                    {interimText && (
                      <span className="text-gray-400 italic"> {interimText}</span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-400 italic">Spreek nu… de tekst verschijnt hier vanzelf.</span>
                )}
              </div>
            </div>

            {/* Stop button */}
            <button
              onClick={stopAndGenerate}
              disabled={!transcript && !interimText}
              className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm shadow hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#EB4628' }}
            >
              <MicOff size={16} />
              Stop & genereer notulen
            </button>
          </div>
        )}

        {/* ── GENERATING ───────────────────────────────────── */}
        {phase === 'generating' && (
          <div className="flex flex-col items-center gap-5 text-center max-w-sm">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EB462812' }}>
              <IbizzMark size={36} animate className="text-[#EB4628]" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800 mb-1">Notulen worden opgesteld…</p>
              <p className="text-sm text-gray-400">Claude analyseert de vergadering en maakt gestructureerde notulen.</p>
            </div>
          </div>
        )}

        {/* ── DONE ─────────────────────────────────────────── */}
        {phase === 'done' && notulen && (
          <div className="w-full max-w-2xl flex flex-col gap-4">

            {/* Success + download */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 size={18} />
                <span className="text-sm font-semibold">Notulen klaar</span>
              </div>
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#EB4628' }}
              >
                <Download size={15} />
                Download PDF
              </button>
            </div>

            {/* Save naar project */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <FolderOpen size={16} className="text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-800">Opslaan in Friday</h3>
              </div>
              {saved ? (
                <div className="flex items-center gap-2 text-green-600 text-sm py-2">
                  <CheckCircle2 size={16} />
                  Opgeslagen — terug te vinden via de Notulen knop in Friday
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Titel</label>
                    <input
                      value={saveTitle}
                      onChange={e => setSaveTitle(e.target.value)}
                      placeholder="Bijv. Kickoff vergadering"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#EB4628]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-2">
                      Klant
                      {fixingName && (
                        <span className="flex items-center gap-1 text-[10px] normal-case text-gray-400">
                          <IbizzMark size={11} animate className="text-[#EB4628]" />
                          naam corrigeren in notulen…
                        </span>
                      )}
                    </label>
                    <input
                      value={saveClient}
                      onChange={e => setSaveClient(e.target.value)}
                      onBlur={e => fixClientName(e.target.value)}
                      placeholder="Naam van de klant"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#EB4628]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Project</label>
                    <Select
                      value={saveProjectId}
                      onChange={setSaveProjectId}
                      placeholder="Geen project"
                      options={[{ value: '', label: 'Geen project' }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
                      className="w-full"
                    />
                  </div>
                  <button
                    onClick={saveToProject}
                    disabled={!saveTitle.trim() || saving}
                    className="w-full mt-2 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#EB4628' }}
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {saving ? 'Opslaan…' : 'Opslaan'}
                  </button>
                </div>
              )}
            </div>

            {/* Notulen preview */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

              {/* Preview header */}
              <div className="h-2" style={{ backgroundColor: '#EB4628' }} />
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-xs text-gray-400 mb-0.5">{notulen.datum}</p>
                {notulen.aanwezig.length > 0 && (
                  <p className="text-xs text-gray-500">Aanwezig: {notulen.aanwezig.join(', ')}</p>
                )}
              </div>

              <div className="p-6 space-y-6">

                {/* Samenvatting */}
                <Section title="Samenvatting">
                  <p className="text-sm text-gray-600 leading-relaxed">{notulen.samenvatting}</p>
                </Section>

                {/* Agendapunten */}
                {notulen.agendapunten.length > 0 && (
                  <Section title="Agendapunten">
                    <div className="space-y-3">
                      {notulen.agendapunten.map((item, i) => (
                        <div key={i}>
                          <p className="text-sm font-semibold text-gray-800">{i + 1}. {item.titel}</p>
                          <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{item.toelichting}</p>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Besluiten */}
                {notulen.besluiten.length > 0 && (
                  <Section title="Besluiten">
                    <ul className="space-y-1.5">
                      {notulen.besluiten.map((b, i) => (
                        <li key={i} className="text-sm text-gray-600 flex gap-2">
                          <span style={{ color: '#EB4628' }}>→</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Actiepunten */}
                {notulen.actiepunten.length > 0 && (
                  <Section title="Actiepunten">
                    <div className="space-y-2">
                      {notulen.actiepunten.map((ap, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                          <div className="w-4 h-4 mt-0.5 rounded border-2 border-gray-300 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-800">{ap.actie}</p>
                            {(ap.eigenaar || ap.deadline) && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {[ap.eigenaar, ap.deadline].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Volgende vergadering */}
                {notulen.volgende_vergadering && (
                  <Section title="Volgende vergadering">
                    <p className="text-sm text-gray-600">{notulen.volgende_vergadering}</p>
                  </Section>
                )}
              </div>
            </div>

          </div>
        )}
      </main>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: '#EB4628' }} />
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  )
}
