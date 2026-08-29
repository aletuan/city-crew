import { describe, expect, it } from 'vitest';
import { planTrips } from './planner';
import { tasteFrom } from './taste';
import type { TripDraft } from './trip';
import type { Place } from './types';

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

const cafe = place({ slug: 'a-cafe', categories: ['cafes'] });
const bar = place({ slug: 'b-bar', categories: ['nightlife'] });
const park = place({ slug: 'c-park', categories: ['nature'] });

describe('tasteFrom', () => {
  // The difference between "no opinion" and "an opinion of zero". The
  // planner skips the term entirely on null, so a reader with no history
  // gets exactly the plans they got before this file existed.
  it('is null when there is nothing to go on', () => {
    expect(tasteFrom({})).toBeNull();
    expect(tasteFrom({ preferred: [], saved: [], suggested: [], passedOver: [] })).toBeNull();
  });

  it('is not null as soon as one signal exists', () => {
    expect(tasteFrom({ preferred: ['cafes'] })).not.toBeNull();
    expect(tasteFrom({ saved: [cafe] })).not.toBeNull();
    expect(tasteFrom({ suggested: [cafe] })).not.toBeNull();
  });

  // ── the silence, and who is allowed to be read by it ────────────────
  //
  // Every other signal is something the reader did on purpose. This one is
  // built from what they did *not* do, and that only means "no" from
  // somebody who has been heard saying "yes": a person with thirty saves
  // who did not save this place has chosen, and a person with none has not
  // refused two hundred places, they have not found the button.
  //
  // The data cannot tell those two apart — both are an `open` with nothing
  // after it — so the tests are where the difference is held.
  it('reads no refusal from somebody who has never saved anything', () => {
    expect(tasteFrom({ passedOver: ['a-cafe'] })).toBeNull();
  });

  it('leaves a stated taste untouched when the reader has never saved', () => {
    const stated = tasteFrom({ preferred: ['cafes'] })!;
    const alsoOpened = tasteFrom({ preferred: ['cafes'], passedOver: ['a-cafe'] })!;
    expect(alsoOpened.affinity(cafe)).toBe(stated.affinity(cafe));
  });

  it('starts reading it the moment there is one save to go on', () => {
    const gated = tasteFrom({ saved: [cafe], passedOver: ['b-bar'] })!;
    const ungated = tasteFrom({ saved: [cafe] })!;
    expect(gated.affinity(bar)).toBeCloseTo(ungated.affinity(bar) - 1, 10);
  });

  // The proof is the gesture, not the tagging. `tally` counts the
  // categories a save carried, so a reader who saved one place the desk
  // has not tagged yet has an empty tally — and has still used the button,
  // which is the whole of what this asks.
  it('counts a save the desk has not tagged as proof of the gesture', () => {
    const untagged = place({ slug: 'untagged', categories: [], vibe_tags: [] });
    const taste = tasteFrom({ preferred: ['cafes'], saved: [untagged], passedOver: ['a-cafe'] })!;
    expect(taste.affinity(cafe)).toBeLessThan(0);
  });

  // The bound the planner's weight depends on. Without it, `TASTE_WEIGHT`
  // is a decoration and the promise that taste cannot overrule the wizard
  // is not true of anything.
  it('never leaves [-1, 1], whatever it is told', () => {
    const loud = tasteFrom({
      preferred: ['cafes', 'nightlife', 'nature'],
      saved: Array.from({ length: 50 }, (_, i) => place({ slug: `s-${i}`, categories: ['cafes'] })),
      suggested: Array.from({ length: 50 }, (_, i) => place({ slug: `g-${i}`, categories: ['cafes'] })),
      liked: Array.from({ length: 50 }, (_, i) => place({ slug: `l-${i}`, categories: ['cafes'] })),
      passedOver: ['b-bar'],
    })!;
    for (const p of [cafe, bar, park]) {
      expect(loud.affinity(p)).toBeGreaterThanOrEqual(-1);
      expect(loud.affinity(p)).toBeLessThanOrEqual(1);
    }
  });

  it('lifts a stated preference above an unmentioned kind', () => {
    const taste = tasteFrom({ preferred: ['cafes'] })!;
    expect(taste.affinity(cafe)).toBeGreaterThan(taste.affinity(bar));
  });

  // Stated beats inferred: somebody who says "cafés" has told us more than
  // somebody whose collections happen to hold some.
  it('weighs a stated preference above a saved one', () => {
    const stated = tasteFrom({ preferred: ['cafes'] })!;
    const inferred = tasteFrom({ saved: [cafe, cafe, cafe] })!;
    expect(stated.affinity(cafe)).toBeGreaterThan(inferred.affinity(cafe));
  });

  it('weighs a saved place above a suggested one', () => {
    const saved = tasteFrom({ saved: [cafe] })!;
    const suggested = tasteFrom({ suggested: [cafe] })!;
    expect(saved.affinity(cafe)).toBeGreaterThan(suggested.affinity(cafe));
  });

  // Normalised against the commonest category rather than the total, so a
  // profile does not flatten as it learns more.
  it('does not dilute a favourite as the collection grows', () => {
    const narrow = tasteFrom({ saved: [cafe, cafe] })!;
    const broad = tasteFrom({ saved: [cafe, cafe, bar, park] })!;
    expect(broad.affinity(cafe)).toBe(narrow.affinity(cafe));
  });

  // A café that is also a viewpoint is a café to somebody who likes cafés.
  it('takes a place at its best category, not its average', () => {
    const both = place({ slug: 'roof-cafe', categories: ['cafes', 'views'] });
    const taste = tasteFrom({ preferred: ['cafes'] })!;
    expect(taste.affinity(both)).toBe(taste.affinity(cafe));
  });

  // ── the fourth signal ─────────────────────────────────────────────
  //
  // A like is one tap on somebody else's list. It is real evidence, and
  // it is the weakest of the four: indirect, because the categories come
  // through another person's judgement about what belongs together, and
  // cheap, because it costs one tap where saving costs a decision about
  // where to file something.
  //
  // The ladder is what these pin, not the numbers. Change 3 and 1 to 30
  // and 10 and every test here still passes; swap them and this fails,
  // which is the whole point.
  it('hears a liked list, and hears it under a saved place', () => {
    const likedOnly = tasteFrom({ liked: [cafe] })!;
    const savedOnly = tasteFrom({ saved: [cafe] })!;
    expect(likedOnly.affinity(cafe)).toBeGreaterThan(0);
    expect(likedOnly.affinity(cafe)).toBeLessThan(savedOnly.affinity(cafe));
  });

  it('keeps liking at the bottom of the ladder', () => {
    const at = (signals: Parameters<typeof tasteFrom>[0]) => tasteFrom(signals)!.affinity(cafe);
    expect(at({ preferred: ['cafes'] })).toBeGreaterThan(at({ saved: [cafe] }));
    expect(at({ saved: [cafe] })).toBeGreaterThan(at({ suggested: [cafe] }));
    expect(at({ suggested: [cafe] })).toBeGreaterThan(at({ liked: [cafe] }));
  });

  // Liking a list you also saved from is two different things happening,
  // not one thing counted twice: you chose to keep the place, and you
  // approved of somebody's collection of it.
  it('adds a like to a save rather than absorbing it', () => {
    const both = tasteFrom({ saved: [cafe], liked: [cafe] })!;
    const saveOnly = tasteFrom({ saved: [cafe] })!;
    expect(both.affinity(cafe)).toBeGreaterThan(saveOnly.affinity(cafe));
  });

  it('is a signal on its own, with nothing else to go on', () => {
    expect(tasteFrom({ liked: [cafe] })).not.toBeNull();
  });

  // ── counting a place once ─────────────────────────────────────────
  //
  // Saved places arrive as the flattened membership of the reader's
  // collections, so one café filed under both "Weekend" and "Near work"
  // arrived twice. Counting it twice gave the readers who organise most
  // the loudest taste, which nobody chose and nothing recorded.
  it('counts a place once however many lists it came in', () => {
    const twice = tasteFrom({ saved: [cafe, cafe, cafe], suggested: [bar] })!;
    const once = tasteFrom({ saved: [cafe], suggested: [bar] })!;
    expect(twice.affinity(cafe)).toBe(once.affinity(cafe));
  });

  it('still weighs two different cafés as two', () => {
    const other = place({ slug: 'd-cafe', categories: ['cafes'] });
    const two = tasteFrom({ saved: [cafe, other], suggested: [bar] })!;
    const one = tasteFrom({ saved: [cafe], suggested: [bar] })!;
    // `lean` normalises against the reader's own commonest category, so
    // two cafés and one café both max that term out — what this holds is
    // that the second café is not silently discarded on its way in, and
    // that the bar's own share is unchanged by it.
    expect(two.affinity(cafe)).toBe(one.affinity(cafe));
    expect(two.affinity(bar)).toBe(one.affinity(bar));
  });

  // The shapes a test hands over have no identity, and the design that
  // made `Categorised` structural is the reason. A caller that has not
  // said which places these are gets every arrival counted, which is the
  // honest reading of "I do not know".
  it('counts every arrival when nothing identifies the places', () => {
    const anon = { categories: ['cafes'] };
    const other = { categories: ['nightlife'] };
    const lopsided = tasteFrom({ saved: [anon, anon, anon, other] })!;
    expect(lopsided.affinity(cafe)).toBeGreaterThan(lopsided.affinity(bar));
  });

  // The one per-place signal, and the strongest single fact here. The
  // `saved` is not decoration: without it the signal is not read at all —
  // see the gate above.
  it('takes a whole point off a place they opened and walked away from', () => {
    const taste = tasteFrom({ preferred: ['cafes'], saved: [bar], passedOver: ['a-cafe'] })!;
    const kept = tasteFrom({ preferred: ['cafes'], saved: [bar] })!;
    expect(taste.affinity(cafe)).toBeCloseTo(kept.affinity(cafe) - 1, 10);
    expect(taste.affinity(cafe)).toBeLessThan(0);
  });

  it('says nothing either way about a place the desk has not tagged', () => {
    const untagged = place({ slug: 'untagged', categories: [], vibe_tags: [] });
    expect(tasteFrom({ preferred: ['cafes'], saved: [cafe] })!.affinity(untagged)).toBe(0);
  });

  it('is unmoved by signals about categories it has never seen', () => {
    const taste = tasteFrom({ saved: [park] })!;
    expect(taste.affinity(cafe)).toBe(0);
  });
});

// ── the claim the whole design rests on ──────────────────────────────

const CATALOG = [
  ...Array.from({ length: 6 }, (_, i) => place({ slug: `eat-${i}`, categories: ['eats'], rating: 4.6 - i * 0.05 })),
  ...Array.from({ length: 6 }, (_, i) => place({ slug: `cafe-${i}`, categories: ['cafes'], rating: 4.6 - i * 0.05 })),
  ...Array.from({ length: 6 }, (_, i) => place({ slug: `night-${i}`, categories: ['nightlife'], rating: 4.6 - i * 0.05 })),
];

const EVENING: TripDraft = {
  company: 'couple', categories: ['eats'], district: null, at: null,
  date: '2026-08-22', when: 'evening', from: [],
};

const slugs = (ps: ReturnType<typeof planTrips>) => ps.flatMap((p) => p.stops.map((s) => s.place.slug));

describe('taste inside the planner', () => {
  // The promise in `docs/ai-agent-planner.md`, made testable: two readers,
  // one draft, two plans.
  //
  // The draft has to ask for more than one kind for this to mean anything,
  // and that is not the test being generous — it is where taste is *for*.
  // A reader who asks only for food gets food whoever they are; the profile
  // chooses among the things they asked for, and a draft with one category
  // has nothing to choose among. The first version of this test asked for
  // `eats` alone and passed identical plans, which was the planner being
  // right and the test being wrong.
  const OPEN: TripDraft = { ...EVENING, categories: ['eats', 'cafes', 'nightlife'] };

  it('gives two different readers two different plans', () => {
    const nightOwl = tasteFrom({ preferred: ['nightlife'], saved: [bar, bar, bar] })!;
    const coffee = tasteFrom({ preferred: ['cafes'], saved: [cafe, cafe, cafe] })!;
    const a = slugs(planTrips(OPEN, CATALOG, 'hanoi', { seed: 1, taste: nightOwl }));
    const b = slugs(planTrips(OPEN, CATALOG, 'hanoi', { seed: 1, taste: coffee }));
    expect(a).not.toEqual(b);
  });

  // And the shape of that difference: each reader's plans lean the way they
  // do, rather than merely differing.
  it('leans each plan the way its reader does', () => {
    const kinds = (taste: ReturnType<typeof tasteFrom>) =>
      planTrips(OPEN, CATALOG, 'hanoi', { seed: 1, taste: taste ?? undefined })
        .flatMap((p) => p.stops.flatMap((s) => s.place.categories ?? []));
    // Three of the four signals each, which is what describing a reader
    // takes now that there are four. Two of three was the same fraction
    // before `liked` arrived, and dropping to two of four made these two
    // readers tie — correctly: the total the sum normalises by grew, so
    // every signal says slightly less than it used to.
    const owl = kinds(tasteFrom({ preferred: ['nightlife'], saved: [bar], liked: [bar] }));
    const brew = kinds(tasteFrom({ preferred: ['cafes'], saved: [cafe], liked: [cafe] }));
    expect(owl.filter((c) => c === 'nightlife').length)
      .toBeGreaterThan(brew.filter((c) => c === 'nightlife').length);
    expect(brew.filter((c) => c === 'cafes').length)
      .toBeGreaterThan(owl.filter((c) => c === 'cafes').length);
  });

  // And the other half of that promise, which matters more: a plan that
  // ignored the question the reader just answered would be a wrong plan,
  // however well it knew them.
  it('never lets a profile overrule the answers just given', () => {
    // Asked for food, profile screams nightlife, every bar rated higher
    // than every restaurant. The answer is still food.
    const loud = tasteFrom({
      preferred: ['nightlife'],
      saved: Array.from({ length: 30 }, () => bar),
      suggested: Array.from({ length: 30 }, () => bar),
    })!;
    const rich = [
      ...Array.from({ length: 6 }, (_, i) => place({ slug: `n-${i}`, categories: ['nightlife'], rating: 5 })),
      ...Array.from({ length: 6 }, (_, i) => place({ slug: `e-${i}`, categories: ['eats'], rating: 3.5 })),
    ];
    const plans = planTrips(
      { ...EVENING, categories: ['eats'] }, rich, 'hanoi', { seed: 3, taste: loud },
    );
    for (const plan of plans) {
      for (const stop of plan.stops) {
        expect(stop.place.categories).toContain('eats');
      }
    }
  });

  // A reader with no signals must get the plans the app made before any of
  // this existed — not "the same numbers", the same call.
  it('changes nothing at all for a reader with no history', () => {
    const bare = planTrips(EVENING, CATALOG, 'hanoi', { seed: 7 });
    const nulled = planTrips(EVENING, CATALOG, 'hanoi', { seed: 7, taste: tasteFrom({}) ?? undefined });
    expect(slugs(nulled)).toEqual(slugs(bare));
  });

  // Determinism survives it: the same reader and the same seed replay.
  it('stays deterministic with a profile in play', () => {
    const taste = tasteFrom({ preferred: ['cafes'], saved: [cafe, cafe] })!;
    const once = slugs(planTrips(EVENING, CATALOG, 'hanoi', { seed: 5, taste }));
    const twice = slugs(planTrips(EVENING, CATALOG, 'hanoi', { seed: 5, taste }));
    expect(once).toEqual(twice);
  });
});
