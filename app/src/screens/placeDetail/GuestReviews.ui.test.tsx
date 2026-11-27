// @vitest-environment jsdom
//
// "Đánh giá từ khách" on a place's page: the count, each review as it is
// drawn, the heart and its undoing, a guest's name and a photo as
// presses — and nothing at all where there is nothing.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '../../uitest/render';

const data = vi.hoisted(() => ({
  reviews: null as unknown,
  fetchGuestReviews: vi.fn(),
  likeCheckin: vi.fn(async (_id: string, _on: boolean) => {}),
  signCheckinPhotos: vi.fn(async (paths: readonly string[]): Promise<Record<string, string>> =>
    Object.fromEntries(paths.filter((p) => !p.includes('unsigned')).map((p) => [p, `https://signed/${p}`]))),
}));
vi.mock('../../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchGuestReviews: async (slug: string) => { data.fetchGuestReviews(slug); return data.reviews; },
  likeCheckin: data.likeCheckin,
  signCheckinPhotos: data.signCheckinPhotos,
}));
// The reader's own visits, as the provider holds them.
const mine = vi.hoisted(() => ({ loaded: true, data: [] as unknown[] }));
vi.mock('../../lib/checkins', () => ({ useMyCheckins: () => mine }));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ lang: 'en', t: (en: string) => en }) }));
// A phone's window, for the viewer's pages: jsdom's is 0×0.
const PHONE = vi.hoisted(() => ({ width: 393, height: 852, scale: 3, fontScale: 1 }));
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useWindowDimensions: () => PHONE,
}));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

import { forgetSignedPhotos } from '../../components/useSignedPhotos';
import { GuestReviews } from './GuestReviews';

const ph = (id: string, owner = 'lan') => ({ id, path: `${owner}/k1/${id}.jpg`, width: 1200, height: 900 });
const review = (over: Record<string, unknown> = {}) => ({
  id: 'k1', user_id: 'u2', handle: 'lan', full_name: 'Lan Pham', avatar_url: null,
  day: '2026-11-24', note: 'Omurice, soft.', photos: [ph('p1'), ph('p2')], likes: 2, liked: false, ...over,
});
const onPerson = vi.fn();
const settle = () => act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
const show = async () => {
  const page = render(<GuestReviews slug="omu" onPerson={onPerson} />);
  await settle();
  return page;
};
const visit = (id: string, over: Record<string, unknown> = {}) => ({
  id, place_slug: 'omu', city_id: 'hanoi', at: '2026-11-26T05:00:00Z', note: null, audience: 'public', photos: [], ...over,
});

beforeEach(() => {
  mine.loaded = true;
  mine.data = [];
  data.reviews = null;
  data.fetchGuestReviews.mockClear();
  data.likeCheckin.mockReset().mockResolvedValue(undefined);
  onPerson.mockClear();
  forgetSignedPhotos();
});
afterEach(cleanup);

describe('GuestReviews', () => {
  it('asks for this place, and draws nothing for one nobody has checked in at, or one the server does not show', async () => {
    await show();
    expect(data.fetchGuestReviews).toHaveBeenCalledWith('omu');
    expect(screen.queryByTestId('guest-reviews')).toBeNull();
    cleanup();
    data.reviews = { count: 0, visits: [] };
    await show();
    expect(screen.queryByTestId('guest-reviews')).toBeNull();
  });

  it('says how many check-ins there were, one and many, and nothing more when there are no reviews', async () => {
    data.reviews = { count: 1, visits: [] };
    await show();
    expect(screen.getByText('Guest reviews')).toBeTruthy();
    expect(screen.getByTestId('guest-reviews-count').textContent).toBe('1 check-in');
    expect(screen.queryByTestId('guest-review')).toBeNull();
    cleanup();
    data.reviews = { count: 12, visits: [] };
    await show();
    expect(screen.getByTestId('guest-reviews-count').textContent).toBe('12 check-ins');
  });

  it('draws a review: who, the day, the note in full, its photos and its heart', async () => {
    data.reviews = { count: 3, visits: [review(), review({ id: 'k2', full_name: '', handle: 'minh', photos: [ph('p9', 'minh')] })] };
    // The day in words, as a person's page says it: two days before now.
    vi.useFakeTimers({ toFake: ['Date'] });
    // Noon UTC: the 26th in Hanoi and in New York alike (`test:tz`).
    vi.setSystemTime(new Date('2026-11-26T12:00:00Z'));
    try {
      await show();
    } finally {
      vi.useRealTimers();
    }
    const [a, b] = screen.getAllByTestId('guest-review');
    expect(within(a).getByTestId('guest-review-person').textContent).toBe('Lan Pham');
    expect(within(b).getByTestId('guest-review-person').textContent).toBe('@minh');
    expect(within(a).getByTestId('guest-review-day').textContent).toBe('2 days ago');
    expect(within(a).getByTestId('guest-review-note').textContent).toBe('Omurice, soft.');
    await waitFor(() => expect(a.querySelectorAll('img').length).toBe(2));
    expect(a.querySelector('img[src="https://signed/lan/k1/p1.jpg"]')).not.toBeNull();
    expect(within(a).getByTestId('guest-review-likes').textContent).toBe('2');
  });

  it('hearts a review at once, and takes the heart back when the server refuses', async () => {
    data.reviews = { count: 1, visits: [review()] };
    await show();
    fireEvent.click(screen.getByTestId('guest-review-heart'));
    expect(data.likeCheckin).toHaveBeenCalledWith('k1', true);
    expect(screen.getByTestId('guest-review-likes').textContent).toBe('3');
    data.likeCheckin.mockRejectedValueOnce(new Error('checkin:unseen'));
    fireEvent.click(screen.getByTestId('guest-review-heart'));
    expect(data.likeCheckin).toHaveBeenLastCalledWith('k1', false);
    await waitFor(() => expect(screen.getByTestId('guest-review-likes').textContent).toBe('3'));
  });

  it('opens the guest’s page from their name', async () => {
    data.reviews = { count: 1, visits: [review()] };
    await show();
    fireEvent.click(screen.getByTestId('guest-review-person'));
    expect(onPerson).toHaveBeenCalledWith('lan');
  });

  it('draws the name as words, not a press, where there is no page to open', async () => {
    data.reviews = { count: 1, visits: [review()] };
    render(<GuestReviews slug="omu" />);
    await act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
    const name = screen.getByTestId('guest-review-person');
    expect(name.getAttribute('role')).not.toBe('button');
    fireEvent.click(name);
    expect(onPerson).not.toHaveBeenCalled();
  });

  it('opens a photo in the viewer at the one pressed, and closes it', async () => {
    data.reviews = { count: 1, visits: [review()] };
    await show();
    await waitFor(() => expect(screen.getAllByTestId('guest-review-photo')[1].querySelector('img')).not.toBeNull());
    fireEvent.click(screen.getAllByTestId('guest-review-photo')[1]);
    const viewer = await screen.findByTestId('photo-viewer');
    expect(viewer.querySelector('img[src="https://signed/lan/k1/p2.jpg"]')).not.toBeNull();
    expect(screen.getByTestId('photo-viewer-count').textContent).toBe('2/2');
    // A swipe back to the first, which the count follows.
    const pager = screen.getByTestId('photo-viewer-pager');
    Object.defineProperty(pager, 'scrollLeft', { value: 0, configurable: true });
    fireEvent.scroll(pager);
    await waitFor(() => expect(screen.getByTestId('photo-viewer-count').textContent).toBe('1/2'));
    fireEvent.click(screen.getByTestId('photo-viewer-close'));
    await waitFor(() => expect(screen.queryByTestId('photo-viewer')).toBeNull());
  });

  it('draws a photo with no link yet as a tint that does not press', async () => {
    data.reviews = { count: 1, visits: [review({ photos: [ph('unsigned')] })] };
    await show();
    const tile = screen.getByTestId('guest-review-photo');
    expect(tile.querySelector('img')).toBeNull();
    fireEvent.click(tile);
    expect(screen.queryByTestId('photo-viewer')).toBeNull();
  });

  // Two, then the rest (owner, 27 Nov 2026).
  it('draws the two newest, and the rest only after "Show more"', async () => {
    data.reviews = {
      count: 5,
      visits: ['a', 'b', 'c', 'd'].map((id) => review({ id, handle: id, note: `Note ${id}.`, photos: [] })),
    };
    await show();
    expect(screen.getAllByTestId('guest-review').map((el) => within(el).getByTestId('guest-review-note').textContent))
      .toEqual(['Note a.', 'Note b.']);
    fireEvent.click(screen.getByTestId('guest-reviews-more'));
    expect(screen.getAllByTestId('guest-review')).toHaveLength(4);
    expect(screen.queryByTestId('guest-reviews-more')).toBeNull();
  });

  it('offers no "Show more" for two reviews or fewer', async () => {
    data.reviews = { count: 2, visits: [review({ id: 'a' }), review({ id: 'b', handle: 'b' })] };
    await show();
    expect(screen.getAllByTestId('guest-review')).toHaveLength(2);
    expect(screen.queryByTestId('guest-reviews-more')).toBeNull();
  });

  // "♥ 2" side by side, as every card in the app draws it.
  it('draws the heart and its figure on one row', async () => {
    data.reviews = { count: 1, visits: [review()] };
    await show();
    const heart = screen.getByTestId('guest-review-heart');
    const figure = within(heart).getByTestId('guest-review-likes');
    const row = figure.parentElement!;
    expect(getComputedStyle(row).flexDirection).toBe('row');
    expect(row.querySelector('[data-icon="heart-outline"]')).toBeTruthy();
    // A visit's heart, not a collection's.
    expect(heart.getAttribute('aria-label')).toBe('Like');
  });

  // The owner's check-in (26 Nov 2026): the pill turned, the card did not.
  describe('asked again when the reader’s own visits here change', () => {
    const again = async (page: Awaited<ReturnType<typeof show>>, next: unknown[]) => {
      mine.data = next;
      page.rerender(<GuestReviews slug="omu" onPerson={onPerson} />);
      await settle();
    };

    it('a new visit, and it is drawn', async () => {
      data.reviews = { count: 1, visits: [] };
      const page = await show();
      expect(data.fetchGuestReviews).toHaveBeenCalledTimes(1);
      data.reviews = { count: 2, visits: [review()] };
      await again(page, [visit('k9')]);
      expect(data.fetchGuestReviews).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Omurice, soft.')).toBeTruthy();
    });

    it.each([
      ['its note', { note: 'New words.' }],
      ['its audience', { audience: 'friends' }],
      ['its photos', { photos: [ph('p9', 'me')] }],
    ])('an edit to %s', async (_what, over) => {
      mine.data = [visit('k9')];
      data.reviews = { count: 1, visits: [] };
      const page = await show();
      await again(page, [visit('k9', over)]);
      expect(data.fetchGuestReviews).toHaveBeenCalledTimes(2);
    });

    it('one removed', async () => {
      mine.data = [visit('k9')];
      data.reviews = { count: 1, visits: [] };
      const page = await show();
      await again(page, []);
      expect(data.fetchGuestReviews).toHaveBeenCalledTimes(2);
    });

    it('not for a visit somewhere else, nor the same visits handed over again', async () => {
      mine.data = [visit('k9')];
      data.reviews = { count: 1, visits: [] };
      const page = await show();
      await again(page, [visit('k9'), visit('k8', { place_slug: 'elsewhere' })]);
      expect(data.fetchGuestReviews).toHaveBeenCalledTimes(1);
    });

    it('not for the visits arriving the first time', async () => {
      mine.loaded = false;
      data.reviews = { count: 1, visits: [] };
      const page = await show();
      mine.loaded = true;
      await again(page, [visit('k9')]);
      expect(data.fetchGuestReviews).toHaveBeenCalledTimes(1);
      // And from then on they are the signal.
      await again(page, []);
      expect(data.fetchGuestReviews).toHaveBeenCalledTimes(2);
    });
  });
});
