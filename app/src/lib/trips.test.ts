import { describe, expect, it } from 'vitest';
import { endMinOf, spendVnd, splitTrips, tripCover } from './trips';

const trip = (day: string) => ({ day });

/** Nine in the morning, midnight — a trip whose hour is never the thing
 *  being tested. Used wherever the day alone should decide. */
const NOON = 12 * 60;

describe('splitTrips', () => {
  it('puts tomorrow ahead and yesterday behind', () => {
    const { upcoming, past } = splitTrips(
      [trip('2026-08-18'), trip('2026-08-16')], '2026-08-17', NOON,
    );
    expect(upcoming.map((t) => t.day)).toEqual(['2026-08-18']);
    expect(past.map((t) => t.day)).toEqual(['2026-08-16']);
  });

  // The one people only notice at 00:05, having planned the evening ahead:
  // today is not a memory yet.
  it('counts a today with no times on it as upcoming', () => {
    const { upcoming, past } = splitTrips([trip('2026-08-17')], '2026-08-17', 23 * 60);
    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(0);
  });

  it('runs the upcoming half soonest first', () => {
    const { upcoming } = splitTrips(
      [trip('2026-09-01'), trip('2026-08-20'), trip('2026-08-25')], '2026-08-17', NOON,
    );
    expect(upcoming.map((t) => t.day)).toEqual(['2026-08-20', '2026-08-25', '2026-09-01']);
  });

  it('runs the past half most recent first', () => {
    const { past } = splitTrips(
      [trip('2026-01-01'), trip('2026-08-10'), trip('2026-05-05')], '2026-08-17', NOON,
    );
    expect(past.map((t) => t.day)).toEqual(['2026-08-10', '2026-05-05', '2026-01-01']);
  });

  // The other half of the same argument. A Monday morning finished at noon
  // sat above tomorrow's plans until midnight, under a heading that said
  // "upcoming" — which is what somebody looking at the list at five in the
  // afternoon reads as "you have not been yet".
  describe('a trip on today, with hours on it', () => {
    const morning = {
      day: '2026-08-17',
      trip_stops: [
        { arrive_min: 9 * 60, dwell_min: 75 },
        { arrive_min: 10 * 60 + 45, dwell_min: 60 },
      ],
    };

    it('is upcoming before it starts', () => {
      expect(splitTrips([morning], '2026-08-17', 8 * 60).upcoming).toHaveLength(1);
    });

    it('is upcoming while it is happening', () => {
      expect(splitTrips([morning], '2026-08-17', 11 * 60).upcoming).toHaveLength(1);
    });

    // Ends 11:45; the grace runs to 12:45.
    it('is still upcoming inside the grace after its last stop', () => {
      expect(splitTrips([morning], '2026-08-17', 12 * 60).upcoming).toHaveLength(1);
    });

    it('is past once the grace has run out', () => {
      const { upcoming, past } = splitTrips([morning], '2026-08-17', 17 * 60 + 8);
      expect(upcoming).toHaveLength(0);
      expect(past).toHaveLength(1);
    });

    // The trip is over, but the day is not: an evening saved for tonight
    // must not be dragged down with the morning that already happened.
    it('does not take tonight down with it', () => {
      const evening = {
        day: '2026-08-17',
        trip_stops: [{ arrive_min: 19 * 60, dwell_min: 90 }],
      };
      const { upcoming, past } = splitTrips([morning, evening], '2026-08-17', 17 * 60 + 8);
      expect(upcoming).toEqual([evening]);
      expect(past).toEqual([morning]);
    });
  });

  it('has two empty halves for no trips at all', () => {
    expect(splitTrips([], '2026-08-17', NOON)).toEqual({ upcoming: [], past: [] });
  });
});

// Real Hanoi coordinates: the first hop is a walk, the second is not.
const LAKE = { lat: 21.0287, lng: 105.8524, price_vnd: 0 };
const CAFE = { lat: 21.0301, lng: 105.8510, price_vnd: 60000 };
const WEST = { lat: 21.0587, lng: 105.8180, price_vnd: 200000 };

describe('spendVnd', () => {
  it('adds the stops up', () => {
    expect(spendVnd([LAKE, CAFE])).toBe(60000);
  });

  it('charges a ride for a leg nobody is walking', () => {
    expect(spendVnd([CAFE, WEST])).toBe(60000 + 200000 + 15000);
  });

  it('charges nothing for a leg inside walking distance', () => {
    expect(spendVnd([LAKE, CAFE])).toBe(spendVnd([LAKE]) + spendVnd([CAFE]));
  });

  // A place unpublished after the trip was saved comes back null. Routing
  // through it would put a stop at 0°N 0°E, off the coast of Ghana, and
  // quote a taxi there and back.
  it('skips a stop the catalog no longer holds', () => {
    expect(spendVnd([LAKE, null, CAFE])).toBe(spendVnd([LAKE, CAFE]));
  });

  it('is nothing for an empty trip', () => {
    expect(spendVnd([])).toBe(0);
  });
});

// Two trips on one day is the ordinary case for a weekend, and it is the
// only input that reaches the comparators' third answer.
describe('splitTrips with two trips on the same day', () => {
  const a = { day: '2026-08-20', id: 'a' };
  const b = { day: '2026-08-20', id: 'b' };

  it('keeps them both, in the order they arrived', () => {
    const { upcoming } = splitTrips([a, b], '2026-08-17', NOON);
    expect(upcoming.map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('does the same on the other side of today', () => {
    const past = splitTrips(
      [{ day: '2026-08-10', id: 'a' }, { day: '2026-08-10', id: 'b' }], '2026-08-17', NOON,
    ).past;
    expect(past.map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('endMinOf', () => {
  it('is null when no stop carries a time', () => {
    expect(endMinOf({ day: '2026-08-17' })).toBe(null);
    expect(endMinOf({ day: '2026-08-17', trip_stops: [{ arrive_min: null }] })).toBe(null);
  });

  it('counts the dwell, so the end is when you leave', () => {
    expect(endMinOf({ day: '2026-08-17', trip_stops: [{ arrive_min: 600, dwell_min: 45 }] }))
      .toBe(645);
  });

  it('treats a stop with no dwell as instant rather than as unknown', () => {
    expect(endMinOf({ day: '2026-08-17', trip_stops: [{ arrive_min: 600 }] })).toBe(600);
  });

  // `sort_order` is the reader's order, not the clock's — somebody who
  // dragged dinner to the end of a list they had already re-timed has a
  // last row that is not their last hour.
  it('takes the latest hour, not the last row', () => {
    expect(endMinOf({
      day: '2026-08-17',
      trip_stops: [{ arrive_min: 1200, dwell_min: 60 }, { arrive_min: 600, dwell_min: 30 }],
    })).toBe(1260);
  });
});

describe('spendVnd with prices missing', () => {
  // A place the desk has not priced. Counting it as free is the only
  // honest option — the alternative is refusing to total the trip at all.
  it('treats an unpriced place as nothing rather than as NaN', () => {
    expect(spendVnd([{ lat: 21.0287, lng: 105.8524 }])).toBe(0);
    expect(spendVnd([{ lat: 21.0287, lng: 105.8524, price_vnd: null }, CAFE])).toBe(60000);
  });
});

const photo = (uri: string, over: Partial<{ is_cover: boolean; is_hidden: boolean; sort_order: number }> = {}) => ({
  photo_uri: uri, is_cover: false, is_hidden: false, sort_order: 0, attribution_name: null, ...over,
});

const withPhotos = (...photos: ReturnType<typeof photo>[]) => ({ places: { place_photos: photos } });
const gone = { places: null };
const unphotographed = { places: { place_photos: [] } };

describe('tripCover', () => {
  it('is the first stop\'s picture on an ordinary day', () => {
    expect(tripCover([withPhotos(photo('a')), withPhotos(photo('b'))])?.photo_uri).toBe('a');
  });

  // The distinction the whole function exists for. "First stop's picture"
  // and "first picture" differ exactly when it matters: an opening stop
  // that was unpublished after the trip was saved, or imported with no
  // photographs, would otherwise leave the card blank while every place
  // after it had one.
  it('falls through a stop that has no picture to give', () => {
    expect(tripCover([unphotographed, withPhotos(photo('b'))])?.photo_uri).toBe('b');
    expect(tripCover([gone, withPhotos(photo('b'))])?.photo_uri).toBe('b');
  });

  // Through `coverOf`, which is the reason this does not reach into
  // `place_photos` itself: a photo the desk pulled must not come back as
  // the face of a trip.
  it('will not use a picture the desk hid', () => {
    expect(tripCover([withPhotos(photo('hidden', { is_hidden: true })), withPhotos(photo('b'))])?.photo_uri)
      .toBe('b');
  });

  it('prefers the marked cover over the first one listed', () => {
    expect(tripCover([withPhotos(photo('a'), photo('b', { is_cover: true }))])?.photo_uri).toBe('b');
  });

  // No band at all, rather than a grey strip with a pin on it. A trip is
  // not a place: its identity is the title, the date and the stops, all
  // already on the card.
  it('has nothing to show for a trip whose stops have no pictures', () => {
    expect(tripCover([])).toBeUndefined();
    expect(tripCover([gone, gone])).toBeUndefined();
    expect(tripCover([unphotographed])).toBeUndefined();
  });
});
