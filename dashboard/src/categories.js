// Functional categories — what a place is and what you do there. Many per
// place, unlike the legacy two-value `category` column.
//
// This list mirrors app/src/lib/categories.ts and the places_categories_known
// check constraint, whose current form is set by
// supabase/migrations/20260809120000_drop_sights_category.sql.
// Adding or removing a key means changing all three.
//
// color + icon are copied from app/src/lib/categories.ts so a category reads
// as the same hue on a mobile card, a mobile chip and a dashboard chip.

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

export const CATEGORY_STYLE = {
  cafes: { color: '#D2A679', icon: 'cafe' },
  eats: { color: '#E09A6B', icon: 'restaurant' },
  views: { color: '#6FB3C0', icon: 'views' },
  heritage: { color: '#D98A80', icon: 'culture' },
  nature: { color: '#8FBF8A', icon: 'leaf' },
  markets: { color: '#C98BB0', icon: 'bag' },
  nightlife: { color: '#A98CD9', icon: 'wine' },
};
