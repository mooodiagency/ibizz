/**
 * Gedeelde stijlregels voor alle Nederlandse AI-output binnen de SEA Agent.
 * In het Engels geschreven omdat de prompts in het Engels zijn (consistent met de
 * rest van de instructies aan het model), maar de inhoudelijke regels gaan over
 * de Nederlandse output.
 */
export const DUTCH_STYLE_RULES = `
DUTCH WRITING STYLE (zeer belangrijk — apply to ALL Dutch text you generate):
- Use SENTENCE CASE, not Title Case. Only capitalize the FIRST letter of a sentence/title.
  ✓ "Thuisbatterij op maat"
  ✗ "Thuisbatterij Op Maat"
  ✓ "Bespaar op je energierekening"
  ✗ "Bespaar Op Je Energierekening"
- Always-capitalized exceptions (these MUST stay capitalized):
  • Proper nouns: person names, place names, country names (Nederland, België, Amsterdam).
  • Brand names exactly as written (Solipower, Google, Meta, ibizz).
  • Acronyms / unit abbreviations (BTW, MKB, kWh, CO2 — keep as canonical form).
  • Standalone "I" only in English; in Dutch "ik" is lowercase.
- Day and month names are LOWERCASE in Dutch (maandag, januari, december).
- After a colon mid-sentence, continue lowercase ("Tip: bel ons vandaag nog").
- Hyphenated compounds: only first part capitalized when sentence starts ("Thuisbatterij-installateur"), otherwise lowercase parts ("snel-laadpunt").
- No ALL-CAPS words for emphasis. No title-cased "Free" or "Now" style.
- Never start a sentence with a lowercase letter unless it is a deliberately styled brand mark.
`.trim()

/**
 * Best-effort post-processor: corrigeert overbodige hoofdletters in een Nederlandse
 * tekst zonder bekende eigennamen/merknamen aan te raken. Bedoeld als vangnet wanneer
 * het model toch een Title-Cased zin teruggeeft.
 *
 * Regels:
 * - Eerste letter van de zin: hoofdletter behouden / forceren
 * - Verder: woorden die geen eigennaam, merknaam, acroniem of unit zijn → lowercase eerste letter
 */
const ALWAYS_CAPITALIZED_EXACT = new Set<string>([
  // Brands toevoegen waar nodig
  'Google', 'Meta', 'TikTok', 'LinkedIn', 'Pinterest', 'YouTube', 'Instagram', 'Facebook',
  'ibizz', 'Solipower', 'Anthropic', 'OpenAI', 'Gemini',
  // Landen / steden
  'Nederland', 'België', 'Amsterdam', 'Rotterdam', 'Utrecht', 'Eindhoven', 'Den Haag',
  'Europa', 'Duitsland',
])

const ACRONYMS = /^([A-Z]{2,}|kWh|BTW|MKB|CO2|API|CRM|SEA|SEO|RSA)$/

function correctWord(word: string, isFirst: boolean): string {
  if (!word) return word
  if (ACRONYMS.test(word)) return word
  if (ALWAYS_CAPITALIZED_EXACT.has(word)) return word

  // Als er meer dan 1 hoofdletter in zit (bv. "AdWords"), respecteer
  const upperCount = (word.match(/[A-Z]/g) ?? []).length
  if (upperCount > 1) return word

  if (isFirst) {
    // Eerste woord van de zin moet met hoofdletter
    return word.charAt(0).toUpperCase() + word.slice(1)
  }
  // Verder in de zin: eerste letter naar lowercase
  return word.charAt(0).toLowerCase() + word.slice(1)
}

/**
 * Past sentence case toe op een enkele zin/string.
 * Splitst op spaties, behoudt interne karakters (streepjes, punten in URLs etc.).
 */
export function toSentenceCase(input: string): string {
  if (!input) return input
  // Splits op spatie maar behoud zinsscheidingen (.,!?:)
  const parts = input.split(/(\s+|[.!?]\s+)/)
  let nextIsFirst = true
  return parts
    .map(part => {
      if (/^\s+$/.test(part)) return part
      if (/^[.!?]\s+$/.test(part)) { nextIsFirst = true; return part }
      const word = part
      const corrected = correctWord(word, nextIsFirst)
      nextIsFirst = false
      return corrected
    })
    .join('')
}
