// @vitest-environment jsdom
//
// A place as one square of the collection's grid. What is pinned: the
// cover and nothing else stands for the place, the name is on it in the
// reader's language and is what VoiceOver reads, a tap is the tile's, a
// place with no photograph keeps its square, the credit follows the
// same switch as the card's, and a place nobody else sees says so.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '../uitest/render';
import type { Place } from '../lib/data';

const state = vi.hoisted(() => ({ lang: 'en' as 'en' | 'vi' | 'ja' }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: state.lang, setLang: () => {}, t: (en: string) => en }),
}));

import PlaceTile from './PlaceTile';
import { appFlags } from '../lib/flags';
import { colors } from '../theme';

const place = (over: Partial<Place> = {}): Place => ({
  slug: 'pho-10',
  city_id: 'hanoi',
  name_en: 'Pho 10 – Ly Quoc Su',
  name_vi: 'Phở 10 – Lý Quốc Sư',
  name_ja: null,
  is_published: true,
  review_status: 'approved',
  place_photos: [],
  ...over,
} as unknown as Place);

const COVER = { photo_uri: 'http://x/cover.jpg', is_cover: true, is_hidden: false, sort_order: 9, attribution_name: 'Bởi Minh' };
const OTHER = { photo_uri: 'http://x/other.jpg', is_cover: false, is_hidden: false, sort_order: 0 };

beforeEach(() => {
  state.lang = 'en';
  appFlags.set('photo_attribution', true);
});

describe('PlaceTile', () => {
  it('shows the cover, and the name before its branch on it', () => {
    render(<PlaceTile place={place({ place_photos: [OTHER, COVER] } as Partial<Place>)} size={111} onPress={() => {}} />);
    expect(document.querySelector('img')?.getAttribute('src')).toBe('http://x/cover.jpg');
    expect(screen.getByText('Pho 10')).toBeTruthy();
    expect(screen.queryByText(/Ly Quoc Su/)).toBeNull();
  });

  it('names the place in the reader’s language, and that name is what VoiceOver reads', () => {
    state.lang = 'vi';
    render(<PlaceTile place={place()} size={111} onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Phở 10' })).toBeTruthy();
  });

  it('is the size it is given, square', () => {
    render(<PlaceTile place={place()} size={111} onPress={() => {}} testID="tile" />);
    const style = getComputedStyle(screen.getByTestId('tile'));
    expect([style.width, style.height]).toEqual(['111px', '111px']);
  });

  it('opens on a tap', () => {
    const onPress = vi.fn();
    render(<PlaceTile place={place()} size={111} onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pho 10' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // No picture is a normal tile, not a broken one: it keeps its square,
  // with the place's emoji, or a pin when it has none.
  it('stands the emoji in when there is no photo, and a pin when there is no emoji', () => {
    render(<PlaceTile place={place({ emoji: '🍜' } as Partial<Place>)} size={111} onPress={() => {}} />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('🍜')).toBeTruthy();
    render(<PlaceTile place={place({ slug: 'x' } as Partial<Place>)} size={111} onPress={() => {}} />);
    expect(screen.getByText('📍')).toBeTruthy();
  });

  it('credits the photograph as the card does', () => {
    render(<PlaceTile place={place({ place_photos: [COVER] } as Partial<Place>)} size={111} onPress={() => {}} />);
    expect(screen.getByText('Bởi Minh')).toBeTruthy();
  });

  it('draws no credit when the switch is off', () => {
    appFlags.set('photo_attribution', false);
    render(<PlaceTile place={place({ place_photos: [COVER] } as Partial<Place>)} size={111} onPress={() => {}} />);
    expect(screen.queryByText('Bởi Minh')).toBeNull();
  });

  // A list stays public around a place that is not live, and only its
  // owner sees that place (23 Oct 2026). The grid is the default view, so
  // the tile carries the card's pill: the word, in the look's colours.
  describe('a place nobody else sees', () => {
    const pill = () => screen.queryByTestId('tile-status');

    it('marks nothing on a live place', () => {
      render(<PlaceTile place={place()} size={111} onPress={() => {}} />);
      expect(pill()).toBeNull();
      expect(screen.getByRole('button', { name: 'Pho 10' })).toBeTruthy();
    });

    it('says Pending in the look’s amber while it waits, and VoiceOver hears it', () => {
      render(<PlaceTile place={place({ is_published: false, review_status: 'pending' })} size={111} onPress={() => {}} />);
      expect(pill()?.textContent).toBe('Pending');
      expect(pill()?.querySelector('[data-icon]')?.getAttribute('data-color')).toBe(colors.warnInk);
      expect(screen.getByRole('button', { name: 'Pho 10, Pending' })).toBeTruthy();
    });

    // Approved and still unpublished is not live either: the rule is the
    // pair, as the member policy's is.
    it('says Pending when approved but not yet published', () => {
      render(<PlaceTile place={place({ is_published: false, review_status: 'approved' })} size={111} onPress={() => {}} />);
      expect(pill()?.textContent).toBe('Pending');
    });

    it('says Declined in the look’s red once the desk has turned it down', () => {
      render(<PlaceTile place={place({ is_published: true, review_status: 'flagged' })} size={111} onPress={() => {}} />);
      expect(pill()?.textContent).toBe('Declined');
      expect(pill()?.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe('alert-circle');
      expect(screen.getByRole('button', { name: 'Pho 10, Declined' })).toBeTruthy();
    });

    // The pill takes the top edge, so the credit steps down over the name
    // rather than being cut to nothing beside it.
    it('moves the credit down beside the pill', () => {
      render(<PlaceTile place={place({ review_status: 'flagged', place_photos: [COVER] } as Partial<Place>)} size={111} onPress={() => {}} />);
      const credit = getComputedStyle(screen.getByText('Bởi Minh'));
      expect(credit.bottom).toBe('24px');
      render(<PlaceTile place={place({ slug: 'live', place_photos: [COVER] } as Partial<Place>)} size={111} onPress={() => {}} />);
      expect(getComputedStyle(screen.getAllByText('Bởi Minh')[1]).top).toBe('5px');
    });
  });
});
