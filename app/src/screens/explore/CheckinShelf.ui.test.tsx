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
    data.cards = [card('a'), card('b', { full_name: '', handle: 'minh' }), card('c')];
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

  // A card a place (26 Nov 2026): two people at one, and the card says
  // so in its corner, in its faces and to a screen reader; a place one
  // person went to says who, and wears no badge.
  it('says how many people went where more than one did', async () => {
    data.cards = [
      card('a', {
        visitors: 3, likes: 4,
        faces: [
          { handle: 'ha', full_name: 'Person a', avatar_url: null },
          { handle: 'trang', full_name: 'Trang', avatar_url: null },
          { handle: 'minh', full_name: '', avatar_url: null },
        ],
      }),
      card('b'), card('c'),
    ];
    await show();
    const [many, one] = screen.getAllByTestId('checkin-shelf-card');
    expect(within(many).getByTestId('checkin-shelf-went').textContent).toBe('3 people went');
    expect(within(many).getAllByTestId('checkin-shelf-face')).toHaveLength(3);
    expect(within(many).getByText('Person a +2')).toBeTruthy();
    expect(many.getAttribute('aria-label')).toBe('Place a, 3 people went');
    // The place's hearts over the week, and the reader's own on top.
    expect(within(many).getByTestId('checkin-shelf-likes').textContent).toBe('4');
    expect(within(one).queryByTestId('checkin-shelf-went')).toBeNull();
    expect(within(one).getAllByTestId('checkin-shelf-face')).toHaveLength(1);
    expect(within(one).getByText('Person b')).toBeTruthy();
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
