// Functional categories — what a place is and what you do there. Many per
// place, unlike the legacy two-value `category` column.
//
// This list mirrors app/src/lib/categories.ts and the places_categories_known
// check constraint, whose current form is set by
// supabase/migrations/20260809120000_drop_sights_category.sql.
// Adding or removing a key means changing all three.

export const CATEGORY_KEYS = [
  ['cafes', 'cafés'],
  ['eats', 'eats'],
  ['views', 'views'],
  ['heritage', 'culture'],
  ['nature', 'nature'],
  ['markets', 'shopping'],
  ['nightlife', 'nightlife'],
];

export const CATEGORY_LABEL = Object.fromEntries(CATEGORY_KEYS);
