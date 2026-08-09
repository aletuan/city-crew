// Functional categories — what a place is and what you do there. Many per
// place, unlike the legacy two-value `category` column.
//
// This list mirrors app/src/lib/categories.ts and the places_categories_known
// check constraint in supabase/migrations/20260809000000_place_categories.sql.
// Adding a key means changing all three.

export const CATEGORY_KEYS = [
  ['cafes', 'cafés'],
  ['eats', 'eats'],
  ['views', 'views'],
  ['heritage', 'heritage'],
  ['nature', 'parks & lakes'],
  ['markets', 'markets'],
  ['nightlife', 'nightlife'],
  ['sights', 'sights'],
];

export const CATEGORY_LABEL = Object.fromEntries(CATEGORY_KEYS);
