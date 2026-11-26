// @vitest-environment jsdom
//
// "Hoạt động nổi bật" on Explore: drawn for a reader signed in, with
// three cards or more; each card its photo, its place and its person, a
// heart that is undone when refused, and a press that opens the place.

import React from 'react';
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
import { CheckinShelf, FEATURED_MIN } from './CheckinShelf';

const card = (id: string, over: Record<string, unknown> = {}) => ({
  id, place_slug: `slug-${id}`, place: { name_en: `Place ${id}`, name_vi: '', i18n: null },
  handle: `h${id}`, full_name: `Person ${id}`, avatar_url: null, note: null, likes: 1, liked: false,
  photo: { id: `p${id}`, path: `u/${id}/p${id}.jpg`, width: 10, height: 10 }, ...over,
});
const navigate = vi.fn();
const show = async () => {
  render(<CheckinShelf navigation={{ navigate } as unknown as Nav} />);
  await act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
};

beforeEach(() => {
  who.me = 'me';
  data.cards = [];
  data.fetchHighlightCheckins.mockClear();
  data.likeCheckin.mockReset().mockResolvedValue(undefined);
  navigate.mockClear();
  forgetSignedPhotos();
});
afterEach(cleanup);

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
});
