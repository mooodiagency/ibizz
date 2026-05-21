/**
 * SEO + GEO + Leesbaarheid score analyse.
 * Pure functies — geen externe API nodig. Runt client-side in real-time
 * terwijl de gebruiker schrijft in de ArticleEditor.
 *
 * Geen externe dependencies — alle analyse logica is custom:
 *  - SEO basics: rule-based op markdown structuur
 *  - GEO: heuristieken voor AI search optimalisatie (cijfers, Q&A, definities, bronnen)
 *  - Leesbaarheid: Flesch-Douma formule (Nederlandse adaptatie van Flesch)
 */

export type CheckSeverity = 'pass' | 'warn' | 'fail'

export type Check = {
  id: string
  label: string
  passed: boolean
  weight: number          // 0.5 - 2, voor gewogen scoring
  detail?: string         // huidige waarde / context
  fix?: string            // concrete suggestie als check faalt
}

export type ScoreResult = {
  score: number           // 0-100
  checks: Check[]
  passedCount: number
  totalCount: number
}

export type AnalysisInput = {
  title: string
  meta_title: string | null
  meta_description: string | null
  content_markdown: string
  target_keyword: string | null
  secondary_keywords: string[]
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')           // code blocks
    .replace(/`[^`]+`/g, ' ')                  // inline code
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')     // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // links → anchor text
    .replace(/^#+\s+/gm, '')                   // heading hashes
    .replace(/[*_~>]/g, '')                    // emphasis chars
    .replace(/^[-+*]\s+/gm, '')                // list bullets
    .replace(/^\d+\.\s+/gm, '')                // ordered list
    .replace(/^\|[^|]+\|.*$/gm, '')            // tables
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function computeScore(checks: Check[]): ScoreResult {
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0)
  const passedWeight = checks.filter(c => c.passed).reduce((s, c) => s + c.weight, 0)
  const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0
  return {
    score,
    checks,
    passedCount: checks.filter(c => c.passed).length,
    totalCount: checks.length,
  }
}

// ─────────────────────────────────────────────────────────────────────
// SEO Basics
// ─────────────────────────────────────────────────────────────────────

export function analyzeSeoBasics(input: AnalysisInput): ScoreResult {
  const checks: Check[] = []
  const md = input.content_markdown
  const plainText = stripMarkdown(md)
  const wordCount = countWords(plainText)
  const target = (input.target_keyword ?? '').toLowerCase().trim()

  // Title length
  const titleLen = input.title.length
  checks.push({
    id: 'title_length',
    label: 'Titel 50-60 tekens',
    passed: titleLen >= 50 && titleLen <= 65,
    weight: 1,
    detail: `${titleLen} tekens`,
    fix: titleLen < 50 ? 'Titel is te kort. Voeg context of jaartal toe.' :
         titleLen > 65 ? 'Titel is te lang. Google capt op ~60 chars.' : undefined,
  })

  // Meta description
  const mdLen = (input.meta_description ?? '').length
  checks.push({
    id: 'meta_description',
    label: 'Meta description 140-160 tekens',
    passed: mdLen >= 140 && mdLen <= 160,
    weight: 1,
    detail: mdLen === 0 ? 'Ontbreekt' : `${mdLen} tekens`,
    fix: mdLen === 0 ? 'Voeg een meta description toe.' :
         mdLen < 140 ? 'Te kort. Vul aan tot 140-160 chars.' :
         mdLen > 160 ? 'Te lang. Wordt afgekapt in SERP.' : undefined,
  })

  // Meta title length (apart van H1)
  const mtLen = (input.meta_title ?? '').length
  checks.push({
    id: 'meta_title_length',
    label: 'Meta title 50-60 tekens',
    passed: mtLen >= 30 && mtLen <= 60,
    weight: 1,
    detail: mtLen === 0 ? 'Ontbreekt' : `${mtLen} tekens`,
    fix: mtLen === 0 ? 'Voeg meta title toe (mag verschillen van H1).' :
         mtLen > 60 ? 'Te lang.' : undefined,
  })

  // Target keyword checks
  if (target) {
    const targetRegex = new RegExp(escapeRegex(target), 'gi')

    // In H1
    const h1Match = md.match(/^#\s+(.+)$/m)
    const h1Text = (h1Match?.[1] ?? '').toLowerCase()
    checks.push({
      id: 'kw_in_h1',
      label: 'Target keyword in H1',
      passed: h1Text.includes(target),
      weight: 2,
      fix: 'Verwerk het target keyword natuurlijk in de H1.',
    })

    // In first 100 words
    const first100 = plainText.split(/\s+/).slice(0, 100).join(' ').toLowerCase()
    checks.push({
      id: 'kw_in_intro',
      label: 'Target keyword in eerste 100 woorden',
      passed: first100.includes(target),
      weight: 1,
      fix: 'Verwerk het target keyword in de eerste alinea.',
    })

    // Keyword density
    const occurrences = (plainText.match(targetRegex) ?? []).length
    const targetWords = countWords(target)
    const density = wordCount > 0 ? (occurrences * targetWords) / wordCount : 0
    checks.push({
      id: 'kw_density',
      label: 'Keyword density 0.5-2.5%',
      passed: density >= 0.005 && density <= 0.025,
      weight: 1,
      detail: `${(density * 100).toFixed(2)}% (${occurrences}×)`,
      fix: density < 0.005 ? 'Keyword komt te weinig voor. Verwerk in 2-3 extra zinnen.' :
           density > 0.025 ? 'Keyword stuffing. Vervang sommige door synoniemen.' : undefined,
    })

    // In a H2
    const h2Matches = md.match(/^##\s+(.+)$/gm) ?? []
    const inH2 = h2Matches.some(h => h.toLowerCase().includes(target))
    checks.push({
      id: 'kw_in_h2',
      label: 'Target keyword in min. 1 H2',
      passed: inH2,
      weight: 1,
      fix: 'Verwerk het keyword in tenminste één H2.',
    })

    // Secondary keywords used
    if (input.secondary_keywords.length > 0) {
      const lowerText = plainText.toLowerCase()
      const usedSecondaries = input.secondary_keywords.filter(k => lowerText.includes(k.toLowerCase())).length
      const ratio = usedSecondaries / input.secondary_keywords.length
      checks.push({
        id: 'secondary_kws',
        label: 'Secondary keywords (≥60% verwerkt)',
        passed: ratio >= 0.6,
        weight: 1,
        detail: `${usedSecondaries}/${input.secondary_keywords.length} gebruikt`,
        fix: 'Verwerk meer secondary keywords natuurlijk in de tekst.',
      })
    }
  }

  // H1 count
  const h1Count = (md.match(/^#\s/gm) ?? []).length
  checks.push({
    id: 'h1_count',
    label: 'Exact één H1',
    passed: h1Count === 1,
    weight: 1.5,
    detail: `${h1Count} H1${h1Count === 1 ? '' : 's'}`,
    fix: h1Count === 0 ? 'Geen H1. Voeg titel toe met # aan het begin.' :
         h1Count > 1 ? 'Meerdere H1\'s. Alleen de titel mag H1 zijn.' : undefined,
  })

  // Heading hierarchy (no level skipping)
  const headingsInOrder = (md.match(/^(#+)\s/gm) ?? []).map(h => h.trim().length)
  let validHierarchy = true
  for (let i = 1; i < headingsInOrder.length; i++) {
    if (headingsInOrder[i] > headingsInOrder[i - 1] + 1) {
      validHierarchy = false
      break
    }
  }
  checks.push({
    id: 'heading_hierarchy',
    label: 'Heading hiërarchie consistent',
    passed: validHierarchy,
    weight: 1,
    fix: 'Sla geen heading levels over. H2 → H3 → H4, nooit H1 → H3.',
  })

  // Word count (min 600)
  checks.push({
    id: 'word_count_min',
    label: 'Minimaal 600 woorden',
    passed: wordCount >= 600,
    weight: 1,
    detail: `${wordCount} woorden`,
    fix: wordCount < 600 ? 'Te kort voor goede SEO. Doel: 800-2000 woorden.' : undefined,
  })

  // Internal links
  const allLinks = [...md.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)]
  const internalLinks = allLinks.filter(m =>
    m[2].startsWith('/') || (!m[2].startsWith('http') && !m[2].startsWith('mailto:') && !m[2].startsWith('tel:'))
  )
  checks.push({
    id: 'internal_links',
    label: 'Min. 2 interne links',
    passed: internalLinks.length >= 2,
    weight: 1,
    detail: `${internalLinks.length} interne link${internalLinks.length === 1 ? '' : 's'}`,
    fix: 'Voeg 2-3 interne links toe naar andere paginas op je site.',
  })

  // External links
  const externalLinks = allLinks.filter(m => m[2].startsWith('http'))
  checks.push({
    id: 'external_links',
    label: '1-5 externe links',
    passed: externalLinks.length >= 1 && externalLinks.length <= 5,
    weight: 1,
    detail: `${externalLinks.length} externe link${externalLinks.length === 1 ? '' : 's'}`,
    fix: externalLinks.length === 0 ? 'Voeg 1-3 externe links toe naar autoriteit bronnen.' :
         externalLinks.length > 5 ? 'Te veel externe links. Houd de beste 1-3.' : undefined,
  })

  return computeScore(checks)
}

// ─────────────────────────────────────────────────────────────────────
// GEO Score (Generative Engine Optimization)
// ─────────────────────────────────────────────────────────────────────

const AUTHORITATIVE_DOMAINS = [
  'rijksoverheid.nl', 'belastingdienst.nl', 'kvk.nl', 'cbs.nl', 'rivm.nl',
  'consumentenbond.nl', 'wikipedia.org', 'overheid.nl', 'eur-lex.europa.eu',
  'nu.nl', 'nrc.nl', 'fd.nl', 'volkskrant.nl', 'parool.nl', 'ad.nl',
  'autoriteitpersoonsgegevens.nl', 'acm.nl', 'afm.nl', 'dnb.nl',
]

export function analyzeGeo(input: AnalysisInput): ScoreResult {
  const md = input.content_markdown
  const plainText = stripMarkdown(md)
  const checks: Check[] = []

  // 1. Concrete cijfers / feiten
  const numberMatches = plainText.match(
    /\b\d+([.,]\d+)?\s*(%|euro|€|jaar|maand|dag|week|uur|kg|km|m²|m³|cent|miljoen|duizend|miljard|x|maal|keer|procent)\b/gi
  ) ?? []
  checks.push({
    id: 'concrete_facts',
    label: 'Concrete cijfer-feiten (≥3)',
    passed: numberMatches.length >= 3,
    weight: 2,
    detail: `${numberMatches.length} cijfers met context`,
    fix: 'AI-search beloont content met concrete data. Voeg percentages, jaartallen, of statistieken toe.',
  })

  // 2. Q&A patronen in headings
  const headings = md.match(/^#+\s+(.+)$/gm) ?? []
  const questionWords = /^(##+)\s*(Hoe|Wat|Waarom|Wanneer|Welke|Wie|Hoeveel|Mag|Kan|Moet|Is|Zijn)\b/i
  const questionHeadings = headings.filter(h => questionWords.test(h)).length
  checks.push({
    id: 'qa_structure',
    label: 'Q&A structuur (≥2 vraag-headings)',
    passed: questionHeadings >= 2,
    weight: 2,
    detail: `${questionHeadings} vraag-headings`,
    fix: 'AI search engines geven prioriteit aan Q&A. Formuleer H2/H3 als vragen ("Hoe doe je X?").',
  })

  // 3. Definities
  const definitionPatterns = [
    /\b[A-Z][a-zëéè]+\s+is\s+(een|de|het|niet)\b/g,
    /\b(betekent|verwijst naar|staat voor)\b/gi,
    /\b[A-Z][a-zëéè]+\s+zijn\s+(een|niet)\b/g,
  ]
  const defCount = definitionPatterns.reduce((s, re) => s + (plainText.match(re) ?? []).length, 0)
  checks.push({
    id: 'definitions',
    label: 'Duidelijke definities (≥1)',
    passed: defCount >= 1,
    weight: 1,
    detail: `${defCount} definities`,
    fix: 'AI-search citeert graag definities. Schrijf "X is een Y die..."',
  })

  // 4. Autoritaire externe links
  const externalLinks = [...md.matchAll(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g)]
  const authLinks = externalLinks.filter(m => AUTHORITATIVE_DOMAINS.some(d => m[1].includes(d)))
  checks.push({
    id: 'auth_links',
    label: 'Autoritaire bronnen (≥1)',
    passed: authLinks.length >= 1,
    weight: 1.5,
    detail: `${authLinks.length} autoritair${authLinks.length === 1 ? 'e' : 'e'} link${authLinks.length === 1 ? '' : 's'}`,
    fix: 'AI-search waardeert citaties naar overheid/kvk/wikipedia/CBS. Voeg er minimaal 1 toe.',
  })

  // 5. Lijsten (gestructureerde content)
  const bulletItems = (md.match(/^[-*+]\s+/gm) ?? []).length
  const orderedItems = (md.match(/^\d+\.\s+/gm) ?? []).length
  const totalListItems = bulletItems + orderedItems
  checks.push({
    id: 'lists',
    label: 'Lijsten gebruikt (≥3 items totaal)',
    passed: totalListItems >= 3,
    weight: 1,
    detail: `${totalListItems} list items`,
    fix: 'Lijsten maken content scannbaar voor AI. Schrijf opsommingen als bullets.',
  })

  // 6. Tabellen
  const hasTable = /^\|.+\|$/m.test(md)
  checks.push({
    id: 'has_table',
    label: 'Tabel aanwezig (optioneel)',
    passed: hasTable,
    weight: 0.5,
    detail: hasTable ? 'Ja' : 'Nee',
    fix: 'Een vergelijkende tabel verhoogt AI citation kans. Overweeg er één toe te voegen.',
  })

  // 7. Korte declaratieve zinnen (eerste 5 zinnen check)
  const firstSentences = plainText.split(/[.!?]+/).slice(0, 5).filter(s => s.trim().length > 0)
  const shortFirst = firstSentences.filter(s => countWords(s) <= 15).length
  checks.push({
    id: 'concise_opener',
    label: 'Korte zinnen in intro (≥3 van eerste 5 ≤15 woorden)',
    passed: shortFirst >= 3,
    weight: 1,
    detail: `${shortFirst}/5 intro zinnen kort`,
    fix: 'AI pakt graag korte declaratieve openers. Knip lange intro zinnen op.',
  })

  return computeScore(checks)
}

// ─────────────────────────────────────────────────────────────────────
// Leesbaarheid (Flesch-Douma — Nederlands)
// ─────────────────────────────────────────────────────────────────────

function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-zëéèäáàïíöóòüúù]/g, '')
  if (cleaned.length === 0) return 0
  // Tel klinker-groepen (basis Nederlandse syllable detection)
  const vowelGroups = cleaned.match(/[aeiouyëéèäáàïíöóòüúù]+/g) ?? []
  let count = vowelGroups.length
  // Stille -e aan einde van woord (maar niet als eenlettergrepig)
  if (count > 1 && /e$/.test(cleaned)) count--
  return Math.max(1, count)
}

export function analyzeReadability(input: AnalysisInput): ScoreResult {
  const plainText = stripMarkdown(input.content_markdown)
  const checks: Check[] = []

  if (plainText.length < 50) {
    return {
      score: 0,
      checks: [{ id: 'too_short', label: 'Tekst te kort voor analyse', passed: false, weight: 1 }],
      passedCount: 0,
      totalCount: 1,
    }
  }

  const sentences = plainText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0)
  const words = plainText.split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const sentenceCount = sentences.length

  const avgWordsPerSentence = wordCount / Math.max(1, sentenceCount)
  const totalSyllables = words.reduce((s, w) => s + countSyllables(w), 0)
  const avgSyllablesPerWord = totalSyllables / wordCount
  const avgWordLength = words.reduce((s, w) => s + w.length, 0) / wordCount

  // Flesch-Douma (1960) — Nederlandse adaptatie van Flesch reading ease
  // Score = 206.84 − (77 × syllables_per_word) − (0.93 × words_per_sentence)
  const fleschDouma = 206.84 - (77 * avgSyllablesPerWord) - (0.93 * avgWordsPerSentence)
  const fleschClamped = Math.max(0, Math.min(100, fleschDouma))

  checks.push({
    id: 'flesch_score',
    label: 'Leesbaarheid score (B1 doel: 60-75)',
    passed: fleschClamped >= 55 && fleschClamped <= 80,
    weight: 2,
    detail: `${Math.round(fleschClamped)}/100${fleschClamped >= 70 ? ' (makkelijk)' : fleschClamped >= 55 ? ' (B1)' : ' (moeilijk)'}`,
    fix: fleschClamped < 55 ? 'Tekst te moeilijk. Korter zinnen + simpeler woorden.' :
         fleschClamped > 85 ? 'Erg simpel. Kan iets meer diepte hebben.' : undefined,
  })

  // Sentence length
  checks.push({
    id: 'sentence_length',
    label: 'Gem. zinslengte ≤20 woorden',
    passed: avgWordsPerSentence <= 20,
    weight: 1,
    detail: `${avgWordsPerSentence.toFixed(1)} woorden/zin`,
    fix: 'Knip lange zinnen op. Doel: gemiddeld 12-18 woorden per zin.',
  })

  // Very long sentences
  const longSentences = sentences.filter(s => countWords(s) > 25).length
  checks.push({
    id: 'long_sentences',
    label: 'Geen overlange zinnen (>25 woorden)',
    passed: longSentences === 0,
    weight: 1,
    detail: `${longSentences} lange zin${longSentences === 1 ? '' : 'nen'}`,
    fix: longSentences > 0 ? `Knip ${longSentences} lange zin${longSentences === 1 ? '' : 'nen'} in tweeën.` : undefined,
  })

  // Word length
  checks.push({
    id: 'word_length',
    label: 'Gem. woordlengte ≤6 letters',
    passed: avgWordLength <= 6,
    weight: 1,
    detail: `${avgWordLength.toFixed(1)} letters/woord`,
    fix: 'Te veel lange woorden. Kies simpeler synoniemen.',
  })

  // Passieve vorm — heuristiek: "wordt"/"worden" + (vermoedelijk) voltooid deelwoord
  const passiveMatches = (plainText.match(/\b(wordt|worden|werd|werden|is\s+ge|zijn\s+ge)\b/gi) ?? []).length
  const passiveRatio = passiveMatches / Math.max(1, sentenceCount)
  checks.push({
    id: 'passive_voice',
    label: 'Actieve vorm (passief ≤15%)',
    passed: passiveRatio <= 0.15,
    weight: 1,
    detail: `${Math.round(passiveRatio * 100)}% passief`,
    fix: 'Te veel "wordt/worden". Schrijf actief: "wij bouwen" niet "er wordt gebouwd".',
  })

  // Alinea lengte
  const paragraphs = input.content_markdown
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p && !p.startsWith('#') && !p.startsWith('-') && !p.startsWith('*') && !p.startsWith('|') && !/^\d+\.\s/.test(p))
  const avgParaWords = paragraphs.length > 0
    ? paragraphs.reduce((s, p) => s + countWords(stripMarkdown(p)), 0) / paragraphs.length
    : 0
  checks.push({
    id: 'paragraph_length',
    label: 'Alinea ≤80 woorden gemiddeld',
    passed: avgParaWords > 0 && avgParaWords <= 80,
    weight: 1,
    detail: `${Math.round(avgParaWords)} woorden/alinea`,
    fix: 'Knip lange alineas op. Doel: 2-4 zinnen per alinea.',
  })

  // AI-tells detectie
  const aiTells = [
    /\bhet is essentieel\b/gi,
    /\bhet is belangrijk om\b/gi,
    /\buiteindelijk\b/gi,
    /\btot slot\b/gi,
    /\bkortom\b/gi,
    /\blaten we eens\b/gi,
    /\brevolutionair\b/gi,
    /\bbaanbrekend\b/gi,
    /\bin essentie\b/gi,
    /—|–/g,  // em-dashes
  ]
  const tellCount = aiTells.reduce((s, re) => s + (plainText.match(re) ?? []).length, 0)
  checks.push({
    id: 'no_ai_tells',
    label: 'Geen AI-tells (em-dashes, lege overgangen)',
    passed: tellCount === 0,
    weight: 1,
    detail: `${tellCount} AI-tells gevonden`,
    fix: 'Verwijder em-dashes (—), "uiteindelijk", "tot slot", "kortom", "het is essentieel".',
  })

  return computeScore(checks)
}

// ─────────────────────────────────────────────────────────────────────
// Word count (puur)
// ─────────────────────────────────────────────────────────────────────

export function getWordCount(markdown: string): number {
  return countWords(stripMarkdown(markdown))
}
