// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert, Linking } from 'react-native';
import { act, fireEvent, render, screen } from '../uitest/render';
import type { Place } from '../lib/data';
import { CATEGORIES, categoryLabel } from '../lib/categories';
import { mapsRouteUrl } from '../lib/maps';
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
// The place's city, by names `lib/address` has never heard of, so the
// cut under test is the one the card's own city list makes.
vi.mock('../lib/city', () => ({
  useCityList: () => ({ cities: [
    { id: 'hanoi', tz: 'Asia/Ho_Chi_Minh', name_vi: 'Phố Núi', name_en: 'Hilltown', short_vi: null, short_en: null },
  ] }),
}));
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
    render(<MapPlaceCard place={place()} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByText('Cộng Cà Phê')).toBeTruthy();
    expect(screen.getByText(/4\.6/)).toBeTruthy();
    expect(screen.getByText(/800 m/)).toBeTruthy();
    expect(document.querySelector('img')?.getAttribute('src')).toBe('https://img/cong.jpg');
    // The spoken name carries the facts as words, and never the star glyph.
    // In the order the eye meets them: the kind, the hours, the distance,
    // the name, the street, the score — and never the star glyph.
    const btn = screen.getByRole('button', { name: 'Cafés, Open, until 23:00, 800 m, Cộng Cà Phê, rated 4.6 (1.2k)' });
    expect(btn.getAttribute('aria-label')).not.toMatch(/★/);
  });

  // The hours are news only when they are about to matter: a place that
  // shuts in half an hour says so; one open until late says nothing; one
  // that is shut says that, and when it opens. Same rule `PlaceCard` keeps.
  // The pin under this strip is the branch; the name line is the brand.
  // The chevron gave its place to the bookmark (owner, 23 Nov 2026): the
  // whole strip opens the place, so the arrow said nothing a press did not.
  it('ends with the bookmark, not a chevron, and saves through the collection picker', () => {
    render(<MapPlaceCard place={place()} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    expect(document.querySelector('[data-icon="chevron-forward"]')).toBeNull();
    const mark = document.querySelector('[data-icon="bookmark-outline"]')!;
    expect(mark.getAttribute('data-size')).toBe('18');
    expect(mark.getAttribute('data-color')).toBe(colors.text);
    fireEvent.click(screen.getByRole('button', { name: 'Save to a collection' }));
    expect(save.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ slug: 'cong' }));
  });

  it('fills the bookmark in coral once the place is kept, and says so', () => {
    save.saved = true;
    render(<MapPlaceCard place={place()} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    const mark = document.querySelector('[data-icon="bookmark"]')!;
    expect(mark.getAttribute('data-color')).toBe(colors.accent);
    expect(screen.getByRole('button', { name: 'Saved — change collections' })).toBeTruthy();
  });

  it('saving does not open the place', () => {
    const onPress = vi.fn();
    render(<MapPlaceCard place={place()} distanceKm={0.8} kind={null} now={NOON} onPress={onPress} />);
    fireEvent.click(screen.getByTestId('map-card-save'));
    expect(onPress).not.toHaveBeenCalled();
  });

  // The count of check-ins, never a control: the act stays on the detail
  // screen, where the cap, the undo and the reward live.
  it('says how often the reader has checked in here, and nothing before the first', () => {
    visits.data = been(2, 'elsewhere');
    const { rerender } = render(<MapPlaceCard place={place()} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByTestId('place-visited')).toBeNull();
    visits.data = [...been(2, 'elsewhere'), ...been(1)];
    rerender(<MapPlaceCard place={place({ rating: 4.6 })} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    // A tick after the hours for the eye; the count for the ear.
    expect(screen.getByTestId('place-visited')).toBeTruthy();
    expect(screen.getByRole('button', { name: /, Checked in once$/ })).toBeTruthy();
    visits.data = been(3);
    rerender(<MapPlaceCard place={place({ rating: 4.7 })} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByRole('button', { name: /rated 4\.7 \(1\.2k\), Checked in 3 times$/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /check in$/i })).toBeNull();
  });

  it('counts nothing while check-in is switched off', () => {
    visits.on = false;
    visits.data = been(3);
    render(<MapPlaceCard place={place()} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByTestId('place-visited')).toBeNull();
  });

  // The street a local would say, under the name: no city, postal code
  // or country (owner, 23 Nov 2026).
  it('prints and speaks the short address under the name', () => {
    render(<MapPlaceCard place={place({ address: '5 Nguyễn Quang Bích, Hoàn Kiếm, Hà Nội 100000, Việt Nam' } as Partial<Place>)} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByTestId('place-address').textContent).toBe('5 Nguyễn Quang Bích, Hoàn Kiếm');
    expect(screen.getByRole('button', { name: /, Cộng Cà Phê, 5 Nguyễn Quang Bích, Hoàn Kiếm, rated/ })).toBeTruthy();
  });

  it('cuts the city by the names the catalog knows it by, and keeps a city it has not', () => {
    const { rerender } = render(<MapPlaceCard place={place({ address: '1 Đường Ga, Phường 2, Phố Núi' } as Partial<Place>)} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByTestId('place-address').textContent).toBe('1 Đường Ga, Phường 2');
    rerender(<MapPlaceCard place={place({ city_id: 'nowhere', address: '1 Đường Ga, Phố Núi' } as Partial<Place>)} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByTestId('place-address').textContent).toBe('1 Đường Ga, Phố Núi');
  });

  it('falls back to the ward, and to nothing', () => {
    const { rerender } = render(<MapPlaceCard place={place({ address: null, neighborhood_en: 'Old Quarter', neighborhood_vi: 'Phố Cổ' } as Partial<Place>)} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByTestId('place-address').textContent).toBe('Old Quarter');
    rerender(<MapPlaceCard place={place({ address: null, neighborhood_en: null } as Partial<Place>)} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByTestId('place-address')).toBeNull();
  });

  // One line of name, now that the layout has four.
  it('gives the name one line, and the score its own coral star', () => {
    render(<MapPlaceCard place={place()} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    const name = screen.getByText('Cộng Cà Phê');
    expect(getComputedStyle(name).whiteSpace).toBe('nowrap');
    expect(getComputedStyle(screen.getByTestId('place-star')).color).toBe(hex(colors.accent as string));
  });

  it('shows and speaks the brand alone, without the branch after the dash', () => {
    render(<MapPlaceCard place={place({ name_en: 'Every Half Coffee Roasters – Đồng Khởi' })} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByText('Every Half Coffee Roasters')).toBeTruthy();
    expect(screen.queryByText(/Đồng Khởi/)).toBeNull();
    expect(screen.getByRole('button', { name: /Every Half/ }).getAttribute('aria-label')).toMatch(/, Every Half Coffee Roasters, /);
  });

  // Always, and first, in a pill of its state's colour (owner, 23 Nov
  // 2026) — unlike the list's cards, which keep quiet about an open place
  // until it is about to close.
  const hours = () => screen.getByTestId('place-hours').textContent;
  const tone = () => {
    const st = getComputedStyle(screen.getByTestId('place-hours'));
    return [st.backgroundColor, st.color];
  };

  it('says an open place is open, and until when, in green', () => {
    render(<MapPlaceCard place={place()} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    expect(hours()).toBe('Open · until 23:00');
    expect(tone()).toEqual([hex(colors.okSoft as string), hex(colors.okInk as string)]);
  });

  it('says a place about to close is closing soon, in amber', () => {
    render(<MapPlaceCard place={place()} distanceKm={null} kind={null} now={HALF_PAST_TEN} onPress={() => {}} />);
    expect(hours()).toBe('Closing soon · until 23:00');
    expect(tone()).toEqual([hex(colors.warnSoft as string), hex(colors.warnInk as string)]);
  });

  it('says a place open around the clock is open all day', () => {
    render(<MapPlaceCard place={place({ opening_hours: week('Open 24 hours') })} distanceKm={null} kind={null} now={NOON} onPress={() => {}} />);
    expect(hours()).toBe('Open · 24 hours');
  });

  it('says a shut place is closed, and when it opens, in red', () => {
    render(<MapPlaceCard place={place({ opening_hours: week('10:00 AM – 9:00 PM') })} distanceKm={null} kind={null} now={new Date('2026-09-19T01:00:00Z')} onPress={() => {}} />);
    expect(hours()).toBe('Closed · opens 10:00');
    expect(tone()).toEqual([hex(colors.badSoft as string), hex(colors.bad as string)]);
  });

  it('says closed alone when nothing opens within the day, and the word is all a listener hears', () => {
    render(<MapPlaceCard place={place({ opening_hours: week('Closed') })} distanceKm={0.8} kind={null} now={NOON} onPress={() => {}} />);
    expect(hours()).toBe('Closed');
    expect(screen.getByRole('button', { name: /^Cafés, Closed, 800 m, / })).toBeTruthy();
  });

  it('says nothing about hours it cannot read', () => {
    render(<MapPlaceCard place={place({ opening_hours: null })} distanceKm={null} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByTestId('place-hours')).toBeNull();
  });

  // No fix, no figure: a distance we do not know is left out, not
  // written as 0.
  it('says nothing about distance when there is no origin', () => {
    render(<MapPlaceCard place={place()} distanceKm={null} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByText(/km/)).toBeNull();
  });

  it('opens the place when pressed', () => {
    const onPress = vi.fn();
    render(<MapPlaceCard place={place()} distanceKm={null} kind={null} now={NOON} onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: /Cộng Cà Phê/ }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('hides the star when rating is null', () => {
    render(<MapPlaceCard place={place({ rating: null })} distanceKm={null} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByText(/★/)).toBeNull();
  });

  it('hides the image when there are no photos', () => {
    render(<MapPlaceCard place={place({ place_photos: [] })} distanceKm={null} kind={null} now={NOON} onPress={() => {}} />);
    expect(document.querySelector('img')).toBeNull();
  });

  // The list's card and this strip name the same place, so they say the
  // same figure: `fmtDistance` for both, metres under a kilometre.
  it('rounds distance to the nearest km when >= 10', () => {
    render(<MapPlaceCard place={place()} distanceKm={12.4} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.getByText(/12 km/)).toBeTruthy();
  });

  // The kind on the photograph, in its pin's colour and by the pin's own
  // rule: the chip it answers to, else its own, else none.
  it('labels the photograph with the kind its pin is wearing, in that colour', () => {
    const kind = () => screen.getByTestId('place-kind');
    const { rerender } = render(<MapPlaceCard place={place({ categories: ['cafes', 'focus'] } as Partial<Place>)} distanceKm={null} kind="focus" now={NOON} onPress={() => {}} />);
    expect(kind().textContent).toBe(categoryLabel('focus', (en) => en));
    expect(getComputedStyle(kind()).backgroundColor).toBe(hex(CATEGORIES.focus.color));
    rerender(<MapPlaceCard place={place({ categories: ['cafes', 'focus'] } as Partial<Place>)} distanceKm={null} kind={null} now={NOON} onPress={() => {}} />);
    expect(kind().textContent).toBe('Cafés');
    rerender(<MapPlaceCard place={place({ categories: [], category: null } as unknown as Partial<Place>)} distanceKm={null} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByTestId('place-kind')).toBeNull();
  });

  // The detail screen's Directions: a route from wherever the reader is,
  // opened in Maps — and said aloud when nothing opens it.
  it('opens a route to the place, and says so when Maps will not open', async () => {
    const open = vi.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('no'));
    const alert = vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onPress = vi.fn();
    render(<MapPlaceCard place={place()} distanceKm={null} kind={null} now={NOON} onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: 'Directions' }));
    expect(open).toHaveBeenLastCalledWith(mapsRouteUrl([place()], 'driving')!.url);
    expect(onPress).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Directions' })); });
    expect(alert).toHaveBeenCalledWith('Could not open Maps');
    open.mockRestore();
    alert.mockRestore();
  });

  it('offers no route to a place it cannot place', () => {
    render(<MapPlaceCard place={place({ lat: null, lng: null })} distanceKm={null} kind={null} now={NOON} onPress={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Directions' })).toBeNull();
  });
});
