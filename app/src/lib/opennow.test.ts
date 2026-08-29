import { describe, expect, it } from 'vitest';
import { OPEN_SHOWN, openNowPlaces } from './opennow';

// Pinned instants, the way format.test pins them: Vietnam is UTC+7, so
// 03:00Z is 10:00 in Saigon. 2026-08-12 is a Wednesday.
const WED_10AM = new Date('2026-08-12T03:00:00Z');
const week = (hours: string) =>
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    .map((d) => `${d}: ${hours}`);

const DAY = week('8:00 AM – 10:00 PM');
const NIGHT = week('7:00 PM – 2:00 AM');

const p = (
  slug: string,
  opening_hours: string[] | null,
  rating: number | null = null,
  rating_count: number | null = null,
) => ({ slug, opening_hours, rating, rating_count });

describe('openNowPlaces', () => {
  it('keeps the open doors and drops the shut ones', () => {
    const out = openNowPlaces([p('cafe', DAY, 4.5), p('bar', NIGHT, 4.8)], WED_10AM);
    expect(out.map((x) => x.slug)).toEqual(['cafe']);
  });

  // A section titled "open right now" is no place for a guess: unknown
  // hours mean out, not in.
  it('leaves out a place whose hours it cannot read', () => {
    const out = openNowPlaces([p('mystery', null, 5), p('cafe', DAY, 4.0)], WED_10AM);
    expect(out.map((x) => x.slug)).toEqual(['cafe']);
  });

  it('ranks the open ones by rating, the reference way', () => {
    const out = openNowPlaces([
      p('ok', DAY, 4.3), p('best', DAY, 4.6), p('good', DAY, 4.5),
    ], WED_10AM);
    expect(out.map((x) => x.slug)).toEqual(['best', 'good', 'ok']);
  });

  it('puts rated above unrated, and more-reviewed first among equals', () => {
    const out = openNowPlaces([
      p('new', DAY, null), p('quiet', DAY, 4.5, 12), p('busy', DAY, 4.5, 900),
    ], WED_10AM);
    expect(out.map((x) => x.slug)).toEqual(['busy', 'quiet', 'new']);
  });

  it('breaks a dead tie on slug, so the list holds still', () => {
    const out = openNowPlaces([p('b', DAY, 4.5, 10), p('a', DAY, 4.5, 10)], WED_10AM);
    expect(out.map((x) => x.slug)).toEqual(['a', 'b']);
  });

  // Rating and count can be absent entirely, not only null — the
  // structural type says so — and two such places still need a stable
  // order between them.
  it('sorts two complete unknowns by slug alone, whichever way they arrive', () => {
    const bare = (slug: string) => ({ slug, opening_hours: DAY });
    expect(openNowPlaces([bare('z'), bare('a')], WED_10AM).map((x) => x.slug))
      .toEqual(['a', 'z']);
    expect(openNowPlaces([bare('a'), bare('z')], WED_10AM).map((x) => x.slug))
      .toEqual(['a', 'z']);
  });

  it('shows at most the cap, and the cap is five', () => {
    expect(OPEN_SHOWN).toBe(5);
    const many = Array.from({ length: 8 }, (_, i) => p(`p${i}`, DAY, 4 + i / 100));
    expect(openNowPlaces(many, WED_10AM)).toHaveLength(5);
  });

  it('takes a different cap when asked', () => {
    const out = openNowPlaces([p('a', DAY, 4.6), p('b', DAY, 4.5)], WED_10AM, 1);
    expect(out.map((x) => x.slug)).toEqual(['a']);
  });

  it('does not reorder the array it was handed', () => {
    const input = [p('b', DAY, 4.0), p('a', DAY, 4.9)];
    openNowPlaces(input, WED_10AM);
    expect(input.map((x) => x.slug)).toEqual(['b', 'a']);
  });

  it('has an answer for a city where everything is shut', () => {
    expect(openNowPlaces([p('bar', NIGHT, 4.8)], WED_10AM)).toEqual([]);
  });
});

// ── the thumb on the scale ──────────────────────────────────────────
//
// Ranking this catalog by rating alone is close to ranking it by nothing:
// 374 rated places, standard deviation 0.23, three quarters between 4.50
// and 4.90. `TASTE_LIFT` is that one deviation and no more, which is what
// these two tests are actually about — that it is decisive inside the
// pack, and powerless outside it.
describe('taste, when there is one', () => {
  const likes = (cats: string[]) => ({
    affinity: (p: { slug: string }) => (cats.includes(p.slug) ? 1 : 0),
  });
  const at = (slug: string, rating: number) => p(slug, DAY, rating);

  it('changes nothing at all when there is no taste', () => {
    const places = [at('a', 4.5), at('b', 4.9)];
    expect(openNowPlaces(places, WED_10AM).map((p) => p.slug)).toEqual(['b', 'a']);
    expect(openNowPlaces(places, WED_10AM, 5, null).map((p) => p.slug)).toEqual(['b', 'a']);
  });

  // Inside the band rating cannot separate, taste decides.
  it('reorders the pack rating leaves in a heap', () => {
    const places = [at('rest', 4.9), at('cafe', 4.8)];
    expect(openNowPlaces(places, WED_10AM).map((p) => p.slug)).toEqual(['rest', 'cafe']);
    expect(openNowPlaces(places, WED_10AM, 5, likes(['cafe'])).map((p) => p.slug))
      .toEqual(['cafe', 'rest']);
  });

  // And outside it, it cannot. This is the promise that keeps the app a
  // curated guide rather than a mirror: 3.6 + 0.23 is still below 4.5.
  it('cannot lift a poor place over a good one', () => {
    const places = [at('good', 4.5), at('poor', 3.6)];
    expect(openNowPlaces(places, WED_10AM, 5, likes(['poor'])).map((p) => p.slug))
      .toEqual(['good', 'poor']);
  });

  // A place passed over costs the same as a liked one gains — the lift is
  // symmetric because `affinity` is.
  it('marks down a place the reader walked away from', () => {
    const places = [at('passed', 4.9), at('other', 4.8)];
    const cold = { affinity: (p: { slug: string }) => (p.slug === 'passed' ? -1 : 0) };
    expect(openNowPlaces(places, WED_10AM, 5, cold).map((p) => p.slug)).toEqual(['other', 'passed']);
  });
});
