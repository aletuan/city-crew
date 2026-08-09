// The functional axis: what a place *is* and what you do there.
//
// Many per place — the Temple of Literature is heritage and a park at once
// — which is what separates this from the old two-value `category` column
// and its "Outdoors & culture" catch-all chip. How a place *feels* is a
// different axis and lives in vibe_tags (see ./vibes).
//
// The vocabulary is closed and mirrored by a check constraint in
// supabase/migrations/20260809000000_place_categories.sql. Adding a key
// means changing both.

import type { Ionicons } from '@expo/vector-icons';

export type CategoryStyle = {
  en: string;
  vi: string;
  ja: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Carried by the glyph only — never a fill, never type. Matches the dot
   *  the same concept wears on a place card, so the filter row and the
   *  cards read as one colour code. */
  color: string;
};

// Chip labels are two words at most. A filter row is scanned, not read:
// past two words the eye starts parsing instead of recognising, and the
// row stops fitting on one screen. The key stays descriptive; the label
// is the short name of the same thing.
/** Filter-row order: eat and drink first, then things to see and do. */
export const CATEGORY_ORDER = [
  'cafes', 'eats', 'views', 'heritage', 'nature', 'markets', 'nightlife', 'sights',
] as const;

export const CATEGORIES: Record<string, CategoryStyle> = {
  cafes: { en: 'Cafés', vi: 'Cà phê', ja: 'カフェ', icon: 'cafe-outline', color: '#D2A679' },
  eats: { en: 'Eats', vi: 'Ăn uống', ja: '食事', icon: 'restaurant-outline', color: '#E09A6B' },
  views: { en: 'Views', vi: 'Ngắm cảnh', ja: '眺望', icon: 'business-outline', color: '#6FB3C0' },
  heritage: { en: 'Culture', vi: 'Văn hóa', ja: '文化', icon: 'library-outline', color: '#D98A80' },
  nature: { en: 'Nature', vi: 'Thiên nhiên', ja: '自然', icon: 'leaf-outline', color: '#8FBF8A' },
  markets: { en: 'Shopping', vi: 'Mua sắm', ja: '買い物', icon: 'bag-outline', color: '#C98BB0' },
  nightlife: { en: 'Nightlife', vi: 'Về đêm', ja: 'ナイトライフ', icon: 'wine-outline', color: '#A98CD9' },
  // The catch-all stays colourless: it makes no claim about what a place is.
  sights: { en: 'Sights', vi: 'Tham quan', ja: '見どころ', icon: 'location-outline', color: '#9A9C98' },
};

/** Same mapping the migration backfills with — see the note in categoriesOf. */
const FROM_VIBE: Record<string, string> = {
  cafes: 'cafes',
  food_tour: 'eats',
  views: 'views',
  culture: 'heritage',
  outdoors: 'nature',
  shopping: 'markets',
  nightlife: 'nightlife',
};

type Categorisable = { categories?: string[] | null; vibe_tags?: string[] | null; category?: string };

/**
 * A place's categories, never empty.
 *
 * The stored column wins. The vibe-derived fallback covers a row written
 * before the column existed — or by a writer that has not learned about it
 * yet — so a place is always reachable from some chip rather than silently
 * dropping out of every filter.
 */
export function categoriesOf(p: Categorisable): string[] {
  if (p.categories?.length) return p.categories;
  const derived = new Set<string>();
  for (const v of p.vibe_tags ?? []) {
    const c = FROM_VIBE[v];
    if (c) derived.add(c);
  }
  if (derived.size) return [...derived];
  return [p.category === 'food' ? 'eats' : 'sights'];
}

export function categoryLabel(key: string, t: (en: string, vi: string, ja?: string) => string): string {
  const c = CATEGORIES[key];
  return c ? t(c.en, c.vi, c.ja) : key;
}
