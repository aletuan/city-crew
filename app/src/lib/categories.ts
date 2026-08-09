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

export type CategoryLabels = { en: string; vi: string; ja: string };

/** Filter-row order: eat and drink first, then things to see and do. */
export const CATEGORY_ORDER = [
  'cafes', 'eats', 'views', 'heritage', 'nature', 'markets', 'nightlife', 'sights',
] as const;

export const CATEGORIES: Record<string, CategoryLabels> = {
  cafes: { en: 'Cafés', vi: 'Cà phê', ja: 'カフェ' },
  eats: { en: 'Eats', vi: 'Ăn uống', ja: '食事' },
  views: { en: 'Views', vi: 'Ngắm cảnh', ja: '眺望' },
  heritage: { en: 'Heritage', vi: 'Di sản & văn hóa', ja: '歴史・文化' },
  nature: { en: 'Parks & lakes', vi: 'Công viên & hồ', ja: '公園・自然' },
  markets: { en: 'Markets', vi: 'Chợ & mua sắm', ja: '市場・買い物' },
  nightlife: { en: 'Nightlife', vi: 'Về đêm', ja: 'ナイトライフ' },
  sights: { en: 'Sights', vi: 'Điểm tham quan', ja: '見どころ' },
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
