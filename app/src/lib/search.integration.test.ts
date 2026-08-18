// Search, end to end — the pipeline as the app actually wires it.
//
// `search.test.ts` proves each function on its own. This file proves they
// compose, on a catalog shaped like the real one, in the exact order two
// files put them together:
//
//   catalog.tsx : mergeTerms(BUILT_IN, rows from `category_terms`)
//   SearchScreen: findPlaces(places, queryTerms(box), thatMap)
//
// Anything that would only break *between* those calls — a default that
// never survives the merge, a term the desk adds that the folding then
// misses, a category whose synonyms swamp its own places — shows up here
// and nowhere else.
//
// The honest boundary: this stops at the screen. `SearchScreen` imports
// React Native and a Node process has no renderer, so what is exercised is
// the call sequence the screen makes, not the screen. What it cannot see
// is the rendering — that the second tier gets its "no exact match"
// heading, that rows key without collision. Those are still eyes-only, and
// the repo says so at the top of `vitest.config.ts`.

import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './categories';
import { findPlaces, mergeTerms, type Searchable, type TermMap } from './search';

/** Exactly what `CatalogProvider` builds from the category table. */
const BUILT_IN: TermMap = Object.fromEntries(
  Object.entries(CATEGORIES).map(([key, c]) => [key, c.terms ?? []]),
);

/** The two calls the app makes, in the order it makes them. */
const search = (catalog: readonly Searchable[], box: string, desk: TermMap | null = null) =>
  findPlaces(catalog, box, mergeTerms(BUILT_IN, desk));

const named = (rows: readonly Searchable[]) => rows.map((p) => p.name_en);

// A slice of the live catalog, kept faithful where faithfulness is the
// point: two thirds of these have no description, because two thirds of
// the real one does not — and that emptiness is the whole reason synonyms
// exist. Names, areas and categories are as the database holds them.
const BRIQUES: Searchable = {
  name_en: 'Briques', neighborhood_en: 'Hoàn Kiếm', categories: ['cafes'], vibe_tags: ['chill'],
};
const RUNNING_BEAN: Searchable = {
  name_en: 'The Running Bean Nhà Thờ - Coffee', neighborhood_en: 'Hoàn Kiếm',
  categories: ['cafes'],
};
const MONO: Searchable = {
  name_en: 'MONO Coffee Lab - Vân Hồ', neighborhood_en: 'Hai Bà Trưng', categories: ['cafes'],
};
const BUN_CHA: Searchable = {
  name_en: 'Bún chả Hàng Quạt', name_vi: 'Bún chả Hàng Quạt',
  neighborhood_en: 'Hoàn Kiếm', categories: ['eats'],
};
const SUSHI: Searchable = {
  name_en: 'Sushi Hokkaido Sachi', neighborhood_en: 'Tây Hồ', categories: ['eats'],
};
const VAN_MIEU: Searchable = {
  name_en: 'Temple of Literature', name_vi: 'Văn Miếu', name_ja: '文廟',
  neighborhood_en: 'Đống Đa', categories: ['heritage', 'nature'],
};
const FINE_ARTS: Searchable = {
  name_en: 'Vietnam Fine Arts Museum', neighborhood_en: 'Ba Đình', categories: ['heritage'],
};
const OPERA: Searchable = {
  name_en: 'Saigon Opera House', neighborhood_en: 'District 1', categories: ['heritage'],
};
const LAKE: Searchable = {
  name_en: 'Hoan Kiem Lake', neighborhood_en: 'Hoàn Kiếm', categories: ['nature'],
  desc_en: 'The lake the old quarter is built around.',
};
const CGV_BA_TRIEU: Searchable = {
  name_en: 'CGV Ba Trieu', neighborhood_en: 'Hai Bà Trưng', categories: ['fun'],
  vibe_tags: ['nightlife', 'chill'],
};
const CGV_METROPOLIS: Searchable = {
  name_en: 'CGV Metropolis', neighborhood_en: 'Ba Đình', categories: ['fun'],
  vibe_tags: ['chill'],
};

const CATALOG = [
  BRIQUES, RUNNING_BEAN, MONO, BUN_CHA, SUSHI,
  VAN_MIEU, FINE_ARTS, OPERA, LAKE, CGV_BA_TRIEU, CGV_METROPOLIS,
];

// ── the bug that started this ────────────────────────────────────────

describe('a word no record in the catalog contains', () => {
  // Nothing about either cinema says "cinema": no description, and the
  // label of the category they are filed under reads "Fun".
  it('reaches the cinemas, in English', () => {
    const { hits, related } = search(CATALOG, 'cinema');
    expect(hits).toEqual([]);
    expect(named(related)).toEqual(['CGV Ba Trieu', 'CGV Metropolis']);
  });

  it('reaches them in Vietnamese, with diacritics or without', () => {
    expect(named(search(CATALOG, 'rạp phim').related)).toHaveLength(2);
    expect(named(search(CATALOG, 'rap phim').related)).toHaveLength(2);
  });

  it('reaches them in Japanese', () => {
    expect(named(search(CATALOG, '映画館').related)).toHaveLength(2);
    // The shorter word too: the stored term contains it.
    expect(named(search(CATALOG, '映画').related)).toHaveLength(2);
  });

  // Search never reads the reader's UI language, which is the point: all
  // three of these work for all three readers.
  it('does not care which language the reader has the app in', () => {
    for (const q of ['cinema', 'rạp phim', '映画館']) {
      expect(named(search(CATALOG, q).related), q).toEqual(['CGV Ba Trieu', 'CGV Metropolis']);
    }
  });
});

// ── the regression that made it two tiers ────────────────────────────

describe('a word that is both a synonym and a real name', () => {
  // `heritage` carries "museum" as a synonym and holds three places. The
  // first cut of this feature returned all three.
  it('returns the museum, not everything filed beside it', () => {
    const { hits, related } = search(CATALOG, 'museum');
    expect(named(hits)).toEqual(['Vietnam Fine Arts Museum']);
    expect(related).toEqual([]);
  });

  it('returns the temple, not the museum and the opera house', () => {
    const { hits, related } = search(CATALOG, 'temple');
    expect(named(hits)).toEqual(['Temple of Literature']);
    expect(related).toEqual([]);
  });

  // `nature` carries "lake"; one place is called one.
  it('returns the lake, not the whole of nature', () => {
    expect(named(search(CATALOG, 'lake').hits)).toEqual(['Hoan Kiem Lake']);
  });

  // `cafes` carries "coffee"; three places have it in their names. The
  // synonym must not add Briques, which is a café that does not say so.
  it('returns the places that say the word, not their whole category', () => {
    const { hits, related } = search(CATALOG, 'coffee');
    expect(named(hits)).toEqual(['The Running Bean Nhà Thờ - Coffee', 'MONO Coffee Lab - Vân Hồ']);
    expect(related).toEqual([]);
  });
});

// ── the guess, when there is nothing to protect ───────────────────────

describe('a kind of place the catalog does not hold', () => {
  // There is no bowling alley, so "bowling" reaching the cinemas is the
  // app offering the nearest kind it has — honest only because the screen
  // heads this tier "no exact match".
  it('offers the nearest kind rather than an empty screen', () => {
    const { hits, related } = search(CATALOG, 'bowling');
    expect(hits).toEqual([]);
    expect(named(related)).toEqual(['CGV Ba Trieu', 'CGV Metropolis']);
  });

  // `focus` ships with synonyms and no places tagged yet. Both tiers empty
  // is the correct answer, and it must not be a crash or a wrong guess.
  it('says nothing at all when a category has no places yet', () => {
    for (const q of ['laptop', 'làm việc', 'coworking']) {
      expect(search(CATALOG, q), q).toEqual({ hits: [], related: [] });
    }
  });

  // Both were found by the invariant below, not by imagination. A search
  // for somewhere to eat came back with cafés, because "quán ăn" split
  // into "quan" and "an" and both hid inside "quán cà phê"; a search for a
  // temple came back with a lake, because "đền" folds to "den" and sits
  // inside "garden".
  it('does not let one category\'s words answer for another', () => {
    expect(named(search(CATALOG, 'quán ăn').related))
      .toEqual(['Bún chả Hàng Quạt', 'Sushi Hokkaido Sachi']);
    for (const p of search(CATALOG, 'đền').related) {
      expect(p.categories, p.name_en ?? '').toContain('heritage');
    }
  });

  it('says nothing for a word nobody in this catalog uses', () => {
    expect(search(CATALOG, 'helicopter')).toEqual({ hits: [], related: [] });
    expect(search(CATALOG, 'zzzz')).toEqual({ hits: [], related: [] });
  });
});

// ── the ordinary searches, which must not have moved ─────────────────

describe('the searches that already worked', () => {
  it('still finds a Vietnamese name typed on a plain keyboard', () => {
    expect(named(search(CATALOG, 'bun cha').hits)).toEqual(['Bún chả Hàng Quạt']);
    expect(named(search(CATALOG, 'van mieu').hits)).toEqual(['Temple of Literature']);
    expect(named(search(CATALOG, 'dong da').hits)).toEqual(['Temple of Literature']);
  });

  it('still finds a place by its area', () => {
    expect(named(search(CATALOG, 'hoan kiem').hits))
      .toEqual(['Briques', 'The Running Bean Nhà Thờ - Coffee', 'Bún chả Hàng Quạt', 'Hoan Kiem Lake']);
  });

  it('still narrows when a second word is added', () => {
    expect(named(search(CATALOG, 'coffee hoan kiem').hits))
      .toEqual(['The Running Bean Nhà Thờ - Coffee']);
  });

  it('still finds a place by its category label in any language', () => {
    expect(named(search(CATALOG, 'cà phê').hits)).toHaveLength(3);
    expect(named(search(CATALOG, 'ca phe').hits)).toHaveLength(3);
    expect(named(search(CATALOG, 'カフェ').hits)).toHaveLength(3);
  });

  it('still finds a place by a vibe or a description', () => {
    expect(named(search(CATALOG, 'chill').hits))
      .toEqual(['Briques', 'CGV Ba Trieu', 'CGV Metropolis']);
    expect(named(search(CATALOG, 'old quarter').hits)).toEqual(['Hoan Kiem Lake']);
  });

  it('still finds a place by its brand, which is what people did before', () => {
    expect(named(search(CATALOG, 'CGV').hits)).toEqual(['CGV Ba Trieu', 'CGV Metropolis']);
  });

  it('has nothing to say about an empty box', () => {
    expect(search(CATALOG, '')).toEqual({ hits: [], related: [] });
    expect(search(CATALOG, '   ')).toEqual({ hits: [], related: [] });
  });
});

// ── the desk's half ──────────────────────────────────────────────────

describe('words the desk adds from the dashboard', () => {
  it('reach the catalog without a release', () => {
    expect(search(CATALOG, 'phở')).toEqual({ hits: [], related: [] });
    const { related } = search(CATALOG, 'phở', { eats: ['phở', 'bún', 'noodles'] });
    expect(named(related)).toEqual(['Bún chả Hàng Quạt', 'Sushi Hokkaido Sachi']);
  });

  it('work typed with diacritics against a query typed without', () => {
    expect(named(search(CATALOG, 'pho', { eats: ['Phở'] }).related)).toHaveLength(2);
  });

  // The safety story, end to end: nothing an editor types — or clears —
  // can take a shipped word away.
  it('cannot take away what the app already knew', () => {
    for (const desk of [{ fun: [] }, {}, null] as (TermMap | null)[]) {
      expect(named(search(CATALOG, 'cinema', desk).related), JSON.stringify(desk))
        .toEqual(['CGV Ba Trieu', 'CGV Metropolis']);
    }
  });

  it('cannot crowd out a real result either', () => {
    // Even told that "museum" means all of heritage, the exact answer wins.
    const { hits, related } = search(CATALOG, 'museum', { heritage: ['museum', 'bao tang'] });
    expect(named(hits)).toEqual(['Vietnam Fine Arts Museum']);
    expect(related).toEqual([]);
  });

  it('are ignored when too short to mean anything', () => {
    expect(search(CATALOG, 'xy', { fun: ['xy'] })).toEqual({ hits: [], related: [] });
  });

  it('survive a category key the app has never heard of', () => {
    expect(() => search(CATALOG, 'cinema', { notacategory: ['whatever'] })).not.toThrow();
  });
});

// ── invariants, over every word the app ships ────────────────────────

describe('every shipped synonym, run against the whole catalog', () => {
  const ALL_TERMS = Object.entries(BUILT_IN).flatMap(([cat, ts]) => ts.map((t) => [cat, t] as const));

  it('is a real list — this test would pass vacuously on an empty one', () => {
    expect(ALL_TERMS.length).toBeGreaterThan(60);
  });

  it('never returns both tiers at once', () => {
    for (const [, term] of ALL_TERMS) {
      const { hits, related } = search(CATALOG, term);
      expect(hits.length && related.length, term).toBeFalsy();
    }
  });

  // A synonym is a claim about one category. When it falls through to the
  // second tier it must bring back that category's places and no others.
  it('only ever brings back places of the category that claims it', () => {
    for (const [cat, term] of ALL_TERMS) {
      const { related } = search(CATALOG, term);
      for (const p of related) {
        expect(p.categories, `"${term}" (${cat}) reached ${p.name_en}`).toContain(cat);
      }
    }
  });

  it('never crashes, whatever the word', () => {
    for (const [, term] of ALL_TERMS) {
      expect(() => search(CATALOG, term), term).not.toThrow();
    }
  });
});

describe('the catalog fixture itself', () => {
  // Guards the tests above: if this slice drifts away from the shape of
  // the real catalog, the assertions stop meaning what they claim to.
  it('is mostly undescribed, like the catalog it stands in for', () => {
    const described = CATALOG.filter((p) => (p.desc_en ?? '').length > 40);
    expect(described.length / CATALOG.length).toBeLessThan(0.4);
  });

  it('holds a place in two categories, which is the ordinary case', () => {
    expect(CATALOG.some((p) => (p.categories ?? []).length > 1)).toBe(true);
  });
});
