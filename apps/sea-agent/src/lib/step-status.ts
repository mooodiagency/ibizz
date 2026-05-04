import type { SeaStrategy, SeaKeywordResearch } from '@ibizz/supabase'

export type StepStatus = 'open' | 'in_progress' | 'approved'

export function strategyStatus(s: SeaStrategy | null | undefined): StepStatus {
  if (!s) return 'open'
  if (s.status === 'approved') return 'approved'
  return 'in_progress'
}

export function keywordsStatus(r: SeaKeywordResearch | null | undefined): StepStatus {
  if (!r || r.campaigns.length === 0) return 'open'
  if (r.status === 'approved') return 'approved'
  return 'in_progress'
}

export function adCopyStatus(r: SeaKeywordResearch | null | undefined): StepStatus {
  if (!r) return 'open'
  const groups = r.campaigns.flatMap(c => c.ad_groups)
  if (groups.length === 0) return 'open'
  const withCopy = groups.filter(g => g.ad_copy && g.ad_copy.headlines.length > 0).length
  if (withCopy === 0) return 'open'
  // Volledig + research approved = approved
  if (withCopy === groups.length && r.status === 'approved') return 'approved'
  return 'in_progress'
}

export function negativesStatus(count: number): StepStatus {
  if (count === 0) return 'open'
  // Een minimale lijst telt als approved (>= 50 termen)
  return count >= 50 ? 'approved' : 'in_progress'
}

export const STATUS_DOT_COLOR: Record<StepStatus, string> = {
  open: '#ef4444',         // red-500
  in_progress: '#f97316',  // orange-500
  approved: '#22c55e',     // green-500
}

export const STATUS_LABEL: Record<StepStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  approved: 'Approved',
}
