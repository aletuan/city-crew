// @vitest-environment jsdom
//
// "Hoạt động nổi bật" on Explore: drawn for a reader signed in, with
// three cards or more; each card its photo, its place and its person, a
// heart that is undone when refused, and a press that opens the place.

import React from 'react';
import { AppState } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '../../uitest/render';

const data = vi.hoisted(() => ({
  cards: [] as unknown[],
  fetchHighlightCheckins: vi.fn(),
  likeCheckin: vi.fn(async (_id: string, _on: boolean) => {}),
  signCheckinPhotos: vi.fn(async (paths: readonly string[]): Promise<Record<string, string>> =>
    Object.fromEntries(paths.filter((p) => !p.includes('unsigned')).map((p) => [p, `https://signed/${p}`]))),
}));
vi.mock('../../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchHighlightCheckins: async (city: string) => { data.fetchHighlightCheckins(city); return data.cards; },
  likeCheckin: data.likeCheckin,
  signCheckinPhotos: data.signCheckinPhotos,
}));
const who = vi.hoisted(() => ({ me: 'me' as string | null }));
vi.mock('../../lib/auth', () => ({ useSession: () => ({ session: who.me ? { user: { id: who.me } } : null }) }));
vi.mock('../../lib/city', () => ({ useCurrentCity: () => ({ city: { id: 'hanoi' } }) }));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ lang: 'en', t: (en: string) => en }) }));

import { forgetSignedPhotos } from '../../components/useSignedPhotos';
import type { Nav } from '../../nav';
import { CheckinShelf, FEATURED_MIN, useHighlights } from './CheckinShelf';

const card = (id: string, over: Record<string, unknown> = {}) => ({
  id, place_slug: `slug-${id}`, place: { name_en: `Place ${id}`, name_vi: '', i18n: null },
  handle: `h${id}`, full_name: `Person ${id}`, avatar_url: null, note: null, likes: 1, liked: false,
  visitors: 1, faces: [{ handle: `h${id}`, full_name: `Person ${id}`, avatar_url: null }],
  photo: { id: `p${id}`, path: `u/${id}/p${id}.jpg`, width: 10, height: 10 }, ...over,
});
const navigate = vi.fn();
// As Explore holds it: the read in the page, the cards handed down.
const Page = () => <CheckinShelf navigation={{ navigate } as unknown as Nav} cards={useHighlights().data} />;
const settle = () => act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
const show = async () => {
  render(<Page />);
  await settle();
};

beforeEach(() => {
  who.me = 'me';
  data.cards = [];
  data.fetchHighlightCheckins.mockClear();
  data.likeCheckin.mockReset().mockResolvedValue(undefined);
  navigate.mockClear();
  forgetSignedPhotos();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('CheckinShelf', () => {
  it('asks nothing and draws nothing for somebody signed out', async () => {
    who.me = null;
    data.cards = [card('a'), card('b'), card('c')];
    await show();
    expect(data.fetchHighlightCheckins).not.toHaveBeenCalled();
    expect(screen.queryByTestId('checkin-shelf')).toBeNull();
  });

  it('asks for the reader’s city, and draws nothing under three cards', async () => {
    expect(FEATURED_MIN).toBe(3);
    data.cards = [card('a'), card('b')];
    await show();
    expect(data.fetchHighlightCheckins).toHaveBeenCalledWith('hanoi');
    expect(screen.queryByTestId('checkin-shelf')).toBeNull();
  });

  it('draws three: the heading, the week, and each card’s place and person', async () => {
    data.cards = [card('a'), card('b', { full_name: '', handle: 'minh', faces: [{ handle: 'minh', full_name: '', avatar_url: null }] }), card('c')];
    await show();
    expect(screen.getByText('Featured check-ins')).toBeTruthy();
    expect(screen.getByText('This week')).toBeTruthy();
    const cards = screen.getAllByTestId('checkin-shelf-card');
    expect(cards).toHaveLength(3);
    expect(cards[0].getAttribute('aria-label')).toBe('Place a, Person a');
    expect(cards[1].getAttribute('aria-label')).toBe('Place b, @minh');
    await waitFor(() => expect(cards[0].querySelector('img[src="https://signed/u/a/pa.jpg"]')).not.toBeNull());
  });

  it('opens the place a card is of', async () => {
    data.cards = [card('a'), card('b'), card('c')];
    await show();
    fireEvent.click(screen.getAllByTestId('checkin-shelf-card')[1]);
    expect(navigate).toHaveBeenCalledWith('PlaceDetail', { slug: 'slug-b' });
  });

  it('hearts a card at once, and takes it back when the server refuses', async () => {
    data.cards = [card('a'), card('b'), card('c')];
    await show();
    const first = screen.getAllByTestId('checkin-shelf-card')[0];
    fireEvent.click(within(first).getByTestId('checkin-shelf-heart'));
    expect(data.likeCheckin).toHaveBeenCalledWith('a', true);
    expect(within(first).getByTestId('checkin-shelf-likes').textContent).toBe('2');
    data.likeCheckin.mockRejectedValueOnce(new Error('checkin:unseen'));
    fireEvent.click(within(first).getByTestId('checkin-shelf-heart'));
    expect(data.likeCheckin).toHaveBeenLastCalledWith('a', false);
    await waitFor(() => expect(within(first).getByTestId('checkin-shelf-likes').textContent).toBe('2'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('holds a plain ground where a photo has no link yet', async () => {
    data.cards = [card('a', { photo: { id: 'pu', path: 'u/a/unsigned.jpg', width: 10, height: 10 } }), card('b'), card('c')];
    await show();
    const first = screen.getAllByTestId('checkin-shelf-card')[0];
    expect(within(first).getByTestId('checkin-shelf-waiting')).toBeTruthy();
  });

  // The final card (owner, 26 Nov 2026): faces and a figure at the foot,
  // no names and no badge; the names are read out instead.
  it('shows who went as faces, a figure only past three, and reads their names out', async () => {
    const face = (handle: string, full_name = '') => ({ handle, full_name, avatar_url: null });
    data.cards = [
      card('a', { visitors: 5, likes: 4, faces: [face('trang', 'Trang'), face('minh'), face('ha', 'Person a')] }),
      card('b', { visitors: 2, faces: [face('minh', 'Minh'), face('trang', 'Trang')] }),
      card('c'),
    ];
    await show();
    const [five, two, one] = screen.getAllByTestId('checkin-shelf-card');
    expect(within(five).getAllByTestId('checkin-shelf-face')).toHaveLength(3);
    expect(within(five).getByTestId('checkin-shelf-more').textContent).toBe('+2');
    expect(five.getAttribute('aria-label')).toBe('Place a, Trang, @minh, Person a +2');
    // The place's hearts over the week.
    expect(within(five).getByTestId('checkin-shelf-likes').textContent).toBe('4');
    expect(within(two).getAllByTestId('checkin-shelf-face')).toHaveLength(2);
    expect(within(two).queryByTestId('checkin-shelf-more')).toBeNull();
    expect(two.getAttribute('aria-label')).toBe('Place b, Minh, Trang');
    expect(within(one).getAllByTestId('checkin-shelf-face')).toHaveLength(1);
    // The first face — the newest visitor — is drawn over the rest.
    const z = within(five).getAllByTestId('checkin-shelf-face')
      .map((el) => Number((el as HTMLElement).style.zIndex));
    expect(z).toEqual([3, 2, 1]);
    // Nobody is named on the card itself, and nothing says "went".
    for (const el of [five, two, one]) {
      expect(within(el).queryByText(/Person|Trang|Minh|@|went/)).toBeNull();
    }
    expect(within(one).queryByText('Place c')).toBeTruthy();
  });

  // Under the photo, not over it: the words are outside the picture.
  it('keeps the visitor’s words off the photo, over who went', async () => {
    data.cards = [card('a', { note: 'Small, warm, clean.' }), card('b'), card('c')];
    await show();
    const first = screen.getAllByTestId('checkin-shelf-card')[0];
    const photo = within(first).getByTestId('checkin-shelf-photo');
    expect(within(photo).queryByTestId('checkin-shelf-note')).toBeNull();
    expect(within(photo).getByText('Place a')).toBeTruthy();
    expect(within(first).getByTestId('checkin-shelf-note')).toBeTruthy();
    // The words first, who went and the heart at the foot.
    const order = Array.from(first.querySelectorAll('[data-testid]'))
      .map((el) => el.getAttribute('data-testid'))
      .filter((id) => id === 'checkin-shelf-face' || id === 'checkin-shelf-heart' || id === 'checkin-shelf-note');
    expect(order).toEqual(['checkin-shelf-note', 'checkin-shelf-face', 'checkin-shelf-heart']);
  });

  it('carries what the visitor wrote, and nothing where they wrote nothing', async () => {
    data.cards = [card('a', { note: 'Small, warm, clean.' }), card('b'), card('c')];
    await show();
    const [said, silent] = screen.getAllByTestId('checkin-shelf-card');
    expect(within(said).getByTestId('checkin-shelf-note').textContent).toBe('Small, warm, clean.');
    expect(within(silent).queryByTestId('checkin-shelf-note')).toBeNull();
  });

  // The owner's day (26 Nov 2026): two cards in the morning, a third
  // person by the afternoon, and no shelf until the app was killed.
  it('is asked again on a return to the app once it has gone stale', async () => {
    let wake: ((s: string) => void) | null = null;
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
      wake = fn as (s: string) => void;
      return { remove: () => {} } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    data.cards = [card('a'), card('b')];
    await show();
    expect(screen.queryByTestId('checkin-shelf')).toBeNull();
    data.cards = [card('a'), card('b'), card('c')];
    // A minute on: still fresh, nothing asked.
    const at = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(at + 60_000);
    act(() => { wake!('active'); });
    await settle();
    expect(data.fetchHighlightCheckins).toHaveBeenCalledTimes(1);
    // Three minutes on: past `STALE_MS`, asked again, and drawn.
    vi.spyOn(Date, 'now').mockReturnValue(at + 3 * 60_000);
    act(() => { wake!('active'); });
    await settle();
    expect(data.fetchHighlightCheckins).toHaveBeenCalledTimes(2);
    expect(screen.getAllByTestId('checkin-shelf-card')).toHaveLength(3);
  });
});
