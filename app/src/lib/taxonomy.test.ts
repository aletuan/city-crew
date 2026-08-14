// The two taxonomies: functional categories and soft vibes. Both are
// lookup tables with a fallback path, and the fallbacks are where the
// silent failures live — an unknown key that renders as nothing is a
// place quietly missing from a filter.

import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_ORDER, categoriesOf, categoryLabel } from './categories';
import { VIBE_FALLBACK_COLOR, VIBES, vibeColor, vibeLabel } from './vibes';

/** The app's `t`, in English. */
const t = (en: string) => en;

describe('categoriesOf', () => {
  it('uses the stored categories when there are any', () => {
    expect(categoriesOf({ categories: ['cafes', 'views'], vibe_tags: ['nightlife'] }))
      .toEqual(['cafes', 'views']);
  });

  // The middle rung: rows written before the categories column existed.
  it('derives from vibes when the column is empty', () => {
    expect(categoriesOf({ categories: [], vibe_tags: ['cafes'] })).toEqual(['cafes']);
  });

  it('does not repeat a category two vibes both map to', () => {
    const derived = categoriesOf({ vibe_tags: ['cafes', 'cafes'] });
    expect(derived).toEqual([...new Set(derived)]);
  });

  it('ignores vibes that map to nothing', () => {
    expect(categoriesOf({ vibe_tags: ['not_a_vibe'] })).toEqual([]);
  });

  // The bottom rung: the legacy two-value axis, and only when nothing
  // better was found.
  it('falls back to the legacy food flag last', () => {
    expect(categoriesOf({ category: 'food' })).toEqual(['eats']);
    expect(categoriesOf({ category: 'food', vibe_tags: ['views'] })).toEqual(['views']);
  });

  it('returns nothing rather than guessing for an uncategorised outdoor place', () => {
    expect(categoriesOf({ category: 'out' })).toEqual([]);
  });

  it('survives a row with no taxonomy at all', () => {
    expect(categoriesOf({})).toEqual([]);
  });
});

describe('the category table', () => {
  it('has an entry for every key in the display order', () => {
    for (const key of CATEGORY_ORDER) expect(CATEGORIES[key]).toBeDefined();
  });

  it('labels a known key from the table', () => {
    expect(categoryLabel('cafes', t)).toBe(CATEGORIES.cafes.en);
  });

  // Data can grow a key before this table knows about it. Showing it
  // beats dropping the place out of the filter row entirely.
  it('renders an unknown key readably instead of dropping it', () => {
    expect(categoryLabel('street_food', t)).toBe('Street food');
  });
});

describe('vibes', () => {
  it('labels a known vibe from the table', () => {
    expect(vibeLabel('cafes', t)).toBe(VIBES.cafes.en);
  });

  it('renders an unknown vibe readably', () => {
    expect(vibeLabel('food_tour', t)).toBe(VIBES.food_tour.en);
    expect(vibeLabel('rooftop_bars', t)).toBe('Rooftop bars');
  });

  it('gives an unknown vibe the neutral dot rather than no dot', () => {
    expect(vibeColor('nightlife')).toBe(VIBES.nightlife.color);
    expect(vibeColor('unknown')).toBe(VIBE_FALLBACK_COLOR);
  });

  // Two vibes sitting next to each other with the same 6pt dot say
  // nothing; the palette was chosen so that never happens.
  it('gives every vibe its own colour', () => {
    const colours = Object.values(VIBES).map((v) => v.color);
    expect(new Set(colours).size).toBe(colours.length);
  });
});
