// The wizard's arithmetic. No React here, and none in what it imports.

import { describe, expect, it } from 'vitest';
import { areaAround, areaCentre, areasNear, canPlan, COMPANY, draftFrom, districtsOf, EMPTY_DRAFT, nearestAreaKm, seedMembers, sourceIdsOf, startPoint, toggle } from './trip';
import type { Collection, Place } from './types';

const at = (neighborhood_en: string | null): Place => ({
  slug: `p${Math.random()}`, name_en: 'P', name_vi: 'P', name_ja: null, category: 'food',
  is_featured: false, vibe_tags: [], neighborhood_en, neighborhood_vi: null,
  neighborhood_ja: null, address: null, lat: null, lng: null, rating: null,
  rating_count: null, price_display: null, price_vnd: null, duration_min: null,
  duration_max: null, desc_en: null, desc_vi: null, desc_ja: null, emoji: null,
  opening_hours: null, website: null, phone: null, place_photos: [],
});

const many = (name: string | null, n: number) => Array.from({ length: n }, () => at(name));

describe('districtsOf', () => {
  // The order is a recommendation. Alphabetical would put a district with
  // one café above the one with eleven, and nothing on the chip tells the
  // reader which is which before they tap it.
  it('puts the busiest district first', () => {
    const places = [...many('Thanh Xuân', 2), ...many('Hoàn Kiếm', 5), ...many('Ba Đình', 3)];
    expect(districtsOf(places)).toEqual(['Hoàn Kiếm', 'Ba Đình', 'Thanh Xuân']);
  });

  // Two districts with four places each must not swap when the catalog
  // reloads, so the tie-break is the name rather than whatever order the
  // rows arrived in.
  it('breaks ties on name so the list does not shuffle', () => {
    const a = [...many('Ba Đình', 4), ...many('Hoàn Kiếm', 4)];
    const b = [...many('Hoàn Kiếm', 4), ...many('Ba Đình', 4)];
    expect(districtsOf(a)).toEqual(districtsOf(b));
    expect(districtsOf(a)).toEqual(['Ba Đình', 'Hoàn Kiếm']);
  });

  // A chip promises places behind it. Counting off the places themselves
  // is the only list that cannot make a promise the catalog will not keep.
  it('never offers a district with nothing in it', () => {
    expect(districtsOf([at(null), at('  '), at('Hoàn Kiếm')])).toEqual(['Hoàn Kiếm']);
  });

  it('offers nothing at all from an empty catalog', () => {
    expect(districtsOf([])).toEqual([]);
  });

  it('caps the row rather than running off the screen', () => {
    const places = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].flatMap((n, i) => many(n, 8 - i));
    expect(districtsOf(places)).toHaveLength(6);
    expect(districtsOf(places, 3)).toEqual(['a', 'b', 'c']);
  });
});

describe('toggle', () => {
  it('adds what is missing and removes what is there', () => {
    expect(toggle(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('keeps the order the reader built', () => {
    expect(toggle(toggle(toggle([], 'c'), 'a'), 'b')).toEqual(['c', 'a', 'b']);
  });

  it('leaves the original alone', () => {
    const before = ['a'];
    toggle(before, 'b');
    expect(before).toEqual(['a']);
  });
});

describe('canPlan', () => {
  it('wants somebody to plan for and something to do', () => {
    expect(canPlan(EMPTY_DRAFT)).toBe(false);
    expect(canPlan({ ...EMPTY_DRAFT, company: 'couple' })).toBe(false);
    expect(canPlan({ ...EMPTY_DRAFT, categories: ['cafes'] })).toBe(false);
    expect(canPlan({ ...EMPTY_DRAFT, company: 'couple', categories: ['cafes'] })).toBe(true);
  });

  // "Near me" is a legitimate answer and the default one, and starting
  // from a collection is a way to begin rather than a requirement to.
  it('does not hold out for a district or a collection', () => {
    const ready = { ...EMPTY_DRAFT, company: 'solo' as const, categories: ['nature'] };
    expect(canPlan(ready)).toBe(true);
    expect(ready.district).toBeNull();
    expect(ready.from).toEqual([]);
  });
});

// A place with a position, for the ordering the chips do.
const put = (name: string, lat: number, lng: number): Place => ({ ...at(name), lat, lng });

describe('areasNear', () => {
  // Hanoi-ish coordinates: Hoàn Kiếm in the middle, Ba Đình a couple of
  // kilometres west, Long Biên across the river.
  const places = [
    put('Hoàn Kiếm', 21.0285, 105.8542),
    put('Hoàn Kiếm', 21.0290, 105.8550),
    put('Ba Đình', 21.0350, 105.8200),
    put('Long Biên', 21.0450, 105.8900),
  ];

  it('puts the closest district first, wherever the pin is', () => {
    expect(areasNear(places, { lat: 21.0350, lng: 105.8200 })[0]).toBe('Ba Đình');
    expect(areasNear(places, { lat: 21.0450, lng: 105.8900 })[0]).toBe('Long Biên');
    expect(areasNear(places, { lat: 21.0287, lng: 105.8546 })[0]).toBe('Hoàn Kiếm');
  });

  // `districtsOf` has had this test since it was written; `ranked` — what
  // `areasNear` actually calls — never did. Two areas at the same point
  // with the same number of places tie on both earlier rules, and only the
  // name decides. Without it the chips can swap places between two renders
  // of identical data, which is a shuffle nobody can reproduce on demand.
  it('breaks a full tie on name, so the chips cannot swap', () => {
    const tied = [put('Tây Hồ', 21.03, 105.82), put('Ba Đình', 21.03, 105.82)];
    expect(areasNear(tied, { lat: 21.03, lng: 105.82 })).toEqual(['Ba Đình', 'Tây Hồ']);
  });

  // The whole complaint: standing in one district and being offered the
  // busiest one first because it is the busiest.
  it('does not simply repeat the busiest-first order', () => {
    const busy = [...many('Hoàn Kiếm', 20).map((p) => ({ ...p, lat: 21.0285, lng: 105.8542 })),
      put('Ba Đình', 21.0350, 105.8200)];
    expect(districtsOf(busy)[0]).toBe('Hoàn Kiếm');
    expect(areasNear(busy, { lat: 21.0350, lng: 105.8200 })[0]).toBe('Ba Đình');
  });

  // Reordered, never filtered: a far chip the reader can see is far beats
  // no chips at all.
  it('keeps every district it was given, up to the limit', () => {
    expect(areasNear(places, { lat: 10.7769, lng: 106.7009 })).toHaveLength(3);
    expect(areasNear(places, { lat: 21.03, lng: 105.85 }, 2)).toHaveLength(2);
  });

  // No point to measure from is not an error, it is the state before the
  // reader has said anything.
  it('falls back to busiest-first with no position', () => {
    expect(areasNear(places, null)).toEqual(districtsOf(places));
    expect(areasNear(places, undefined)).toEqual(districtsOf(places));
  });

  // A district whose places all lack coordinates cannot be placed, and is
  // still a district somebody may want.
  it('keeps a district with no coordinates, at the back', () => {
    const mixed = [...places, ...many('Tây Hồ', 3)];
    const out = areasNear(mixed, { lat: 21.0285, lng: 105.8542 });
    expect(out).toContain('Tây Hồ');
    expect(out[out.length - 1]).toBe('Tây Hồ');
  });

  it('ignores places with no district at all', () => {
    expect(areasNear([...places, ...many(null, 4)], { lat: 21.03, lng: 105.85 })).toHaveLength(3);
  });
});

describe('nearestAreaKm', () => {
  const places = [
    put('Hoàn Kiếm', 21.0285, 105.8542),
    put('Ba Đình', 21.0350, 105.8200),
  ];

  it('measures to the closest area, not to the first one listed', () => {
    // Standing on Ba Đình: the answer is Ba Đình's distance, near zero,
    // even though Hoàn Kiếm sorts first by every other rule in this file.
    expect(nearestAreaKm(places, { lat: 21.0350, lng: 105.8200 })).toBeLessThan(0.1);
  });

  // The reading that made this function necessary: eighty-five kilometres
  // from Hanoi, under a heading that said "nearby".
  it('is large when the reader is nowhere near the catalog', () => {
    const km = nearestAreaKm(places, { lat: 20.0, lng: 105.6 });
    expect(km).toBeGreaterThan(25);
  });

  it('cannot say without a point to measure from', () => {
    expect(nearestAreaKm(places, null)).toBeNull();
    expect(nearestAreaKm(places, undefined)).toBeNull();
  });

  it('cannot say when there are no areas at all', () => {
    expect(nearestAreaKm([], { lat: 21.03, lng: 105.85 })).toBeNull();
    expect(nearestAreaKm(many(null, 3), { lat: 21.03, lng: 105.85 })).toBeNull();
  });

  // Infinity is how `areasNear` keeps an unplaceable district at the back.
  // It must not escape as a distance, or the caller compares it to 25 and
  // silently drops the claim for a catalog that is perfectly local.
  it('cannot say when no area has coordinates', () => {
    expect(nearestAreaKm(many('Tây Hồ', 3), { lat: 21.03, lng: 105.85 })).toBeNull();
  });
});

describe('startPoint', () => {
  const ME = { lat: 21.0313, lng: 105.8135 };      // 29 Liễu Giai
  const PIN = { lat: 21.0333, lng: 105.8500 };     // Old Quarter
  const HANOI = { center_lat: 21.0285, center_lng: 105.8542, radius_km: 20 };
  const CENTRE = { lat: 21.0285, lng: 105.8542 };
  const none = { district: null, at: null };

  // The bug. "Around Hanoi · near me" is drawn for the state where
  // nothing has been chosen, and for months that state carried no
  // coordinate at all — so the planner had no origin, charged the opening
  // stop no distance, and picked it from anywhere in the city while the
  // label went on saying "near me".
  it('starts the day where the reader is when they chose nothing', () => {
    expect(startPoint(none, ME, HANOI)).toEqual(ME);
  });

  it('prefers the pin, which is the thing they actually pointed at', () => {
    expect(startPoint({ district: null, at: PIN }, ME, HANOI)).toEqual(PIN);
  });

  // The one that is easy to get backwards. A district must return *null*,
  // not the reader's position: `originOf` prefers a supplied point over
  // the district's own centre, so answering `me` here would plan a day in
  // Hà Đông around a sofa in Thanh Xuân.
  it('stands aside for a district instead of overriding it', () => {
    expect(startPoint({ district: 'Ba Đình', at: null }, ME, HANOI)).toBeNull();
  });

  // Both set is not a contradiction to resolve by precedence alone —
  // picking an area drops a pin on it, so in the app the two agree. The
  // pin still wins, because it is the later and more specific of the two.
  it('lets the pin win when an area is also set', () => {
    expect(startPoint({ district: 'Ba Đình', at: PIN }, ME, HANOI)).toEqual(PIN);
  });

  // Browsing Hanoi from Đà Nẵng. The position is real and 600km away;
  // every place would be charged the same capped distance, which chooses
  // nothing, while the label said "near you". The centre instead.
  it('starts at the centre for a reader in another city', () => {
    expect(startPoint(none, { lat: 16.0544, lng: 108.2022 }, HANOI)).toEqual(CENTRE);
  });

  // The edge of the city counts as the city — the radius is the desk's
  // own word for where it stops — and a step past it does not.
  it('holds the reader to the city’s own radius', () => {
    const inside = { lat: 21.0285 + 19.9 / 111.2, lng: 105.8542 };
    const outside = { lat: 21.0285 + 20.1 / 111.2, lng: 105.8542 };
    expect(startPoint(none, inside, HANOI)).toEqual(inside);
    expect(startPoint(none, outside, HANOI)).toEqual(CENTRE);
  });

  // Permission refused, or simply not read back yet: the centre too, and
  // the label says "centre" for it, so the anchor is never a secret.
  it('starts at the centre when there is no position to be had', () => {
    expect(startPoint(none, null, HANOI)).toEqual(CENTRE);
  });

  // No city to plan is the one case left without an anchor — a position
  // with no city to hold it to is not one to trust either.
  it('has no answer without a city', () => {
    expect(startPoint(none, ME, null)).toBeNull();
    expect(startPoint(none, null, null)).toBeNull();
  });

  // Not a hedge. `useMyPosition` resolves after the first render, so the
  // wizard draws at least once with a null position and the tap can land
  // in that window — and a district chosen in that window must still
  // suppress, or a late position would arrive and quietly take over.
  it('keeps the district suppressed even before a position arrives', () => {
    expect(startPoint({ district: 'Ba Đình', at: null }, null, HANOI)).toBeNull();
  });
});

describe('areaCentre', () => {
  it('is the mean of the area\'s places', () => {
    expect(areaCentre([
      put('Ba Đình', 21.03, 105.82),
      put('Ba Đình', 21.05, 105.84),
      put('Hoàn Kiếm', 21.0285, 105.8542),
    ], 'Ba Đình')).toEqual({ lat: 21.04, lng: 105.83 });
  });

  // The bug this exists for: choosing an area is a way of placing the pin,
  // and the sheet treated it as no pin at all. A district that cannot be
  // placed must say so rather than hand back (0, 0), which is a real point
  // in the Gulf of Guinea and would move the map there.
  it('cannot place an area whose every place lacks coordinates', () => {
    expect(areaCentre(many('Tây Hồ', 3), 'Tây Hồ')).toBeNull();
  });

  it('ignores the placeless ones when some of the area can be placed', () => {
    expect(areaCentre([...many('Tây Hồ', 2), put('Tây Hồ', 21.06, 105.82)], 'Tây Hồ'))
      .toEqual({ lat: 21.06, lng: 105.82 });
  });

  it('has no answer for an area that is not there', () => {
    expect(areaCentre([put('Ba Đình', 21.03, 105.82)], 'Nowhere')).toBeNull();
  });

  // `draft.district` is null whenever the reader has not chosen one, which
  // is most of the time.
  it('has no answer without a name', () => {
    const places = [put('Ba Đình', 21.03, 105.82)];
    expect(areaCentre(places, null)).toBeNull();
    expect(areaCentre(places, undefined)).toBeNull();
    expect(areaCentre(places, '   ')).toBeNull();
  });

  // The keys are trimmed when the areas are grouped, so the lookup has to
  // trim too or the two disagree about what a name is.
  it('finds an area whose name arrives padded', () => {
    expect(areaCentre([put('Ba Đình', 21.03, 105.82)], '  Ba Đình  '))
      .toEqual({ lat: 21.03, lng: 105.82 });
  });

  it('matches the name the chips are drawn from', () => {
    const places = [put('Ba Đình', 21.03, 105.82), put('Hoàn Kiếm', 21.0285, 105.8542)];
    for (const name of areasNear(places, { lat: 21.03, lng: 105.82 })) {
      expect(areaCentre(places, name)).not.toBeNull();
    }
  });
});

// Four options, each a glyph and its words, and no colour of its own: the
// chips wear their word's ink since 3 Nov 2026 (see `Tile`), so a hue here
// would be a value nothing reads.
describe('COMPANY', () => {
  it('gives every option a glyph, and no hue of its own', () => {
    for (const c of COMPANY) {
      expect(c.icon, c.key).toBeTruthy();
      expect(c, c.key).not.toHaveProperty('color');
    }
    expect(COMPANY.map((c) => c.key)).toEqual(['solo', 'couple', 'friends', 'family']);
  });
});

describe('draftFrom', () => {
  // The answers as they arrive off the route, minus the parts a draft
  // does not carry.
  const ask = {
    categories: ['cafes'], district: null, when: 'day' as const, from: ['a-list'],
  };

  // The bug this whole helper exists for. Three screens each built this
  // object and all three wrote `at: null`, because nothing in the params
  // carried a coordinate — so the header could say "A pin you dropped"
  // while the planner chose a first stop as though the reader had said
  // nothing about where they were.
  it('carries the pin the reader dropped', () => {
    expect(draftFrom({ ...ask, atLat: 21.0325, atLng: 105.8135 }, '2026-08-21').at)
      .toEqual({ lat: 21.0325, lng: 105.8135 });
  });

  it('has no pin when the reader dropped none', () => {
    expect(draftFrom(ask, '2026-08-21').at).toBeNull();
  });

  // Half a coordinate is not a place. It must not become one, and it must
  // not become (0, 0) either — that is in the Gulf of Guinea, and every
  // place in Hanoi would be charged the same distance from it.
  it('refuses half a coordinate', () => {
    expect(draftFrom({ ...ask, atLat: 21.0325 }, '2026-08-21').at).toBeNull();
    expect(draftFrom({ ...ask, atLng: 105.8135 }, '2026-08-21').at).toBeNull();
  });

  // Zero is a real latitude and a real longitude. A truthiness check here
  // would throw away the Gulf of Guinea for real, which matters less than
  // the habit does.
  it('keeps a coordinate that happens to be zero', () => {
    expect(draftFrom({ ...ask, atLat: 0, atLng: 0 }, '2026-08-21').at)
      .toEqual({ lat: 0, lng: 0 });
  });

  it('takes the day it was given rather than reading a clock', () => {
    expect(draftFrom(ask, '2027-01-09').date).toBe('2027-01-09');
  });

  it('carries the rest of the answers through', () => {
    const d = draftFrom({ ...ask, district: 'Ba Đình' }, '2026-08-21');
    expect(d.categories).toEqual(['cafes']);
    expect(d.district).toBe('Ba Đình');
    expect(d.when).toBe('day');
    expect(d.from).toEqual(['a-list']);
  });

  // `company` rides in the params for the model that names the plan and is
  // read by nothing in the planner, so the draft does not carry it.
  it('leaves company out, which nothing downstream reads', () => {
    expect(draftFrom(ask, '2026-08-21').company).toBeNull();
  });

  it('gives a draft with no collections an empty list rather than undefined', () => {
    expect(draftFrom({ categories: [], district: null, when: 'evening' }, '2026-08-21').from)
      .toEqual([]);
  });
});

describe('seedMembers', () => {
  const a = at('Hoàn Kiếm'); const b = at('Ba Đình'); const c = at('Tây Hồ');
  const list = (slug: string, members: Place[]): Collection =>
    ({ slug, title_en: slug, title_vi: slug, title_ja: null, collection_places: [], members } as unknown as Collection);

  it('is nothing until a list is chosen', () => {
    expect(seedMembers(undefined, [list('x', [a])], [])).toEqual([]);
    expect(seedMembers([], [list('x', [a])], [])).toEqual([]);
  });

  it('takes the members of the chosen lists only, in the order the lists come', () => {
    const lists = [list('own', [a]), list('skip', [b]), list('pub', [c])];
    expect(seedMembers(['pub', 'own'], lists, [])).toEqual([a, c]);
  });

  // Your own published list is on both shelves under one slug: one list,
  // pinned once. Two lists sharing a place are still two votes for it.
  it('pins a list on both shelves once, and a place in two lists twice', () => {
    const lists = [list('own', [a, b]), list('own', [a, b]), list('pub', [b])];
    expect(seedMembers(['own', 'pub'], lists, [])).toEqual([a, b, b]);
  });
});

// Which lists a trip remembers it started from (owner, 13 Nov 2026):
// the ones `seedMembers` resolves, by id, once each — and of those, the
// ones with a place among the stops saved.
describe('sourceIdsOf', () => {
  // Every list holds `kept` unless told otherwise, so the cases below
  // that are about choosing are not also about stops.
  const list = (slug: string, id?: string, has: (string | null)[] = ['kept']): Collection =>
    ({
      slug, id, title_en: slug, title_vi: slug, title_ja: null,
      collection_places: has.map((s, i) => ({ sort_order: i, places: s ? { slug: s } : null })),
    } as unknown as Collection);
  const STOPS = ['kept'];

  it('names nothing until a list is chosen', () => {
    expect(sourceIdsOf(undefined, [list('x', 'c-x')], STOPS)).toEqual([]);
    expect(sourceIdsOf(null, [list('x', 'c-x')], STOPS)).toEqual([]);
    expect(sourceIdsOf([], [list('x', 'c-x')], STOPS)).toEqual([]);
  });

  it('names the chosen lists by id, in the order the shelves hold them', () => {
    const lists = [list('own', 'c-own'), list('skip', 'c-skip'), list('pub', 'c-pub')];
    expect(sourceIdsOf(['pub', 'own'], lists, STOPS)).toEqual(['c-own', 'c-pub']);
  });

  // Your own published list is on both shelves: one list, one trip for it.
  it('names a list on both shelves once', () => {
    expect(sourceIdsOf(['own'], [list('own', 'c-own'), list('own', 'c-own')], STOPS)).toEqual(['c-own']);
  });

  // A chosen slug that no shelf still holds was not built from.
  it('leaves out a chosen list no shelf holds', () => {
    expect(sourceIdsOf(['gone', 'own'], [list('own', 'c-own')], STOPS)).toEqual(['c-own']);
  });

  // A ticked list none of whose places made the day gave the trip
  // nothing (owner, 13 Nov 2026): seven ticked, five stops from three.
  it('names only the chosen lists with a place among the stops', () => {
    const lists = [list('gave', 'c-gave', ['a', 'b']), list('none', 'c-none', ['x']), list('also', 'c-also', ['b'])];
    expect(sourceIdsOf(['gave', 'none', 'also'], lists, ['b', 'q'])).toEqual(['c-gave', 'c-also']);
    expect(sourceIdsOf(['gave', 'none'], lists, [])).toEqual([]);
  });

  // A place gone from the catalog leaves its row with no place; it is
  // nobody's stop, and does not make a list count.
  it('reads past a member whose place is gone', () => {
    expect(sourceIdsOf(['l'], [list('l', 'c-l', [null, 'kept'])], STOPS)).toEqual(['c-l']);
    expect(sourceIdsOf(['l'], [list('l', 'c-l', [null])], STOPS)).toEqual([]);
  });

  // A list that carries its members (`membersOf`'s first answer) is read
  // by them, not by its rows.
  it('reads a list by its members when it carries them', () => {
    const own = { ...list('own', 'c-own', []), members: [{ slug: 'kept' }] } as unknown as Collection;
    expect(sourceIdsOf(['own'], [own], STOPS)).toEqual(['c-own']);
    const off = { ...list('off', 'c-off', ['kept']), members: [{ slug: 'elsewhere' }] } as unknown as Collection;
    expect(sourceIdsOf(['off'], [off], STOPS)).toEqual([]);
  });

  // A launch-cache row without its id is skipped rather than looked up;
  // and the shelf after it holding the same slug is still the same list.
  it('skips a row that carries no id, and does not read the slug again further on', () => {
    expect(sourceIdsOf(['old', 'own'], [list('old'), list('old', 'c-old'), list('own', 'c-own')], STOPS)).toEqual(['c-own']);
  });
});

// The area a point is named by in the plan heading: the nearest with
// three places or more, so a stray label on one row ("Hoan Kiem") never
// names the old quarter (owner, 12 Nov 2026).
describe('areaAround', () => {
  const at = (slug: string, area: string | null, lat: number | null, lng: number | null) =>
    ({ slug, neighborhood_en: area, lat, lng }) as unknown as Place;
  const big = [1, 2, 3].map((i) => at(`hk${i}`, 'Hoàn Kiếm', 21.032, 105.850));
  const stray = at('s', 'Hoan Kiem', 21.0287, 105.8521);

  it('names the nearest area big enough to be one, passing a stray beside the point', () => {
    expect(areaAround([...big, stray], { lat: 21.0287, lng: 105.8521 })).toBe('Hoàn Kiếm');
  });

  it('takes an area of exactly three, and none smaller', () => {
    const two = [at('a', 'Ba Đình', 21.035, 105.82), at('b', 'Ba Đình', 21.035, 105.82)];
    expect(areaAround([...two, ...big], { lat: 21.035, lng: 105.82 })).toBe('Hoàn Kiếm');
    expect(areaAround([...two, at('c', 'Ba Đình', 21.035, 105.82), ...big], { lat: 21.035, lng: 105.82 })).toBe('Ba Đình');
  });

  it('names nothing with no point, or nothing it can place', () => {
    expect(areaAround(big, null)).toBeNull();
    expect(areaAround([stray], { lat: 21.0287, lng: 105.8521 })).toBeNull();
    expect(areaAround([1, 2, 3].map((i) => at(`u${i}`, 'Unplaced', null, null)), { lat: 21, lng: 105 })).toBeNull();
  });
});
