// @vitest-environment jsdom
// A person's page (16 Nov 2026): the first step of a profile, built only
// from what was already public — the profile and the lists a person
// published. What is checked here is what a reader is shown: whose page
// it is, which lists are on it and which are not, what stands across the
// top, and the friend button by what stands between the two of you.
//
// Every person in these fixtures has their own handle, name and face,
// and who is shown is asserted both ways — the right one there, the
// reader not (`CLAUDE.md`'s lesson from 15 Nov, when a card named the
// reader as the author of somebody else's list).
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, textStyleOf, viewStyleOf, within } from '../uitest/render';
import type { Nav, RootRoute } from '../nav';
import type { FriendshipRow } from '../lib/friends';
import type { Collection } from '../lib/types';
import { bgHex, colors } from '../theme';

const alert = vi.hoisted(() => vi.fn<(title: string, body?: string) => void>());
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  Alert: { alert },
}));

const data = vi.hoisted(() => ({
  sendFriendRequest: vi.fn(async (_me: string, _other: string): Promise<void> => {}),
  acceptFriendRequest: vi.fn(async (_requester: string, _me: string): Promise<void> => {}),
}));

type Who = { id: string; handle: string; full_name: string; avatar_url: string; bio?: string | null };
const crew = vi.hoisted(() => ({
  ships: { data: [] as FriendshipRow[], loading: false, reload: vi.fn() },
  blocks: { data: [] as string[] },
  mutual: {} as Record<string, number>,
}));
vi.mock('../lib/crew', () => ({ useCrew: () => crew }));

const state = vi.hoisted(() => ({
  me: 'me-id' as string | null,
  people: {} as Record<string, Who>,
  asked: [] as (string | null)[],
  lookup: { loading: false, error: null as string | null, reload: vi.fn() },
  shelf: [] as unknown[],
  places: [] as unknown[],
  likes: {} as Record<string, number>,
  lang: 'en' as 'en' | 'vi',
  scheme: 'dark' as 'dark' | 'light',
}));
vi.mock('../lib/auth', () => ({
  useSession: () => ({ session: state.me ? { user: { id: state.me } } : null }),
}));
vi.mock('../lib/catalog', () => ({
  useCollections: () => ({ data: state.shelf, loading: false, reload: () => {} }),
  usePlaces: () => ({ data: state.places, loading: false, reload: () => {} }),
  useLikes: () => ({ likes: state.likes }),
}));
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  sendFriendRequest: data.sendFriendRequest,
  acceptFriendRequest: data.acceptFriendRequest,
  useProfileByHandle: (h: string | null) => {
    state.asked.push(h);
    return { data: h ? state.people[h] ?? null : null, ...state.lookup };
  },
}));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: state.scheme }) }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string | null, vi: string | null) => (state.lang === 'vi' ? vi ?? en ?? '' : en ?? vi ?? ''),
  }),
}));

import PersonScreen from './PersonScreen';

const LAN: Who = { id: 'lan-id', handle: 'lan', full_name: 'Lan Phạm', avatar_url: 'https://faces/lan.jpg', bio: 'Coffee first, then the rest.' };

const list = (slug: string, over: Partial<Collection> = {}): Collection => ({
  id: slug, slug, title_en: `List ${slug}`, title_vi: `Bộ ${slug}`, title_ja: null,
  desc_en: null, desc_vi: null, desc_ja: null, curator_handle: '@lan', cover: null,
  owner_id: 'lan-id', is_public: true, city_id: 'hanoi', collection_places: [],
  ...over,
} as Collection);

const members = (n: number) => Array.from({ length: n }, (_, i) => ({ sort_order: i, places: { slug: `p${i}` } }));

const flush = async () => { await act(async () => {}); };
const show = async (handle = 'lan') => {
  const navigation = { goBack: vi.fn(), navigate: vi.fn() };
  render(<PersonScreen navigation={navigation as unknown as Nav} route={{ params: { handle } } as RootRoute<'Person'>} />);
  await flush();
  return navigation;
};

beforeEach(() => {
  state.me = 'me-id';
  state.people = { lan: LAN };
  state.asked = [];
  state.lookup = { loading: false, error: null, reload: vi.fn() };
  state.shelf = [];
  state.places = [];
  state.likes = {};
  state.lang = 'en';
  state.scheme = 'dark';
  crew.ships.data = [];
  crew.ships.reload.mockClear();
  crew.blocks.data = [];
  crew.mutual = {};
  alert.mockClear();
  data.sendFriendRequest.mockClear();
  data.acceptFriendRequest.mockClear();
});
afterEach(cleanup);

describe('whose page it is', () => {
  it('is headed by the person’s handle, bare, with their name under it and their bio', async () => {
    await show();
    expect(screen.getByTestId('person-handle').textContent).toBe('lan');
    expect(screen.getByTestId('person-name').textContent).toBe('Lan Phạm');
    expect(screen.getByTestId('person-bio').textContent).toBe('Coffee first, then the rest.');
    // Handle strong, name quiet — the order every row of people has.
    expect(textStyleOf(screen.getByTestId('person-handle'))?.color).toBe(colors.text);
    expect(textStyleOf(screen.getByTestId('person-name'))?.color).toBe(colors.textTertiary);
  });

  it('wears their face, not the reader’s, ringed in the page’s own ground', async () => {
    await show();
    const face = screen.getByTestId('person-cover').nextElementSibling!.firstElementChild as HTMLElement;
    expect(face.querySelector('img')!.getAttribute('src')).toBe('https://faces/lan.jpg');
    expect(viewStyleOf(face)).toMatchObject({ borderWidth: 4, borderColor: bgHex.dark });
  });

  it('asks for the profile by the handle it was opened with, the `@` and case off', async () => {
    await show('@Lan');
    expect(state.asked.every((h) => h === 'lan')).toBe(true);
    expect(screen.getByTestId('person-handle').textContent).toBe('lan');
  });

  it('draws no name line and no bio for somebody who wrote neither', async () => {
    state.people = { lan: { ...LAN, full_name: '', bio: null } };
    await show();
    expect(screen.getByTestId('person-handle').textContent).toBe('lan');
    expect(screen.queryByTestId('person-name')).toBeNull();
    expect(screen.queryByTestId('person-bio')).toBeNull();
  });

  it('goes back through the navigation prop', async () => {
    const navigation = await show();
    fireEvent.click(screen.getByTestId('person-back'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('their lists', () => {
  it('shows the lists they published, newest first, and nobody else’s', async () => {
    state.shelf = [
      list('new', { collection_places: members(17) as Collection['collection_places'] }),
      list('minh-list', { owner_id: 'minh-id' }),
      list('desk', { owner_id: null }),
      list('old'),
    ];
    state.likes = { new: 3 };
    await show();
    const tiles = screen.getAllByTestId('person-list');
    expect(tiles.map((x) => x.textContent)).toEqual(['List new17 places · 3 likes', 'List old0 places']);
    expect(screen.getByTestId('person-counts').textContent).toBe('2 collections');
    expect(screen.queryByTestId('person-no-lists')).toBeNull();
  });

  // The page is one anybody can open: a private list is never on it,
  // even when the shelf it is handed holds one.
  it('never shows a private list', async () => {
    state.shelf = [list('secret', { is_public: false }), list('open')];
    await show();
    expect(screen.getAllByTestId('person-list').map((x) => x.textContent)).toEqual(['List open0 places']);
  });

  it('says one of each in the singular, and titles a list in the reader’s language', async () => {
    state.shelf = [list('one', { collection_places: members(1) as Collection['collection_places'] })];
    state.likes = { one: 1 };
    await show();
    expect(screen.getByTestId('person-list').textContent).toBe('List one1 place · 1 like');
    expect(screen.getByTestId('person-counts').textContent).toBe('1 collection');
    cleanup();
    state.lang = 'vi';
    await show();
    expect(screen.getByTestId('person-list').textContent).toBe('Bộ one1 địa điểm · 1 lượt thích');
    expect(screen.getByTestId('person-counts').textContent).toBe('1 bộ sưu tập');
  });

  it('opens a list’s own page on a press', async () => {
    state.shelf = [list('new'), list('old')];
    const navigation = await show();
    fireEvent.click(screen.getAllByTestId('person-list')[1]);
    expect(navigation.navigate).toHaveBeenCalledExactlyOnceWith('CollectionDetail', { slug: 'old' });
  });

  it('sets them two to a row, with an empty slot beside an odd one out', async () => {
    state.shelf = [list('a'), list('b'), list('c')];
    await show();
    const [a, b, c] = screen.getAllByTestId('person-list');
    expect(a.parentElement).toBe(b.parentElement);
    expect(c.parentElement).not.toBe(a.parentElement);
    expect(c.parentElement!.children).toHaveLength(2);
    expect(viewStyleOf(c.parentElement!.lastElementChild as HTMLElement).flex).toBe(1);
  });

  it('says there are none yet, in a card, for somebody who has published nothing', async () => {
    state.shelf = [list('minh-list', { owner_id: 'minh-id' })];
    await show();
    expect(screen.queryAllByTestId('person-list')).toEqual([]);
    expect(within(screen.getByTestId('person-no-lists')).getByText('No public collections yet')).toBeTruthy();
    expect(screen.getByTestId('person-counts').textContent).toBe('0 collections');
  });
});

describe('the cover', () => {
  const coverSrc = () => screen.getByTestId('person-cover').querySelector('img')?.getAttribute('src') ?? null;

  it('is the cover of their newest list that has one, and each tile wears its own', async () => {
    state.shelf = [
      list('bare'),
      list('chosen', { cover: { photo_uri: 'https://covers/chosen.jpg' } }),
      list('older', { cover: { photo_uri: 'https://covers/older.jpg' } }),
    ];
    await show();
    expect(coverSrc()).toBe('https://covers/chosen.jpg');
    expect(screen.queryByTestId('person-cover-tint')).toBeNull();
    // The bare one wears the tint; the other two their own photographs.
    expect(screen.getAllByTestId('person-list').map((x) => x.querySelector('img')?.getAttribute('src') ?? null))
      .toEqual([null, 'https://covers/chosen.jpg', 'https://covers/older.jpg']);
  });

  // Not somebody else's photograph across a page that is not theirs.
  it('is not another person’s list’s cover', async () => {
    state.shelf = [list('minh-list', { owner_id: 'minh-id', cover: { photo_uri: 'https://covers/minh.jpg' } })];
    await show();
    expect(coverSrc()).toBeNull();
    expect(screen.getByTestId('person-cover-tint')).toBeTruthy();
  });

  it('is the accent’s tint for somebody with no list, or none with a photograph', async () => {
    await show();
    expect(viewStyleOf(screen.getByTestId('person-cover-tint')).backgroundColor).toBe(colors.accentSoft);
    cleanup();
    state.shelf = [list('bare')];
    await show();
    expect(viewStyleOf(screen.getByTestId('person-cover-tint')).backgroundColor).toBe(colors.accentSoft);
  });
});

describe('the friend button', () => {
  const edge = (requester: string, addressee: string, status: 'pending' | 'accepted'): FriendshipRow =>
    ({ requester, addressee, status, created_at: '2026-11-01T00:00:00Z', responded_at: null }) as FriendshipRow;

  it('offers Add friend to a stranger and sends the request as the reader', async () => {
    await show();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add friend' })); });
    expect(data.sendFriendRequest).toHaveBeenCalledExactlyOnceWith('me-id', 'lan-id');
    expect(screen.getByTestId('person-requested').textContent).toBe('Requested');
  });

  it('says Friends for a friend, with the places you both save', async () => {
    crew.ships.data = [edge('me-id', 'lan-id', 'accepted')];
    crew.mutual = { 'lan-id': 4 };
    await show();
    expect(screen.getByTestId('person-friends').textContent).toBe('Friends');
    expect(screen.getByTestId('person-counts').textContent).toBe('0 collections · 4 mutual saves');
    cleanup();
    crew.mutual = { 'lan-id': 1 };
    state.lang = 'vi';
    await show();
    expect(screen.getByTestId('person-counts').textContent).toBe('0 bộ sưu tập · 1 chỗ cùng lưu');
  });

  it('offers Accept to somebody who asked, and accepts their request', async () => {
    crew.ships.data = [edge('lan-id', 'me-id', 'pending')];
    await show();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Accept' })); });
    expect(data.acceptFriendRequest).toHaveBeenCalledExactlyOnceWith('lan-id', 'me-id');
  });

  it('has none on your own page, across a block, or signed out', async () => {
    state.people = { lan: { ...LAN, id: 'me-id' } };
    await show();
    expect(screen.queryByText('Add friend')).toBeNull();
    cleanup();
    state.people = { lan: LAN };
    crew.blocks.data = ['lan-id'];
    await show();
    expect(screen.queryByText('Add friend')).toBeNull();
    cleanup();
    crew.blocks.data = [];
    state.me = null;
    await show();
    expect(screen.queryByText('Add friend')).toBeNull();
    // The page itself is still theirs.
    expect(screen.getByTestId('person-handle').textContent).toBe('lan');
  });
});

describe('when there is nobody to show', () => {
  it('turns while the profile is on its way', async () => {
    state.people = {};
    state.lookup = { loading: true, error: null, reload: vi.fn() };
    await show();
    expect(screen.getByTestId('person-loading')).toBeTruthy();
    expect(screen.queryByTestId('person-missing')).toBeNull();
  });

  it('says it could not load, and asks again', async () => {
    state.people = {};
    state.lookup = { loading: false, error: 'timeout', reload: vi.fn() };
    await show();
    expect(screen.getByTestId('person-failed')).toBeTruthy();
    fireEvent.click(screen.getByTestId('person-retry'));
    expect(state.lookup.reload).toHaveBeenCalledTimes(1);
  });

  it('says nobody is here for a handle no profile answers to, or none at all', async () => {
    state.people = {};
    await show('ghost');
    expect(screen.getByTestId('person-missing')).toBeTruthy();
    expect(screen.queryByTestId('person-cover')).toBeNull();
    cleanup();
    state.asked = [];
    await show('@');
    expect(screen.getByTestId('person-missing')).toBeTruthy();
    // Nothing to ask about: no lookup by an empty handle.
    expect(state.asked.every((h) => h === null)).toBe(true);
  });
});
