// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import type { Place } from '../lib/data';
import MapPlaceCard from './MapPlaceCard';
import { colors } from '../theme';

const save = vi.hoisted(() => ({ save: vi.fn(), saved: false }));
vi.mock('../lib/save', () => ({
  useSaveActions: () => ({ save: save.save }),
  useIsSaved: () => save.saved,
}));
const visits = vi.hoisted(() => ({ on: true, data: [] as { place_slug: string }[] }));
vi.mock('../lib/useFlag', () => ({ useFlag: (name: string) => name === 'place_checkin' && visits.on }));
vi.mock('../lib/checkins', () => ({ useMyCheckins: () => ({ data: visits.data }) }));
const been = (n: number, slug = 'cong') => Array.from({ length: n }, () => ({ place_slug: slug }));
const hex = (c: string) => {
  const n = c.replace('#', '');
  return `rgb(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)})`;
};

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
  beforeEach(() => { save.save.mockReset(); save.saved = false; visits.on = true; visits.data = []; });
  it('shows the cover, the name, the rating and the distance', () => {
    render(<MapPlaceCard place={place()} distanceKm={0.8} tint={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByText('Cộng Cà Phê')).toBeTruthy();
    expect(screen.getByText(/4\.6/)).toBeTruthy();
    expect(screen.getByText(/800 m/)).toBeTruthy();
    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://img/cong.jpg');
    // The spoken name carries the facts as words, and never the star glyph.
    const btn = screen.getByRole('button', { name: /rated 4\.6 \(1\.2k\), 800 m/ });
    expect(btn.getAttribute('aria-label')).not.toMatch(/★/);
  });

  // The hours are news only when they are about to matter: a place that
  // shuts in half an hour says so; one open until late says nothing; one
  // that is shut says that, and when it opens. Same rule `PlaceCard` keeps.
  // The pin under this strip is the branch; the name line is the brand.
  // The chevron gave its place to the bookmark (owner, 23 Nov 2026): the
  // whole strip opens the place, so the arrow said nothing a press did not.
  it('ends with the bookmark, not a chevron, and saves through the collection picker', () => {
    render(<MapPlaceCard place={place()} distanceKm={0.8} tint={null} now={NOON} onPress={() => {}} />);
    expect(document.querySelector('[data-icon="chevron-forward"]')).toBeNull();
    const mark = document.querySelector('[data-icon="bookmark-outline"]')!;
    expect(mark.getAttribute('data-size')).toBe('18');
    expect(mark.getAttribute('data-color')).toBe(colors.text);
    fireEvent.click(screen.getByRole('button', { name: 'Save to a collection' }));
    expect(save.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: 'cong' }));
  });

  it('fills the bookmark in coral once the place is kept, and says so', () => {
    save.saved = true;
    render(<MapPlaceCard place={place()} distanceKm={0.8} tint={null} now={NOON} onPress={() => {}} />);
    const mark = document.querySelector('[data-icon="bookmark"]')!;
    expect(mark.getAttribute('data-color')).toBe(colors.accent);
    expect(screen.getByRole('button', { name: 'Saved — change collections' })).toBeTruthy();
  });

  it('saving does not open the place', () => {
    const onPress = vi.fn();
    render(<MapPlaceCard place={place()} distanceKm={0.8} tint={null} now={NOON} onPress={onPress} />);
    fireEvent.click(screen.getByTestId('map-card-save'));
    expect(onPress).not.toHaveBeenCalled();
  });

  // The count of check-ins, never a control: the act stays on the detail
  // screen, where the cap, the undo and the reward live.
  it('says how often the reader has checked in here, and nothing before the first', () => {
    visits.data = been(2, 'elsewhere');
    const { rerender } = render(<MapPlaceCard place={place()} distanceKm={0.8} tint={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByTestId('place-visited')).toBeNull();
    visits.data = [...been(2, 'elsewhere'), ...been(1)];
    rerender(<MapPlaceCard place={place({ rating: 4.6 })} distanceKm={0.8} tint={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByText('Checked in once')).toBeTruthy();
    visits.data = been(3);
    rerender(<MapPlaceCard place={place({ rating: 4.7 })} distanceKm={0.8} tint={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByText('Checked in 3 times')).toBeTruthy();
    expect(screen.getByRole('button', { name: /800 m, Checked in 3 times$/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /check in$/i })).toBeNull();
  });

  it('counts nothing while check-in is switched off', () => {
    visits.on = false;
    visits.data = been(3);
    render(<MapPlaceCard place={place()} distanceKm={0.8} tint={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByTestId('place-visited')).toBeNull();
  });

  // A long name wraps to a second line instead of losing its second half.
  it('gives the name two lines, and the score its own coral star', () => {
    render(<MapPlaceCard place={place()} distanceKm={0.8} tint={null} now={NOON} onPress={() => {}} />);
    const name = screen.getByText('Cộng Cà Phê');
    expect((name.style as unknown as { WebkitLineClamp: string }).WebkitLineClamp).toBe('2');
    expect(getComputedStyle(screen.getByTestId('place-star')).color).toBe(hex(colors.accent as string));
  });

  it('shows and speaks the brand alone, without the branch after the dash', () => {
    render(<MapPlaceCard place={place({ name_en: 'Every Half Coffee Roasters – Đồng Khởi' })} distanceKm={0.8} tint={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByText('Every Half Coffee Roasters')).toBeTruthy();
    expect(screen.queryByText(/Đồng Khởi/)).toBeNull();
    expect(screen.getByRole('button', { name: /Every Half/ }).getAttribute('aria-label')).toMatch(/^Every Half Coffee Roasters, /);
  });

  it('says "until 23:00" when the place closes within the hour', () => {
    render(<MapPlaceCard place={place()} distanceKm={null} tint={null} now={HALF_PAST_TEN} onPress={() => {}} />);
    expect(screen.getByText(/until 23:00/)).toBeTruthy();
  });

  it('says nothing about hours while closing time is still far off', () => {
    render(<MapPlaceCard place={place()} distanceKm={null} tint={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByText(/until/)).toBeNull();
  });

  it('says a shut place is closed', () => {
    render(<MapPlaceCard place={place({ opening_hours: week('Closed') })} distanceKm={null} tint={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByText(/Closed/)).toBeTruthy();
  });

  // No fix, no figure: a distance we do not know is left out, not
  // written as 0.
  it('says nothing about distance when there is no origin', () => {
    render(<MapPlaceCard place={place()} distanceKm={null} tint={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByText(/km/)).toBeNull();
  });

  it('opens the place when pressed', () => {
    const onPress = vi.fn();
    render(<MapPlaceCard place={place()} distanceKm={null} tint={null} now={NOON} onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: /Cộng Cà Phê/ }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('hides the star when rating is null', () => {
    render(<MapPlaceCard place={place({ rating: null })} distanceKm={null} tint={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByText(/★/)).toBeNull();
  });

  it('hides the image when there are no photos', () => {
    render(<MapPlaceCard place={place({ place_photos: [] })} distanceKm={null} tint={null} now={NOON} onPress={() => {}} />);
    expect(document.querySelector('img')).toBeNull();
  });

  // The list's card and this strip name the same place, so they say the
  // same figure: `fmtDistance` for both, metres under a kilometre.
  it('rounds distance to the nearest km when >= 10', () => {
    render(<MapPlaceCard place={place()} distanceKm={12.4} tint={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByText(/12 km/)).toBeTruthy();
  });

  // The coral pin says "this one"; the mark says which of them it was.
  it('repeats the colour its pin is wearing, and shows none when the pin has none', () => {
    const { rerender } = render(<MapPlaceCard place={place()} distanceKm={null} tint="#D2A679" now={NOON} onPress={() => {}} />);
    expect(screen.getByTestId('place-tint')).toBeTruthy();
    rerender(<MapPlaceCard place={place()} distanceKm={null} tint={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByTestId('place-tint')).toBeNull();
  });
});
