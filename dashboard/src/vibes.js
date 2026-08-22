// Vibe taxonomy for the dashboard's filter row and editor picker — mirrors
// app/src/lib/vibes.ts. Was two separately hand-copied arrays (PlaceList and
// PlaceEditor); one source here so the two can't drift.
//
// color + icon match the mobile app's values so a vibe reads as the same
// hue everywhere it appears.

export const VIBE_ORDER = [
  'cafes', 'food_tour', 'nightlife', 'views', 'culture', 'outdoors', 'chill', 'shopping',
  // Suitability — hand-assigned only; the importer never writes these.
  // The desk is the producer, this picker is the tool, and the planner's
  // COMPANY_LEAN is the consumer.
  'kid_friendly', 'romantic', 'quiet',
];

export const VIBE_STYLE = {
  cafes: { label: 'cafes', color: '#D2A679', icon: 'cafe' },
  food_tour: { label: 'food tour', color: '#E09A6B', icon: 'restaurant' },
  nightlife: { label: 'nightlife', color: '#A98CD9', icon: 'wine' },
  views: { label: 'views', color: '#6FB3C0', icon: 'views' },
  culture: { label: 'culture', color: '#D98A80', icon: 'culture' },
  outdoors: { label: 'outdoors', color: '#8FBF8A', icon: 'leaf' },
  // Same glyph as outdoors — chill is a mood, not a place to be, so it
  // borrows the nearest concept's icon rather than inventing one.
  chill: { label: 'chill', color: '#7FA8D9', icon: 'leaf' },
  shopping: { label: 'shopping', color: '#C98BB0', icon: 'bag' },
  kid_friendly: { label: 'kid-friendly', color: '#D9C37A', icon: 'balloon' },
  romantic: { label: 'romantic', color: '#E08FA8', icon: 'heart' },
  quiet: { label: 'quiet', color: '#A8A79B', icon: 'hush' },
};

export const VIBE_LABEL = Object.fromEntries(VIBE_ORDER.map((v) => [v, VIBE_STYLE[v].label]));
