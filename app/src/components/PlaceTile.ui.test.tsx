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
import { colors, onPhoto } from '../theme';

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
  // the tile has to say what the card's status line says.
  describe('a place nobody else sees', () => {
    const icon = () => screen.queryByTestId('tile-status')?.querySelector('[data-icon]');

    it('marks nothing on a live place', () => {
      render(<PlaceTile place={place()} size={111} onPress={() => {}} />);
      expect(screen.queryByTestId('tile-status')).toBeNull();
      expect(screen.getByRole('button', { name: 'Pho 10' })).toBeTruthy();
    });

    it('wears the clock while it waits, and VoiceOver says only you can see it', () => {
      render(<PlaceTile place={place({ is_published: false, review_status: 'pending' })} size={111} onPress={() => {}} />);
      expect(icon()?.getAttribute('data-icon')).toBe('time-outline');
      expect(icon()?.getAttribute('data-color')).toBe(onPhoto.text);
      expect(screen.getByRole('button', { name: 'Pho 10, Only you can see this' })).toBeTruthy();
    });

    // Approved and still unpublished is not live either: the rule is the
    // pair, as the member policy's is.
    it('wears the clock when approved but not yet published', () => {
      render(<PlaceTile place={place({ is_published: false, review_status: 'approved' })} size={111} onPress={() => {}} />);
      expect(icon()?.getAttribute('data-icon')).toBe('time-outline');
    });

    it('wears the red cross once the desk has turned it down', () => {
      render(<PlaceTile place={place({ is_published: true, review_status: 'flagged' })} size={111} onPress={() => {}} />);
      expect(icon()?.getAttribute('data-icon')).toBe('close-circle-outline');
      expect(icon()?.getAttribute('data-color')).toBe(colors.bad);
      expect(screen.getByRole('button', { name: 'Pho 10, Not accepted' })).toBeTruthy();
    });
  });
});
