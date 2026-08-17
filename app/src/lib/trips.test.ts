import { describe, expect, it } from 'vitest';
import { spendVnd, splitTrips } from './trips';

const trip = (day: string) => ({ day });

describe('splitTrips', () => {
  it('puts tomorrow ahead and yesterday behind', () => {
    const { upcoming, past } = splitTrips(
      [trip('2026-08-18'), trip('2026-08-16')], '2026-08-17',
    );
    expect(upcoming.map((t) => t.day)).toEqual(['2026-08-18']);
    expect(past.map((t) => t.day)).toEqual(['2026-08-16']);
  });

  // The one people only notice at 00:05, having planned the evening ahead:
  // today is not a memory yet.
  it('counts today as upcoming', () => {
    const { upcoming, past } = splitTrips([trip('2026-08-17')], '2026-08-17');
    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(0);
  });

  it('runs the upcoming half soonest first', () => {
    const { upcoming } = splitTrips(
      [trip('2026-09-01'), trip('2026-08-20'), trip('2026-08-25')], '2026-08-17',
    );
    expect(upcoming.map((t) => t.day)).toEqual(['2026-08-20', '2026-08-25', '2026-09-01']);
  });

  it('runs the past half most recent first', () => {
    const { past } = splitTrips(
      [trip('2026-01-01'), trip('2026-08-10'), trip('2026-05-05')], '2026-08-17',
    );
    expect(past.map((t) => t.day)).toEqual(['2026-08-10', '2026-05-05', '2026-01-01']);
  });

  it('has two empty halves for no trips at all', () => {
    expect(splitTrips([], '2026-08-17')).toEqual({ upcoming: [], past: [] });
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
