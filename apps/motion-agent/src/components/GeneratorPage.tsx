'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Upload, X, Wand2, AlertCircle, Download, RotateCcw, Image as ImageIcon, Clock, Sparkles, Lock, Maximize2, Type } from 'lucide-react'
import { createClient } from '@ibizz/supabase'
import { Select, IbizzMark } from '@ibizz/ui'
import { VIDEO_MODELS } from '@ibizz/ai-video'
import type { Brand, MotionGeneration, MotionModelId, MotionAspectRatio, MotionResolution } from '@ibizz/supabase'
import { useAuth } from '@/lib/auth'
import VideoTextEditor from './VideoTextEditor'

const MAX_DIM = 1280   // client-side resize voor kleinere base64

type FillStyle = 'white' | 'blur' | 'ai'

export default function GeneratorPage() {
  const { user } = useAuth()
  const [brands, setBrands] = useState<Brand[]>([])
  const [brandId, setBrandId] = useState<string>('')
  // "working" image = wat naar het video-model gaat (origineel of uitgebreid)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageMime, setImageMime] = useState<string>('image/jpeg')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  // origineel blijft bewaard zodat we per formaat opnieuw kunnen uitbreiden
  const [originalBase64, setOriginalBase64] = useState<string | null>(null)
  const [originalMime, setOriginalMime] = useState<string>('image/jpeg')
  const [originalPreview, setOriginalPreview] = useState<string | null>(null)
  const [originalDims, setOriginalDims] = useState<{ w: number; h: number } | null>(null)
  const [extendedForAR, setExtendedForAR] = useState<MotionAspectRatio | null>(null)
  const [extending, setExtending] = useState(false)
  const [extendError, setExtendError] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<MotionModelId>('veo-3.1-fast')
  const [aspectRatio, setAspectRatio] = useState<MotionAspectRatio>('9:16')
  const [resolution, setResolution] = useState<MotionResolution>('720p')
  const [durationSec, setDurationSec] = useState(8)

  const [generating, setGenerating] = useState(false)
  const [active, setActive] = useState<MotionGeneration | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [textEditing, setTextEditing] = useState(false)

  // AI-regie (vision → prompt suggesties)
  const [hint, setHint] = useState('')
  const [suggestions, setSuggestions] = useState<{ title: string; prompt: string }[]>([])
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [productLock, setProductLock] = useState(true)
  const [audioMode, setAudioMode] = useState<'music' | 'silent'>('music')
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('brands').select('*').order('name').then(({ data }) => {
      setBrands((data ?? []) as Brand[])
    })
  }, [])

  // Cleanup timers
  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current)
    if (elapsedTimer.current) clearInterval(elapsedTimer.current)
  }, [])

  const availableModels = VIDEO_MODELS.filter(m => m.available)
  const modelInfo = VIDEO_MODELS.find(m => m.id === model)
  const estCost = modelInfo ? (modelInfo.pricePerSec * durationSec).toFixed(2) : null

  // AI kijkt naar de foto en stelt beweging-prompts voor
  const suggestPrompts = useCallback(async (opts?: { fillIfEmpty?: boolean }) => {
    if (!imageBase64) return
    setSuggestLoading(true)
    setSuggestError(null)
    try {
      const res = await fetch('/api/suggest-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          imageMimeType: imageMime,
          hint: hint.trim() || undefined,
          aspectRatio,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Suggesties mislukt')
      setSuggestions(data.suggestions ?? [])
      setAnalysis(data.productName ? `${data.productName} — ${data.analysis ?? ''}`.trim() : (data.analysis ?? null))
      // Product → lock standaard aan; persoon/scene → uit (die mogen bewegen)
      if (data.subjectType === 'product') setProductLock(true)
      else if (data.subjectType === 'persoon' || data.subjectType === 'scene') setProductLock(false)
      // Vul de prompt automatisch met de beste suggestie als 't veld leeg is
      if (opts?.fillIfEmpty) {
        setPrompt(p => (p.trim() ? p : (data.suggestions?.[0]?.prompt ?? p)))
      }
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : 'Suggesties mislukt')
    } finally {
      setSuggestLoading(false)
    }
  }, [imageBase64, imageMime, hint, aspectRatio])

  // Auto-suggest zodra er een nieuwe foto is geüpload (op origineel, niet op extend)
  useEffect(() => {
    if (originalBase64) {
      setSuggestions([])
      setAnalysis(null)
      suggestPrompts({ fillIfEmpty: true })
    }
    // alleen op nieuwe upload, niet op elke hint-toetsaanslag of frame-extend
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originalBase64])

  async function handleFile(file: File) {
    setError(null)
    setExtendError(null)
    if (!file.type.startsWith('image/')) {
      setError('Alleen afbeeldingen toegestaan')
      return
    }
    try {
      const { base64, mime, dataUrl, width, height } = await resizeImage(file, MAX_DIM)
      // origineel bewaren
      setOriginalBase64(base64)
      setOriginalMime(mime)
      setOriginalPreview(dataUrl)
      setOriginalDims({ w: width, h: height })
      setExtendedForAR(null)
      // working = origineel (tot we uitbreiden)
      setImageBase64(base64)
      setImageMime(mime)
      setImagePreview(dataUrl)
    } catch {
      setError('Kon afbeelding niet verwerken')
    }
  }

  function clearImage() {
    setImageBase64(null); setImagePreview(null)
    setOriginalBase64(null); setOriginalPreview(null); setOriginalDims(null)
    setExtendedForAR(null); setExtendError(null)
    setSuggestions([]); setAnalysis(null)
  }

  // ── Kader-vullen (outpaint) ──────────────────────────────────────────
  const targetARValue = aspectRatio === '16:9' ? 16 / 9 : 9 / 16
  const sourceARValue = originalDims ? originalDims.w / originalDims.h : null
  const arMatches = sourceARValue == null ? true : Math.abs(sourceARValue - targetARValue) / targetARValue < 0.04
  const isFramed = extendedForAR === aspectRatio
  const needsFraming = !!originalBase64 && !arMatches && !isFramed

  // style: 'white'/'blur' = gratis client-side; 'ai' = Gemini (vult de rand schermvullend)
  async function runFill(style: FillStyle): Promise<{ base64: string; mime: string } | null> {
    if (!originalBase64 || !originalDims) return null
    setExtending(true)
    setExtendError(null)
    try {
      // ── Gratis lokale fill (geen API) ──
      if (style === 'white' || style === 'blur') {
        if (!originalPreview) throw new Error('Geen bron-afbeelding')
        const filled = await fillFrameLocal(originalPreview, aspectRatio, style)
        setImageBase64(filled.base64)
        setImageMime(filled.mime)
        setImagePreview(filled.dataUrl)
        setExtendedForAR(aspectRatio)
        return { base64: filled.base64, mime: filled.mime }
      }

      // ── AI-scène via Gemini (gebruikt GEMINI_API_KEY, los van fal) ──
      // Product eerst deterministisch gecentreerd op wit canvas, Gemini vult de rand
      if (!originalPreview) throw new Error('Geen bron-afbeelding')
      const composite = await fillFrameLocal(originalPreview, aspectRatio, 'white')
      const res = await fetch('/api/extend-frame-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: composite.base64,
          imageMimeType: composite.mime,
          aspectRatio,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI kader vullen mislukt')
      const aiMime = data.mimeType ?? 'image/png'
      // Normaliseer naar exact 9:16/16:9 — voorkomt zwarte rand bij Veo
      const norm = await coverToCanvas(`data:${aiMime};base64,${data.base64}`, aspectRatio)
      setImageBase64(norm.base64)
      setImageMime(norm.mime)
      setImagePreview(norm.dataUrl)
      setExtendedForAR(aspectRatio)
      return { base64: norm.base64, mime: norm.mime }
    } catch (e) {
      setExtendError(e instanceof Error ? e.message : 'Kader vullen mislukt')
      return null
    } finally {
      setExtending(false)
    }
  }

  function changeAspectRatio(ar: MotionAspectRatio) {
    if (ar === aspectRatio) return
    setAspectRatio(ar)
    // Uitgebreide frame gold voor het oude formaat → terug naar origineel
    if (extendedForAR && extendedForAR !== ar && originalBase64) {
      setImageBase64(originalBase64)
      setImageMime(originalMime)
      setImagePreview(originalPreview)
      setExtendedForAR(null)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const startPolling = useCallback((id: string) => {
    async function tick() {
      try {
        const res = await fetch(`/api/poll-video?id=${id}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Poll mislukt')
        const gen = data.generation as MotionGeneration
        setActive(gen)
        if (gen.status === 'running') {
          pollTimer.current = setTimeout(tick, 6000)
        } else {
          // klaar of gefaald
          setGenerating(false)
          if (elapsedTimer.current) clearInterval(elapsedTimer.current)
          if (gen.status === 'failed') setError(gen.error ?? 'Generatie mislukt')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Poll mislukt')
        setGenerating(false)
        if (elapsedTimer.current) clearInterval(elapsedTimer.current)
      }
    }
    pollTimer.current = setTimeout(tick, 6000)
  }, [])

  async function generate() {
    if (!originalBase64 || !prompt.trim()) return
    setGenerating(true)
    setError(null)
    setActive(null)
    setElapsed(0)
    elapsedTimer.current = setInterval(() => setElapsed(e => e + 1), 1000)

    // Kader vullen indien het formaat niet matcht — voorkomt zwarte balken.
    // Auto = gratis witte fill (geen credits nodig).
    let imgB64 = imageBase64 ?? originalBase64
    let imgMime = imageMime
    if (needsFraming) {
      const framed = await runFill('white')
      if (!framed) {
        setGenerating(false)
        if (elapsedTimer.current) clearInterval(elapsedTimer.current)
        setError('Kader vullen mislukt — probeer opnieuw of kies een ander formaat')
        return
      }
      imgB64 = framed.base64
      imgMime = framed.mime
    }

    // Veiligheidsnet: forceer exact 9:16/16:9 zodat Veo nooit een zwarte rand padt
    try {
      const exact = await coverToCanvas(`data:${imgMime};base64,${imgB64}`, aspectRatio)
      imgB64 = exact.base64
      imgMime = exact.mime
    } catch { /* val terug op huidige image */ }

    // Product-lock clausule altijd meesturen zodat het model het product onaangetast laat
    const LOCK_CLAUSE = ' Belangrijk: het product, de verpakking, het etiket en alle tekst blijven exact identiek en volledig onveranderd. Niet vervormen, niet hertekenen, niet opnieuw genereren, geen tekst wijzigen. Beweging komt uitsluitend van de camera, de belichting en de omgeving — het product zelf blijft statisch en scherp in beeld. Het VOLLEDIGE product blijft te allen tijde compleet in beeld en gecentreerd; de camera snijdt het product nooit aan, zoomt nooit voorbij de randen van het product, en een deel van het product buiten beeld is niet toegestaan. Houd ruime marge rond het product zodat het altijd helemaal zichtbaar is.'
    // Audio-regie: geen gesproken stem/tekst; muziek mag wel
    const AUDIO_CLAUSE = audioMode === 'silent'
      ? ' Audio: volledig stil. Geen geluid, geen muziek, geen stemmen, geen gesproken tekst.'
      : ' Audio: ALLEEN subtiele, sfeervolle achtergrondmuziek die bij het merk past. ABSOLUUT GEEN voice-over, geen gesproken tekst, geen dialoog, geen narratie, geen stemmen, geen zang met woorden, geen uitgesproken tekst in beeld.'
    const finalPrompt = (productLock ? `${prompt.trim()}${LOCK_CLAUSE}` : prompt.trim()) + AUDIO_CLAUSE

    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: brandId || null,
          prompt: finalPrompt,
          model,
          aspectRatio,
          resolution,
          durationSec,
          imageBase64: imgB64,
          imageMimeType: imgMime,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      const gen = data.generation as MotionGeneration
      setActive(gen)
      startPolling(gen.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generatie mislukt')
      setGenerating(false)
      if (elapsedTimer.current) clearInterval(elapsedTimer.current)
    }
  }

  function reset() {
    setActive(null)
    setError(null)
    setGenerating(false)
    if (pollTimer.current) clearTimeout(pollTimer.current)
    if (elapsedTimer.current) clearInterval(elapsedTimer.current)
  }

  const canGenerate = !!originalBase64 && !!prompt.trim() && !generating && !extending

  return (
    <div className="flex h-full">
      {/* Left: controls */}
      <div className="w-[420px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">Foto → video</h1>
          <p className="text-sm text-gray-500 mt-0.5">Animeer een product of persoon met AI</p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Image upload */}
          <Field label="Bron-afbeelding">
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="bron" className="w-full max-h-56 object-contain bg-gray-50" />
                <button
                  onClick={clearImage}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5"
                >
                  <X size={13} />
                </button>
                {isFramed && (
                  <span className="absolute bottom-2 left-2 bg-green-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Kader gevuld · {aspectRatio}
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={() => fileInput.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`w-full border-2 border-dashed rounded-xl py-10 flex flex-col items-center justify-center gap-2 transition-colors ${
                  dragOver ? 'border-[#EB4628] bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Upload size={20} className="text-gray-400" />
                <span className="text-xs text-gray-500">Sleep een foto hierheen of klik</span>
                <span className="text-[10px] text-gray-400">JPG / PNG · wordt geschaald naar max {MAX_DIM}px</span>
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </Field>

          {/* Prompt + AI-regie */}
          <Field label="Wat moet er gebeuren">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
              placeholder="Bv: De camera zoomt langzaam in op het product terwijl het zachtjes ronddraait, warme studioverlichting, subtiele reflecties."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#EB4628] resize-none leading-relaxed"
            />

            {imageBase64 && (
              <div className="mt-2 space-y-2">
                {/* Intentie + suggest-knop */}
                <div className="flex gap-2">
                  <input
                    value={hint}
                    onChange={e => setHint(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') suggestPrompts() }}
                    placeholder="Optioneel: waar is dit voor? (bv. Instagram ad)"
                    className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#EB4628]"
                  />
                  <button
                    onClick={() => suggestPrompts()}
                    disabled={suggestLoading}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#EB4628] border border-orange-200 hover:bg-orange-50 disabled:opacity-50 flex-shrink-0"
                  >
                    {suggestLoading ? <IbizzMark size={11} animate className="text-[#EB4628]" /> : <Sparkles size={11} />}
                    Suggesties
                  </button>
                </div>

                {suggestLoading && suggestions.length === 0 && (
                  <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                    <IbizzMark size={11} animate className="text-[#EB4628]" />
                    AI bekijkt je foto en bedenkt beweging…
                  </p>
                )}

                {analysis && !suggestLoading && (
                  <p className="text-[11px] text-gray-400 italic">AI ziet: {analysis}</p>
                )}

                {suggestions.length > 0 && (
                  <div className="space-y-1.5">
                    {suggestions.map((s, i) => {
                      const isActive = prompt.trim() === s.prompt.trim()
                      return (
                        <button
                          key={i}
                          onClick={() => setPrompt(s.prompt)}
                          className={`w-full text-left rounded-lg border px-2.5 py-1.5 transition-colors ${
                            isActive ? 'border-[#EB4628] bg-orange-50' : 'border-gray-200 hover:border-[#EB4628] hover:bg-orange-50/40'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Sparkles size={10} className="text-[#EB4628]" />
                            <span className="text-[11px] font-semibold text-gray-700">{s.title}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">{s.prompt}</p>
                        </button>
                      )
                    })}
                  </div>
                )}

                {suggestError && (
                  <p className="text-[11px] text-red-600">{suggestError}</p>
                )}
              </div>
            )}
          </Field>

          {/* Product-lock */}
          {imageBase64 && (
            <div
              onClick={() => setProductLock(v => !v)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                productLock ? 'border-[#EB4628] bg-orange-50/50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Lock size={14} className={productLock ? 'text-[#EB4628]' : 'text-gray-400'} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-800">Product onveranderd houden</div>
                <div className="text-[11px] text-gray-500 leading-snug">
                  Beweging alleen via camera, licht en omgeving. Etiket en tekst blijven exact.
                </div>
              </div>
              <span
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${productLock ? 'bg-[#EB4628]' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${productLock ? 'translate-x-4' : ''}`} />
              </span>
            </div>
          )}

          {/* Audio */}
          {originalBase64 && (
            <Field label="Geluid">
              <div className="flex gap-2">
                <button
                  onClick={() => setAudioMode('music')}
                  className={`flex-1 rounded-xl border px-3 py-2 text-left transition-colors ${
                    audioMode === 'music' ? 'border-[#EB4628] bg-orange-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`text-xs font-semibold ${audioMode === 'music' ? 'text-[#EB4628]' : 'text-gray-700'}`}>Muziek</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">geen spraak/tekst</div>
                </button>
                <button
                  onClick={() => setAudioMode('silent')}
                  className={`flex-1 rounded-xl border px-3 py-2 text-left transition-colors ${
                    audioMode === 'silent' ? 'border-[#EB4628] bg-orange-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`text-xs font-semibold ${audioMode === 'silent' ? 'text-[#EB4628]' : 'text-gray-700'}`}>Stil</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">geen geluid</div>
                </button>
              </div>
            </Field>
          )}

          {/* Brand */}
          <Field label="Merk (optioneel)">
            <Select
              value={brandId}
              onChange={setBrandId}
              placeholder="— Geen merk —"
              options={[{ value: '', label: '— Geen merk —' }, ...brands.map(b => ({ value: b.id, label: b.name }))]}
              className="w-full"
            />
          </Field>

          {/* Model */}
          <Field label="Model">
            <Select
              value={model}
              onChange={v => setModel(v as MotionModelId)}
              options={availableModels.map(m => ({ value: m.id, label: `${m.name} — $${m.pricePerSec}/sec` }))}
              className="w-full"
            />
            {modelInfo && <p className="text-[11px] text-gray-400 mt-1">{modelInfo.description}</p>}
          </Field>

          {/* Aspect ratio */}
          <Field label="Formaat">
            <div className="flex gap-2">
              <RatioBtn label="9:16" sub="Vertical (Reels/TikTok)" active={aspectRatio === '9:16'} onClick={() => changeAspectRatio('9:16')} />
              <RatioBtn label="16:9" sub="Landscape" active={aspectRatio === '16:9'} onClick={() => changeAspectRatio('16:9')} />
            </div>

            {/* Kader vullen — voorkomt zwarte balken bij formaat-mismatch */}
            {originalBase64 && !arMatches && (
              <div className="mt-2 space-y-1.5">
                {isFramed ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                    <Maximize2 size={11} />
                    Kader gevuld voor {aspectRatio} — geen zwarte balken, product volledig zichtbaar.
                  </p>
                ) : (
                  <p className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 leading-snug">
                    <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
                    Je foto past niet op {aspectRatio}. Vul het kader — product blijft volledig zichtbaar, geen zwarte balken. (Anders gebeurt 't automatisch bij genereren.)
                  </p>
                )}
                <div className="flex gap-1.5">
                  <FillBtn label="Wit" sub="gratis" onClick={() => runFill('white')} disabled={extending} />
                  <FillBtn label="Blur" sub="gratis" onClick={() => runFill('blur')} disabled={extending} />
                  <FillBtn label="AI-scène" sub="Gemini" onClick={() => runFill('ai')} disabled={extending} />
                </div>
                <p className="text-[10px] text-gray-400">
                  AI-scène vult de rand schermvullend met een passende achtergrond (Gemini) — product blijft exact en volledig in beeld.
                </p>
                {extending && (
                  <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                    <IbizzMark size={10} animate className="text-[#EB4628]" /> Kader vullen…
                  </p>
                )}
                {extendError && <p className="text-[11px] text-red-600">{extendError}</p>}
              </div>
            )}
          </Field>

          {/* Resolution + duration */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Resolutie">
              <Select
                value={resolution}
                onChange={v => setResolution(v as MotionResolution)}
                options={[{ value: '720p', label: '720p' }, { value: '1080p', label: '1080p' }]}
                className="w-full"
              />
            </Field>
            <Field label={`Duur: ${durationSec}s`}>
              <input
                type="range"
                min={4}
                max={8}
                step={2}
                value={durationSec}
                onChange={e => setDurationSec(parseInt(e.target.value, 10))}
                className="w-full accent-[#EB4628] mt-2"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Veo: 4, 6 of 8 sec</p>
            </Field>
          </div>

          {estCost && (
            <p className="text-[11px] text-gray-400">
              Geschatte kost: <span className="font-semibold text-gray-600">~${estCost}</span> ({durationSec}s × ${modelInfo?.pricePerSec}/sec)
            </p>
          )}

          {error && (
            <p className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
              {error}
            </p>
          )}

          <button
            onClick={generate}
            disabled={!canGenerate}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: '#EB4628' }}
          >
            {generating ? <IbizzMark size={15} animate /> : <Wand2 size={15} />}
            {generating ? 'Bezig met genereren…' : 'Genereer video'}
          </button>
        </div>
      </div>

      {/* Right: result */}
      <div className="flex-1 overflow-y-auto bg-gray-50 flex items-center justify-center p-8">
        {!active && !generating && (
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center mx-auto mb-4">
              <ImageIcon size={26} className="text-cyan-500" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">Nog geen video</p>
            <p className="text-sm text-gray-400">Upload een foto, beschrijf de beweging en klik op genereren.</p>
          </div>
        )}

        {(generating || active?.status === 'running') && (
          <div className="text-center">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: '#EB462812' }}>
              <IbizzMark size={44} animate className="text-[#EB4628]" />
            </div>
            <p className="text-base font-semibold text-gray-800 mb-1">AI animeert je foto…</p>
            <p className="text-sm text-gray-400 mb-3">Video-generatie duurt meestal 1-3 minuten. Niet wegklikken.</p>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1">
              <Clock size={11} />
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
            </span>
          </div>
        )}

        {active?.status === 'succeeded' && active.result_url && (
          <div className="w-full max-w-md">
            <div className={`mx-auto rounded-2xl overflow-hidden bg-black shadow-lg ${active.aspect_ratio === '9:16' ? 'max-w-[320px]' : 'w-full'}`}>
              <video
                src={active.result_url}
                controls
                autoPlay
                loop
                playsInline
                className="w-full h-auto"
              />
            </div>
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              <button
                onClick={() => setTextEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: '#EB4628' }}
              >
                <Type size={14} />
                Tekst toevoegen
              </button>
              <a
                href={active.result_url}
                download
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300"
              >
                <Download size={14} />
                Download
              </a>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300"
              >
                <RotateCcw size={14} />
                Nieuwe
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tekst-editor */}
      {textEditing && active?.status === 'succeeded' && active.result_url && (
        <VideoTextEditor
          videoUrl={active.result_url}
          aspectRatio={active.aspect_ratio}
          durationSec={active.duration_sec}
          generationId={active.id}
          initialLayers={active.text_overlays}
          onClose={() => setTextEditing(false)}
          onSaved={layers => setActive(prev => prev ? { ...prev, text_overlays: layers } : prev)}
        />
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function RatioBtn({ label, sub, active, onClick }: { label: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl border px-3 py-2 text-left transition-colors ${
        active ? 'border-[#EB4628] bg-orange-50' : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className={`text-sm font-bold ${active ? 'text-[#EB4628]' : 'text-gray-700'}`}>{label}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>
    </button>
  )
}

function FillBtn({ label, sub, onClick, disabled }: { label: string; sub: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded-lg border border-gray-200 hover:border-[#EB4628] hover:bg-orange-50/40 px-2 py-1.5 text-center transition-colors disabled:opacity-50"
    >
      <div className="text-[11px] font-semibold text-gray-700">{label}</div>
      <div className="text-[9px] text-gray-400">{sub}</div>
    </button>
  )
}

/**
 * Gratis client-side kader-vulling (geen API). Plaatst het product gecentreerd
 * en volledig zichtbaar op een vol-formaat canvas; vult de rest met wit of een
 * vervaagde versie van de foto. Geen zoom, product 100% intact.
 */
async function fillFrameLocal(
  srcDataUrl: string,
  ar: MotionAspectRatio,
  style: 'white' | 'blur',
): Promise<{ base64: string; mime: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const [cw, ch] = ar === '16:9' ? [1280, 720] : [720, 1280]
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas context')); return }

      // Achtergrond
      if (style === 'blur') {
        const coverScale = Math.max(cw / img.width, ch / img.height)
        const bw = img.width * coverScale
        const bh = img.height * coverScale
        ctx.filter = 'blur(28px) brightness(1.04)'
        ctx.drawImage(img, (cw - bw) / 2, (ch - bh) / 2, bw, bh)
        ctx.filter = 'none'
      } else {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, cw, ch)
      }

      // Product gecentreerd, volledig zichtbaar, met marge zodat inzoom niet afsnijdt
      const margin = 0.8
      const scale = Math.min((cw * margin) / img.width, (ch * margin) / img.height)
      const pw = Math.round(img.width * scale)
      const ph = Math.round(img.height * scale)
      ctx.drawImage(img, Math.round((cw - pw) / 2), Math.round((ch - ph) / 2), pw, ph)

      const mime = 'image/jpeg'
      const dataUrl = canvas.toDataURL(mime, 0.92)
      resolve({ base64: dataUrl.replace(/^data:[^;]+;base64,/, ''), mime, dataUrl })
    }
    img.onerror = () => reject(new Error('image load'))
    img.src = srcDataUrl
  })
}

/**
 * Forceer een afbeelding naar EXACT de doel-dimensies (1280x720 / 720x1280)
 * via cover-fit (vult het kader, snijdt overschot weg). Voorkomt zwarte randen
 * doordat het video-model een net-niet-kloppende ratio anders zou padden.
 */
async function coverToCanvas(
  srcDataUrl: string,
  ar: MotionAspectRatio,
): Promise<{ base64: string; mime: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const [cw, ch] = ar === '16:9' ? [1280, 720] : [720, 1280]
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas context')); return }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, cw, ch)
      const scale = Math.max(cw / img.width, ch / img.height) // COVER
      const dw = img.width * scale
      const dh = img.height * scale
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh)
      const mime = 'image/jpeg'
      const dataUrl = canvas.toDataURL(mime, 0.92)
      resolve({ base64: dataUrl.replace(/^data:[^;]+;base64,/, ''), mime, dataUrl })
    }
    img.onerror = () => reject(new Error('image load'))
    img.src = srcDataUrl
  })
}

/** Resize een afbeelding client-side naar max dimensie, geeft base64 (zonder prefix) + dims terug. */
async function resizeImage(file: File, maxDim: number): Promise<{ base64: string; mime: string; dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height / width) * maxDim)
            width = maxDim
          } else {
            width = Math.round((width / height) * maxDim)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('canvas context')); return }
        // Wit vullen zodat transparante achtergronden (PNG/WEBP) niet zwart
        // worden bij JPEG-conversie — beter voor productshots.
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        const mime = 'image/jpeg'
        const dataUrl = canvas.toDataURL(mime, 0.9)
        const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '')
        resolve({ base64, mime, dataUrl, width, height })
      }
      img.onerror = () => reject(new Error('image load'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('file read'))
    reader.readAsDataURL(file)
  })
}
