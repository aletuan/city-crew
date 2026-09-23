// @vitest-environment jsdom
//
// The cards, read on the city's clock.
//
// One instant, two cities, two ribbons. The instant is the screenshot
// that found the bug: 16:56 on a Tuesday in Melbourne, outside Kumo
// Desserts, hours 3 PM to 10 PM, door open, and a card that said "Opens
// 15:00" because it had read the clock in Vietnam — the same instant is
// 13:56 in Hanoi. The pure reading is `lib/clock`'s and `lib/format`'s
// to prove; what is proved here is that the two cards ask on the
// place's city and not on the constant they used to share, which is the
// only thing about this a reader could see.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '../uitest/render';
import type { Place } from '../lib/data';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/save', () => ({
  useSave: () => ({ save: () => {}, isSaved: () => false }),
}));
// Two cities in the list, each with its zone — the shape `cities.tz`
// gives the app — and a third row hydrated before the column existed.
vi.mock('../lib/city', () => ({
  useCity: () => ({
    city: null,
    cities: [
      { id: 'melbourne', tz: 'Australia/Melbourne' },
      { id: 'hanoi', tz: 'Asia/Ho_Chi_Minh' },
      { id: 'hcmc' },
    ],
  }),
}));

import PlaceCard from './PlaceCard';
import MapPlaceCard from './MapPlaceCard';

// Kumo's week, as the desk has it: shut Mondays, 3 PM to 10 PM otherwise.
const KUMO_HOURS = [
  'Monday: Closed',
  ...['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => `${d}: 3:00 – 10:00 PM`),
];
const SCREENSHOT = new Date('2026-09-22T06:56:00Z');

const place = (city_id: string): Place => ({
  slug: `kumo-${city_id}`, city_id,
  name_en: 'Kumo Desserts', name_vi: 'Kumo Desserts', name_ja: null,
  category: 'cafes', categories: ['cafes'], vibe_tags: [], place_photos: [],
  is_published: true, review_status: 'approved',
  neighborhood_en: 'Carlton', opening_hours: KUMO_HOURS,
  lat: -37.8, lng: 144.96, rating: 4.7, rating_count: 300,
} as unknown as Place);

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(SCREENSHOT); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

describe('PlaceCard', () => {
  const text = (id: string) => screen.getByTestId(id).textContent ?? '';

  it('reads a Melbourne place on Melbourne’s clock: open, and nothing to say yet', () => {
    render(<PlaceCard testID="card" onPress={() => {}} place={place('melbourne')} />);
    expect(text('card')).not.toContain('Opens');
    expect(text('card')).not.toContain('Closed');
  });

  it('reads the same hours on Hanoi’s clock for a Hanoi place: shut, opens at three', () => {
    render(<PlaceCard testID="card" onPress={() => {}} place={place('hanoi')} />);
    expect(text('card')).toContain('Opens 15:00');
  });

  it('reads Vietnam for a city cached before it had a zone', () => {
    render(<PlaceCard testID="card" onPress={() => {}} place={place('hcmc')} />);
    expect(text('card')).toContain('Opens 15:00');
  });
});

describe('MapPlaceCard', () => {
  const card = (city_id: string) =>
    render(<MapPlaceCard place={place(city_id)} distanceKm={null} tint={null} now={SCREENSHOT} onPress={() => {}} />);

  it('reads a Melbourne place on Melbourne’s clock', () => {
    card('melbourne');
    expect(screen.queryByText(/Closed/)).toBeNull();
  });

  it('reads a Hanoi place on Hanoi’s clock', () => {
    card('hanoi');
    expect(screen.getByText(/Closed · opens 15:00/)).toBeTruthy();
  });
});
