/**
 * PDF generator voor SEO Writer Briefs.
 *
 * Gebruikt jsPDF (client-side) — exporteert een brief in ibizz huisstijl met
 * rode accent lijn, gestructureerde secties en duidelijke headers.
 *
 * De brief is bedoeld om naar Caven (of andere externe schrijvers) te sturen.
 */

import type { SeoWriterBrief, SeoBrief } from '@ibizz/supabase'
import jsPDF from 'jspdf'

const RED = '#EB4628'
const DARK = '#1a1a1a'
const GRAY = '#6b7280'
const LIGHT = '#f3f4f6'

const PAGE_MARGIN = 18
const PAGE_WIDTH = 210                      // A4 mm
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2
const FOOTER_HEIGHT = 12

type Ctx = {
  doc: jsPDF
  y: number
  pageNum: number
  briefTitle: string
}

function startNewPage(ctx: Ctx) {
  drawFooter(ctx)
  ctx.doc.addPage()
  ctx.pageNum += 1
  ctx.y = PAGE_MARGIN
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y + needed > 297 - PAGE_MARGIN - FOOTER_HEIGHT) {
    startNewPage(ctx)
  }
}

function drawFooter(ctx: Ctx) {
  const footerY = 297 - PAGE_MARGIN
  ctx.doc.setFontSize(8)
  ctx.doc.setTextColor(GRAY)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.text(`ibizz · ${ctx.briefTitle}`, PAGE_MARGIN, footerY)
  ctx.doc.text(`Pagina ${ctx.pageNum}`, PAGE_WIDTH - PAGE_MARGIN, footerY, { align: 'right' })
}

function sectionHeader(ctx: Ctx, title: string) {
  ensureSpace(ctx, 14)
  ctx.doc.setDrawColor(RED)
  ctx.doc.setLineWidth(0.6)
  ctx.doc.line(PAGE_MARGIN, ctx.y, PAGE_MARGIN + 8, ctx.y)
  ctx.doc.setFontSize(11)
  ctx.doc.setFont('helvetica', 'bold')
  ctx.doc.setTextColor(DARK)
  ctx.doc.text(title.toUpperCase(), PAGE_MARGIN, ctx.y + 5)
  ctx.y += 9
}

function paragraph(ctx: Ctx, text: string, opts?: { size?: number; bold?: boolean; color?: string; gapAfter?: number }) {
  if (!text) return
  const size = opts?.size ?? 10
  const color = opts?.color ?? DARK
  const gap = opts?.gapAfter ?? 3
  ctx.doc.setFontSize(size)
  ctx.doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
  ctx.doc.setTextColor(color)
  const lines = ctx.doc.splitTextToSize(text, CONTENT_WIDTH) as string[]
  const lineHeight = size * 0.42
  ensureSpace(ctx, lines.length * lineHeight + gap)
  for (const line of lines) {
    ctx.doc.text(line, PAGE_MARGIN, ctx.y)
    ctx.y += lineHeight
  }
  ctx.y += gap
}

function bulletList(ctx: Ctx, items: string[]) {
  ctx.doc.setFontSize(10)
  ctx.doc.setFont('helvetica', 'normal')
  ctx.doc.setTextColor(DARK)
  const indent = PAGE_MARGIN + 4
  for (const item of items) {
    if (!item) continue
    const lines = ctx.doc.splitTextToSize(item, CONTENT_WIDTH - 4) as string[]
    ensureSpace(ctx, lines.length * 4.2 + 1)
    // Bullet
    ctx.doc.setFillColor(RED)
    ctx.doc.circle(PAGE_MARGIN + 1.4, ctx.y - 1.3, 0.7, 'F')
    for (let i = 0; i < lines.length; i++) {
      ctx.doc.text(lines[i], indent, ctx.y)
      ctx.y += 4.2
    }
    ctx.y += 0.5
  }
  ctx.y += 2
}

function labelValue(ctx: Ctx, label: string, value: string) {
  if (!value) return
  ctx.doc.setFontSize(9)
  ctx.doc.setFont('helvetica', 'bold')
  ctx.doc.setTextColor(GRAY)
  ctx.doc.text(label.toUpperCase(), PAGE_MARGIN, ctx.y)
  ctx.y += 4
  paragraph(ctx, value, { size: 10, gapAfter: 4 })
}

/**
 * Genereer en download de PDF.
 */
export function generateWriterBriefPDF(
  writerBrief: SeoWriterBrief,
  brief: SeoBrief,
  pageTopic: string,
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ctx: Ctx = {
    doc,
    y: PAGE_MARGIN,
    pageNum: 1,
    briefTitle: brief.title,
  }
  const c = writerBrief.content

  // ── Cover header — rode accent + titel ────────────────────────────
  doc.setFillColor(RED)
  doc.rect(0, 0, PAGE_WIDTH, 4, 'F')
  ctx.y = PAGE_MARGIN + 4

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(RED)
  doc.text('IBIZZ · SEO CONTENT BRIEF', PAGE_MARGIN, ctx.y)
  ctx.y += 9

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  const titleLines = doc.splitTextToSize(pageTopic, CONTENT_WIDTH) as string[]
  for (const line of titleLines) {
    doc.text(line, PAGE_MARGIN, ctx.y)
    ctx.y += 7
  }
  ctx.y += 2

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY)
  doc.text(`Project: ${brief.title}  ·  Markt: ${brief.primary_market}  ·  Datum: ${new Date().toLocaleDateString('nl-NL')}`, PAGE_MARGIN, ctx.y)
  ctx.y += 10

  // ── Persona + Thema header card ───────────────────────────────────
  doc.setFillColor(LIGHT)
  doc.roundedRect(PAGE_MARGIN, ctx.y, CONTENT_WIDTH, 22, 2, 2, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(GRAY)
  doc.text('PERSONA', PAGE_MARGIN + 4, ctx.y + 6)
  doc.text('THEMA', PAGE_MARGIN + CONTENT_WIDTH / 2 + 4, ctx.y + 6)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(DARK)
  doc.text(c.persona_name || '—', PAGE_MARGIN + 4, ctx.y + 12)
  doc.text(c.theme || '—', PAGE_MARGIN + CONTENT_WIDTH / 2 + 4, ctx.y + 12)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(GRAY)
  const painShort = (c.pain_addressed || '').slice(0, 60)
  doc.text(painShort, PAGE_MARGIN + 4, ctx.y + 18)
  doc.text(c.search_intent || '—', PAGE_MARGIN + CONTENT_WIDTH / 2 + 4, ctx.y + 18)
  ctx.y += 28

  // ── Kernboodschap ─────────────────────────────────────────────────
  sectionHeader(ctx, 'Kernboodschap')
  paragraph(ctx, c.message, { size: 11, bold: true, gapAfter: 6 })

  // ── Pijnpunt geadresseerd ─────────────────────────────────────────
  sectionHeader(ctx, 'Pijnpunt dat we adresseren')
  paragraph(ctx, c.pain_addressed, { gapAfter: 6 })

  // ── SEO setup ─────────────────────────────────────────────────────
  sectionHeader(ctx, 'SEO setup')
  labelValue(ctx, 'Target keyword', c.target_keyword)
  if (c.secondary_keywords && c.secondary_keywords.length > 0) {
    labelValue(ctx, 'Secundaire keywords', c.secondary_keywords.join(' · '))
  }
  labelValue(ctx, 'Search intent', c.search_intent)
  labelValue(ctx, 'Doel woordlengte', `${c.word_count_target} woorden`)

  // ── Tone of voice ─────────────────────────────────────────────────
  sectionHeader(ctx, 'Tone of voice')
  paragraph(ctx, c.tone_of_voice, { gapAfter: 6 })

  // ── Heading structuur ─────────────────────────────────────────────
  if (c.headings_structure && c.headings_structure.length > 0) {
    sectionHeader(ctx, 'Voorgestelde heading structuur')
    bulletList(ctx, c.headings_structure)
  }

  // ── Must include ──────────────────────────────────────────────────
  if (c.must_include && c.must_include.length > 0) {
    sectionHeader(ctx, 'Verplichte elementen')
    bulletList(ctx, c.must_include)
  }

  // ── Must avoid ────────────────────────────────────────────────────
  if (c.must_avoid && c.must_avoid.length > 0) {
    sectionHeader(ctx, 'Vermijd')
    bulletList(ctx, c.must_avoid)
  }

  // ── Lessons learned ───────────────────────────────────────────────
  if (c.lessons_learned && c.lessons_learned.length > 0) {
    sectionHeader(ctx, 'Lessons learned (uit eerdere content)')
    bulletList(ctx, c.lessons_learned)
  }

  // ── Internal links ────────────────────────────────────────────────
  if (c.internal_links && c.internal_links.length > 0) {
    sectionHeader(ctx, 'Voorgestelde internal links')
    bulletList(ctx, c.internal_links)
  }

  // ── Voorbeelden ───────────────────────────────────────────────────
  if (c.examples_good || c.examples_bad) {
    sectionHeader(ctx, 'Voorbeelden')
    if (c.examples_good) {
      labelValue(ctx, '✓ Goed', c.examples_good)
    }
    if (c.examples_bad) {
      labelValue(ctx, '✗ Vermijd', c.examples_bad)
    }
  }

  // Final footer
  drawFooter(ctx)

  // Download
  const slug = pageTopic.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 50)
  const date = new Date().toISOString().slice(0, 10)
  doc.save(`ibizz-content-brief-${slug || 'page'}-${date}.pdf`)
}
