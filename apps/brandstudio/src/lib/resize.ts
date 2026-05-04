/**
 * Crop + resize a source image to target dimensions, returning a Blob.
 * Uses center-cover semantics — same as CSS object-fit: cover.
 */
export async function resizeImageBlob(
  sourceUrl: string,
  targetWidth: number,
  targetHeight: number,
  format: 'jpeg' | 'png' = 'jpeg',
): Promise<Blob> {
  const img = await loadImage(sourceUrl)

  const srcRatio = img.width / img.height
  const tgtRatio = targetWidth / targetHeight

  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (srcRatio > tgtRatio) {
    // bron breder dan target → crop links/rechts
    sw = img.height * tgtRatio
    sx = (img.width - sw) / 2
  } else if (srcRatio < tgtRatio) {
    // bron langer dan target → crop boven/onder
    sh = img.width / tgtRatio
    sy = (img.height - sh) / 2
  }

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context niet beschikbaar')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight)

  const mime = format === 'png' ? 'image/png' : 'image/jpeg'
  const quality = format === 'jpeg' ? 0.92 : undefined

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('Resize mislukt')),
      mime,
      quality,
    )
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Kon afbeelding niet laden: ${src}`))
    img.src = src
  })
}

export async function downloadResized(
  sourceUrl: string,
  targetWidth: number,
  targetHeight: number,
  filename: string,
  format: 'jpeg' | 'png' = 'jpeg',
) {
  const blob = await resizeImageBlob(sourceUrl, targetWidth, targetHeight, format)
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
