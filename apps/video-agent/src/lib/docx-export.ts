/**
 * Video Agent — DOCX export in exact FRENKY-layout.
 *
 * Reconstrueert het format uit FRENKY_Dag1_Scripts-4.docx:
 *   - Cover: brand + dag-titel + intro-subtitel
 *   - Overzicht / Cast totaal / Locaties (intro-blokken)
 *   - Per script (14 velden in vaste volgorde, ● ● ● ● divider tussendoor)
 *   - Bold labels, italic voice-over in quotes, genummerde shotlist met [REAL] tags
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, LevelFormat, PageOrientation, BorderStyle,
} from 'docx'
import type {
  VideoBrief, VideoScript, Brand, VideoCastRole, VideoLocation,
  VideoProductieToets, VideoScriptLine, VideoShot, VideoTextOverlay,
} from '@ibizz/supabase'

const RED = 'EB4628'
const DIVIDER = '● ● ● ●'

// ─── Helpers voor inline runs ───────────────────────────────────────────
function lbl(text: string): TextRun {
  // Bold label, gevolgd door waarde — bijv. "Doel: "
  return new TextRun({ text, bold: true })
}
function val(text: string): TextRun {
  return new TextRun({ text })
}
function vo(text: string): TextRun {
  // Voice-over regel — italic in quotes
  return new TextRun({ text: `"${text}"`, italics: true })
}
function dir(text: string): TextRun {
  // Directie / (beat) — italic, grijs effect via lichtgrijze kleur
  return new TextRun({ text, italics: true, color: '666666' })
}

// ─── Building blocks ────────────────────────────────────────────────────
function dividerParagraph(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240 },
    children: [new TextRun({ text: DIVIDER, color: '999999' })],
  })
}

function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: RED })],
  })
}

function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 26 })],
  })
}

function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, color: RED })],
  })
}

function fieldLine(label: string, value: string | null | undefined): Paragraph[] {
  if (!value || !value.trim()) return []
  return [new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [lbl(`${label}: `), val(value.trim())],
  })]
}

function paragraphLines(text: string | null | undefined): Paragraph[] {
  if (!text || !text.trim()) return []
  return text.trim().split(/\n+/).map(line =>
    new Paragraph({
      spacing: { after: 100 },
      children: [val(line)],
    })
  )
}

function sectionLabel(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text: label, bold: true, size: 22 })],
  })
}

// ─── Brief-niveau blokken ───────────────────────────────────────────────
function coverPage(brief: VideoBrief, brand: Brand | null, scriptsCount: number): Paragraph[] {
  const blocks: Paragraph[] = []

  blocks.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 2400, after: 240 },
    children: [new TextRun({ text: 'Video concepten', bold: true, size: 28, color: '666666' })],
  }))

  blocks.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [new TextRun({
      text: brand?.name ?? 'Merk onbekend',
      bold: true,
      size: 56,
      color: RED,
    })],
  }))

  blocks.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text: brief.dag_titel, bold: true, size: 32 })],
  }))

  if (brief.intro_subtitel) {
    blocks.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 240 },
      children: [new TextRun({ text: brief.intro_subtitel, italics: true, size: 22, color: '666666' })],
    }))
  }

  blocks.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 80 },
    children: [new TextRun({
      text: `${scriptsCount} ${scriptsCount === 1 ? 'script' : 'scripts'} · v${brief.versie}`,
      size: 20, color: '999999',
    })],
  }))

  blocks.push(dividerParagraph())
  return blocks
}

function overzichtSection(brief: VideoBrief): Paragraph[] {
  const blocks: Paragraph[] = []
  if (!brief.overzicht || !brief.overzicht.trim()) return blocks
  blocks.push(h2(`Overzicht ${brief.dag_titel}`))
  blocks.push(...paragraphLines(brief.overzicht))
  return blocks
}

function scriptsListSection(scripts: VideoScript[]): Paragraph[] {
  if (scripts.length === 0) return []
  const blocks: Paragraph[] = []
  blocks.push(h2('Scripts'))
  for (const s of scripts) {
    const lenSuffix = s.lengte_sec ? ` — ~${s.lengte_sec} sec` : ''
    blocks.push(new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: `${s.nummer}. `, bold: true }),
        new TextRun({ text: s.titel, bold: true }),
        new TextRun({ text: lenSuffix }),
      ],
    }))
  }
  return blocks
}

function castTotaalSection(brief: VideoBrief, scriptsCount: number): Paragraph[] {
  if (!brief.cast_totaal || brief.cast_totaal.length === 0) return []
  const blocks: Paragraph[] = []
  blocks.push(h2(`Cast totaal (${scriptsCount === 1 ? '1 video' : `alle ${scriptsCount} videos`})`))
  for (const role of brief.cast_totaal) {
    blocks.push(castBullet(role))
  }
  return blocks
}

function castBullet(role: VideoCastRole): Paragraph {
  const aantal = `${role.aantal}×`
  const tail = role.omschrijving ? ` — ${role.omschrijving}` : ''
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: '● ', bold: true }),
      new TextRun({ text: `${aantal} ${role.rol}`, bold: true }),
      new TextRun({ text: tail }),
    ],
  })
}

function locatiesSection(brief: VideoBrief): Paragraph[] {
  if (!brief.locaties || brief.locaties.length === 0) return []
  const blocks: Paragraph[] = []
  blocks.push(h2(`Locaties ${brief.dag_titel}`))
  for (const loc of brief.locaties) {
    const scriptsTxt = loc.scripts && loc.scripts.length > 0
      ? ` (scripts ${loc.scripts.join(', ')})`
      : ''
    const tail = loc.toelichting ? ` — ${loc.toelichting}` : ''
    blocks.push(new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: '● ', bold: true }),
        new TextRun({ text: loc.naam, bold: true }),
        new TextRun({ text: scriptsTxt }),
        new TextRun({ text: tail }),
      ],
    }))
  }
  return blocks
}

// ─── Per-script blok (14 velden) ────────────────────────────────────────
function scriptBlock(script: VideoScript): Paragraph[] {
  const blocks: Paragraph[] = []

  // Titel
  blocks.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 200 },
    children: [
      new TextRun({ text: `Script ${script.nummer} — `, bold: true, size: 26, color: RED }),
      new TextRun({ text: script.titel, bold: true, size: 26 }),
    ],
  }))

  // Meta velden
  blocks.push(...fieldLine('Doel', script.doel))
  blocks.push(...fieldLine('Inzicht', script.inzicht))
  blocks.push(...fieldLine('Locatie', script.locatie))
  if (script.lengte_sec) {
    blocks.push(new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [lbl('Lengte: '), val(`~${script.lengte_sec} sec`)],
    }))
  }

  // Cast
  if (script.cast_rollen && script.cast_rollen.length > 0) {
    blocks.push(sectionLabel('Cast'))
    for (const role of script.cast_rollen) {
      blocks.push(castBullet(role))
    }
  }

  // Productie-toets
  if (script.productie_toets) {
    blocks.push(...productieToetsBlock(script.productie_toets))
  }

  // Hook
  if (script.hook) {
    blocks.push(sectionLabel('Hook'))
    blocks.push(...paragraphLines(script.hook))
  }

  // Concept
  if (script.concept) {
    blocks.push(sectionLabel('Concept'))
    blocks.push(...paragraphLines(script.concept))
  }

  // Script lines (voice-over + directions)
  if (script.script_lines && script.script_lines.length > 0) {
    blocks.push(sectionLabel('Script'))
    blocks.push(...scriptLinesBlock(script.script_lines))
  }

  // Shotlist
  if (script.shotlist && script.shotlist.length > 0) {
    blocks.push(sectionLabel('Shotlist'))
    blocks.push(...shotlistBlock(script.shotlist))
  }

  // Tekst in beeld
  if (script.tekst_in_beeld && script.tekst_in_beeld.length > 0) {
    blocks.push(sectionLabel('Tekst in beeld'))
    blocks.push(...overlaysBlock(script.tekst_in_beeld, script.lengte_sec))
  }

  // Montage
  if (script.montage) {
    blocks.push(sectionLabel('Montage'))
    blocks.push(...paragraphLines(script.montage))
  }

  // CTA
  if (script.cta) {
    blocks.push(sectionLabel('Call-to-action'))
    blocks.push(new Paragraph({
      spacing: { after: 100 },
      children: [vo(script.cta.trim())],
    }))
  }

  // Caption
  if (script.caption) {
    blocks.push(sectionLabel('Caption'))
    blocks.push(...paragraphLines(script.caption))
  }

  // Variaties
  if (script.variaties && script.variaties.length > 0) {
    blocks.push(sectionLabel('Variaties'))
    for (const v of script.variaties) {
      blocks.push(new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: '→ ', bold: true, color: RED }),
          vo(v.trim()),
        ],
      }))
    }
  }

  blocks.push(dividerParagraph())
  return blocks
}

function productieToetsBlock(pt: VideoProductieToets): Paragraph[] {
  const blocks: Paragraph[] = []
  blocks.push(sectionLabel('Productie-toets'))
  const fields: Array<[string, string]> = [
    ['Cast', pt.cast],
    ['Locatie', pt.locatie],
    ['Props', pt.props],
    ['Permits', pt.permits],
    ['Productietijd', pt.productietijd],
    ['Risico', pt.risico],
  ]
  for (const [label, value] of fields) {
    if (!value || !value.trim()) continue
    blocks.push(new Paragraph({
      spacing: { after: 60 },
      children: [lbl(`${label}: `), val(value.trim())],
    }))
  }
  // Kostencategorie — beide bold
  if (pt.kostencategorie) {
    blocks.push(new Paragraph({
      spacing: { after: 60 },
      children: [
        lbl('Kostencategorie: '),
        new TextRun({ text: pt.kostencategorie, bold: true }),
      ],
    }))
  }
  return blocks
}

function scriptLinesBlock(lines: VideoScriptLine[]): Paragraph[] {
  return lines.map(line => {
    if (line.type === 'direction') {
      return new Paragraph({
        spacing: { after: 60 },
        children: [dir(line.text)],
      })
    }
    return new Paragraph({
      spacing: { after: 60 },
      children: [vo(line.text)],
    })
  })
}

function timeRange(start: number, end: number | null): string {
  if (end == null) return `vanaf ${start}s`
  return `${start}–${end}s` // en-dash
}

function shotlistBlock(shots: VideoShot[]): Paragraph[] {
  return shots.map(shot => new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${shot.nummer}. `, bold: true }),
      new TextRun({ text: `[${shot.tag}] `, bold: true, color: RED }),
      new TextRun({ text: shot.beschrijving }),
      new TextRun({ text: ` (${timeRange(shot.start_sec, shot.end_sec)})`, color: '666666' }),
    ],
  }))
}

function overlaysBlock(overlays: VideoTextOverlay[], lengteSec: number | null): Paragraph[] {
  return overlays.map(ov => {
    const isEnd = ov.end_sec == null && lengteSec != null && ov.start_sec >= lengteSec - 2
    const timeLabel = isEnd
      ? 'Eind'
      : ov.end_sec != null
        ? `${ov.start_sec}–${ov.end_sec}s`
        : `${ov.start_sec}s`
    return new Paragraph({
      spacing: { after: 60 },
      children: [
        lbl(`${timeLabel}: `),
        vo(ov.text),
      ],
    })
  })
}

// ─── Main entrypoint ────────────────────────────────────────────────────
export type DocxExportArgs = {
  brief: VideoBrief
  scripts: VideoScript[]
  brand: Brand | null
}

export async function buildBriefDocx(args: DocxExportArgs): Promise<Buffer> {
  const { brief, scripts, brand } = args

  // Sorteer scripts op nummer
  const sortedScripts = [...scripts].sort((a, b) => a.nummer - b.nummer)

  const allBlocks: Paragraph[] = [
    ...coverPage(brief, brand, sortedScripts.length),
    ...overzichtSection(brief),
    ...scriptsListSection(sortedScripts),
    ...castTotaalSection(brief, sortedScripts.length),
    ...locatiesSection(brief),
    dividerParagraph(),
    ...sortedScripts.flatMap(s => scriptBlock(s)),
  ]

  const doc = new Document({
    creator: 'ibizz Video Agent',
    title: `${brand?.name ?? 'Brief'} — ${brief.dag_titel}`,
    description: brief.overzicht ?? '',
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } }, // 11pt
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Calibri' },
          paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Calibri' },
          paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: 'Calibri' },
          paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: {
            // A4 portrait (Dutch standard)
            width: 11906,
            height: 16838,
            orientation: PageOrientation.PORTRAIT,
          },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch
        },
      },
      children: allBlocks,
    }],
  })

  return Packer.toBuffer(doc)
}

/**
 * Geeft een veilige filename voor download — bv. "FRENKY_Dag1_v3.docx"
 */
export function filenameFor(brief: VideoBrief, brand: Brand | null): string {
  const brandPart = (brand?.name ?? 'Brief').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/_+/g, '_')
  const dagPart = brief.dag_titel
    .replace(/—/g, '-')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60)
  return `${brandPart}_${dagPart}_v${brief.versie}.docx`.replace(/_+/g, '_').replace(/^_|_$/g, '')
}

// Workaround voor unused-import warning — BorderStyle wordt geëxporteerd
// voor toekomstige uitbreidingen (bv. tabel-borders), maar nog niet gebruikt.
export const _border = BorderStyle
