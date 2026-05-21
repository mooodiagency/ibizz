'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

export type MaskBrushHandle = {
  clear: () => void
  hasMask: () => boolean
  /** Returns the mask as a black/white PNG dataURL (white = selected). null if empty. */
  getMaskDataUrl: () => string | null
  /**
   * Returns the mask in OpenAI gpt-image-1 format: PNG with alpha channel where
   * the selected (painted) area is transparent (alpha=0) and the rest is opaque.
   * null if empty.
   */
  getOpenAIMaskDataUrl: () => string | null
}

type Props = {
  imageUrl: string
  active: boolean
  brushSize: number
  imageClassName?: string
  onChange?: () => void
}

const MaskBrushOverlay = forwardRef<MaskBrushHandle, Props>(function MaskBrushOverlay(
  { imageUrl, active, brushSize, imageClassName, onChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const visibleCanvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const [drawing, setDrawing] = useState(false)
  const [cursor, setCursor] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false })
  const [hasContent, setHasContent] = useState(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)

  // Sync canvas size to displayed image size
  useEffect(() => {
    function resize() {
      const img = imgRef.current
      const visible = visibleCanvasRef.current
      if (!img || !visible) return
      const w = img.clientWidth
      const h = img.clientHeight
      if (w === 0 || h === 0) return

      visible.width = w
      visible.height = h

      // Hidden mask canvas at native image resolution (better quality output)
      if (!maskCanvasRef.current) {
        maskCanvasRef.current = document.createElement('canvas')
      }
      const mask = maskCanvasRef.current
      mask.width = img.naturalWidth || w
      mask.height = img.naturalHeight || h
    }

    resize()
    const obs = new ResizeObserver(resize)
    if (imgRef.current) obs.observe(imgRef.current)
    window.addEventListener('resize', resize)
    return () => {
      obs.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [imageUrl])

  // Reset on image change
  useEffect(() => {
    clear()
  }, [imageUrl])

  useImperativeHandle(ref, () => ({
    clear,
    hasMask: () => hasContent,
    getMaskDataUrl: () => {
      if (!maskCanvasRef.current || !hasContent) return null
      return maskCanvasRef.current.toDataURL('image/png')
    },
    getOpenAIMaskDataUrl: () => {
      const src = maskCanvasRef.current
      if (!src || !hasContent) return null

      // Maak een nieuwe canvas en bouw RGBA waarin witte gebieden alpha=0 worden
      const out = document.createElement('canvas')
      out.width = src.width
      out.height = src.height
      const srcCtx = src.getContext('2d')
      const outCtx = out.getContext('2d')
      if (!srcCtx || !outCtx) return null

      const img = srcCtx.getImageData(0, 0, src.width, src.height)
      const dst = outCtx.createImageData(src.width, src.height)
      for (let i = 0; i < img.data.length; i += 4) {
        const r = img.data[i]
        const isWhite = r > 128
        // OpenAI mask: alpha=0 op te vervangen gebied (waar gebruiker schilderde)
        dst.data[i] = 0
        dst.data[i + 1] = 0
        dst.data[i + 2] = 0
        dst.data[i + 3] = isWhite ? 0 : 255
      }
      outCtx.putImageData(dst, 0, 0)
      return out.toDataURL('image/png')
    },
  }))

  function clear() {
    const visible = visibleCanvasRef.current
    if (visible) visible.getContext('2d')?.clearRect(0, 0, visible.width, visible.height)
    const mask = maskCanvasRef.current
    if (mask) {
      const ctx = mask.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, mask.width, mask.height)
      }
    }
    setHasContent(false)
    onChange?.()
  }

  function clientToLocal(e: React.PointerEvent): { x: number; y: number } | null {
    const visible = visibleCanvasRef.current
    if (!visible) return null
    const rect = visible.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function drawSegment(from: { x: number; y: number } | null, to: { x: number; y: number }) {
    const visible = visibleCanvasRef.current
    const mask = maskCanvasRef.current
    if (!visible || !mask) return

    const visibleCtx = visible.getContext('2d')
    const maskCtx = mask.getContext('2d')
    if (!visibleCtx || !maskCtx) return

    // Scale factor between displayed canvas and full-resolution mask canvas
    const sx = mask.width / visible.width
    const sy = mask.height / visible.height
    const radius = brushSize / 2
    const radiusMask = (brushSize / 2) * Math.max(sx, sy)

    // Visible: indigo translucent
    visibleCtx.fillStyle = 'rgba(99, 102, 241, 0.45)'
    visibleCtx.strokeStyle = 'rgba(99, 102, 241, 0.45)'
    visibleCtx.lineWidth = brushSize
    visibleCtx.lineCap = 'round'
    visibleCtx.lineJoin = 'round'

    // Mask: pure white
    maskCtx.fillStyle = '#ffffff'
    maskCtx.strokeStyle = '#ffffff'
    maskCtx.lineWidth = radiusMask * 2
    maskCtx.lineCap = 'round'
    maskCtx.lineJoin = 'round'

    if (!from) {
      visibleCtx.beginPath()
      visibleCtx.arc(to.x, to.y, radius, 0, Math.PI * 2)
      visibleCtx.fill()

      maskCtx.beginPath()
      maskCtx.arc(to.x * sx, to.y * sy, radiusMask, 0, Math.PI * 2)
      maskCtx.fill()
    } else {
      visibleCtx.beginPath()
      visibleCtx.moveTo(from.x, from.y)
      visibleCtx.lineTo(to.x, to.y)
      visibleCtx.stroke()

      maskCtx.beginPath()
      maskCtx.moveTo(from.x * sx, from.y * sy)
      maskCtx.lineTo(to.x * sx, to.y * sy)
      maskCtx.stroke()
    }

    setHasContent(true)
    onChange?.()
  }

  function pointerDown(e: React.PointerEvent) {
    if (!active) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const pos = clientToLocal(e)
    if (!pos) return
    setDrawing(true)
    lastPosRef.current = pos
    drawSegment(null, pos)
  }

  function pointerMove(e: React.PointerEvent) {
    const pos = clientToLocal(e)
    if (pos) setCursor({ x: pos.x, y: pos.y, visible: true })
    if (drawing && pos) {
      drawSegment(lastPosRef.current, pos)
      lastPosRef.current = pos
    }
  }

  function pointerUp() {
    setDrawing(false)
    lastPosRef.current = null
  }

  return (
    <div ref={containerRef} className="relative inline-block leading-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={imageUrl}
        alt=""
        className={imageClassName ?? 'max-w-full max-h-[82vh] object-contain rounded-lg block'}
        draggable={false}
      />
      <canvas
        ref={visibleCanvasRef}
        className="absolute inset-0 rounded-lg"
        style={{
          cursor: active ? 'none' : 'default',
          touchAction: active ? 'none' : 'auto',
        }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerEnter={e => {
          const pos = clientToLocal(e)
          if (pos) setCursor({ x: pos.x, y: pos.y, visible: true })
        }}
        onPointerLeave={() => setCursor(c => ({ ...c, visible: false }))}
      />

      {/* Liquid glass cursor */}
      {active && cursor.visible && (
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            left: cursor.x,
            top: cursor.y,
            width: brushSize,
            height: brushSize,
            transform: 'translate(-50%, -50%)',
            backdropFilter: 'blur(14px) saturate(1.8) brightness(1.05)',
            WebkitBackdropFilter: 'blur(14px) saturate(1.8) brightness(1.05)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04))',
            border: '1.5px solid rgba(255, 255, 255, 0.55)',
            boxShadow:
              'inset 0 0 0 1px rgba(255, 255, 255, 0.25), inset 0 1px 4px rgba(255, 255, 255, 0.4), 0 8px 28px rgba(0, 0, 0, 0.18)',
            transition: 'width 80ms ease-out, height 80ms ease-out',
          }}
        />
      )}
    </div>
  )
})

export default MaskBrushOverlay
