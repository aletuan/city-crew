// The classifier lives in `supabase/functions/_shared/`, because that is
// where it runs: it is part of the import, and the import is an Edge
// Function. It is tested from here because this is where the test runner
// is, and the module is plain TypeScript with no imports and no Deno APIs —
// nothing about it needs Deno to execute.
//
// The alternative was a second test toolchain for one file. This is the
// cheaper honest arrangement, and the reach across the boundary is the
// price of it.

import { describe, expect, it } from 'vitest';
import {
  BY_TYPE, CATEGORY_KEYS, classify, MAX_CATEGORIES, VIBE_KEYS,
} from '../../../supabase/functions/_shared/classify';
import { CATEGORIES } from './categories';
import { VIBES } from './vibes';

describe('the mirrored taxonomies', () => {
  // The classifier cannot import the app's taxonomy — different runtime,
  // different module graph — so it restates it. A restated list drifts, and
  // the drift is silent: a category added here and not there simply never
  // gets assigned, which looks like the classifier being cautious rather
  // than the classifier being out of date.
  it('lists exactly the categories the app knows', () => {
    expect([...CATEGORY_KEYS].sort()).toEqual(Object.keys(CATEGORIES).sort());
  });

  it('lists exactly the vibes the app knows', () => {
    expect([...VIBE_KEYS].sort()).toEqual(Object.keys(VIBES).sort());
  });

  // A typo here writes a category nothing in the app can render, on
  // whichever kind of place happens to hit that row, with no error
  // anywhere.
  it('maps every type to a category that exists', () => {
    const unknown = Object.entries(BY_TYPE)
      .filter(([, category]) => !(CATEGORY_KEYS as readonly string[]).includes(category))
      .map(([type, category]) => `${type} → ${category}`);
    expect(unknown).toEqual([]);
  });
});

describe('classify', () => {
  // The three shapes from the screenshots that prompted this: a Japanese
  // restaurant, a brunch place that is also a café, and a rooftop.
  it('reads a restaurant off its cuisine type', () => {
    expect(classify('japanese_restaurant', ['japanese_restaurant', 'restaurant', 'food']))
      .toEqual({ categories: ['eats'], vibes: ['food_tour'] });
  });

  it('gives a place both of the things it honestly is', () => {
    expect(classify('cafe', ['cafe', 'restaurant', 'point_of_interest']))
      .toEqual({ categories: ['cafes', 'eats'], vibes: ['cafes', 'food_tour'] });
  });

  it('reads a bar that also serves food', () => {
    const { categories } = classify('bar', ['bar', 'restaurant']);
    expect(categories).toEqual(['nightlife', 'eats']);
  });

  it('reads a museum, a park and a market', () => {
    expect(classify('museum', ['museum']).categories).toEqual(['heritage']);
    expect(classify('park', ['park']).categories).toEqual(['nature']);
    expect(classify('market', ['market']).categories).toEqual(['markets']);
  });

  it('reads a cinema as somewhere to go rather than somewhere to eat', () => {
    expect(classify('movie_theater', ['movie_theater'])).toEqual({
      categories: ['fun'],
      // `fun` has no vibe that follows from it, so none is invented.
      vibes: [],
    });
  });

  // Silence is the answer, and the point of it: `needs_classification`
  // stays true and the desk still sees the row.
  it('says nothing about a type it does not know', () => {
    expect(classify('hair_salon', ['hair_salon', 'point_of_interest']))
      .toEqual({ categories: [], vibes: [] });
  });

  it('says nothing when Google says nothing', () => {
    expect(classify(null, null)).toEqual({ categories: [], vibes: [] });
    expect(classify()).toEqual({ categories: [], vibes: [] });
    expect(classify(undefined, [])).toEqual({ categories: [], vibes: [] });
  });

  // The generic types are on almost every row Google returns. If any of
  // them mapped, every place would wear that category.
  it('ignores the types that are on everything', () => {
    expect(classify('point_of_interest', ['point_of_interest', 'establishment', 'food']))
      .toEqual({ categories: [], vibes: [] });
  });

  it('holds the categories to a readable number', () => {
    const many = ['bar', 'restaurant', 'cafe', 'museum', 'park', 'market'];
    expect(classify('bar', many).categories).toHaveLength(MAX_CATEGORIES);
  });

  // Google's own answer to "what is this, mainly" must survive the cap.
  // Ordered by the taxonomy alone, `market` would sort after `cafes` and
  // `eats` and be the one dropped.
  it('never lets the cap remove what Google called it primarily', () => {
    const { categories } = classify('market', ['cafe', 'restaurant', 'museum', 'market']);
    expect(categories[0]).toBe('markets');
    expect(categories).toContain('markets');
  });

  // Same place, same answer — twice, and whatever order Google lists them
  // in. A category set that shuffles would make the desk re-read a row it
  // had already agreed with.
  it('does not depend on the order Google returns types in', () => {
    const a = classify('cafe', ['cafe', 'restaurant', 'bakery']);
    const b = classify('cafe', ['bakery', 'restaurant', 'cafe']);
    expect(a).toEqual(b);
  });

  it('counts a type once however many times it appears', () => {
    expect(classify('cafe', ['cafe', 'coffee_shop', 'bakery', 'tea_house']).categories)
      .toEqual(['cafes']);
  });

  // Both of these are judgements about a room rather than facts about a
  // business, and the module says so at length. This is the assertion that
  // keeps a later edit from quietly deciding otherwise.
  it('never claims a place is focus, which Google cannot know', () => {
    for (const type of Object.keys(BY_TYPE)) {
      expect(classify(type, [type]).categories, type).not.toContain('focus');
    }
  });

  it('never claims a place is chill', () => {
    for (const type of Object.keys(BY_TYPE)) {
      expect(classify(type, [type]).vibes, type).not.toContain('chill');
    }
  });

  // Whatever comes out has to be renderable by the app.
  it('only ever returns keys the app can draw', () => {
    for (const type of Object.keys(BY_TYPE)) {
      const { categories, vibes } = classify(type, [type]);
      for (const c of categories) expect(Object.keys(CATEGORIES), type).toContain(c);
      for (const v of vibes) expect(Object.keys(VIBES), type).toContain(v);
    }
  });
});
