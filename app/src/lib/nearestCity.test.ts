// Tested here rather than beside the module, for the reason
// `ward.test.ts` gives: the module runs in a Deno Edge Function and the
// test runner lives in the app. The coordinates are the real ones from
// `public.cities` and from rows the 13–18 September audit examined.

import { describe, expect, it } from 'vitest';

import { distanceKm, MAX_CITY_KM, nearestCity } from '../../../supabase/functions/_shared/nearest-city';

const CITIES = [
  { id: 'dalat', center_lat: 11.9416, center_lng: 108.4383 },
  { id: 'danang', center_lat: 16.0544, center_lng: 108.2022 },
  { id: 'hanoi', center_lat: 21.0285, center_lng: 105.8542 },
  { id: 'hcmc', center_lat: 10.7769, center_lng: 106.7009 },
  { id: 'hue', center_lat: 16.4637, center_lng: 107.5909 },
];

describe('distanceKm', () => {
  it('measures a known pair — Saigon to Da Nang is about 610 km', () => {
    const km = distanceKm({ lat: 10.7769, lng: 106.7009 }, { lat: 16.0544, lng: 108.2022 });
    expect(km).toBeGreaterThan(600);
    expect(km).toBeLessThan(620);
  });

  it('is zero for a point against itself', () => {
    expect(distanceKm({ lat: 10.7769, lng: 106.7009 }, { lat: 10.7769, lng: 106.7009 })).toBe(0);
  });

  it('keeps its precision on two shops in the same street', () => {
    // ~110 m apart. The spherical law of cosines goes soft here; haversine
    // is the reason this is not a rounding artefact.
    const km = distanceKm({ lat: 10.7769, lng: 106.7009 }, { lat: 10.7779, lng: 106.7009 });
    expect(km).toBeGreaterThan(0.1);
    expect(km).toBeLessThan(0.12);
  });

  it('is symmetric', () => {
    const a = { lat: 21.0285, lng: 105.8542 };
    const b = { lat: 11.9416, lng: 108.4383 };
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 9);
  });
});

describe('nearestCity — the rows the audit had to correct by hand', () => {
  it('files a Đà Lạt café in Đà Lạt, not the Saigon the phone was showing', () => {
    // 1/2 Circle Coffee, Hẻm 4 Đặng Thái Thân, Xuân Hương — imported as hcmc.
    const near = nearestCity(CITIES, { lat: 11.924712, lng: 108.4534609 });
    expect(near?.id).toBe('dalat');
    expect(near!.km).toBeLessThan(5);
  });

  it('files a Đà Nẵng rooftop in Đà Nẵng', () => {
    // BlackOut Rooftop Bar, 90 Võ Nguyên Giáp — published in the Saigon feed.
    const near = nearestCity(CITIES, { lat: 16.0807577, lng: 108.246822 });
    expect(near?.id).toBe('danang');
  });

  it('puts Metro Manila past the cutoff, so the caller refuses it', () => {
    // Starbucks Pearl Plaza, Ortigas Center — the row that was deleted.
    const near = nearestCity(CITIES, { lat: 14.5837, lng: 121.0614 });
    expect(near!.km).toBeGreaterThan(MAX_CITY_KM);
    expect(near!.km).toBeGreaterThan(1000);
  });
});

describe('nearestCity — the far rows that are correct as they stand', () => {
  it('keeps Long Hải in Saigon, 70-odd km out and still nearest', () => {
    // 1991's Coffee & Beer. Bà Rịa–Vũng Tàu has been part of Hồ Chí Minh
    // City since the 2025 merger, so hcmc is the right answer.
    const near = nearestCity(CITIES, { lat: 10.3907967, lng: 107.2299278 });
    expect(near?.id).toBe('hcmc');
    expect(near!.km).toBeGreaterThan(50);
    expect(near!.km).toBeLessThan(MAX_CITY_KM);
  });

  it('keeps the farthest approved place in the catalog inside the cutoff', () => {
    // Delab Coffee Roastery, 81.6 km from Đà Lạt — reviewed and published.
    // If this ever fails, the cutoff has been set below something real.
    const near = nearestCity(CITIES, { lat: 11.5290359, lng: 107.818171 });
    expect(near?.id).toBe('dalat');
    expect(near!.km).toBeLessThan(MAX_CITY_KM);
  });
});

describe('nearestCity — the edges', () => {
  it('answers null when there are no cities, rather than guessing', () => {
    expect(nearestCity([], { lat: 10.7769, lng: 106.7009 })).toBeNull();
  });

  it('skips a city whose centre is not a number', () => {
    const broken = [
      { id: 'broken', center_lat: Number.NaN, center_lng: 106.7 },
      { id: 'hcmc', center_lat: 10.7769, center_lng: 106.7009 },
    ];
    expect(nearestCity(broken, { lat: 10.78, lng: 106.7 })?.id).toBe('hcmc');
  });

  it('answers null when every city centre is broken', () => {
    expect(nearestCity([{ id: 'x', center_lat: Number.NaN, center_lng: Number.NaN }],
      { lat: 10.78, lng: 106.7 })).toBeNull();
  });

  it('breaks a tie on the first city, which the caller orders', () => {
    const twins = [
      { id: 'first', center_lat: 10, center_lng: 106 },
      { id: 'second', center_lat: 10, center_lng: 106 },
    ];
    expect(nearestCity(twins, { lat: 11, lng: 106 })?.id).toBe('first');
  });
});
