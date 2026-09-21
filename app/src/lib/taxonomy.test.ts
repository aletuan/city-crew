// The two taxonomies: functional categories and soft vibes. Both are
// lookup tables with a fallback path, and the fallbacks are where the
// silent failures live — an unknown key that renders as nothing is a
// place quietly missing from a filter.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  CATEGORY_ORDER,
  MAP_PIN_CHOSEN_FILL,
  MAP_PIN_CHOSEN_INK,
  MAP_PIN_NEUTRAL_FILL,
  categoriesOf,
  categoryColor,
  categoryLabel,
  pinCategory,
  pinTint,
} from './categories';
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

describe('categoryColor', () => {
  it('is the colour of the place’s one category', () => {
    expect(categoryColor({ categories: ['views'] })).toBe(CATEGORIES.views.color);
  });

  it('picks the first category in the filter row’s order, not the stored order', () => {
    expect(categoryColor({ categories: ['views', 'cafes'] })).toBe(CATEGORIES.cafes.color);
  });

  it('reaches the legacy fallback the same way categoriesOf does', () => {
    expect(categoryColor({ vibe_tags: ['food_tour'] })).toBe(CATEGORIES.eats.color);
  });

  it('is null for a place nothing classifies, or one classified only by a key the row does not know', () => {
    expect(categoryColor({})).toBeNull();
    expect(categoryColor({ categories: ['street_food'] })).toBeNull();
  });
});

describe('pinTint', () => {
  // Inside a chip every place is that kind of place, so the chip's colour
  // is the only one that adds anything — the rule the map and the card
  // both draw with, in one place so they cannot drift apart.
  it('is the chip’s colour while a chip is asking', () => {
    expect(pinTint({ categories: ['cafes'] }, 'focus')).toBe(CATEGORIES.focus.color);
  });

  it('is the place’s own colour at All, or under a chip nobody knows', () => {
    expect(pinTint({ categories: ['cafes'] }, null)).toBe(CATEGORIES.cafes.color);
    expect(pinTint({ categories: ['cafes'] })).toBe(CATEGORIES.cafes.color);
    expect(pinTint({ categories: ['cafes'] }, 'street_food')).toBe(CATEGORIES.cafes.color);
  });

  it('is nothing at all for a place nothing classifies', () => {
    expect(pinTint({}, null)).toBeNull();
  });
});

describe('pinCategory', () => {
  // Under a chip every place *is* that kind of place already, so the chip
  // is the only answer that adds anything. The rule is defended in the
  // doc comment on `PlacesMap`'s `category` prop; it lives here so the pin
  // and the strip card's dot cannot come to answer it differently.
  it('is the chip while a chip is asking', () => {
    expect(pinCategory({ categories: ['cafes'] }, 'focus')).toBe('focus');
  });

  it('is the place’s own first category at All, or under a chip nobody knows', () => {
    expect(pinCategory({ categories: ['cafes'] }, null)).toBe('cafes');
    expect(pinCategory({ categories: ['cafes'] })).toBe('cafes');
    expect(pinCategory({ categories: ['cafes'] }, 'street_food')).toBe('cafes');
  });

  it('picks the filter row’s order, not the stored order', () => {
    expect(pinCategory({ categories: ['views', 'cafes'] }, null)).toBe('cafes');
  });

  it('reaches the legacy fallback the same way categoriesOf does', () => {
    expect(pinCategory({ vibe_tags: ['food_tour'] }, null)).toBe('eats');
  });

  it('is nothing at all for a place nothing classifies', () => {
    expect(pinCategory({}, null)).toBeNull();
    expect(pinCategory({ categories: ['street_food'] }, null)).toBeNull();
  });

  // `pinTint` is a reading of this rule now, rather than a second copy of it.
  it('is the rule pinTint reads', () => {
    for (const chip of [null, 'focus', 'street_food']) {
      const key = pinCategory({ categories: ['cafes'] }, chip);
      expect(pinTint({ categories: ['cafes'] }, chip)).toBe(key ? CATEGORIES[key].color : null);
    }
  });
});

// ── the fill behind a map pin's glyph ──
//
// A chip glyph is drawn on a surface this app chose with the category's
// name written beside it, so its colour is a third and redundant channel
// and is free to be quiet. A map pin carries a white glyph on a tile
// nobody here chose. Same hue — that is what makes it the same colour —
// at whatever weight the glyph needs.

/** sRGB relative luminance, per WCAG. */
function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}

const WHITE = '#FFFFFF';

describe('the map pin palette', () => {
  it('gives every category in the filter row a fill', () => {
    for (const key of CATEGORY_ORDER) {
      expect(CATEGORIES[key].pin).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  // What makes the pin and the chip one colour rather than two that were
  // once related.
  it('keeps each category’s hue exactly', () => {
    for (const key of CATEGORY_ORDER) {
      expect(Math.abs(hue(CATEGORIES[key].pin) - hue(CATEGORIES[key].color))).toBeLessThan(0.5);
    }
  });

  // The glyph is the whole point of the change; a glyph nobody can read is
  // a pin that says less than the colour it replaced.
  it('carries a white glyph at 4.5:1 or better', () => {
    for (const key of CATEGORY_ORDER) {
      expect(contrast(CATEGORIES[key].pin, WHITE)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(MAP_PIN_NEUTRAL_FILL, WHITE)).toBeGreaterThanOrEqual(4.5);
  });

  // The chosen pin keeps the brand coral, which a white glyph cannot sit
  // on — hence the inversion. Darkening the coral instead would have
  // walked it onto `heritage`, whose hue it already shares to within a
  // degree.
  it('inverts the chosen pin’s glyph rather than darkening its coral', () => {
    expect(MAP_PIN_CHOSEN_FILL).toBe('#FF6F5B');
    expect(contrast(MAP_PIN_CHOSEN_FILL, WHITE)).toBeLessThan(3);
    expect(contrast(MAP_PIN_CHOSEN_FILL, MAP_PIN_CHOSEN_INK)).toBeGreaterThanOrEqual(4.5);
  });
});

// The assets are generated by hand (`scripts/map-pins.py`) and CI has no
// Python to regenerate them, so this is what stands between the table and
// a category that silently has no pin.
describe('the pin assets', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../../assets/pins/pins.manifest.json', import.meta.url), 'utf8'),
  ) as Record<string, { file: string; icon: string; fill: string; ink: string }>;

  it('has a pin and a chosen pin for every category in the filter row', () => {
    for (const key of CATEGORY_ORDER) {
      expect(manifest[key], `no pin drawn for ${key} — run scripts/map-pins.py`).toBeDefined();
      expect(manifest[`${key}-chosen`]).toBeDefined();
    }
    expect(manifest.neutral).toBeDefined();
    expect(manifest['neutral-chosen']).toBeDefined();
  });

  it('drew each category in the colour and glyph the table declares', () => {
    for (const key of CATEGORY_ORDER) {
      expect(manifest[key].fill).toBe(CATEGORIES[key].pin);
      expect(manifest[key].icon).toBe(CATEGORIES[key].icon);
    }
    expect(manifest.neutral.fill).toBe(MAP_PIN_NEUTRAL_FILL);
  });

  it('drew the chosen pins in the accent, with the inverted glyph', () => {
    for (const key of [...CATEGORY_ORDER, 'neutral']) {
      expect(manifest[`${key}-chosen`].fill).toBe(MAP_PIN_CHOSEN_FILL);
      expect(manifest[`${key}-chosen`].ink).toBe(MAP_PIN_CHOSEN_INK);
      // The chosen pin keeps its category's glyph — the colour says "this
      // one", the glyph still says what kind of place it is.
      expect(manifest[`${key}-chosen`].icon).toBe(manifest[key].icon);
    }
  });

  it('drew nothing the table does not ask for', () => {
    const wanted = new Set([...CATEGORY_ORDER, 'neutral'].flatMap((k) => [k, `${k}-chosen`]));
    expect(Object.keys(manifest).sort()).toEqual([...wanted].sort());
  });
});
