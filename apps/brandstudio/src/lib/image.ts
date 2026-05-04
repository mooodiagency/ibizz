/**
 * Convert SVG/WebP file to PNG (raster) of JPG via Canvas (client-side, geen deps).
 * Returns a new File. JPG/PNG worden ongewijzigd doorgegeven.
 * - WebP → JPG (compatibel met alle LLMs)
 * - SVG → PNG (transparante achtergrond behouden)
 */
export async function ensureJpgOrPng(file: File): Promise<File> {
  if (file.type === 'image/jpeg' || file.type === 'image/png') return file
  if (file.type === 'image/webp') return webpToJpg(file)
  if (file.type === 'image/svg+xml') return svgToPng(file)
  throw new Error(`Niet ondersteund formaat: ${file.type}`)
}

async function webpToJpg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context niet beschikbaar')
  ctx.drawImage(bitmap, 0, 0)

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Conversie mislukt')), 'image/jpeg', 0.92)
  })
  const baseName = file.name.replace(/\.webp$/i, '')
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
}

const SVG_DEFAULT_SIZE = 1024

async function svgToPng(file: File): Promise<File> {
  const text = await file.text()
  const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('SVG kon niet ingelezen worden'))
      i.src = objectUrl
    })

    // Bepaal afmetingen — als de SVG geen size heeft, parse viewBox of gebruik default
    let { width, height } = img
    if (!width || !height) {
      const vbMatch = text.match(/viewBox=["']([^"']+)["']/i)
      if (vbMatch) {
        const [, , w, h] = vbMatch[1].split(/[\s,]+/).map(Number)
        if (w && h) { width = w; height = h }
      }
    }
    if (!width || !height) { width = SVG_DEFAULT_SIZE; height = SVG_DEFAULT_SIZE }

    // Schaal de langste zijde naar SVG_DEFAULT_SIZE voor crispe output
    const scale = SVG_DEFAULT_SIZE / Math.max(width, height)
    const outW = Math.round(width * scale)
    const outH = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context niet beschikbaar')
    ctx.drawImage(img, 0, 0, outW, outH)

    const pngBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG conversie mislukt')), 'image/png')
    })

    const baseName = file.name.replace(/\.svg$/i, '')
    return new File([pngBlob], `${baseName}.png`, { type: 'image/png' })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return `${file.name}: alleen JPG, PNG, WebP of SVG`
  if (file.size > MAX_FILE_SIZE) return `${file.name}: max 10MB`
  return null
}

export function slugifyFileName(name: string): string {
  const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return base.replace(/[^a-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '')
}
