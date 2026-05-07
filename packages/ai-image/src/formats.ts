export type FormatGroup =
  | 'Social — Promotioneel'
  | 'Social — Organisch'
  | 'Google Ads'
  | 'DPG Media'
  | 'Funda'

export type FormatDef = {
  id: string
  name: string
  platform: string
  group: FormatGroup
  width: number
  height: number
}

export const FORMATS: FormatDef[] = [
  // ── Social — Promotioneel ─────────────────────────────────────────────
  { id: 'meta-fb-promo-video',    platform: 'Meta (FB)',  name: 'Video',           group: 'Social — Promotioneel', width: 1080, height: 1350 },
  { id: 'meta-fb-promo-story',    platform: 'Meta (FB)',  name: 'Stories/Reels',   group: 'Social — Promotioneel', width: 1080, height: 1920 },
  { id: 'meta-fb-promo-carrou',   platform: 'Meta (FB)',  name: 'Carrousel',       group: 'Social — Promotioneel', width: 1080, height: 1080 },
  { id: 'meta-fb-promo-still',    platform: 'Meta (FB)',  name: 'Still (staand)',  group: 'Social — Promotioneel', width: 630,  height: 1200 },

  { id: 'meta-ig-promo-video',    platform: 'Meta (IG)',  name: 'Video',           group: 'Social — Promotioneel', width: 1080, height: 1440 },
  { id: 'meta-ig-promo-story',    platform: 'Meta (IG)',  name: 'Stories/Reels',   group: 'Social — Promotioneel', width: 1080, height: 1920 },
  { id: 'meta-ig-promo-carrou',   platform: 'Meta (IG)',  name: 'Carrousel',       group: 'Social — Promotioneel', width: 1080, height: 1080 },
  { id: 'meta-ig-promo-still',    platform: 'Meta (IG)',  name: 'Still (staand)',  group: 'Social — Promotioneel', width: 1080, height: 1440 },

  { id: 'li-promo-video',         platform: 'LinkedIn',   name: 'Video',           group: 'Social — Promotioneel', width: 1080, height: 1080 },
  { id: 'li-promo-carrou',        platform: 'LinkedIn',   name: 'Carrousel',       group: 'Social — Promotioneel', width: 1080, height: 1080 },
  { id: 'li-promo-still',         platform: 'LinkedIn',   name: 'Still',           group: 'Social — Promotioneel', width: 1080, height: 1920 },

  { id: 'tt-promo-video',         platform: 'TikTok',     name: 'Video',           group: 'Social — Promotioneel', width: 1080, height: 1920 },
  { id: 'tt-promo-story',         platform: 'TikTok',     name: 'Stories/Reels',   group: 'Social — Promotioneel', width: 1080, height: 1920 },
  { id: 'tt-promo-carrou',        platform: 'TikTok',     name: 'Carrousel',       group: 'Social — Promotioneel', width: 1080, height: 1920 },
  { id: 'tt-promo-still',         platform: 'TikTok',     name: 'Still',           group: 'Social — Promotioneel', width: 1080, height: 1920 },

  { id: 'pin-promo-video',        platform: 'Pinterest',  name: 'Video',           group: 'Social — Promotioneel', width: 1000, height: 1500 },
  { id: 'pin-promo-carrou',       platform: 'Pinterest',  name: 'Carrousel',       group: 'Social — Promotioneel', width: 1000, height: 1500 },
  { id: 'pin-promo-still',        platform: 'Pinterest',  name: 'Still',           group: 'Social — Promotioneel', width: 1000, height: 1500 },

  // ── Social — Organisch ────────────────────────────────────────────────
  { id: 'meta-org-video',         platform: 'Facebook/Instagram', name: 'Video',          group: 'Social — Organisch', width: 1080, height: 1920 },
  { id: 'meta-org-story',         platform: 'Facebook/Instagram', name: 'Stories/Reels',  group: 'Social — Organisch', width: 1080, height: 1920 },
  { id: 'meta-org-carrou',        platform: 'Facebook/Instagram', name: 'Carrousel',      group: 'Social — Organisch', width: 1080, height: 1350 },
  { id: 'meta-org-still',         platform: 'Facebook/Instagram', name: 'Still',          group: 'Social — Organisch', width: 1080, height: 1350 },

  { id: 'li-org-video',           platform: 'LinkedIn',   name: 'Video',           group: 'Social — Organisch', width: 1080, height: 1080 },
  { id: 'li-org-carrou',          platform: 'LinkedIn',   name: 'Carrousel',       group: 'Social — Organisch', width: 1080, height: 1080 },
  { id: 'li-org-still',           platform: 'LinkedIn',   name: 'Still',           group: 'Social — Organisch', width: 1080, height: 1920 },

  { id: 'tt-org-video',           platform: 'TikTok',     name: 'Video',           group: 'Social — Organisch', width: 1080, height: 1920 },
  { id: 'tt-org-story',           platform: 'TikTok',     name: 'Stories/Reels',   group: 'Social — Organisch', width: 1080, height: 1920 },
  { id: 'tt-org-carrou',          platform: 'TikTok',     name: 'Carrousel',       group: 'Social — Organisch', width: 1080, height: 1920 },
  { id: 'tt-org-still',           platform: 'TikTok',     name: 'Still',           group: 'Social — Organisch', width: 1080, height: 1920 },

  { id: 'pin-org-video',          platform: 'Pinterest',  name: 'Video',           group: 'Social — Organisch', width: 1000, height: 1500 },
  { id: 'pin-org-carrou',         platform: 'Pinterest',  name: 'Carrousel',       group: 'Social — Organisch', width: 1000, height: 1500 },
  { id: 'pin-org-still',          platform: 'Pinterest',  name: 'Still',           group: 'Social — Organisch', width: 1000, height: 1500 },

  // ── Google Ads ────────────────────────────────────────────────────────
  { id: 'gads-search-1-1',        platform: 'Google Search', name: 'Image asset 1:1',     group: 'Google Ads', width: 1200, height: 1200 },
  { id: 'gads-search-1-91',       platform: 'Google Search', name: 'Image asset 1.91:1',  group: 'Google Ads', width: 1200, height: 628  },
  { id: 'gads-pmax-1-91',         platform: 'Performance Max', name: 'Beeld 1.91:1',      group: 'Google Ads', width: 1200, height: 628  },
  { id: 'gads-pmax-1-1',          platform: 'Performance Max', name: 'Beeld 1:1',         group: 'Google Ads', width: 1200, height: 1200 },
  { id: 'gads-pmax-4-5',          platform: 'Performance Max', name: 'Beeld 4:5',         group: 'Google Ads', width: 960,  height: 1200 },
  { id: 'gads-pmax-9-16',         platform: 'Performance Max', name: 'Video 9:16',        group: 'Google Ads', width: 1080, height: 1920 },
  { id: 'gads-pmax-1-1-vid',      platform: 'Performance Max', name: 'Video 1:1',         group: 'Google Ads', width: 1080, height: 1080 },
  { id: 'gads-pmax-16-9',         platform: 'Performance Max', name: 'Video 16:9',        group: 'Google Ads', width: 1920, height: 1080 },

  // ── DPG Media ─────────────────────────────────────────────────────────
  { id: 'dpg-seamless',           platform: 'DPG',  name: 'Seamless Image',          group: 'DPG Media', width: 1440, height: 720  },
  { id: 'dpg-seamless-l',         platform: 'DPG',  name: 'Seamless Image L',        group: 'DPG Media', width: 1440, height: 960  },
  { id: 'dpg-seamless-xl',        platform: 'DPG',  name: 'Seamless Image XL',       group: 'DPG Media', width: 1440, height: 1440 },
  { id: 'dpg-carrou',             platform: 'DPG',  name: 'Seamless Carrousel',      group: 'DPG Media', width: 1080, height: 1080 },
  { id: 'dpg-medium-rect',        platform: 'DPG',  name: 'Medium Rectangle',        group: 'DPG Media', width: 320,  height: 250  },
  { id: 'dpg-half-page',          platform: 'DPG',  name: 'Half page',               group: 'DPG Media', width: 300,  height: 600  },
  { id: 'dpg-mpage',              platform: 'DPG',  name: 'Mpage',                   group: 'DPG Media', width: 320,  height: 480  },
  { id: 'dpg-billboard',          platform: 'DPG',  name: 'Billboard',               group: 'DPG Media', width: 970,  height: 250  },
  { id: 'dpg-header-imu',         platform: 'DPG',  name: 'Header IMU',              group: 'DPG Media', width: 300,  height: 250  },

  // ── Funda ─────────────────────────────────────────────────────────────
  { id: 'funda-billboard',        platform: 'Funda', name: 'Billboard',                  group: 'Funda', width: 970, height: 250 },
  { id: 'funda-half-page',        platform: 'Funda', name: 'Halfpage',                   group: 'Funda', width: 300, height: 600 },
  { id: 'funda-leader-foto',      platform: 'Funda', name: 'Leaderboard Fotopagina',     group: 'Funda', width: 728, height: 90  },
  { id: 'funda-leader-result',    platform: 'Funda', name: 'Leaderboard Resultaatlijst', group: 'Funda', width: 728, height: 90  },
  { id: 'funda-medium-rect',      platform: 'Funda', name: 'Medium Rectangle',           group: 'Funda', width: 300, height: 250 },
  { id: 'funda-large-skyscraper', platform: 'Funda', name: 'Large Skyscraper',           group: 'Funda', width: 120, height: 600 },
  { id: 'funda-skyscraper',       platform: 'Funda', name: 'Skyscraper',                 group: 'Funda', width: 60,  height: 600 },
  { id: 'funda-mob-half',         platform: 'Funda', name: 'Mobile Halfpage',            group: 'Funda', width: 320, height: 240 },
  { id: 'funda-mob-banner',       platform: 'Funda', name: 'Mobile Largebanner',         group: 'Funda', width: 320, height: 100 },
]

import type { AspectRatio } from './types'

/** Door Gemini ondersteunde aspect ratios met hun decimal value voor matching. */
const GEMINI_RATIOS: Array<{ label: AspectRatio; value: number }> = [
  { label: '1:1',  value: 1 / 1 },
  { label: '2:3',  value: 2 / 3 },
  { label: '3:2',  value: 3 / 2 },
  { label: '3:4',  value: 3 / 4 },
  { label: '4:3',  value: 4 / 3 },
  { label: '4:5',  value: 4 / 5 },
  { label: '5:4',  value: 5 / 4 },
  { label: '9:16', value: 9 / 16 },
  { label: '16:9', value: 16 / 9 },
  { label: '21:9', value: 21 / 9 },
]

/**
 * Map any width/height to the closest Gemini-supported aspect ratio.
 * Garandeert dat Gemini de juiste oriëntatie produceert.
 */
export function nearestGeminiAspectRatio(width: number, height: number): AspectRatio {
  const target = width / height
  let best = GEMINI_RATIOS[0]
  let bestDiff = Math.abs(GEMINI_RATIOS[0].value - target)
  for (const r of GEMINI_RATIOS) {
    const diff = Math.abs(r.value - target)
    if (diff < bestDiff) { best = r; bestDiff = diff }
  }
  return best.label
}

export function aspectRatioOf(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const g = gcd(width, height)
  return `${width / g}:${height / g}`
}

export function aspectLabel(width: number, height: number): string {
  const ratio = width / height
  if (Math.abs(ratio - 1) < 0.01) return 'vierkant'
  if (ratio < 1) return `staand ${aspectRatioOf(width, height)}`
  return `liggend ${aspectRatioOf(width, height)}`
}
