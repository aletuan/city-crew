import { describe, expect, it } from 'vitest';
import { distanceKm, fmtDistance, nearestTo } from './geo';

// The three the app ships with, at the coordinates the cities table
// holds. Using the real numbers is the point: a formula that passes on
// toy inputs and picks the wrong city in Hanoi has passed nothing.
const SAIGON = { id: 'hcmc', center_lat: 10.7769, center_lng: 106.7009 };
const HANOI = { id: 'hanoi', center_lat: 21.0285, center_lng: 105.8542 };
const DANANG = { id: 'danang', center_lat: 16.0544, center_lng: 108.2022 };
const ALL = [SAIGON, HANOI, DANANG];

describe('distanceKm', () => {
  it('measures the length of the country', () => {
    // ~1144 km great circle. Loose to a kilometre: the tolerance is for
    // floating point, not for the formula being approximately right.
    expect(distanceKm(21.0285, 105.8542, 10.7769, 106.7009)).toBeCloseTo(1143.5, 0);
  });

  it('puts Da Nang between the two, and nearly in the middle', () => {
    const toSaigon = distanceKm(16.0544, 108.2022, 10.7769, 106.7009);
    const toHanoi = distanceKm(16.0544, 108.2022, 21.0285, 105.8542);
    expect(toSaigon).toBeCloseTo(608.9, 0);
    expect(toHanoi).toBeCloseTo(605.9, 0);
  });

  it('is nothing from a place to itself', () => {
    expect(distanceKm(21.0285, 105.8542, 21.0285, 105.8542)).toBe(0);
  });

  it('does not care which way round you ask', () => {
    expect(distanceKm(21.0285, 105.8542, 10.7769, 106.7009))
      .toBeCloseTo(distanceKm(10.7769, 106.7009, 21.0285, 105.8542), 9);
  });

  // A degree of latitude is a degree of latitude anywhere; a degree of
  // longitude shrinks towards the poles. A formula that treated the two
  // alike would pass every test above and fail this one.
  it('narrows a degree of longitude away from the equator', () => {
    const atEquator = distanceKm(0, 0, 0, 1);
    const atHanoi = distanceKm(21, 0, 21, 1);
    expect(atEquator).toBeCloseTo(111.2, 0);
    expect(atHanoi).toBeLessThan(atEquator);
    expect(atHanoi).toBeCloseTo(atEquator * Math.cos(21 * Math.PI / 180), 0);
  });

  it('handles opposite sides of the planet', () => {
    // Half the circumference, near enough.
    expect(distanceKm(0, 0, 0, 180)).toBeCloseTo(Math.PI * 6371, 0);
  });
});

describe('nearestTo', () => {
  // The failure this exists to catch: standing in one city and being
  // shown another. Nothing errors when it goes wrong.
  it('picks the city you are standing in', () => {
    expect(nearestTo(ALL, 21.03, 105.85)?.id).toBe('hanoi');
    expect(nearestTo(ALL, 10.78, 106.70)?.id).toBe('hcmc');
    expect(nearestTo(ALL, 16.05, 108.20)?.id).toBe('danang');
  });

  it('picks the nearest from somewhere between', () => {
    // Hue, about 100 km north of Da Nang and 600 from either end.
    expect(nearestTo(ALL, 16.4637, 107.5909)?.id).toBe('danang');
  });

  it('still answers from the other side of the world', () => {
    // London. Hanoi is the northernmost, and the closest of the three.
    expect(nearestTo(ALL, 51.5072, -0.1276)?.id).toBe('hanoi');
  });

  it('has nothing to offer from an empty list', () => {
    expect(nearestTo([], 21.03, 105.85)).toBeNull();
  });

  it('returns the only candidate there is', () => {
    expect(nearestTo([SAIGON], 51.5072, -0.1276)?.id).toBe('hcmc');
  });

  // Strictly less-than, so the answer depends on the order of the list
  // rather than on which way the floating point fell.
  it('gives a tie to the earlier entry', () => {
    const a = { id: 'a', center_lat: 10, center_lng: 10 };
    const b = { id: 'b', center_lat: 10, center_lng: 10 };
    expect(nearestTo([a, b], 0, 0)?.id).toBe('a');
    expect(nearestTo([b, a], 0, 0)?.id).toBe('b');
  });
});

describe('fmtDistance', () => {
  it('uses metres while you could walk it', () => {
    expect(fmtDistance(0.4)).toBe('400 m');
    expect(fmtDistance(0.85)).toBe('850 m');
  });

  // A search result's coordinate is a pin on a building, not a doorway.
  // "847 m" claims a precision neither the data nor the reader has.
  it('rounds metres to the nearest fifty', () => {
    expect(fmtDistance(0.847)).toBe('850 m');
    expect(fmtDistance(0.822)).toBe('800 m');
  });

  // Never "0 m" — a place is somewhere even when the arithmetic rounds
  // to nothing, and a zero reads as a missing value rather than a near one.
  it('never rounds all the way down to nothing', () => {
    expect(fmtDistance(0.004)).toBe('50 m');
    expect(fmtDistance(0)).toBe('50 m');
  });

  it('keeps one decimal in the range you would ride', () => {
    expect(fmtDistance(1.24)).toBe('1.2 km');
    expect(fmtDistance(9.96)).toBe('10 km');
  });

  it('drops the decimal once it has stopped meaning anything', () => {
    expect(fmtDistance(12.4)).toBe('12 km');
    expect(fmtDistance(140.6)).toBe('141 km');
  });

  // The three "So Coffee" results this was written for. What matters is
  // not any single figure but that the three read as clearly different.
  it('separates three shops of the same name', () => {
    const shown = [1.24, 4.51, 2.08].map(fmtDistance);
    expect(shown).toEqual(['1.2 km', '4.5 km', '2.1 km']);
    expect(new Set(shown).size).toBe(3);
  });

  it('says nothing rather than something wrong', () => {
    expect(fmtDistance(NaN)).toBe('');
    expect(fmtDistance(-1)).toBe('');
  });
});
