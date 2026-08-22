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
