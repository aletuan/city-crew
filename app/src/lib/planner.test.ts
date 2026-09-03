import { describe, expect, it } from 'vitest';
import { brandKey } from './brand';
import { partAt, partGone, planTrips, startMinFor, START_MIN } from './planner';
import type { TripDraft } from './trip';
import type { Place } from './types';

// A place with only the fields the planner reads. Everything else is
// filled so a `Place` type-checks; nothing below depends on it.
let n = 0;
const place = (p: Partial<Place> & { slug: string }): Place => ({
  name_en: p.slug, name_vi: p.slug, name_ja: null,
  city_id: 'hanoi', category: 'out', categories: ['cafes'],
  is_featured: false, is_published: true, review_status: 'approved',
  vibe_tags: [], neighborhood_en: 'Hoàn Kiếm', neighborhood_vi: null, neighborhood_ja: null,
  address: null, lat: 21.028 + (n += 1) / 1000, lng: 105.852, rating: 4.5, rating_count: 100,
  price_display: null, price_vnd: 100_000, duration_min: 60, duration_max: 90,
  desc_en: null, desc_vi: null, desc_ja: null, emoji: null,
  opening_hours: null, website: null, phone: null, place_photos: [],
  ...p,
} as Place);

/** Eight of a kind, so the draw has a band to sample from. */
const many = (cat: string, count = 8) =>
  Array.from({ length: count }, (_, i) =>
    place({ slug: `${cat}-${i}`, categories: [cat], rating: 4.6 - i * 0.05, rating_count: 1000 - i * 10 }));

const EVENING: TripDraft = {
  company: 'couple', categories: ['eats', 'nightlife', 'views'], district: null, at: null,
  date: '2026-08-16', when: 'evening', from: [],
};

const CATALOG = [...many('eats'), ...many('nightlife'), ...many('views'), ...many('cafes')];

// Google's weekday strings, the shape `opening_hours` actually holds.
const week = (hours: string) =>
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    .map((d) => `${d}: ${hours}`);

describe('planTrips', () => {
  it('builds three ways to spend an evening', () => {
    const plans = planTrips(EVENING, CATALOG, 'hanoi', { seed: 1 });
    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.lens)).toEqual(['match', 'iconic', 'lowkey']);
    for (const p of plans) expect(p.stops).toHaveLength(3);
  });

  it('starts a day in the morning and an evening in the evening', () => {
    const day = planTrips({ ...EVENING, when: 'day', categories: ['cafes', 'eats', 'views'] },
      CATALOG, 'hanoi', { seed: 1 });
    expect(day[0].stops[0].part).toBe('morning');
    expect(planTrips(EVENING, CATALOG, 'hanoi', { seed: 1 })[0].stops[0].part).toBe('evening');
  });

  // How long a plan is comes from what was asked for, not from the hour.
  // The rule this replaced took its length from `when` alone, so somebody
  // asking for cafés on their own got three cafés at seventy-five minutes
  // each — a contest rather than a plan.
  describe('length comes from the ask', () => {
    const ask = (categories: string[], when: 'day' | 'evening' = 'evening') =>
      planTrips({ ...EVENING, when, categories }, CATALOG, 'hanoi', { seed: 1 })[0].stops.length;

    it('answers one kind of place with one place', () => {
      expect(ask(['cafes'])).toBe(1);
    });

    it('gives a day one more, because a day has the room', () => {
      expect(ask(['cafes'], 'day')).toBe(2);
    });

    it('grows a stop per kind asked for', () => {
      expect(ask(['eats', 'nightlife'])).toBe(2);
      expect(ask(['eats', 'nightlife', 'views'])).toBe(3);
    });

    // The shapes are still a ceiling: an evening is three stops however
    // many kinds are named, because five in an evening is not an evening.
    it('never exceeds the shape it is filling', () => {
      expect(ask(['cafes', 'eats', 'nightlife', 'views'])).toBe(3);
      expect(ask(['cafes', 'eats', 'nightlife', 'views'], 'day')).toBe(5);
    });

    // Nothing was narrowed, so nothing should be. `canPlan` stops an empty
    // draft reaching the button, but the planner is called from tests and
    // from a parsed sentence, and must not read "no answer" as "one stop".
    it('keeps the whole shape when no kind was named', () => {
      expect(ask([])).toBe(3);
      expect(ask([], 'day')).toBe(5);
    });

    // The payoff, and the reason one stop is not a lesser answer: three
    // lenses over one slot is three different cafés to choose between.
    it('turns one stop into three different places to choose from', () => {
      const plans = planTrips({ ...EVENING, categories: ['cafes'] }, CATALOG, 'hanoi', { seed: 1 });
      const slugs = plans.map((pl) => pl.stops[0].place.slug);
      expect(plans.length).toBeGreaterThan(1);
      expect(new Set(slugs).size).toBe(slugs.length);
    });
  });

  it('replays exactly for the same seed, and moves for a different one', () => {
    const a = planTrips(EVENING, CATALOG, 'hanoi', { seed: 7 });
    const b = planTrips(EVENING, CATALOG, 'hanoi', { seed: 7 });
    const slugs = (ps: ReturnType<typeof planTrips>) => ps.map((p) => p.stops.map((s) => s.place.slug));
    expect(slugs(a)).toEqual(slugs(b));

    // Not an assertion that every seed differs — that is luck — but that
    // the seed reaches the draw at all. Twenty seeds producing one answer
    // would mean it does not.
    const seen = new Set(
      Array.from({ length: 20 }, (_, i) => JSON.stringify(slugs(planTrips(EVENING, CATALOG, 'hanoi', { seed: i })))),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it('never visits the same place twice in one plan', () => {
    for (const plan of planTrips(EVENING, CATALOG, 'hanoi', { seed: 3 })) {
      const slugs = plan.stops.map((s) => s.place.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  // The same-brand trap #188 measured: ~a fifth of the Hanoi catalog is
  // branch rows, and the distance penalty pulls branches of one chain
  // toward each other because they sit near each other on the map.
  describe('branches of one brand', () => {
    it('never puts two branches into one plan', () => {
      const catalog = [
        place({ slug: 'sushi-a', name_en: 'Sushi Chain - Old Quarter', categories: ['eats'], rating: 5, rating_count: 1000 }),
        place({ slug: 'sushi-b', name_en: 'Sushi Chain - Ba Đình', categories: ['eats'], rating: 4.95, rating_count: 1000 }),
        ...many('eats'),
      ];
      // A day asked for in one category gets two slots, both of that kind
      // — the exact shape where two branches used to slip in together.
      const day: TripDraft = { ...EVENING, when: 'day', categories: ['eats'] };
      for (let seed = 0; seed < 10; seed++) {
        for (const plan of planTrips(day, catalog, 'hanoi', { seed })) {
          const brands = plan.stops.map((s) => brandKey(s.place.name_en));
          expect(new Set(brands).size).toBe(brands.length);
        }
      }
    });

    it('spends the repeat penalty on a brand, not just a slug, across cards', () => {
      // Two branches so far ahead that the first card must take one; a
      // third café outside the draw band until the brand penalty moves
      // it in. Three cards each wearing a different branch of the same
      // roastery is one answer shown three times.
      const catalog = [
        place({ slug: 'roast-a', name_en: 'Roastery - One', categories: ['cafes'], rating: 5, rating_count: 0 }),
        place({ slug: 'roast-b', name_en: 'Roastery - Two', categories: ['cafes'], rating: 4.9, rating_count: 0 }),
        place({ slug: 'quiet-cafe', categories: ['cafes'], rating: 3.5, rating_count: 0 }),
      ];
      for (const seed of [1, 5, 9]) {
        const plans = planTrips({ ...EVENING, categories: ['cafes'] }, catalog, 'hanoi', { seed });
        expect(plans.length).toBeGreaterThanOrEqual(2);
        expect(brandKey(plans[0].stops[0].place.name_en)).toBe('roastery');
        expect(brandKey(plans[1].stops[0].place.name_en)).toBe('quiet-cafe');
      }
    });
  });

  it('leaves a closed place out', () => {
    // Everything shuts at six; the evening starts at six.
    const shut = many('eats').map((p) => ({ ...p, opening_hours: week('8:00 AM – 6:00 PM') }));
    const plans = planTrips({ ...EVENING, categories: ['eats'] }, shut, 'hanoi', { seed: 1 });
    expect(plans).toHaveLength(0);
  });

  it('keeps a place that stores no hours at all', () => {
    // APEC Park in Da Nang records none, because a public park posts
    // none. Reading null as closed would bar it from every plan forever.
    const parks = [place({ slug: 'apec-park', categories: ['nature'], opening_hours: null })];
    const plans = planTrips({ ...EVENING, categories: ['nature'] }, parks, 'hanoi', { seed: 1 });
    expect(plans).toHaveLength(1);
    expect(plans[0].stops[0].place.slug).toBe('apec-park');
  });

  it('returns one plan when the city holds one such place', () => {
    // Three near-identical cards claim a choice that is not there.
    const one = [place({ slug: 'only-market', categories: ['markets'] })];
    expect(planTrips({ ...EVENING, categories: ['markets'] }, one, 'hanoi', { seed: 1 })).toHaveLength(1);
  });

  it('returns nothing at all rather than an empty plan', () => {
    expect(planTrips(EVENING, [], 'hanoi', { seed: 1 })).toEqual([]);
    expect(planTrips({ ...EVENING, categories: ['nature'] }, CATALOG, 'hanoi', { seed: 1 })).toEqual([]);
  });

  it('only offers what the reader asked for', () => {
    const plans = planTrips({ ...EVENING, categories: ['cafes'] }, CATALOG, 'hanoi', { seed: 1 });
    for (const plan of plans) {
      for (const s of plan.stops) expect(s.place.categories).toContain('cafes');
    }
  });

  it('plans from the minimum the wizard allows — one category, no collection', () => {
    const bare: TripDraft = { ...EVENING, categories: ['eats'], from: [] };
    expect(planTrips(bare, CATALOG, 'hanoi', { seed: 1 }).length).toBeGreaterThan(0);
  });

  it('runs the clock forward across the evening', () => {
    const [plan] = planTrips(EVENING, CATALOG, 'hanoi', { seed: 1 });
    expect(plan.stops[0].arriveMin).toBe(18 * 60);
    for (let i = 1; i < plan.stops.length; i++) {
      expect(plan.stops[i].arriveMin).toBeGreaterThan(plan.stops[i - 1].arriveMin);
    }
    expect(plan.windowMin[1]).toBeGreaterThan(plan.windowMin[0]);
  });

  it('charges for rides and not for walks', () => {
    const [plan] = planTrips(EVENING, CATALOG, 'hanoi', { seed: 1 });
    const rides = plan.legs.filter((l) => l?.mode === 'ride').length;
    expect(plan.costVnd.transport).toBe(rides * 15000);
  });

  it('splits food from activities', () => {
    const [plan] = planTrips(EVENING, CATALOG, 'hanoi', { seed: 1 });
    const total = plan.stops.reduce((n2, s) => n2 + (s.place.price_vnd ?? 0), 0);
    expect(plan.costVnd.food + plan.costVnd.activity).toBe(total);
  });

  it('leans towards the district the reader chose', () => {
    const elsewhere = many('eats').map((p) => ({ ...p, neighborhood_en: 'Cầu Giấy' }));
    const chosen = [place({ slug: 'ba-dinh-eats', categories: ['eats'], neighborhood_en: 'Ba Đình', rating: 4.0, rating_count: 50 })];
    // Three kinds asked for, so three stops: the district is a nudge worth
    // 2.5 and this place is the lowest-rated in the pool, which is the
    // point — it should still make an evening it would not otherwise. A
    // one-stop draft would test whether the nudge can beat every rating at
    // once, which was never the claim.
    const [plan] = planTrips(
      { ...EVENING, district: 'Ba Đình' },
      [...elsewhere, ...chosen], 'hanoi', { seed: 1 },
    );
    expect(plan.stops.map((s) => s.place.slug)).toContain('ba-dinh-eats');
  });

  // ── where the day starts ──
  //
  // The bug these cover was found by using the app: a pin dropped on 29
  // Liễu Giai in Ba Đình came back with all three plans in Hoàn Kiếm,
  // about four kilometres away, while cafés a few hundred metres from the
  // pin went unused. Two things were wrong and both are here.
  //
  // `draft.at` never reached the planner at all — the only geographic term
  // was a district *name* matched against `neighborhood_en`, so dropping a
  // pin contributed nothing. And the distance penalty measured from the
  // previous stop, which does not exist on the first one, so the opening
  // stop was chosen by whatever scored highest anywhere in the city and
  // every later stop then clung to it through the very penalty that had
  // let it in.
  describe('from where the day starts', () => {
    // 29 Liễu Giai, and the tourist core about four kilometres east.
    const CAPITAL_PLACE = { lat: 21.0325, lng: 105.8135 };
    const OLD_QUARTER = { lat: 21.028, lng: 105.852 };

    // The asymmetry that made this bug reliable rather than occasional:
    // the central cafés are not better, they are *reviewed* more, and
    // `min(3, log10(1 + rating_count))` reads review volume as worth.
    const near = Array.from({ length: 3 }, (_, i) => place({
      slug: `near-${i}`, categories: ['cafes'], neighborhood_en: 'Ba Đình',
      lat: CAPITAL_PLACE.lat + i / 2000, lng: CAPITAL_PLACE.lng,
      rating: 4.4, rating_count: 40,
    }));
    const far = Array.from({ length: 8 }, (_, i) => place({
      slug: `far-${i}`, categories: ['cafes'], neighborhood_en: 'Hoàn Kiếm',
      lat: OLD_QUARTER.lat + i / 2000, lng: OLD_QUARTER.lng,
      rating: 4.6, rating_count: 1000,
    }));
    const BOTH = [...near, ...far];
    const CAFES: TripDraft = { ...EVENING, categories: ['cafes'], when: 'day' };
    const first = (d: TripDraft, places = BOTH) =>
      planTrips(d, places, 'hanoi', { seed: 1 })[0].stops[0].place.slug;

    // The regression, stated the way the reader would: two people standing
    // in different places, asking the same question, must not be told to
    // start in the same café. Before the fix this failed — both came back
    // `far-0`, because the pin was not read at all.
    it('starts somewhere else for a reader standing somewhere else', () => {
      expect(first({ ...CAFES, at: CAPITAL_PLACE }))
        .not.toBe(first({ ...CAFES, at: OLD_QUARTER }));
    });

    it('opens near the pin rather than across town', () => {
      expect(first({ ...CAFES, at: CAPITAL_PLACE })).toMatch(/^near-/);
      expect(first({ ...CAFES, at: OLD_QUARTER })).toMatch(/^far-/);
    });

    // A chosen area is the same answer in a different shape, so it has to
    // place the reader too. `areaCentre` has no boundaries to work from —
    // it takes the mean of the area's places — and that is enough to say
    // which way is out of the reader's way.
    it('places a reader who picked an area instead of dropping a pin', () => {
      expect(first({ ...CAFES, district: 'Ba Đình' })).toMatch(/^near-/);
    });

    // The pin is what places the reader, even with an area also set.
    //
    // Tested in the direction that actually discriminates: an area on one
    // side of town and a pin on the other, where the area's own +2.5 bonus
    // pulls the opposite way. The pin wins and it is not close.
    //
    // The other direction is deliberately not asserted, because the two
    // terms very nearly cancel there — an area bonus of 2.5 against four
    // kilometres of penalty comes out inside a tenth of a point, and
    // pinning a test to which side of that lands first would be pinning it
    // to arithmetic nobody chose. It is also close to unreachable: picking
    // an area drops a pin on it, so in the app the two agree.
    it('is placed by the pin even when an area pulls the other way', () => {
      expect(first({ ...CAFES, district: 'Ba Đình', at: OLD_QUARTER })).toMatch(/^far-/);
    });

    // Nobody who said nothing about where they are should have their plan
    // moved by this. With no pin and no area there is nothing to measure
    // from, and the first stop goes back to being chosen on merit — which
    // is exactly what it did before any of this existed.
    it('leaves the opening stop on merit when the reader is unplaced', () => {
      expect(first({ ...CAFES, at: null, district: null })).toMatch(/^far-/);
    });

    // A nudge, not a gate — the same rule `DISTRICT_BONUS` is written to.
    // The penalty caps at five kilometres precisely so a place that is
    // genuinely much better can still be worth the journey.
    it('still crosses town for somewhere genuinely better', () => {
      const dismal = near.map((p) => ({ ...p, rating: 2, rating_count: 5 }));
      const superb = far.map((p) => ({ ...p, rating: 4.9, rating_count: 5000 }));
      expect(first({ ...CAFES, at: CAPITAL_PLACE }, [...dismal, ...superb])).toMatch(/^far-/);
    });

    // A row with no coordinates is charged nothing, because there is
    // nothing to measure — and the consequence, which is worth stating out
    // loud rather than discovering later, is that it can outrank a place
    // that *is* locatable and far. That is the lesser of the two wrongs
    // available: the alternative is charging it the cap, which would bury
    // every row the import pipeline left without coordinates for a fault
    // that is the catalog's rather than the place's.
    it('charges nothing to a place the catalog cannot locate', () => {
      const nowhere = near.map((p) => ({ ...p, lat: null, lng: null }));
      expect(first({ ...CAFES, at: CAPITAL_PLACE }, [...nowhere, ...far])).toMatch(/^near-/);
    });

    // An area whose every place lacks a coordinate has a size but no
    // position, and `areaCentre` says so with null rather than (0, 0) —
    // which would put the reader in the Gulf of Guinea and charge the cap
    // against everything equally.
    it('does not invent a position for an area that has none', () => {
      const unplaceable = near.map((p) => ({ ...p, lat: null, lng: null }));
      expect(first({ ...CAFES, district: 'Ba Đình' }, [...unplaceable, ...far])).toMatch(/^far-/);
    });

    it('stays deterministic once the reader is placed', () => {
      const twice = () => planTrips({ ...CAFES, at: CAPITAL_PLACE }, BOTH, 'hanoi', { seed: 7 })
        .flatMap((p) => p.stops.map((s) => s.place.slug));
      expect(twice()).toEqual(twice());
    });
  });

  it('does not hand back an empty screen for a quiet district', () => {
    // A hard filter would: Hanoi's quietest district holds two places.
    // The area shapes the plan, it does not gate it.
    const plans = planTrips({ ...EVENING, district: 'Nowhere At All' }, CATALOG, 'hanoi', { seed: 1 });
    expect(plans.length).toBeGreaterThan(0);
  });

  it('leaves `why` empty for a model to fill, or not', () => {
    for (const plan of planTrips(EVENING, CATALOG, 'hanoi', { seed: 1 })) {
      expect(plan.title).toBeNull();
      for (const s of plan.stops) expect(s.why).toBeNull();
    }
  });
});

describe('planTrips with a collection to build from', () => {
  const pinned = [place({ slug: 'my-bar', categories: ['nightlife'], rating: 3.0, rating_count: 5 })];

  it('finds room for a saved place a score alone would never pick', () => {
    const plans = planTrips(EVENING, CATALOG, 'hanoi', { seed: 1, pinned });
    expect(plans[0].stops.map((s) => s.place.slug)).toContain('my-bar');
  });

  it('leaves at least one stop for the lenses to differ over', () => {
    // A collection big enough to fill every slot would make three plans
    // one plan in three orders.
    const big = many('eats', 6).map((p) => ({ ...p, slug: `mine-${p.slug}` }));
    const plans = planTrips({ ...EVENING, categories: ['eats'] }, CATALOG, 'hanoi', { seed: 1, pinned: big });
    for (const plan of plans) {
      const mine = plan.stops.filter((s) => s.place.slug.startsWith('mine-')).length;
      expect(mine).toBeLessThanOrEqual(plan.stops.length - 1);
    }
  });

  it('says why a saved place could not be used', () => {
    const shut = place({ slug: 'day-cafe', categories: ['cafes'], opening_hours: week('7:00 AM – 5:00 PM') });
    const gone = place({ slug: 'pending-bar', categories: ['nightlife'], is_published: false });
    const away = place({ slug: 'saigon-bar', categories: ['nightlife'], city_id: 'hcmc' });
    const [plan] = planTrips(EVENING, CATALOG, 'hanoi', { seed: 1, pinned: [shut, gone, away] });

    expect(plan.pinnedDropped).toEqual(expect.arrayContaining([
      { slug: 'day-cafe', reason: 'closed' },
      { slug: 'pending-bar', reason: 'unlive' },
      { slug: 'saigon-bar', reason: 'city' },
    ]));
  });

  it('still plans when every saved place was dropped', () => {
    const shut = place({ slug: 'day-cafe', categories: ['cafes'], opening_hours: week('7:00 AM – 5:00 PM') });
    const plans = planTrips(EVENING, CATALOG, 'hanoi', { seed: 1, pinned: [shut] });
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0].pinnedDropped).toHaveLength(1);
  });
});

describe('planTrips avoiding what was already shown', () => {
  it('moves away from slugs the screen has already offered', () => {
    const first = planTrips(EVENING, CATALOG, 'hanoi', { seed: 1 });
    const shown = first.flatMap((p) => p.stops.map((s) => s.place.slug));
    const again = planTrips(EVENING, CATALOG, 'hanoi', { seed: 2, avoid: shown });
    const repeated = again.flatMap((p) => p.stops.map((s) => s.place.slug)).filter((s) => shown.includes(s));
    expect(repeated.length).toBeLessThan(shown.length);
  });

  it('still returns the only place there is, however avoided', () => {
    // A penalty and not an exclusion: Regenerate on a one-place category
    // must not come back empty.
    const one = [place({ slug: 'only-market', categories: ['markets'] })];
    const plans = planTrips({ ...EVENING, categories: ['markets'] }, one, 'hanoi',
      { seed: 5, avoid: ['only-market'] });
    expect(plans).toHaveLength(1);
  });
});

// ── the row the desk has not finished ────────────────────────────────
//
// Every column the score reads is nullable, and a place suggested by a
// reader arrives with almost all of them empty: no rating, no price, no
// duration, no coordinates. That is not an edge case, it is what
// `AddPlaceScreen` produces. A planner that throws — or worse, quietly
// scores `NaN` and puts the sparsest row first every time — would meet
// those on the day someone's suggestion is approved.
describe('planTrips on a catalog with holes in it', () => {
  const bare = (slug: string, cat: string) => place({
    slug, categories: [cat],
    rating: null, rating_count: null, price_vnd: null,
    duration_min: null, duration_max: null,
  });

  const THIN = [
    bare('eats-bare', 'eats'), bare('night-bare', 'nightlife'), bare('views-bare', 'views'),
  ];

  it('plans an evening out of rows with nothing filled in', () => {
    const plans = planTrips(EVENING, THIN, 'hanoi', { seed: 1 });
    expect(plans.length).toBeGreaterThan(0);
    const stops = plans[0].stops;
    expect(stops.length).toBeGreaterThan(0);
    for (const s of stops) expect(Number.isFinite(s.arriveMin)).toBe(true);
  });

  it('costs an unpriced evening at nothing rather than at NaN', () => {
    const { food, activity } = planTrips(EVENING, THIN, 'hanoi', { seed: 1 })[0].costVnd;
    expect(food).toBe(0);
    expect(activity).toBe(0);
  });

  // 75 minutes, from `DWELL_DEFAULT`. Guessing is the only option, and
  // guessing the same for everything keeps the times honest about being
  // guesses.
  it('gives a place with no stated duration the default', () => {
    expect(planTrips(EVENING, THIN, 'hanoi', { seed: 1 })[0].stops[0].dwellMin).toBe(75);
  });

  it('takes one end of a duration range when only one is stated', () => {
    const lo = [place({ slug: 'lo', categories: ['eats'], duration_min: 120, duration_max: null })];
    const hi = [place({ slug: 'hi', categories: ['eats'], duration_min: null, duration_max: 120 })];
    const dwell = (ps: Place[]) =>
      planTrips({ ...EVENING, categories: ['eats'] }, ps, 'hanoi', { seed: 1 })[0].stops[0].dwellMin;
    expect(dwell(lo)).toBe(120);
    expect(dwell(hi)).toBe(120);
  });

  // The catalog holds places with a district and nothing more precise, and
  // a plan through one still has to put the next stop somewhere.
  it('assumes a hop when a stop has no coordinates', () => {
    const nowhere = [
      place({ slug: 'a-eats', categories: ['eats'], lat: null, lng: null }),
      place({ slug: 'b-night', categories: ['nightlife'], lat: null, lng: null }),
    ];
    const plan = planTrips({ ...EVENING, categories: ['eats', 'nightlife'] }, nowhere, 'hanoi', { seed: 1 })[0];
    expect(plan.legs[0]).toBeNull();
    expect(plan.stops[1].arriveMin).toBe(plan.stops[0].arriveMin + plan.stops[0].dwellMin + 20);
    expect(plan.costVnd.transport).toBe(0);
  });

  // Identical rows in every column the score reads. Without a total
  // tie-break the sort is at the mercy of the engine's, and the same seed
  // would stop replaying.
  it('breaks a dead heat on slug, in both directions', () => {
    const twins = ['c', 'a', 'b', 'd'].map((s) => place({ slug: `${s}-eats`, categories: ['eats'] }));
    const run = () => planTrips({ ...EVENING, categories: ['eats'] }, twins, 'hanoi', { seed: 4 })[0]
      .stops.map((s) => s.place.slug);
    expect(run()).toEqual(run());
  });
});

describe('planTrips with no seed and no date', () => {
  // The screens always pass a seed; a caller in a test or a script may not,
  // and a planner that returned nothing without one would be a trap.
  it('draws from a fixed seed when none is given', () => {
    const a = planTrips(EVENING, CATALOG, 'hanoi');
    const b = planTrips(EVENING, CATALOG, 'hanoi');
    expect(a.map((p) => p.stops.map((s) => s.place.slug)))
      .toEqual(b.map((p) => p.stops.map((s) => s.place.slug)));
    expect(a.length).toBeGreaterThan(0);
  });

  // A day that is not a day means the hour cannot be placed on a calendar,
  // and an unplaceable hour is unknown rather than closed — the same rule
  // `openState` already applies to a place that posts no hours at all.
  it('keeps a place with hours when the date cannot be read', () => {
    const shop = [place({ slug: 'shop', categories: ['eats'], opening_hours: week('9:00 AM – 5:00 PM') })];
    const plans = planTrips({ ...EVENING, categories: ['eats'], date: 'not-a-day' }, shop, 'hanoi', { seed: 1 });
    expect(plans[0].stops.map((s) => s.place.slug)).toContain('shop');
  });
});

describe('planTrips with a taste profile', () => {
  // Phase 4 wires this to `profiles.pref_*`; the seam is here now because
  // the weight it carries is the argument, and an unexercised seam is a
  // seam that will not fit when the time comes.
  it('lets affinity move the order without overruling the answers', () => {
    const loved = 'eats-7'; // the lowest-rated of the eight, so only taste can lift it
    const taste = { affinity: (p: Place) => (p.slug === loved ? 3 : 0) };
    const with_ = planTrips(EVENING, CATALOG, 'hanoi', { seed: 1, taste });
    const without = planTrips(EVENING, CATALOG, 'hanoi', { seed: 1 });
    const slugs = (ps: ReturnType<typeof planTrips>) => ps.flatMap((p) => p.stops.map((s) => s.place.slug));
    expect(slugs(with_).filter((s) => s === loved).length)
      .toBeGreaterThanOrEqual(slugs(without).filter((s) => s === loved).length);
    // Still an evening of what was asked for, whatever the profile says.
    for (const p of with_) {
      for (const s of p.stops) {
        expect(['eats', 'nightlife', 'views'].some((c) => s.place.categories?.includes(c))).toBe(true);
      }
    }
  });
});

describe('planTrips with a stated budget', () => {
  // Same category, same rating, same everything but the bill. Without a
  // budget the draw is free to take either; with one it should lean.
  const cheap = Array.from({ length: 6 }, (_, i) =>
    place({ slug: `cheap-${i}`, categories: ['eats'], price_vnd: 40_000, rating: 4.5, rating_count: 500 }));
  const dear = Array.from({ length: 6 }, (_, i) =>
    place({ slug: `dear-${i}`, categories: ['eats'], price_vnd: 900_000, rating: 4.5, rating_count: 500 }));
  const MIXED = [...cheap, ...dear];
  const FOOD: TripDraft = { ...EVENING, categories: ['eats'] };

  const spend = (ps: ReturnType<typeof planTrips>) =>
    ps.flatMap((p) => p.stops).reduce((sum, s) => sum + (s.place.price_vnd ?? 0), 0);

  it('spends less when a budget was stated than when none was', () => {
    const tight = planTrips(FOOD, MIXED, 'hanoi', { seed: 1, budgetVnd: 150_000 });
    const open = planTrips(FOOD, MIXED, 'hanoi', { seed: 1 });
    expect(spend(tight)).toBeLessThan(spend(open));
  });

  // The same promise taste makes: a budget reorders what was asked for, it
  // does not answer a different question. Asked for food with a low budget
  // and only expensive food in the catalog, the answer is expensive food.
  it('never turns a stated budget into a different day out', () => {
    const plans = planTrips(FOOD, dear, 'hanoi', { seed: 2, budgetVnd: 100_000 });
    expect(plans.length).toBeGreaterThan(0);
    for (const p of plans) {
      for (const s of p.stops) expect(s.place.categories ?? []).toContain('eats');
    }
  });

  // Not said, and no budget at all, must be the same call — not merely the
  // same numbers. Zero would divide into shares of nothing and put every
  // priced place infinitely over.
  it('treats an unstated budget and a zero one as no budget', () => {
    const slugs = (ps: ReturnType<typeof planTrips>) => ps.flatMap((p) => p.stops.map((s) => s.place.slug));
    const bare = planTrips(FOOD, MIXED, 'hanoi', { seed: 3 });
    for (const budgetVnd of [null, undefined, 0]) {
      expect(slugs(planTrips(FOOD, MIXED, 'hanoi', { seed: 3, budgetVnd }))).toEqual(slugs(bare));
    }
  });

  // A price the desk has not filled in is not a price of zero anywhere else
  // in this file, but against a budget it has to behave like one: the
  // alternative is charging a place for a number nobody wrote down.
  it('does not charge a place whose price the catalog does not know', () => {
    const unpriced = Array.from({ length: 6 }, (_, i) =>
      place({ slug: `unknown-${i}`, categories: ['eats'], price_vnd: null, rating: 4.5, rating_count: 500 }));
    const plans = planTrips(FOOD, [...unpriced, ...dear], 'hanoi', { seed: 5, budgetVnd: 150_000 });
    const slugs = plans.flatMap((pl) => pl.stops.map((st) => st.place.slug));
    expect(slugs.some((slug) => slug.startsWith('unknown-'))).toBe(true);
  });

  it('stays deterministic with a budget in play', () => {
    const once = planTrips(FOOD, MIXED, 'hanoi', { seed: 4, budgetVnd: 200_000 });
    const twice = planTrips(FOOD, MIXED, 'hanoi', { seed: 4, budgetVnd: 200_000 });
    expect(once.flatMap((p) => p.stops.map((s) => s.place.slug)))
      .toEqual(twice.flatMap((p) => p.stops.map((s) => s.place.slug)));
  });
});

// The clock, which the shapes above deliberately do not read.
//
// The bug: `START_MIN` is fixed, so at 17:08 on a Monday "a day out today"
// was planned from 09:00 — eight hours gone — and every place in it was
// checked against its 09:00 opening hours rather than against any hour the
// reader could still turn up in.
describe('startMinFor', () => {
  const now = (h: number, m = 0) => new Date(2026, 7, 17, h, m);

  it('gives a future day the hour its shape starts at', () => {
    expect(startMinFor('day', '2026-08-18', now(17, 8))).toBe(START_MIN.day);
    expect(startMinFor('evening', '2026-08-20', now(23, 30))).toBe(START_MIN.evening);
  });

  it('gives today the same hour while that hour is still ahead', () => {
    expect(startMinFor('day', '2026-08-17', now(7))).toBe(START_MIN.day);
    expect(startMinFor('evening', '2026-08-17', now(9))).toBe(START_MIN.evening);
  });

  it('starts from now once the shape’s hour has gone', () => {
    expect(startMinFor('day', '2026-08-17', now(17, 8))).toBe(17 * 60 + 15);
    expect(startMinFor('evening', '2026-08-17', now(20, 1))).toBe(20 * 60 + 15);
  });

  // Rounded up, never down: a start at the minute the reader is still
  // reading the screen is a start they have already missed.
  it('rounds the start up to the quarter hour', () => {
    expect(startMinFor('evening', '2026-08-17', now(19, 14))).toBe(19 * 60 + 15);
    expect(startMinFor('evening', '2026-08-17', now(19, 15))).toBe(19 * 60 + 15);
    expect(startMinFor('evening', '2026-08-17', now(19, 16))).toBe(19 * 60 + 30);
  });

  // Deliberately not clamped to `LAST_START`. Clamping would put the start
  // back in the past, which is the whole thing being fixed; the wizard's
  // job is to make a late tonight a choice, and `partGone` is how it knows.
  it('honours a very late tonight rather than winding it back', () => {
    expect(startMinFor('evening', '2026-08-17', now(23, 0))).toBe(23 * 60);
  });
});

describe('partGone', () => {
  const now = (h: number, m = 0) => new Date(2026, 7, 17, h, m);

  it('is false for any day that is not today', () => {
    expect(partGone('day', '2026-08-18', now(23, 59))).toBe(false);
    expect(partGone('evening', '2026-08-18', now(23, 59))).toBe(false);
  });

  it('says a day out is gone in the late afternoon but an evening is not', () => {
    expect(partGone('day', '2026-08-17', now(17, 8))).toBe(true);
    expect(partGone('evening', '2026-08-17', now(17, 8))).toBe(false);
  });

  it('says an evening is gone once it is nearly over', () => {
    expect(partGone('evening', '2026-08-17', now(20, 59))).toBe(false);
    expect(partGone('evening', '2026-08-17', now(21, 1))).toBe(true);
  });
});

describe('planTrips with a start pushed later', () => {
  const late = 20 * 60 + 15;

  it('puts the first stop at the hour it was given', () => {
    const plans = planTrips(EVENING, CATALOG, 'hanoi', { seed: 1, startMin: late });
    expect(plans[0].stops[0].arriveMin).toBe(late);
    expect(plans[0].windowMin[0]).toBe(late);
  });

  it('leaves the shape’s own hour alone when nothing was given', () => {
    const plans = planTrips(EVENING, CATALOG, 'hanoi', { seed: 1 });
    expect(plans[0].stops[0].arriveMin).toBe(START_MIN.evening);
  });

  // The half of this that matters most: the gate moves with the start, so
  // a plan built at eight in the evening cannot offer somewhere that shut
  // at seven. Under the old fixed start it could, and did.
  it('checks opening hours against the later hour, not the shape’s', () => {
    const early = many('eats').map((p) => ({ ...p, opening_hours: week('7:00 AM – 7:00 PM') }));
    const catalog = [...early, ...many('nightlife'), ...many('views')];
    expect(planTrips({ ...EVENING, categories: ['eats'] }, catalog, 'hanoi',
      { seed: 1, startMin: 18 * 60 })).not.toHaveLength(0);
    expect(planTrips({ ...EVENING, categories: ['eats'] }, catalog, 'hanoi',
      { seed: 1, startMin: late })).toHaveLength(0);
  });

  // Zero is a real hour, and `||` would quietly make it nine in the
  // morning. Nobody plans a trip at midnight; the arithmetic still has to
  // mean what it says.
  it('takes midnight literally rather than as no answer', () => {
    const open = many('eats').map((p) => ({ ...p, opening_hours: week('Open 24 hours') }));
    const plans = planTrips({ ...EVENING, categories: ['eats'] }, open, 'hanoi',
      { seed: 1, startMin: 0 });
    expect(plans[0].stops[0].arriveMin).toBe(0);
  });
});

// A stop is called what the clock says, not what the slot it came out of
// used to claim. The slot labels agreed with the clock at the shapes' own
// hours and lied everywhere else — an evening's worth of stops in a day
// shape came back headed "morning".
describe('partAt', () => {
  it('divides the day at noon and at five', () => {
    expect(partAt(9 * 60)).toBe('morning');
    expect(partAt(11 * 60 + 59)).toBe('morning');
    expect(partAt(12 * 60)).toBe('afternoon');
    expect(partAt(16 * 60 + 59)).toBe('afternoon');
    expect(partAt(17 * 60)).toBe('evening');
    expect(partAt(23 * 60)).toBe('evening');
  });

  it('agrees with the shapes at the hours they were written for', () => {
    // A day out, packed back to back from 09:00 at the nominal step.
    expect([0, 1, 2, 3, 4].map((i) => partAt(9 * 60 + i * 95)))
      .toEqual(['morning', 'morning', 'afternoon', 'afternoon', 'afternoon']);
    expect([0, 1, 2].map((i) => partAt(18 * 60 + i * 95)))
      .toEqual(['evening', 'evening', 'evening']);
  });

  it('reads an hour past midnight as the small hours of a day, not as nothing', () => {
    expect(partAt(25 * 60)).toBe('morning');
  });
});

describe('a day shape asked for late in the day', () => {
  const DAY: TripDraft = { ...EVENING, when: 'day', categories: ['cafes', 'eats', 'views'] };

  it('calls its stops what the clock calls them', () => {
    const plans = planTrips(DAY, CATALOG, 'hanoi', { seed: 1, startMin: 20 * 60 + 15 });
    for (const stop of plans[0].stops) expect(stop.part).toBe('evening');
  });

  // Four stops from 20:15 finish at about 03:00, and the screens print an
  // hour past midnight modulo a day — 01:35, on a card headed with today's
  // date. Two stops and an honest finish is the better answer.
  it('is trimmed so it cannot run onto the next day', () => {
    const plans = planTrips(DAY, CATALOG, 'hanoi', { seed: 1, startMin: 20 * 60 + 15 });
    expect(plans[0].stops.length).toBe(2);
    expect(plans[0].windowMin[1]).toBeLessThanOrEqual(24 * 60);
  });

  it('keeps at least one stop however late it is asked', () => {
    const plans = planTrips(DAY, CATALOG, 'hanoi', { seed: 1, startMin: 23 * 60 + 45 });
    expect(plans[0].stops).toHaveLength(1);
  });

  it('leaves a shape asked for at its own hour alone', () => {
    expect(planTrips(DAY, CATALOG, 'hanoi', { seed: 1 })[0].stops).toHaveLength(4);
  });

  // A draft naming no category keeps the whole shape, and that ceiling is
  // the one the day's end has to bite on too.
  it('trims a shape nobody narrowed', () => {
    const open = { ...DAY, categories: [] };
    expect(planTrips(open, CATALOG, 'hanoi', { seed: 1 })[0].stops).toHaveLength(5);
    expect(planTrips(open, CATALOG, 'hanoi', { seed: 1, startMin: 20 * 60 })[0].stops)
      .toHaveLength(2);
  });
});

describe('who is coming', () => {
  // Two shelves, deliberately equal in every scored respect, so the only
  // thing separating them is who is along. `at` pins the reader so the
  // distance term cannot tip the draw either way by accident.
  const bars = many('nightlife');
  const parks = many('nature');
  const HERE = { lat: 21.028, lng: 105.852 };
  const openAsk: TripDraft = {
    company: 'family', categories: [], district: null, at: HERE,
    date: '2026-08-16', when: 'evening', from: [],
  };
  const first = (company: TripDraft['company']) =>
    planTrips({ ...openAsk, company }, [...bars, ...parks], 'hanoi', { seed: 1 })[0]
      .stops.map((s) => (s.place.categories ?? [])[0]);

  // The question this whole table exists to answer: the wizard's first
  // question used to change nothing but the prose. A family and a group
  // of friends with the same open ask now get different evenings.
  it('keeps a family out of the bars it never asked for', () => {
    expect(first('family')).not.toContain('nightlife');
  });

  it('leans a group of friends the other way', () => {
    expect(first('friends')).toContain('nightlife');
  });

  // A lean, never a gate. The reader's own categories carry weight 3
  // against the avoid's 2 — and more structurally, chosen categories are
  // the *filter*: a family that says nightlife gets nightlife, because
  // what they said is more specific than what this table knows.
  it('never overrules what a family explicitly asked for', () => {
    const plans = planTrips(
      { ...openAsk, company: 'family', categories: ['nightlife'] },
      [...bars, ...parks], 'hanoi', { seed: 1 },
    );
    for (const p of plans) {
      for (const s of p.stops) expect(s.place.categories ?? []).toContain('nightlife');
    }
  });

  // "No answer" is an answer a reader gives on purpose — every chip
  // untapped — and a draft built outside the wizard carries null. The
  // table must stay silent then, and the plan must still come, exactly
  // as every draft planned before the table existed. (The "Other" chip
  // used to be the visible way to decline this question; declining is
  // now simply not tapping.)
  it('still plans, and deterministically, when nobody is named', () => {
    const bare = first(null);
    expect(bare.length).toBeGreaterThan(0);
    expect(bare).toEqual(first(null));
  });

  it('stays deterministic with a company set', () => {
    expect(first('family')).toEqual(first('family'));
  });

  // ── suitability vibes, the desk's half of this table ──
  //
  // Category leans are this table guessing from what a place is; a
  // suitability vibe is a person having judged the room. Same category on
  // both shelves here, so nothing separates them but the tag — which is
  // exactly the situation the desk creates by assigning one.
  describe('reads the room when the desk has judged it', () => {
    const tagged = (cat: string, vibe: string) =>
      many(cat).map((p, i) => (i % 2 === 0 ? { ...p, vibe_tags: [vibe] } : p));

    const opening = (company: TripDraft['company'], places: Place[]) =>
      planTrips({ ...openAsk, company, categories: [] }, places, 'hanoi', { seed: 2 })[0]
        .stops.map((s) => s.place.vibe_tags);

    it('seats a family at the kid-friendly half of the shelf', () => {
      for (const v of opening('family', tagged('nature', 'kid_friendly'))) {
        expect(v).toContain('kid_friendly');
      }
    });

    it('books a couple into the romantic rooms', () => {
      for (const v of opening('couple', tagged('views', 'romantic'))) {
        expect(v).toContain('romantic');
      }
    });

    it('finds somebody on their own a quiet seat', () => {
      for (const v of opening('solo', tagged('cafes', 'quiet'))) {
        expect(v).toContain('quiet');
      }
    });

    // The tag moves nothing for the answers that carry no vibe lean — a
    // catalog the desk has started tagging must not change plans for
    // readers the tags say nothing about.
    it('means nothing to friends, and to no answer at all', () => {
      const shelf = tagged('eats', 'kid_friendly');
      const bare = shelf.map((p) => ({ ...p, vibe_tags: [] }));
      const stops = (places: Place[]) =>
        planTrips({ ...openAsk, company: 'friends', categories: [] }, places, 'hanoi', { seed: 3 })[0]
          .stops.map((s) => s.place.slug);
      expect(stops(shelf)).toEqual(stops(bare));
    });
  });
});
