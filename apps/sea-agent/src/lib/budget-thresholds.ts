/**
 * Budget drempels per campaign type — gebaseerd op ibizz interview inzichten.
 * Onder deze drempels presteren campagnes structureel slecht of komen ze niet uit de "leerfase".
 */

export type BudgetSeverity = 'ok' | 'warning' | 'critical'

export type BudgetCheck = {
  severity: BudgetSeverity
  message: string
  /** Aanbevolen minimum maandbudget */
  recommended: number
}

const DAYS_PER_MONTH = 30.4

/** Algemeen absolute minimum — hieronder is adverteren afgeraden. */
export const ABSOLUTE_MIN_DAILY = 5
export const ABSOLUTE_MIN_MONTHLY = ABSOLUTE_MIN_DAILY * DAYS_PER_MONTH // ~152

/** Per campaign type — daily budget thresholds. */
export const CAMPAIGN_THRESHOLDS: Record<string, { min: number; recommended: number }> = {
  Search:            { min: 10, recommended: 15 },
  'Performance Max': { min: 20, recommended: 30 },
  Display:           { min: 10, recommended: 15 },
  YouTube:           { min: 15, recommended: 25 },
  'Demand Gen':      { min: 333, recommended: 500 },  // €10.000+/mnd is ondergrens
}

/**
 * Check een totaal maandbudget tegen de absolute minimum.
 * Voor brief-niveau validatie (voordat de strategie de verdeling maakt).
 */
export function checkBriefBudget(monthlyBudget: number | null): BudgetCheck | null {
  if (monthlyBudget == null) return null

  const daily = monthlyBudget / DAYS_PER_MONTH

  if (daily < ABSOLUTE_MIN_DAILY) {
    return {
      severity: 'critical',
      message: `Budget van €${monthlyBudget}/maand (€${daily.toFixed(2)}/dag) is te laag — adverteren wordt afgeraden onder €${ABSOLUTE_MIN_DAILY}/dag.`,
      recommended: Math.ceil(ABSOLUTE_MIN_DAILY * DAYS_PER_MONTH),
    }
  }

  if (daily < 10) {
    return {
      severity: 'warning',
      message: `Budget van €${daily.toFixed(2)}/dag is krap. Verwacht 1.5+ maand voordat campagnes leveren.`,
      recommended: Math.ceil(10 * DAYS_PER_MONTH),
    }
  }

  return { severity: 'ok', message: `Gezond budget: €${daily.toFixed(2)}/dag.`, recommended: monthlyBudget }
}

/**
 * Check een budget voor een specifieke campaign type.
 * Voor strategy-niveau validatie (per campaign in de breakdown).
 */
export function checkCampaignBudget(
  campaignType: string,
  monthlyBudget: number,
): BudgetCheck | null {
  const t = CAMPAIGN_THRESHOLDS[campaignType]
  if (!t) return null

  const daily = monthlyBudget / DAYS_PER_MONTH

  if (daily < t.min) {
    return {
      severity: 'critical',
      message: `${campaignType}: €${daily.toFixed(2)}/dag onder minimum (€${t.min}/dag aanbevolen).`,
      recommended: Math.ceil(t.recommended * DAYS_PER_MONTH),
    }
  }

  if (daily < t.recommended) {
    return {
      severity: 'warning',
      message: `${campaignType}: €${daily.toFixed(2)}/dag — minimum is gehaald maar €${t.recommended}/dag is comfortabeler.`,
      recommended: Math.ceil(t.recommended * DAYS_PER_MONTH),
    }
  }

  return null
}

/**
 * CPA aanbeveling op basis van producprijs / order value.
 * Marge regels uit interview: max CPA ≈ 15-20% van de order value.
 */
export function recommendedMaxCpa(averageOrderValue: number): { min: number; max: number } {
  // €50-€150 producten → max CPA ~€25 (interview)
  // Onder €50 → max ~€10
  if (averageOrderValue < 50) return { min: 5, max: 10 }
  if (averageOrderValue < 150) return { min: 15, max: 25 }
  if (averageOrderValue < 300) return { min: 30, max: 50 }
  // Hogere order values: ~15-20% van AOV
  return { min: Math.round(averageOrderValue * 0.12), max: Math.round(averageOrderValue * 0.20) }
}
