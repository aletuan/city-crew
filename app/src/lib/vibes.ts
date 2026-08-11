// Vibe taxonomy — the soft, n-to-n signals a place carries ("cafes",
// "views", "nightlife"), as opposed to the hard `category` axis.
//
// One source of truth for how a vibe presents itself: its dot colour, its
// glyph, and its label in each language. Screens read from here rather than
// keeping their own maps.
//
// Colour discipline: the accent stays the only identity colour, so a vibe's
// hue lives in a 6pt dot and never in a fill or in type. The palette is
// desaturated on purpose — on the near-black ground nothing should compete
// with the accent used for active state.

import type { Ionicons } from '@expo/vector-icons';

export type VibeStyle = {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  en: string;
  vi: string;
  ja: string;
};

export const VIBES: Record<string, VibeStyle> = {
  cafes: { color: '#D2A679', icon: 'cafe-outline', en: 'Cafés', vi: 'Cà phê', ja: 'カフェ' },
  food_tour: { color: '#E09A6B', icon: 'restaurant-outline', en: 'Food', vi: 'Ăn uống', ja: 'グルメ' },
  nightlife: { color: '#A98CD9', icon: 'wine-outline', en: 'Nightlife', vi: 'Về đêm', ja: 'ナイトライフ' },
  // Teal, not green: at 6pt a green dot here was indistinguishable from
  // outdoors' green next to it.
  views: { color: '#6FB3C0', icon: 'business-outline', en: 'Views', vi: 'Ngắm cảnh', ja: '眺望' },
  culture: { color: '#D98A80', icon: 'library-outline', en: 'Culture', vi: 'Văn hóa', ja: 'カルチャー' },
  outdoors: { color: '#8FBF8A', icon: 'leaf-outline', en: 'Nature', vi: 'Thiên nhiên', ja: '自然' },
  chill: { color: '#7FA8D9', icon: 'leaf-outline', en: 'Chill', vi: 'Thư giãn', ja: 'のんびり' },
  shopping: { color: '#C98BB0', icon: 'bag-outline', en: 'Shopping', vi: 'Mua sắm', ja: 'ショッピング' },
};

/** Neutral dot for a vibe the catalog grew before this table knew about it. */
export const VIBE_FALLBACK_COLOR = '#6E706D';

/**
 * Label for a vibe key. An unknown key is shown as-is rather than dropped —
 * new data stays visible instead of silently disappearing from cards.
 */
export function vibeLabel(key: string, t: (en: string, vi: string, ja?: string) => string): string {
  const v = VIBES[key];
  if (v) return t(v.en, v.vi, v.ja);
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function vibeColor(key: string): string {
  return VIBES[key]?.color ?? VIBE_FALLBACK_COLOR;
}
