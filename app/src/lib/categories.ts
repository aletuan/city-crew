// The functional axis: what a place *is* and what you do there.
//
// Many per place — the Temple of Literature is heritage and a park at once
// — which is what separates this from the old two-value `category` column
// and its "Outdoors & culture" catch-all chip. How a place *feels* is a
// different axis and lives in vibe_tags (see ./vibes).
//
// The vocabulary is closed and mirrored by the places_categories_known
// check constraint, whose current form is set by
// supabase/migrations/20260819040000_focus_fun_categories.sql. Adding or
// removing a key means changing this list, the dashboard's copy in
// dashboard/src/categories.js, and the constraint — in that last order,
// since a constraint tightened before the writers know about it fails
// every import.

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
/** Filter-row order: eat and drink first, then things to see and do.
 *  `focus` sits beside the cafés because that is where somebody scanning
 *  for a place to work will look — it is a way of using a café before it
 *  is anything else — and `fun` beside nightlife, its evening cousin. */
export const CATEGORY_ORDER = [
  'cafes', 'focus', 'eats', 'views', 'heritage', 'nature', 'markets', 'nightlife', 'fun',
] as const;

export const CATEGORIES: Record<string, CategoryStyle> = {
  cafes: { en: 'Cafés', vi: 'Cà phê', ja: 'カフェ', icon: 'cafe-outline', color: '#D2A679' },
  eats: { en: 'Eats', vi: 'Ăn uống', ja: '食事', icon: 'restaurant-outline', color: '#E09A6B' },
  views: { en: 'Views', vi: 'Ngắm cảnh', ja: '眺望', icon: 'business-outline', color: '#6FB3C0' },
  heritage: { en: 'Culture', vi: 'Văn hóa', ja: '文化', icon: 'library-outline', color: '#D98A80' },
  nature: { en: 'Nature', vi: 'Thiên nhiên', ja: '自然', icon: 'leaf-outline', color: '#8FBF8A' },
  markets: { en: 'Shopping', vi: 'Mua sắm', ja: '買い物', icon: 'bag-outline', color: '#C98BB0' },
  nightlife: { en: 'Nightlife', vi: 'Về đêm', ja: 'ナイトライフ', icon: 'wine-outline', color: '#A98CD9' },
  // The two 2026-08 additions, and why their hues are what they are.
  //
  // The obvious picks were wrong, and a test caught it: the seven above
  // sit at 7°, 24°, 30°, 114°, 190°, 263° and 324°, which leaves gaps at
  // 213° and 152° — but the company chips in `trip.ts` were *solved
  // against this table*, and their blue and green sit at 214° and 152°.
  // Landing there would have made "Just me" and a work café the same
  // colour two rows apart on the wizard. So these are solved against both
  // palettes at once: 238° and 293° clear every category hue and every
  // company hue by 23° or more, at the family's own pastel weight.
  //
  // `focus` is a place to sit and work or study. The ticket, not the film
  // reel, for `fun`: a cinema is what the catalog holds today, but the key
  // has to be as true for bowling or a show as for a screen.
  focus: { en: 'Focus', vi: 'Học tập', ja: '作業', icon: 'laptop-outline', color: '#989AD7' },
  fun: { en: 'Fun', vi: 'Giải trí', ja: 'エンタメ', icon: 'ticket-outline', color: '#C88BD0' },
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
 * A place's categories — possibly none.
 *
 * The stored column wins. The vibe-derived fallback covers a row written
 * before the column existed, or by a writer that has not learned about it
 * yet. Beyond that there is no guess to make: a place nothing classifies
 * returns empty and is reached through "All", which is honest, where a
 * catch-all category would have claimed something the data never said.
 */
export function categoriesOf(p: Categorisable): string[] {
  if (p.categories?.length) return p.categories;
  const derived = new Set<string>();
  for (const v of p.vibe_tags ?? []) {
    const c = FROM_VIBE[v];
    if (c) derived.add(c);
  }
  // 'food' means eating and drinking whatever else is missing; 'out' means
  // only "not food", which names nothing.
  if (!derived.size && p.category === 'food') derived.add('eats');
  return [...derived];
}

/**
 * Label for a category key.
 *
 * A key this table has not heard of is shown tidied rather than raw —
 * "street_food" reads as a chip, `street_food` reads as leaked data. The
 * vibe table has always done this; a test comparing the two is what
 * turned up that categories did not.
 */
export function categoryLabel(key: string, t: (en: string, vi: string, ja?: string) => string): string {
  const c = CATEGORIES[key];
  if (c) return t(c.en, c.vi, c.ja);
  return key.replace(/_/g, ' ').replace(/^\w/, (ch) => ch.toUpperCase());
}
