// What the pill reads off the check-ins: which visit was the last one
// here, and whether another may be written yet.

import { describe, expect, it } from 'vitest';
import {
  canRepeat, type Checkin, filterVisits, latestCheckin, monthTitle, PER_PLACE_PER_DAY, REPEAT_AFTER_MIN,
  textMatches, visitCategories, visitCities, visitSections, visitsInDay, visitSummary, visitsAt,
} from './checkin';

const row = (id: string, slug: string, at: string): Checkin => ({ id, place_slug: slug, city_id: 'hanoi', at });

describe('visitsAt', () => {
  it('lists this place\'s visits newest first and nothing from another, whatever order it was given', () => {
    const rows = [
      row('a', 'cong', '2026-10-01T03:00:00Z'),
      row('b', 'pizza', '2026-10-08T03:00:00Z'),
      row('c', 'cong', '2026-10-07T09:30:00Z'),
      row('d', 'cong', '2026-10-03T09:30:00Z'),
    ];
    expect(visitsAt(rows, 'cong').map((r) => r.id)).toEqual(['c', 'd', 'a']);
    expect(visitsAt(rows, 'pizza').map((r) => r.id)).toEqual(['b']);
    expect(visitsAt(rows, 'bun')).toEqual([]);
  });
  it('keeps two visits at the same instant, in the order given', () => {
    const rows = [row('x', 'cong', '2026-10-02T00:00:00Z'), row('y', 'cong', '2026-10-02T00:00:00Z')];
    expect(visitsAt(rows, 'cong').map((r) => r.id)).toEqual(['x', 'y']);
  });
  it('agrees with latestCheckin about which is newest', () => {
    const rows = [row('old', 'cong', '2026-10-01T00:00:00Z'), row('new', 'cong', '2026-10-02T00:00:00Z')];
    expect(visitsAt(rows, 'cong')[0].id).toBe(latestCheckin(rows, 'cong')?.id);
  });
});

describe('latestCheckin', () => {
  it('picks the newest visit at this place and nothing from another', () => {
    const rows = [
      row('a', 'cong', '2026-10-01T03:00:00Z'),
      row('b', 'pizza', '2026-10-08T03:00:00Z'),
      row('c', 'cong', '2026-10-07T09:30:00Z'),
    ];
    expect(latestCheckin(rows, 'cong')?.id).toBe('c');
    expect(latestCheckin(rows, 'pizza')?.id).toBe('b');
  });
  it('is null when this place has never been checked in at', () => {
    expect(latestCheckin([row('a', 'cong', '2026-10-01T03:00:00Z')], 'pizza')).toBeNull();
    expect(latestCheckin([], 'cong')).toBeNull();
  });
  it('does not trust the order it was given', () => {
    const rows = [row('old', 'cong', '2026-10-01T00:00:00Z'), row('new', 'cong', '2026-10-02T00:00:00Z')];
    expect(latestCheckin(rows, 'cong')?.id).toBe('new');
    expect(latestCheckin([...rows].reverse(), 'cong')?.id).toBe('new');
  });
});

describe('canRepeat', () => {
  const at = '2026-10-08T03:00:00Z';
  it('allows a first visit, and another once the window has passed', () => {
    expect(canRepeat([], 'cong', new Date(at))).toBe(true);
    expect(canRepeat([row('a', 'cong', at)], 'cong', new Date('2026-10-08T03:10:00Z'))).toBe(true);
    expect(canRepeat([row('a', 'cong', at)], 'cong', new Date('2026-10-09T03:00:00Z'))).toBe(true);
  });
  it('refuses a second visit inside the window — that is a double tap, not a return', () => {
    expect(REPEAT_AFTER_MIN).toBe(10);
    expect(canRepeat([row('a', 'cong', at)], 'cong', new Date('2026-10-08T03:09:59Z'))).toBe(false);
    expect(canRepeat([row('a', 'cong', at)], 'cong', new Date(at))).toBe(false);
  });
  it('refuses a fourth visit at one place inside a day, and allows it at another', () => {
    expect(PER_PLACE_PER_DAY).toBe(3);
    const now = new Date('2026-10-08T20:00:00Z');
    const three = [
      row('a', 'cong', '2026-10-08T01:00:00Z'),
      row('b', 'cong', '2026-10-08T08:00:00Z'),
      row('c', 'cong', '2026-10-08T12:00:00Z'),
    ];
    expect(canRepeat(three, 'cong', now)).toBe(false);
    expect(canRepeat(three, 'pizza', now)).toBe(true);
    // Twenty-four hours on, the oldest has rolled out of the day.
    expect(canRepeat(three, 'cong', new Date('2026-10-09T01:00:01Z'))).toBe(true);
    // Two in the day and the window passed: still room for the third.
    expect(canRepeat(three.slice(1), 'cong', now)).toBe(true);
  });
});

describe('visitsInDay', () => {
  it('counts this place\u2019s visits in the last twenty-four hours, strictly', () => {
    const now = new Date('2026-10-08T20:00:00Z');
    const rows = [
      row('a', 'cong', '2026-10-07T20:00:00Z'), // exactly a day ago: out
      row('b', 'cong', '2026-10-07T20:00:01Z'), // in
      row('c', 'pizza', '2026-10-08T19:00:00Z'),
      row('d', 'cong', '2026-10-08T19:00:00Z'),
    ];
    expect(visitsInDay(rows, 'cong', now)).toBe(2);
    expect(visitsInDay(rows, 'pizza', now)).toBe(1);
    expect(visitsInDay(rows, 'bun', now)).toBe(0);
  });
});

// Instants mid-month and mid-day, so the two clocks the suite runs on
// (Hanoi, New York) file them under the same month.
describe('visitSections', () => {
  it('groups by month, newest month first and newest visit first inside it', () => {
    const rows = [
      row('a', 'cong', '2026-09-15T05:00:00Z'),
      row('b', 'pizza', '2026-10-15T05:00:00Z'),
      row('c', 'cong', '2026-10-12T05:00:00Z'),
      row('d', 'bun', '2026-07-15T05:00:00Z'),
    ];
    const secs = visitSections(rows);
    expect(secs.map((x) => x.key)).toEqual(['2026-10', '2026-09', '2026-07']);
    expect(secs[0]).toMatchObject({ year: 2026, month: 10 });
    expect(secs[0].data.map((x) => x.id)).toEqual(['b', 'c']);
    expect(secs[2].data.map((x) => x.id)).toEqual(['d']);
  });
  it('is empty for nobody', () => {
    expect(visitSections([])).toEqual([]);
  });
  it('does not trust the order it was given, and leaves it alone', () => {
    const rows = [row('old', 'cong', '2026-10-12T05:00:00Z'), row('new', 'cong', '2026-10-15T05:00:00Z')];
    expect(visitSections(rows)[0].data.map((x) => x.id)).toEqual(['new', 'old']);
    expect(rows[0].id).toBe('old');
  });
});

describe('monthTitle', () => {
  it('names the month the way each language does', () => {
    expect(monthTitle('en', 2026, 10)).toBe('October 2026');
    expect(monthTitle('vi', 2026, 10)).toBe('Tháng 10, 2026');
    expect(monthTitle('ja', 2026, 10)).toBe('2026年10月');
    expect(monthTitle('en', 2025, 1)).toBe('January 2025');
  });
});

const place = (cats: string[]) => ({ name_en: 'x', name_vi: 'x', name_ja: null, cover: null, categories: cats });
const inCity = (id: string, slug: string, city: string | null, cats: string[] = []): Checkin =>
  ({ id, place_slug: slug, city_id: city, at: '2026-10-01T05:00:00Z', place: place(cats) });

describe('visitSummary', () => {
  it('counts visits, the distinct places among them, and the distinct cities', () => {
    const rows = [
      inCity('a', 'cong', 'hanoi'), inCity('b', 'cong', 'hanoi'), inCity('c', 'pizza', 'saigon'),
      // A visit whose place is gone names no city, and counts as no city.
      inCity('d', '', null),
    ];
    expect(visitSummary(rows)).toEqual({ visits: 4, places: 3, cities: 2 });
    expect(visitSummary([])).toEqual({ visits: 0, places: 0, cities: 0 });
  });
});

describe('the facets', () => {
  const rows = [
    inCity('a', 'cong', 'hanoi', ['cafes']),
    inCity('b', 'pizza', 'melbourne', ['eats', 'nightlife']),
    inCity('c', 'bun', 'melbourne', ['eats']),
    inCity('d', 'lane', 'melbourne', []),
    inCity('e', '', null),
    // A row the cache kept before places rode along: no `place` at all.
    row('f', 'old', '2026-09-01T05:00:00Z'),
  ];
  it('lists cities by how often they were visited, then by first appearance', () => {
    expect(visitCities(rows)).toEqual(['melbourne', 'hanoi']);
    // `row()` files everything under Hanoi; the cache-era row counts there too.
    expect(visitCities([])).toEqual([]);
  });
  it('lists categories the same way, across every place visited', () => {
    expect(visitCategories(rows)).toEqual(['eats', 'cafes', 'nightlife']);
  });
  it('filters by city, by category, and by both at once', () => {
    expect(filterVisits(rows, null, null)).toBe(rows);
    expect(filterVisits(rows, 'melbourne', null).map((r) => r.id)).toEqual(['b', 'c', 'd']);
    expect(filterVisits(rows, null, 'eats').map((r) => r.id)).toEqual(['b', 'c']);
    expect(filterVisits(rows, 'melbourne', 'nightlife').map((r) => r.id)).toEqual(['b']);
    expect(filterVisits(rows, 'hanoi', 'eats')).toEqual([]);
    // The cache-era row has no kinds, so a kind never finds it; a city does.
    expect(filterVisits(rows, 'hanoi', null).map((r) => r.id)).toEqual(['a', 'f']);
  });
});

describe('textMatches', () => {
  it('finds every word typed somewhere in the haystack, tone marks and case aside', () => {
    expect(textMatches(['Cộng Cà Phê', 'Hà Nội'], 'cong')).toBe(true);
    expect(textMatches(['Cộng Cà Phê', 'Hà Nội'], 'ca phe ha noi')).toBe(true);
    expect(textMatches(['Cộng Cà Phê', 'Hà Nội'], 'CỘNG')).toBe(true);
    expect(textMatches(['Cộng Cà Phê', 'Hà Nội'], 'cong saigon')).toBe(false);
  });
  it('matches everything on an empty or blank query', () => {
    expect(textMatches(['x'], '')).toBe(true);
    expect(textMatches(['x'], '   ')).toBe(true);
    expect(textMatches([], 'x')).toBe(false);
  });
});
