import jsPDF from 'jspdf'

export type NotulenData = {
  datum: string
  aanwezig: string[]
  samenvatting: string
  agendapunten: { titel: string; toelichting: string }[]
  besluiten: string[]
  actiepunten: { actie: string; eigenaar: string | null; deadline: string | null }[]
  volgende_vergadering: string | null
}

const RED: [number, number, number] = [235, 70, 40]
const DARK: [number, number, number] = [20, 20, 20]
const GRAY: [number, number, number] = [100, 100, 100]
const LIGHT: [number, number, number] = [245, 245, 245]

export function generateNotulenPDF(n: NotulenData) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const margin = 22
  const contentW = W - margin * 2
  let y = 0

  function checkPageBreak(needed = 20) {
    if (y + needed > H - 20) {
      doc.addPage()
      y = 20
    }
  }

  function sectionHeader(title: string) {
    checkPageBreak(16)
    y += 6
    doc.setFillColor(...RED)
    doc.rect(margin, y, 3, 5.5, 'F')
    doc.setTextColor(...RED)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 6, y + 4.5)
    y += 11
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
  }

  function bodyText(text: string, indent = 0) {
    const lines = doc.splitTextToSize(text, contentW - indent)
    checkPageBreak(lines.length * 5.5 + 2)
    doc.text(lines, margin + indent, y)
    y += lines.length * 5.5 + 3
  }

  // ── Header bar ──────────────────────────────────────────────────────
  doc.setFillColor(...RED)
  doc.rect(0, 0, W, 32, 'F')

  // ibizz wordmark (bold italic look via helvetica-bold)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('ibizz', margin, 21)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('NOTULEN', W - margin, 21, { align: 'right' })

  y = 44

  // ── Meta: datum + aanwezig ──────────────────────────────────────────
  doc.setTextColor(...GRAY)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(n.datum, margin, y)
  y += 5.5

  if (n.aanwezig.length > 0) {
    const attendees = doc.splitTextToSize(`Aanwezig: ${n.aanwezig.join(', ')}`, contentW)
    doc.text(attendees, margin, y)
    y += attendees.length * 5 + 2
  }

  // Thin divider
  y += 4
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(margin, y, W - margin, y)
  y += 8

  // ── Samenvatting ────────────────────────────────────────────────────
  sectionHeader('Samenvatting')
  doc.setTextColor(60, 60, 60)
  bodyText(n.samenvatting)

  // ── Agendapunten ────────────────────────────────────────────────────
  if (n.agendapunten.length > 0) {
    sectionHeader('Agendapunten')
    n.agendapunten.forEach((item, i) => {
      checkPageBreak(18)
      doc.setTextColor(...DARK)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`${i + 1}.  ${item.titel}`, margin, y)
      y += 5.5
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      bodyText(item.toelichting, 6)
      y += 1
    })
  }

  // ── Besluiten ───────────────────────────────────────────────────────
  if (n.besluiten.length > 0) {
    sectionHeader('Besluiten')
    n.besluiten.forEach(b => {
      doc.setTextColor(...DARK)
      bodyText(`→  ${b}`)
    })
  }

  // ── Actiepunten ─────────────────────────────────────────────────────
  if (n.actiepunten.length > 0) {
    sectionHeader('Actiepunten')
    n.actiepunten.forEach(ap => {
      checkPageBreak(14)
      const meta: string[] = []
      if (ap.eigenaar) meta.push(ap.eigenaar)
      if (ap.deadline) meta.push(ap.deadline)
      doc.setTextColor(...DARK)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const line = `☐  ${ap.actie}`
      const wrapped = doc.splitTextToSize(line, contentW - 4)
      doc.text(wrapped, margin, y)
      y += wrapped.length * 5.5
      if (meta.length > 0) {
        doc.setTextColor(...GRAY)
        doc.setFontSize(8.5)
        doc.text(meta.join('  ·  '), margin + 5, y)
        y += 5
      }
      y += 2
    })
  }

  // ── Volgende vergadering ─────────────────────────────────────────────
  if (n.volgende_vergadering) {
    sectionHeader('Volgende vergadering')
    doc.setTextColor(...DARK)
    bodyText(n.volgende_vergadering)
  }

  // ── Footer ───────────────────────────────────────────────────────────
  const pages = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFillColor(...LIGHT)
    doc.rect(0, H - 12, W, 12, 'F')
    doc.setTextColor(160, 160, 160)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.text('ibizz — creatief en digitaal bureau', margin, H - 4)
    doc.text(
      `Gegenereerd op ${new Date().toLocaleDateString('nl-NL')}  ·  pagina ${p} van ${pages}`,
      W - margin, H - 4, { align: 'right' }
    )
  }

  doc.save(`notulen-${new Date().toISOString().slice(0, 10)}.pdf`)
}
