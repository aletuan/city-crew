// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import type { Place } from '../lib/data';
import MapPlaceCard from './MapPlaceCard';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

const week = (v: string) =>
  ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d) => `${d}: ${v}`);

const place = (over: Partial<Place> = {}): Place => ({
  slug: 'cong', name_en: 'Cộng Cà Phê', name_vi: 'Cộng Cà Phê', name_ja: null,
  city_id: 'hanoi', category: 'cafes', categories: ['cafes'], is_featured: false,
  vibe_tags: [], lat: 21.0285, lng: 105.8542, rating: 4.6, rating_count: 1200,
  opening_hours: week('7:00 AM – 11:00 PM'),
  place_photos: [{ photo_uri: 'https://img/cong.jpg', is_cover: true, is_hidden: false, sort_order: 0 }],
  ...over,
} as unknown as Place);

const NOON = new Date('2026-09-19T05:00:00Z');       // 12:00 Hanoi — open, hours away from closing
const HALF_PAST_TEN = new Date('2026-09-19T15:30:00Z'); // 22:30 Hanoi — open, closes in 30 min

describe('MapPlaceCard', () => {
  it('shows the cover, the name, the rating and the distance', () => {
    render(<MapPlaceCard place={place()} distanceKm={0.8} now={NOON} onPress={() => {}} />);
    expect(screen.getByText('Cộng Cà Phê')).toBeTruthy();
    expect(screen.getByText(/4\.6/)).toBeTruthy();
    expect(screen.getByText(/0\.8 km/)).toBeTruthy();
    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://img/cong.jpg');
  });

  // The hours are news only when they are about to matter: a place that
  // shuts in half an hour says so; one open until late says nothing; one
  // that is shut says that, and when it opens. Same rule `PlaceCard` keeps.
  it('says "until 23:00" when the place closes within the hour', () => {
    render(<MapPlaceCard place={place()} distanceKm={null} now={HALF_PAST_TEN} onPress={() => {}} />);
    expect(screen.getByText(/until 23:00/)).toBeTruthy();
  });

  it('says nothing about hours while closing time is still far off', () => {
    render(<MapPlaceCard place={place()} distanceKm={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByText(/until/)).toBeNull();
  });

  it('says a shut place is closed', () => {
    render(<MapPlaceCard place={place({ opening_hours: week('Closed') })} distanceKm={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByText(/Closed/)).toBeTruthy();
  });

  // No fix, no figure: a distance we do not know is left out, not
  // written as 0.
  it('says nothing about distance when there is no origin', () => {
    render(<MapPlaceCard place={place()} distanceKm={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByText(/km/)).toBeNull();
  });

  it('opens the place when pressed', () => {
    const onPress = vi.fn();
    render(<MapPlaceCard place={place()} distanceKm={null} now={NOON} onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: /Cộng Cà Phê/ }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('hides the star when rating is null', () => {
    render(<MapPlaceCard place={place({ rating: null })} distanceKm={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByText(/★/)).toBeNull();
  });

  it('hides the image when there are no photos', () => {
    render(<MapPlaceCard place={place({ place_photos: [] })} distanceKm={null} now={NOON} onPress={() => {}} />);
    expect(document.querySelector('img')).toBeNull();
  });

  it('rounds distance to the nearest km when >= 10', () => {
    render(<MapPlaceCard place={place()} distanceKm={12.4} now={NOON} onPress={() => {}} />);
    expect(screen.getByText(/12 km/)).toBeTruthy();
  });
});
