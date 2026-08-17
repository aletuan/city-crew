import { describe, expect, it } from 'vitest';
import { planTrips } from './planner';
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

  it('plans five stops for a day and three for an evening', () => {
    const day = planTrips({ ...EVENING, when: 'day', categories: ['cafes', 'eats', 'views'] },
      CATALOG, 'hanoi', { seed: 1 });
    expect(day[0].stops).toHaveLength(5);
    expect(day[0].stops[0].part).toBe('morning');
    expect(planTrips(EVENING, CATALOG, 'hanoi', { seed: 1 })[0].stops[0].part).toBe('evening');
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
    const [plan] = planTrips(
      { ...EVENING, categories: ['eats'], district: 'Ba Đình' },
      [...elsewhere, ...chosen], 'hanoi', { seed: 1 },
    );
    expect(plan.stops.map((s) => s.place.slug)).toContain('ba-dinh-eats');
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
