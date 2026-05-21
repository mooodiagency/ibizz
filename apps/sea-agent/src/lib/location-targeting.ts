/**
 * Locatie targeting voor Google Ads campagnes.
 *
 * Het brief.location veld blijft een string in de DB (geen migration nodig).
 * Wij serializeren een structured target naar JSON in dat veld, met fallback
 * voor oude plain-string waarden (bijv. "Netherlands").
 */

export type LocationItem =
  | { kind: 'country'; value: string }                                  // bijv. "Netherlands"
  | { kind: 'city'; value: string }                                     // bijv. "Amsterdam"
  | { kind: 'postcode'; value: string; country?: string }               // bijv. "1011 AB", NL
  | { kind: 'radius'; centerCity: string; radiusKm: number; country?: string } // bijv. 25 km rond "Utrecht"
  | { kind: 'coordinates'; lat: number; lng: number; radiusKm: number }

export type LocationTargeting = {
  items: LocationItem[]
  /** Google Ads: 'presence' (alleen fysiek aanwezig) of 'presence_or_interest' */
  targetingType: 'presence' | 'presence_or_interest'
}

const DEFAULT: LocationTargeting = {
  items: [{ kind: 'country', value: 'Netherlands' }],
  targetingType: 'presence',
}

/**
 * Parse een brief.location string. Backwards compatible:
 * - JSON met onze structuur → return parsed
 * - Anders → behandel als enkele country/city string
 */
export function parseLocation(raw: string | null | undefined): LocationTargeting {
  if (!raw || !raw.trim()) return DEFAULT
  const trimmed = raw.trim()

  // Probeer JSON
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<LocationTargeting>
      if (Array.isArray(parsed.items)) {
        return {
          items: parsed.items,
          targetingType: parsed.targetingType ?? 'presence',
        }
      }
    } catch { /* fall through */ }
  }

  // Plain string → country fallback
  return {
    items: [{ kind: 'country', value: trimmed }],
    targetingType: 'presence',
  }
}

export function serializeLocation(targeting: LocationTargeting): string {
  // Als het maar één country is en presence default → bewaar als plain string (legacy compat)
  if (
    targeting.items.length === 1 &&
    targeting.items[0].kind === 'country' &&
    targeting.targetingType === 'presence'
  ) {
    return targeting.items[0].value
  }
  return JSON.stringify(targeting)
}

/** Korte menselijke samenvatting voor in lijsten en cards. */
export function describeLocation(targeting: LocationTargeting): string {
  if (targeting.items.length === 0) return '—'
  const parts: string[] = []
  for (const i of targeting.items) {
    switch (i.kind) {
      case 'country':
      case 'city':
        parts.push(i.value); break
      case 'postcode':
        parts.push(`📮 ${i.value}`); break
      case 'radius':
        parts.push(`${i.radiusKm}km rond ${i.centerCity}`); break
      case 'coordinates':
        parts.push(`📍 ${i.lat.toFixed(3)},${i.lng.toFixed(3)} (${i.radiusKm}km)`); break
    }
  }
  return parts.join(' · ')
}
