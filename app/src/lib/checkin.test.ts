// What the pill reads off the check-ins: which visit was the last one
// here, and whether another may be written yet.

import { describe, expect, it } from 'vitest';
import {
  PhotoError, photoRefusalOf, PHOTOS_PER_VISIT, visitPhotosOf,
  audienceOf, cleanNote, nextAudience, NOTE_MAX,
  canRepeat, visitedToday, type Checkin, filterVisits, PER_DAY, whyRefused, latestCheckin, monthTitle, PER_PLACE_PER_DAY, REPEAT_AFTER_MIN,
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
    expect(monthTitle('zh', 2026, 10)).toBe('2026年10月');
    expect(monthTitle('zh-Hant', 2026, 10)).toBe('2026年10月');
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

describe('a visit\'s note and who sees it', () => {
  const v = (id: string, at: string, audience?: 'private' | 'friends' | 'public' | null) => ({ id, place_slug: 'p', city_id: null, at, audience });

  it('reads an unanswered visit as private', () => {
    expect(audienceOf({})).toBe('private');
    expect(audienceOf({ audience: null })).toBe('private');
    expect(audienceOf({ audience: 'friends' })).toBe('friends');
  });

  it('opens the next visit on Friends until the reader has answered once', () => {
    expect(nextAudience([])).toBe('friends');
    expect(nextAudience([v('a', '2026-10-01T00:00:00Z'), v('b', '2026-10-02T00:00:00Z', null)])).toBe('friends');
  });

  it('then on the last answer given, whatever order the rows come in', () => {
    const rows = [
      v('old', '2026-11-20T00:00:00Z', 'friends'),
      v('newest-unanswered', '2026-11-24T00:00:00Z', null),
      v('last-answer', '2026-11-23T00:00:00Z', 'private'),
    ];
    expect(nextAudience(rows)).toBe('private');
    expect(nextAudience([...rows].reverse())).toBe('private');
  });

  it('opens on Public whenever Public is offered, whatever the reader last chose', () => {
    expect(nextAudience([], true)).toBe('public');
    expect(nextAudience([v('kept-close', '2026-11-25T00:00:00Z', 'private')], true)).toBe('public');
    expect(nextAudience([v('to-friends', '2026-11-25T00:00:00Z', 'friends')], true)).toBe('public');
  });

  it('without Public on offer, never opens on it, even straight after a public visit', () => {
    expect(nextAudience([v('shared-with-all', '2026-11-25T00:00:00Z', 'public')])).toBe('friends');
    expect(nextAudience([
      v('private-before', '2026-11-20T00:00:00Z', 'private'),
      v('shared-with-all', '2026-11-25T00:00:00Z', 'public'),
    ])).toBe('friends');
  });

  it('stores a note trimmed and bounded, and nothing as null', () => {
    expect(cleanNote('  Crisp sourdough.  ')).toBe('Crisp sourdough.');
    expect(cleanNote('   ')).toBeNull();
    expect(cleanNote('')).toBeNull();
    expect(cleanNote('a'.repeat(NOTE_MAX + 20))).toHaveLength(NOTE_MAX);
    // Cut at the bound, a space left hanging there goes too.
    expect(cleanNote(`${'a'.repeat(NOTE_MAX - 1)} b`)).toBe('a'.repeat(NOTE_MAX - 1));
  });
});

describe('whyRefused', () => {
  const now = new Date('2026-10-08T20:00:00Z');
  it('says "a moment ago" when this place has a visit inside the ten minutes, whatever else is true', () => {
    const rows = [row('a', 'cong', '2026-10-08T19:55:00Z'), row('b', 'cong', '2026-10-08T12:00:00Z'), row('c', 'cong', '2026-10-08T08:00:00Z')];
    expect(whyRefused(rows, 'cong', now)).toBe('soon');
    // Exactly ten minutes on is no longer "a moment ago".
    expect(whyRefused([row('a', 'cong', '2026-10-08T19:50:00Z')], 'cong', now)).toBe('day');
  });
  it('says "three here" when this place has its three in the day', () => {
    const rows = [row('a', 'cong', '2026-10-08T19:00:00Z'), row('b', 'cong', '2026-10-08T12:00:00Z'), row('c', 'cong', '2026-10-08T08:00:00Z')];
    expect(whyRefused(rows, 'cong', now)).toBe('place');
    expect(whyRefused(rows.slice(0, 2), 'cong', now)).toBe('day');
  });
  it('says "the day" otherwise — other places’ visits do not make it this place’s three', () => {
    expect(PER_DAY).toBe(50);
    const rows = [row('a', 'pizza', '2026-10-08T19:58:00Z'), row('b', 'pizza', '2026-10-08T12:00:00Z'), row('c', 'pizza', '2026-10-08T08:00:00Z')];
    expect(whyRefused(rows, 'cong', now)).toBe('day');
    expect(whyRefused([], 'cong', now)).toBe('day');
  });
});

describe('photoRefusalOf', () => {
  // The function's own codes first, whatever the status carrying them:
  // a cap is a cap at 403, 409 or 429.
  it('names the three caps by their codes', () => {
    expect(photoRefusalOf(409, 'photo:full')).toBe('full');
    expect(photoRefusalOf(429, 'photo:day')).toBe('day');
    expect(photoRefusalOf(403, 'photo:account')).toBe('account');
  });
  it('calls every way a file is not a picture the same thing', () => {
    for (const code of ['not_jpeg', 'malformed', 'truncated', 'no_image', 'too_large', 'too_big']) {
      expect(photoRefusalOf(415, code)).toBe('image');
    }
  });
  it('reads a 401 with no code as signed out', () => {
    expect(photoRefusalOf(401, undefined)).toBe('signed_out');
  });
  it('leaves anything else to be tried again', () => {
    expect(photoRefusalOf(500, 'boom')).toBe('other');
    expect(photoRefusalOf(undefined, undefined)).toBe('other');
    // A code wins over the status: a cap refused while signed in is the cap.
    expect(photoRefusalOf(401, 'photo:day')).toBe('day');
  });
  it('carries its reason on the error', () => {
    const e = new PhotoError('day');
    expect(e.why).toBe('day');
    expect(e.message).toBe('day');
    expect(e.name).toBe('PhotoError');
    expect(PHOTOS_PER_VISIT).toBe(3);
  });
});

describe('visitPhotosOf', () => {
  const ph = (id: string, extra: Record<string, unknown> = {}) => ({ id, path: `u1/k1/${id}.jpg`, width: 1200, height: 900, ...extra });
  it('reads nothing that is not a list as no photos', () => {
    expect(visitPhotosOf(null)).toEqual([]);
    expect(visitPhotosOf({ id: 'p1' })).toEqual([]);
  });
  it('keeps the size and path, in position order, and drops the hidden', () => {
    expect(visitPhotosOf([ph('b', { position: 2 }), ph('h', { position: 1, hidden_at: '2026-11-25T00:00:00Z' }), ph('a', { position: 1, extra: 1 })]))
      .toEqual([{ id: 'a', path: 'u1/k1/a.jpg', width: 1200, height: 900 }, { id: 'b', path: 'u1/k1/b.jpg', width: 1200, height: 900 }]);
  });
  it('keeps the order it was sent in when no position rides along', () => {
    expect(visitPhotosOf([ph('b'), ph('a')]).map((p) => p.id)).toEqual(['b', 'a']);
  });
  it('leaves out an entry it could not draw', () => {
    expect(visitPhotosOf([null, ph('a'), { ...ph('b'), path: 7 }, { ...ph('c'), width: '1200' }, { ...ph('d'), height: null }, { ...ph('e'), id: 3 }]).map((p) => p.id)).toEqual(['a']);
  });
  it('never draws more than a visit may carry', () => {
    expect(visitPhotosOf([ph('a'), ph('b'), ph('c'), ph('d')])).toHaveLength(PHOTOS_PER_VISIT);
  });
});

// The pill's state (27 Nov 2026): worn for the day of the visit, on the
// phone's calendar, and plain the next.
describe('visitedToday', () => {
  const at = (iso: string, slug = 'cong'): Checkin => ({ id: iso + slug, place_slug: slug, city_id: 'hanoi', at: iso } as Checkin);
  const local = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
  it('is false with no visit here', () => {
    expect(visitedToday([at(local(2026, 11, 27, 9), 'other')], 'cong', new Date(2026, 10, 27, 10))).toBe(false);
  });
  it('is true for a visit earlier the same day', () => {
    expect(visitedToday([at(local(2026, 11, 27, 0, 5))], 'cong', new Date(2026, 10, 27, 23, 50))).toBe(true);
  });
  it('is false after the phone’s midnight, though under 24 hours', () => {
    expect(visitedToday([at(local(2026, 11, 26, 23, 55))], 'cong', new Date(2026, 10, 27, 0, 5))).toBe(false);
  });
  it('reads the newest visit, not the first', () => {
    const rows = [at(local(2026, 10, 1, 9)), at(local(2026, 11, 27, 8))];
    expect(visitedToday(rows, 'cong', new Date(2026, 10, 27, 9))).toBe(true);
  });
  it('is false on the same day of another month and of another year', () => {
    expect(visitedToday([at(local(2026, 10, 27, 9))], 'cong', new Date(2026, 10, 27, 10))).toBe(false);
    expect(visitedToday([at(local(2025, 11, 27, 9))], 'cong', new Date(2026, 10, 27, 10))).toBe(false);
  });
});
