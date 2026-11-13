// @vitest-environment jsdom
//
// One list's activity (owner, 13 Nov 2026): the list in a small card,
// then every like and copy on it, all time, newest first. What is pinned
// here is what the page asks for (the epoch, so all time), which rows it
// keeps (this list's, one per act), how each row reads (the handle, the
// card head's compact age with "now" for "New", the name, the badge for
// the kind), and the four states — loading, empty (yours, whatever it is
// now, or not yours), failed with Try again — and that a row is not a
// control. A list that is not public is asked about like any other.
// `actsOn`, `listAgeOf` and `ageWord` run for real, and so does the kept,
// shared answer the page reads (`useListActivityQuery`, `useSharedFetch`):
// only the two RPC wrappers under it and the providers are stood in. So
// the page opening on a kept answer without a spinner, and its faces
// coming off the rows with no second read, are tested through the code
// that does them.

import React from 'react';
import { StyleSheet } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, fontSizeOf, render, screen, textStyleOf, viewStyleOf, within } from '../uitest/render';
import { cacheKey } from '../lib/data/cache';
import { forgetSharedFetches } from '../lib/data/fetch';
import type { Nav, RootRoute } from '../nav';
import type { Applause, Copy, FriendshipRow } from '../lib/friends';
import type { Collection } from '../lib/types';
import { CHIP_H, CHIP_SLOP } from '../components/ui';
import { bgHex, colors, font, radius } from '../theme';

const NOW = new Date(2026, 10, 13, 12, 0, 0);
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

// `Alert` from react-native-web is a silent no-op, so a failed request's
// Alert is caught at the import the screen uses — as Crew's tests do.
const alert = vi.hoisted(() => vi.fn<(title: string, body?: string) => void>());
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  Alert: { alert },
}));

const data = vi.hoisted(() => ({
  fetchApplause: vi.fn(async (_since: string): Promise<Applause[]> => []),
  fetchCopies: vi.fn(async (_since: string): Promise<Copy[]> => []),
  fetchCuratorAvatars: vi.fn(async (_handles: string[]): Promise<Record<string, string>> => ({})),
  sendFriendRequest: vi.fn(async (_me: string, _other: string): Promise<void> => {}),
  acceptFriendRequest: vi.fn(async (_requester: string, _me: string): Promise<void> => {}),
  fetchCollectionStats: vi.fn(async (_id: string): Promise<unknown[]> => []),
}));
// The module the hooks read the RPCs from, not the barrel: `hooks.ts`
// imports them from here, so a stand-in on the barrel would miss them.
vi.mock('../lib/data/people', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchApplause: data.fetchApplause,
  fetchCopies: data.fetchCopies,
  fetchCuratorAvatars: data.fetchCuratorAvatars,
  sendFriendRequest: data.sendFriendRequest,
  acceptFriendRequest: data.acceptFriendRequest,
}));

// The statistics the page asks ahead for, from the module the hook reads.
vi.mock('../lib/data/stats', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchCollectionStats: data.fetchCollectionStats,
}));

// The crew the app already holds: the edges and the blocks the friend
// button reads, and the reload a request ends with.
const crew = vi.hoisted(() => ({
  ships: { data: [] as FriendshipRow[], loading: false, reload: vi.fn() },
  blocks: { data: [] as string[] },
}));
vi.mock('../lib/crew', () => ({ useCrew: () => crew }));

const state = vi.hoisted(() => ({
  me: 'me' as string | null,
  profile: { handle: 'andy', avatar_url: 'https://faces/andy.jpg' } as { handle: string; avatar_url: string } | null,
  mine: [] as unknown[],
  mineLoading: false,
  lang: 'en' as 'en' | 'vi',
  scheme: 'dark' as 'dark' | 'light',
}));
vi.mock('../lib/auth', () => {
  const all = () => ({ session: state.me ? { user: { id: state.me } } : null, profile: state.profile });
  return { useAuth: all, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
vi.mock('../lib/save', () => ({
  useMyLists: () => ({ data: state.mine, loading: state.mineLoading, reload: () => {} }),
}));
vi.mock('../lib/theme', () => ({ useScheme: () => ({ scheme: state.scheme }) }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string | null, vi: string | null) => (state.lang === 'vi' ? vi ?? en ?? '' : en ?? vi ?? ''),
  }),
}));

import CollectionActivityScreen from './CollectionActivityScreen';

const list = (over: Partial<Collection> = {}): Collection => ({
  id: 'c1', slug: 'old-quarter', title_en: 'Old Quarter eats', title_vi: 'Ăn phố cổ', title_ja: null,
  desc_en: 'Where we eat when friends visit.', desc_vi: null, desc_ja: null,
  curator_handle: '@stale', cover: null, owner_id: 'me', is_public: true, city_id: 'hanoi',
  collection_places: [], created_at: ago(3 * HOUR),
  ...over,
} as Collection);

const like = (liked_at: string, liker_handle: string | null, liker_name: string | null = null, collection_id = 'c1', liker_avatar_url: string | null = null): Applause =>
  ({ collection_id, liked_at, liker_handle, liker_name, liker_id: liker_handle && `id-${liker_handle}`, liker_avatar_url });
const copy = (copied_at: string, copier_handle: string | null, copier_name: string | null = null, collection_id = 'c1', copier_avatar_url: string | null = null): Copy =>
  ({ collection_id, copied_at, copier_handle, copier_name, copier_id: copier_handle && `id-${copier_handle}`, copier_avatar_url });

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const show = async (slug = 'old-quarter') => {
  const navigation = { goBack: vi.fn(), navigate: vi.fn() };
  render(
    <CollectionActivityScreen
      navigation={navigation as unknown as Nav}
      route={{ params: { slug } } as RootRoute<'CollectionActivity'>}
    />,
  );
  await flush();
  return navigation;
};

/** A row's who: the face and the words, which VoiceOver reads as one. */
const whoOf = (r: HTMLElement) => within(r).getByTestId('activity-who');

/** Each row's two lines, as read: line one's words, then line two's. */
const rowLines = () => screen.getAllByTestId('activity-row').map((r) => {
  const lines = whoOf(r).lastElementChild as HTMLElement;
  return [...lines.children].map((c) => [...c.querySelectorAll('div,span')].length
    ? [...c.children].map((w) => w.textContent).join(' ')
    : c.textContent);
});

/** The `numberOfLines` a Text was given, read off its props. */
const linesOf = (el: HTMLElement): number | undefined => {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'))!;
  type Fiber = { memoizedProps?: { numberOfLines?: number }; return?: Fiber };
  let f: Fiber | undefined = (el as unknown as Record<string, Fiber>)[key];
  while (f && f.memoizedProps?.numberOfLines === undefined) f = f.return;
  return f?.memoizedProps?.numberOfLines;
};

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  data.fetchApplause.mockImplementation(async () => []);
  data.fetchCopies.mockImplementation(async () => []);
  // The kept answer outlives a render, in memory and on the phone: each
  // test starts with neither, unless it makes one.
  forgetSharedFetches();
  await AsyncStorage.removeItem(cacheKey('likesonmine', 'all', 'me'));
  await AsyncStorage.removeItem(cacheKey('copiesofmine', 'all', 'me'));
  state.me = 'me';
  state.profile = { handle: 'andy', avatar_url: 'https://faces/andy.jpg' };
  state.mine = [list()];
  state.mineLoading = false;
  state.lang = 'en';
  state.scheme = 'dark';
  crew.ships.data = [];
  crew.ships.loading = false;
  crew.blocks.data = [];
  data.sendFriendRequest.mockImplementation(async () => {});
  data.acceptFriendRequest.mockImplementation(async () => {});
});
afterEach(() => { vi.useRealTimers(); });

describe('the frame', () => {
  it('is called Activity, at the compact size, and goes back', async () => {
    const navigation = await show();
    expect(fontSizeOf(screen.getByText('Activity'))).toBe(20);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('says it in Vietnamese', async () => {
    state.lang = 'vi';
    await show();
    expect(screen.getByText('Hoạt động')).toBeTruthy();
  });
});

describe('the list, in a card', () => {
  it('leads with your face, your handle and the list’s age, then its title and words', async () => {
    await show();
    const card = screen.getByTestId('activity-list');
    expect(card.querySelector('img')!.getAttribute('src')).toBe('https://faces/andy.jpg');
    // Your handle from the profile, not the row's stale stamp.
    expect(within(card).getByText('andy')).toBeTruthy();
    // Beside a face the handle is the name, bare (owner, 13 Nov 2026).
    expect(card.textContent).not.toContain('@');
    expect(within(card).queryByText('stale')).toBeNull();
    expect(within(card).getByText('3h')).toBeTruthy();
    expect(screen.getByTestId('activity-list-title').textContent).toBe('Old Quarter eats');
    expect(screen.getByTestId('activity-list-desc').textContent).toBe('Where we eat when friends visit.');
    // The head first, then the words: in that order in the card.
    expect(card.textContent).toBe('andy3hOld Quarter eatsWhere we eat when friends visit.');
  });

  it('sets the title in bold and cuts the words at three lines', async () => {
    await show();
    expect(textStyleOf(screen.getByTestId('activity-list-title'))?.fontWeight).toBe(font.bold);
    expect(linesOf(screen.getByTestId('activity-list-desc'))).toBe(3);
    // Justified, as the collection page sets the same words.
    expect(textStyleOf(screen.getByTestId('activity-list-desc'))?.textAlign).toBe('justify');
    expect(linesOf(screen.getByTestId('activity-list-title'))).toBeUndefined();
    // A summary: no "Read more".
    expect(screen.queryByText(/Read more/)).toBeNull();
  });

  // The line under the handle, a step under the handle and the words, as
  // the collection page's own line under the handle is.
  it('sets the age in the third grey', async () => {
    await show();
    expect(textStyleOf(within(screen.getByTestId('activity-list')).getByText('3h'))?.color).toBe(colors.textTertiary);
  });

  it('says a list made a moment ago is New, as the card head does', async () => {
    state.mine = [list({ created_at: ago(10_000) })];
    await show();
    expect(within(screen.getByTestId('activity-list')).getByText('New')).toBeTruthy();
  });

  it('leaves out what it does not have: a handle, an age, the words', async () => {
    state.profile = { handle: '', avatar_url: '' };
    state.mine = [list({ created_at: null, desc_en: null })];
    await show();
    const card = screen.getByTestId('activity-list');
    expect(card.textContent).toBe('Old Quarter eats');
    expect(screen.queryByTestId('activity-list-desc')).toBeNull();
    // The blank disc, not an empty picture.
    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('[data-icon="person-outline"]')).toBeTruthy();
  });
});

describe('what it asks for', () => {
  it('asks both functions from the epoch, so it is all time', async () => {
    await show();
    expect(data.fetchApplause).toHaveBeenCalledExactlyOnceWith('1970-01-01T00:00:00.000Z');
    expect(data.fetchCopies).toHaveBeenCalledExactlyOnceWith('1970-01-01T00:00:00.000Z');
  });

  // A list gone private keeps what it gathered while public (owner, 13
  // Nov 2026): the two functions answer its owner whatever it is now, so
  // the page asks, and lists, as it does for a public one.
  it('asks for a list that is not public, and lists what it gathered', async () => {
    state.mine = [list({ is_public: false })];
    data.fetchApplause.mockImplementation(async () => [like(ago(2 * HOUR), 'minh', 'Minh Trần')]);
    data.fetchCopies.mockImplementation(async () => [copy(ago(30 * MIN), 'lan', 'Lan Phạm')]);
    await show();
    expect(data.fetchApplause).toHaveBeenCalledExactlyOnceWith('1970-01-01T00:00:00.000Z');
    expect(data.fetchCopies).toHaveBeenCalledExactlyOnceWith('1970-01-01T00:00:00.000Z');
    expect(rowLines()).toEqual([['Lan Phạm', '@lan · 30m'], ['Minh Trần', '@minh · 2h']]);
    expect(screen.queryByTestId('activity-empty')).toBeNull();
    expect(screen.queryByText(/Only a public collection/)).toBeNull();
    expect(screen.getByTestId('activity-list')).toBeTruthy();
  });

  // And one that never gathered anything is the ordinary nothing-yet,
  // not a different kind of nothing.
  it('gives a list that is not public and has no acts the ordinary empty state', async () => {
    state.mine = [list({ is_public: false })];
    await show();
    expect(data.fetchApplause).toHaveBeenCalledOnce();
    expect(screen.getByTestId('activity-empty').textContent)
      .toBe('No likes or copies yetWhen someone likes or copies this collection, you will see it here.');
    expect(screen.queryByTestId('activity-private')).toBeNull();
    expect(screen.getByTestId('activity-list')).toBeTruthy();
  });

  // Only the owner: a list that is not among yours is not looked for
  // anywhere else, and the page reads as empty — no card, no fetch.
  it('shows nothing useful for a list that is not yours', async () => {
    await show('somebody-elses');
    expect(data.fetchApplause).not.toHaveBeenCalled();
    expect(data.fetchCopies).not.toHaveBeenCalled();
    expect(screen.queryByTestId('activity-list')).toBeNull();
    expect(screen.getByTestId('activity-empty').textContent)
      .toBe('No likes or copies yetWhen someone likes or copies this collection, you will see it here.');
  });

  it('asks nothing for a list from the launch cache with no id', async () => {
    state.mine = [list({ id: undefined })];
    await show();
    expect(data.fetchApplause).not.toHaveBeenCalled();
    expect(screen.getByTestId('activity-empty')).toBeTruthy();
    expect(screen.getByTestId('activity-list')).toBeTruthy();
  });

  it('asks nothing signed out', async () => {
    state.me = null;
    await show();
    expect(data.fetchApplause).not.toHaveBeenCalled();
    expect(screen.getByTestId('activity-empty')).toBeTruthy();
  });
});

describe('the rows', () => {
  it('keeps this list’s likes and copies, newest first, one row per act', async () => {
    data.fetchApplause.mockImplementation(async () => [
      like(ago(5 * MIN), 'lan', 'Lan Phạm'),
      like(ago(1 * MIN), 'elsewhere', 'Not here', 'c2'),
      like(ago(2 * HOUR), 'minh', 'Minh Trần'),
    ]);
    data.fetchCopies.mockImplementation(async () => [
      copy(ago(30 * MIN), 'lan', 'Lan Phạm'),
      copy(ago(3 * MIN), 'other', 'Other', 'c9'),
    ]);
    await show();
    // The name on top, the handle under it with its `@` and the age —
    // Crew's arrangement, so one person reads the same on both screens.
    expect(rowLines()).toEqual([
      ['Lan Phạm', '@lan · 5m'],
      ['Lan Phạm', '@lan · 30m'],
      ['Minh Trần', '@minh · 2h'],
    ]);
    const kinds = screen.getAllByTestId(/^activity-badge-/).map((b) => b.getAttribute('data-testid'));
    expect(kinds).toEqual(['activity-badge-like', 'activity-badge-copy', 'activity-badge-like']);
  });

  it('dates an act by the card head’s table, with "now" for under a minute', async () => {
    data.fetchApplause.mockImplementation(async () => [
      like(ago(20_000), 'a'),
      like(ago(26 * HOUR), 'b'),
      like(new Date(2025, 10, 12, 9).toISOString(), 'c'),
    ]);
    await show();
    expect(rowLines().map((r) => r[0])).toEqual(['a now', 'b 12 Nov', 'c 12 Nov 2025']);
  });

  it('dates it in Vietnamese as the owner wrote it: Vừa xong, 5p, 12/11, 12/11/25', async () => {
    state.lang = 'vi';
    data.fetchApplause.mockImplementation(async () => [
      like(ago(20_000), 'a'),
      like(ago(5 * MIN), 'b'),
      like(ago(3 * HOUR), 'c'),
      like(ago(26 * HOUR), 'd'),
      like(new Date(2025, 10, 12, 9).toISOString(), 'e'),
    ]);
    await show();
    expect(rowLines().map((r) => r[0])).toEqual(['a Vừa xong', 'b 5p', 'c 3h', 'd 12/11', 'e 12/11/25']);
  });

  it('calls a person whose profile is gone Someone, with no second line', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), null, null)]);
    await show();
    expect(rowLines()).toEqual([['Someone 5m']]);
  });

  it('sets the name in semibold, and the handle and age under it in grey', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan', 'Lan Phạm')]);
    await show();
    const row = screen.getByTestId('activity-row');
    expect(textStyleOf(within(row).getByText('Lan Phạm'))).toMatchObject({ fontWeight: font.semibold, color: colors.text });
    expect(textStyleOf(within(row).getByText('@lan · 5m'))?.color).toBe(colors.textTertiary);
  });

  // No name: the handle is the name, bare, with the age beside it — as
  // the collection card's head draws a handle alone.
  it('draws a handle with no name bare, on one line with its age', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan', null)]);
    await show();
    expect(rowLines()).toEqual([['lan 5m']]);
    const row = screen.getByTestId('activity-row');
    expect(textStyleOf(within(row).getByText('lan'))).toMatchObject({ fontWeight: font.semibold, color: colors.text });
    expect(textStyleOf(within(row).getByText('5m'))?.color).toBe(colors.textTertiary);
    expect(row.textContent).not.toContain('@');
  });

  // One round trip (13 Nov 2026): the face rides the row, so there is
  // no second read by handle — not the batched one the page used to
  // make, not any other.
  it('wears each face off its own row, with no second read, and the blank disc without one', async () => {
    data.fetchApplause.mockImplementation(async () => [
      like(ago(5 * MIN), 'lan', null, 'c1', 'https://faces/lan.jpg'),
      like(ago(9 * MIN), 'cleared', null, 'c1', ''),
    ]);
    data.fetchCopies.mockImplementation(async () => [
      copy(ago(6 * MIN), 'minh', null, 'c1', 'https://faces/minh.jpg'),
      copy(ago(7 * MIN), null),
    ]);
    await show();
    const rows = screen.getAllByTestId('activity-row');
    expect(rows.map((r) => r.querySelector('img')?.getAttribute('src') ?? null)).toEqual([
      'https://faces/lan.jpg', 'https://faces/minh.jpg', null, null,
    ]);
    expect(data.fetchCuratorAvatars).not.toHaveBeenCalled();
  });

  // The face is the row's, not one looked up by the handle: two rows by
  // one handle with two faces (a picture changed between two acts is
  // the same person; the server answers each row's own join) each wear
  // their own.
  it('takes the face from the row even where two rows share a handle', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan', null, 'c1', 'https://faces/new.jpg')]);
    data.fetchCopies.mockImplementation(async () => [copy(ago(9 * MIN), 'Lan', null, 'c1', 'https://faces/old.jpg')]);
    await show();
    expect(screen.getAllByTestId('activity-row').map((r) => r.querySelector('img')!.getAttribute('src')))
      .toEqual(['https://faces/new.jpg', 'https://faces/old.jpg']);
  });

  it('draws a 40pt face', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan')]);
    await show();
    const face = whoOf(screen.getByTestId('activity-row')).firstElementChild as HTMLElement;
    expect([viewStyleOf(face).width, viewStyleOf(face).height]).toEqual([40, 40]);
  });

  // A red heart for a like, the copy mark on the accent for a copy, each
  // on the face's corner with a ring of the page around it.
  it('badges a like with a white heart on red and a copy with the copy mark on the accent', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan')]);
    data.fetchCopies.mockImplementation(async () => [copy(ago(9 * MIN), 'minh')]);
    await show();
    const liked = screen.getByTestId('activity-badge-like');
    const copied = screen.getByTestId('activity-badge-copy');
    expect(viewStyleOf(liked).backgroundColor).toBe('#FF3040');
    expect(liked.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('heart');
    expect(liked.querySelector('[data-icon]')!.getAttribute('data-color')).toBe('#FFFFFF');
    expect(viewStyleOf(copied).backgroundColor).toBe(colors.accentFill);
    expect(copied.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('duplicate');
    expect(copied.querySelector('[data-icon]')!.getAttribute('data-color')).toBe(String(colors.accentInk));
    for (const b of [liked, copied]) {
      expect(viewStyleOf(b)).toMatchObject({ position: 'absolute', right: -3, bottom: -3, width: 20, borderWidth: 2 });
      // Pinned on the face itself, not beside it.
      expect(b.parentElement).toBe(b.closest('[data-testid="activity-who"]')!.firstElementChild);
    }
  });

  it('rings the badge in the page’s own ground, resolved for the look in force', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan')]);
    await show();
    expect(viewStyleOf(screen.getByTestId('activity-badge-like')).borderColor).toBe(bgHex.dark);
  });

  it('rings it in paper’s ground on the light look', async () => {
    state.scheme = 'light';
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan')]);
    await show();
    expect(viewStyleOf(screen.getByTestId('activity-badge-like')).borderColor).toBe(bgHex.light);
  });

  // Crew's hairline (owner, 13 Nov 2026): across the row inside the
  // card, none above the first — the rows of a card, not a list's inset.
  it('draws Crew’s hairline between rows, across the row, none above the first', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'a'), like(ago(9 * MIN), 'b')]);
    await show();
    const [first, second] = screen.getAllByTestId('activity-row');
    expect(viewStyleOf(first).borderTopWidth ?? 0).toBe(0);
    expect(viewStyleOf(second)).toMatchObject({
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
    });
    // And not again on the words: one line between two rows.
    expect(viewStyleOf(whoOf(second).lastElementChild as HTMLElement).borderTopWidth ?? 0).toBe(0);
  });

  it('is a line to read, not a control, and says in words what the badge shows', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan', 'Lan Phạm')]);
    data.fetchCopies.mockImplementation(async () => [copy(ago(9 * MIN), null)]);
    await show();
    const rows = screen.getAllByTestId('activity-row');
    expect(rows.map((r) => whoOf(r).getAttribute('aria-label'))).toEqual([
      'Lan Phạm, @lan, Liked, 5m',
      'Someone, Saved a copy, 9m',
    ]);
    // The row is not a button; the one control in it is its friend
    // button, beside the words and not around them.
    for (const r of rows) expect(r.getAttribute('role')).toBeNull();
    expect(within(rows[0]).getAllByRole('button').map((b) => b.textContent)).toEqual(['Add friend']);
    expect(within(whoOf(rows[0])).queryAllByRole('button')).toEqual([]);
    expect(within(rows[1]).queryAllByRole('button')).toEqual([]);
  });
});

describe('the states', () => {
  it('turns while the list is still loading, with no card yet', async () => {
    state.mine = [];
    state.mineLoading = true;
    await show();
    expect(screen.queryByTestId('activity-list')).toBeNull();
    expect(screen.queryByTestId('activity-empty')).toBeNull();
    expect(document.querySelector('[role="progressbar"]')).toBeTruthy();
  });

  // Both halves or neither: the copies that came first wait for the
  // likes, so a row never lands above one that arrives a beat later.
  it('turns under the card while the acts are on their way', async () => {
    data.fetchApplause.mockImplementation(() => new Promise(() => {}));
    data.fetchCopies.mockImplementation(async () => [copy(ago(5 * MIN), 'minh')]);
    await show();
    expect(screen.getByTestId('activity-list')).toBeTruthy();
    expect(screen.getByTestId('activity-loading')).toBeTruthy();
    expect(screen.queryByTestId('activity-empty')).toBeNull();
    expect(screen.queryByTestId('activity-row')).toBeNull();
  });

  it('says nobody yet on a public list nobody has acted on, with nothing to press', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(MIN), 'x', null, 'c2')]);
    await show();
    const empty = screen.getByTestId('activity-empty');
    expect(empty.textContent).toBe('No likes or copies yetWhen someone likes or copies this collection, you will see it here.');
    expect(screen.queryByTestId('activity-retry')).toBeNull();
  });

  it('says it failed, with Try again, when both halves fail — and Try again asks again', async () => {
    data.fetchApplause.mockImplementation(async () => { throw new Error('offline'); });
    data.fetchCopies.mockImplementation(async () => { throw new Error('offline'); });
    await show();
    expect(screen.getByTestId('activity-failed').textContent).toContain("Couldn't load your activity");
    expect(screen.queryByTestId('activity-empty')).toBeNull();
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan')]);
    data.fetchCopies.mockImplementation(async () => []);
    fireEvent.click(screen.getByTestId('activity-retry'));
    await flush();
    expect(data.fetchApplause).toHaveBeenCalledTimes(2);
    expect(data.fetchCopies).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('activity-failed')).toBeNull();
    expect(rowLines()).toEqual([['lan 5m']]);
  });

  // While Try again is out, the page turns: the failure has cleared,
  // and nothing has come back yet to say whether there is anything.
  it('turns while Try again asks, rather than saying there is nothing', async () => {
    data.fetchApplause.mockImplementation(async () => { throw new Error('offline'); });
    data.fetchCopies.mockImplementation(async () => { throw new Error('offline'); });
    await show();
    expect(screen.getByTestId('activity-failed')).toBeTruthy();
    let answer!: (rows: Applause[]) => void;
    data.fetchApplause.mockImplementation(() => new Promise((r) => { answer = r; }));
    data.fetchCopies.mockImplementation(async () => []);
    fireEvent.click(screen.getByTestId('activity-retry'));
    await flush();
    expect(screen.getByTestId('activity-loading')).toBeTruthy();
    expect(screen.queryByTestId('activity-empty')).toBeNull();
    expect(screen.queryByTestId('activity-failed')).toBeNull();
    await act(async () => { answer([]); });
    expect(screen.getByTestId('activity-empty')).toBeTruthy();
  });

  // A kept answer that was empty is an answer: opened again, the page
  // says so at once and draws no spinner while it asks behind it.
  it('draws a kept empty answer as empty, without a spinner, while it refreshes', async () => {
    await show();
    cleanup();
    data.fetchApplause.mockImplementation(() => new Promise(() => {}));
    data.fetchCopies.mockImplementation(() => new Promise(() => {}));
    await show();
    expect(screen.getByTestId('activity-empty')).toBeTruthy();
    expect(screen.queryByTestId('activity-loading')).toBeNull();
  });

  // A retry that succeeds with nothing is an empty list, not the old
  // failure left standing.
  it('forgets the failure once Try again comes back with nothing', async () => {
    data.fetchApplause.mockImplementation(async () => { throw new Error('offline'); });
    await show();
    expect(screen.getByTestId('activity-failed')).toBeTruthy();
    data.fetchApplause.mockImplementation(async () => []);
    fireEvent.click(screen.getByTestId('activity-retry'));
    await flush();
    expect(screen.queryByTestId('activity-failed')).toBeNull();
    expect(screen.getByTestId('activity-empty')).toBeTruthy();
  });

  it('says it failed when either half fails and the other has nothing', async () => {
    data.fetchCopies.mockImplementation(async () => { throw new Error('offline'); });
    await show();
    expect(screen.getByTestId('activity-failed')).toBeTruthy();
    cleanup();
    data.fetchCopies.mockImplementation(async () => []);
    data.fetchApplause.mockImplementation(async () => { throw new Error('offline'); });
    await show();
    expect(screen.getByTestId('activity-failed')).toBeTruthy();
  });

  // Opened again, the page draws what it was last told on its first
  // render — no spinner, no empty frame — and asks again behind it.
  it('opens on the kept answer without a spinner, and refreshes it behind', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan', 'Lan Phạm')]);
    await show();
    cleanup();
    let answer!: (rows: Applause[]) => void;
    data.fetchApplause.mockImplementation(() => new Promise((r) => { answer = r; }));
    render(
      <CollectionActivityScreen
        navigation={{ goBack: vi.fn(), navigate: vi.fn() } as unknown as Nav}
        route={{ params: { slug: 'old-quarter' } } as RootRoute<'CollectionActivity'>}
      />,
    );
    // The first render, before any promise has had a turn.
    expect(screen.queryByTestId('activity-loading')).toBeNull();
    expect(document.querySelector('[role="progressbar"]')).toBeNull();
    expect(rowLines()).toEqual([['Lan Phạm', '@lan · 5m']]);
    expect(data.fetchApplause).toHaveBeenCalledTimes(2);
    await act(async () => { answer([like(ago(1 * MIN), 'an', 'An Lê'), like(ago(5 * MIN), 'lan', 'Lan Phạm')]); });
    expect(rowLines()).toEqual([['An Lê', '@an · 1m'], ['Lan Phạm', '@lan · 5m']]);
  });

  // A refresh that fails behind kept rows keeps them, and says nothing:
  // the failure state is for a page with nothing to show.
  it('keeps the kept rows when the refresh behind them fails', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan')]);
    await show();
    cleanup();
    data.fetchApplause.mockImplementation(async () => { throw new Error('offline'); });
    data.fetchCopies.mockImplementation(async () => { throw new Error('offline'); });
    await show();
    expect(rowLines()).toEqual([['lan 5m']]);
    expect(screen.queryByTestId('activity-failed')).toBeNull();
  });

  // Reopened after one half failed and the other came back: the kept
  // half's rows stand while the failed one is asked again, rather than
  // being taken away for a spinner.
  it('keeps one half’s kept rows on screen while the failed half is asked again', async () => {
    data.fetchApplause.mockImplementation(async () => { throw new Error('offline'); });
    data.fetchCopies.mockImplementation(async () => [copy(ago(5 * MIN), 'minh')]);
    await show();
    cleanup();
    data.fetchApplause.mockImplementation(() => new Promise(() => {}));
    await show();
    expect(rowLines()).toEqual([['minh 5m']]);
    expect(screen.queryByTestId('activity-loading')).toBeNull();
  });

  it('shows what came back when only one half failed', async () => {
    data.fetchApplause.mockImplementation(async () => { throw new Error('offline'); });
    data.fetchCopies.mockImplementation(async () => [copy(ago(5 * MIN), 'minh')]);
    await show();
    expect(screen.queryByTestId('activity-failed')).toBeNull();
    expect(rowLines()).toEqual([['minh 5m']]);
  });
});

// ── the way to the statistics, the people's card, the friend button (owner, 13 Nov 2026) ──

/** The `hitSlop` a pressable was given, read off its props. */
const slopOf = (el: HTMLElement): unknown => {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'))!;
  type Fiber = { memoizedProps?: { hitSlop?: unknown }; return?: Fiber };
  let f: Fiber | undefined = (el as unknown as Record<string, Fiber>)[key];
  while (f && f.memoizedProps?.hitSlop === undefined) f = f.return;
  return f?.memoizedProps?.hitSlop;
};
const edge = (requester: string, addressee: string, status: 'pending' | 'accepted' = 'pending'): FriendshipRow =>
  ({ requester, addressee, status, created_at: '2026-11-01T00:00:00Z' });

// One row between the list and the people, "Statistics ›", where the two
// counts and their filter stood (owner, 13 Nov 2026): it opens the list's
// figures, which this page asks for as it opens.
describe('the way to the statistics', () => {
  const link = () => screen.getByTestId('activity-stats-link');

  it('stands between the list’s card and the people, and opens the list’s statistics', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(1 * MIN), 'a')]);
    const navigation = await show();
    const card = screen.getByTestId('activity-list');
    const people = screen.getByTestId('activity-people');
    expect(card.compareDocumentPosition(link()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(link().compareDocumentPosition(people) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Statistics' }));
    expect(navigation.navigate).toHaveBeenCalledExactlyOnceWith('CollectionStats', { slug: 'old-quarter' });
  });

  it('leads with the bar chart, ends with a chevron, and says it in Vietnamese', async () => {
    await show();
    const icons = [...link().querySelectorAll('[data-icon]')].map((g) => g.getAttribute('data-icon'));
    expect(icons).toEqual(['stats-chart-outline', 'chevron-forward']);
    expect(link().textContent).toBe('Statistics');
    expect(textStyleOf(within(link()).getByText('Statistics'))?.flex).toBe(1);
    cleanup();
    state.lang = 'vi';
    await show();
    expect(link().textContent).toBe('Thống kê');
  });

  // Opens and trips have no people to list, so an empty Activity is not
  // an empty Statistics page.
  it('is there while nobody has liked or copied the list, right under the list, above the empty state', async () => {
    await show();
    const empty = screen.getByTestId('activity-empty');
    expect(link().compareDocumentPosition(empty) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is there while the acts are on their way', async () => {
    data.fetchApplause.mockImplementation(() => new Promise(() => {}));
    await show();
    expect(screen.getByTestId('activity-loading')).toBeTruthy();
    expect(link()).toBeTruthy();
  });

  it('is not there for a list that is not yours, or one with no id', async () => {
    await show('somebody-elses');
    expect(screen.queryByTestId('activity-stats-link')).toBeNull();
    cleanup();
    state.mine = [list({ id: undefined })];
    await show();
    expect(screen.queryByTestId('activity-stats-link')).toBeNull();
  });

  it('asks for the figures as the page opens, for this list and its owner', async () => {
    await show();
    expect(data.fetchCollectionStats).toHaveBeenCalledExactlyOnceWith('c1');
    cleanup();
    data.fetchCollectionStats.mockClear();
    forgetSharedFetches();
    state.me = null;
    await show();
    expect(data.fetchCollectionStats).not.toHaveBeenCalled();
  });

  // No count and no filter any more: every act, always, and nothing on
  // the page narrows them.
  it('lists everyone, likes and copies together, with nothing to narrow them', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(1 * MIN), 'a'), like(ago(3 * MIN), 'b')]);
    data.fetchCopies.mockImplementation(async () => [copy(ago(2 * MIN), 'd')]);
    await show();
    expect(rowLines().map((r) => r[0].split(' ')[0])).toEqual(['a', 'd', 'b']);
    expect(screen.queryByTestId('activity-stats')).toBeNull();
    expect(screen.queryByTestId('activity-stat-like')).toBeNull();
    expect(screen.queryByTestId('activity-stat-copy')).toBeNull();
    expect(screen.queryAllByRole('button').map((b) => b.textContent)).not.toContain('Likes');
  });
});

describe('the people, in a card', () => {
  it('puts every row in one card, as Crew’s friends are, at the page’s gap', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(1 * MIN), 'a'), like(ago(2 * MIN), 'b')]);
    data.fetchCopies.mockImplementation(async () => [copy(ago(3 * MIN), 'c')]);
    await show();
    const people = screen.getByTestId('activity-people');
    expect([...people.children]).toEqual(screen.getAllByTestId('activity-row'));
    // `Card` itself: its radius, its ground and its rim.
    expect(viewStyleOf(people)).toMatchObject({
      borderRadius: radius.card, backgroundColor: colors.surfaceCard, borderWidth: 1, marginBottom: 14,
    });
    // The statistics row's card, the same card at the same gap.
    expect(viewStyleOf(screen.getByTestId('activity-stats-link').parentElement!)).toMatchObject({ borderRadius: radius.card, marginBottom: 14 });
  });

  it('pads each row as Crew’s are', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(1 * MIN), 'a')]);
    await show();
    expect(viewStyleOf(screen.getByTestId('activity-row'))).toMatchObject({
      flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 13,
    });
  });
});

describe('the friend button', () => {
  const rowOf = (handle: string) => screen.getAllByTestId('activity-row')
    .find((r) => rowLines()[screen.getAllByTestId('activity-row').indexOf(r)][0].startsWith(handle))!;
  const buttonOf = (handle: string) => {
    const r = rowOf(handle);
    return (r.lastElementChild === whoOf(r) ? null : r.lastElementChild) as HTMLElement | null;
  };

  it('offers each state by what stands between you, at the row’s right end', async () => {
    crew.ships.data = [
      edge('me', 'id-friend', 'accepted'),
      edge('me', 'id-waiting'),
      edge('id-asker', 'me'),
    ];
    data.fetchApplause.mockImplementation(async () => [
      like(ago(1 * MIN), 'friend'), like(ago(2 * MIN), 'waiting'), like(ago(3 * MIN), 'asker'), like(ago(4 * MIN), 'stranger'),
    ]);
    await show();
    expect(buttonOf('friend')!.textContent).toBe('Friends');
    expect(buttonOf('waiting')!.textContent).toBe('Requested');
    expect(buttonOf('asker')!.textContent).toBe('Accept');
    expect(buttonOf('stranger')!.textContent).toBe('Add friend');
    // Friends and Requested are states to read; the other two are controls.
    expect(buttonOf('friend')!.getAttribute('role')).toBeNull();
    expect(buttonOf('waiting')!.getAttribute('role')).toBeNull();
    expect(buttonOf('asker')!.getAttribute('role')).toBe('button');
    expect(buttonOf('stranger')!.getAttribute('role')).toBe('button');
  });

  it('says them in Vietnamese', async () => {
    state.lang = 'vi';
    crew.ships.data = [edge('me', 'id-friend', 'accepted'), edge('me', 'id-waiting'), edge('id-asker', 'me')];
    data.fetchApplause.mockImplementation(async () => [
      like(ago(1 * MIN), 'friend'), like(ago(2 * MIN), 'waiting'), like(ago(3 * MIN), 'asker'), like(ago(4 * MIN), 'stranger'),
    ]);
    await show();
    expect(['friend', 'waiting', 'asker', 'stranger'].map((h) => buttonOf(h)!.textContent))
      .toEqual(['Bạn bè', 'Đã gửi', 'Đồng ý', 'Kết bạn']);
  });

  it('wears Crew’s looks: the quiet outline, the glass pill, the gradient — each at the chip’s height', async () => {
    crew.ships.data = [edge('me', 'id-friend', 'accepted'), edge('me', 'id-waiting'), edge('id-asker', 'me')];
    data.fetchApplause.mockImplementation(async () => [
      like(ago(1 * MIN), 'friend'), like(ago(2 * MIN), 'waiting'), like(ago(3 * MIN), 'asker'), like(ago(4 * MIN), 'stranger'),
    ]);
    await show();
    for (const h of ['friend', 'waiting']) {
      expect(viewStyleOf(buttonOf(h)!)).toMatchObject({
        borderWidth: 1, borderColor: colors.borderGlass, borderRadius: radius.pill, minHeight: CHIP_H,
      });
      expect(textStyleOf(within(buttonOf(h)!).getByText(/./))?.color).toBe(colors.textTertiary);
    }
    const add = buttonOf('stranger')!.firstElementChild!.firstElementChild as HTMLElement;
    expect(viewStyleOf(add)).toMatchObject({ backgroundColor: colors.surfaceGlass, borderRadius: radius.pill, minHeight: CHIP_H });
    expect(add.querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('person-add-outline');
    const accept = buttonOf('asker')!;
    expect(accept.querySelector('[data-stub="LinearGradient"]')).toBeTruthy();
    expect(viewStyleOf(accept.querySelector('[data-stub="LinearGradient"]') as HTMLElement).minHeight).toBe(CHIP_H);
    expect(textStyleOf(within(accept).getByText('Accept'))?.color).toBe(colors.accentInk);
    // 44 to the thumb, the chip's slop.
    expect(slopOf(buttonOf('stranger')!)).toEqual(CHIP_SLOP);
    expect(slopOf(accept)).toEqual(CHIP_SLOP);
  });

  it('offers nothing to somebody you blocked, to yourself, or to a row with nobody behind it', async () => {
    crew.blocks.data = ['id-blocked'];
    data.fetchApplause.mockImplementation(async () => [
      like(ago(1 * MIN), 'blocked'),
      { ...like(ago(2 * MIN), 'andy'), liker_id: 'me' },
      like(ago(3 * MIN), null),
      // A function from before the ids rode the rows: no id at all.
      { collection_id: 'c1', liked_at: ago(4 * MIN), liker_handle: 'old', liker_name: null },
    ]);
    await show();
    for (const r of screen.getAllByTestId('activity-row')) expect(r.lastElementChild).toBe(whoOf(r));
  });

  describe('Add friend', () => {
    const only = () => {
      data.fetchApplause.mockImplementation(async () => [like(ago(1 * MIN), 'lan', 'Lan Phạm')]);
    };

    it('sends the request as you, says Requested at once, and reads the crew again', async () => {
      only();
      let done!: () => void;
      data.sendFriendRequest.mockImplementation(() => new Promise<void>((r) => { done = r; }));
      await show();
      fireEvent.click(within(rowOf('Lan')).getByRole('button', { name: 'Add friend' }));
      expect(data.sendFriendRequest).toHaveBeenCalledExactlyOnceWith('me', 'id-lan');
      // Before the server has answered.
      expect(buttonOf('Lan')!.textContent).toBe('Requested');
      expect(buttonOf('Lan')!.getAttribute('role')).toBeNull();
      expect(crew.ships.reload).not.toHaveBeenCalled();
      await act(async () => { done(); });
      expect(crew.ships.reload).toHaveBeenCalledTimes(1);
      expect(buttonOf('Lan')!.textContent).toBe('Requested');
      expect(alert).not.toHaveBeenCalled();
    });

    it('goes back to Add friend and says so when the request fails', async () => {
      only();
      data.sendFriendRequest.mockImplementation(async () => { throw new Error('Network request failed'); });
      await show();
      await act(async () => { fireEvent.click(within(rowOf('Lan')).getByRole('button', { name: 'Add friend' })); });
      expect(alert).toHaveBeenCalledExactlyOnceWith('Could not send the request', 'Network request failed');
      expect(buttonOf('Lan')!.textContent).toBe('Add friend');
      expect(crew.ships.reload).not.toHaveBeenCalled();
    });

    // A refusal across a block must not say that it was one.
    it('does not say why when the policy refused it', async () => {
      only();
      data.sendFriendRequest.mockImplementation(async () => {
        throw new Error('new row violates row-level security policy for table "friendships"');
      });
      await show();
      await act(async () => { fireEvent.click(within(rowOf('Lan')).getByRole('button', { name: 'Add friend' })); });
      expect(alert).toHaveBeenCalledExactlyOnceWith('Could not send the request', undefined);
    });

    it('says it failed in Vietnamese', async () => {
      state.lang = 'vi';
      only();
      data.sendFriendRequest.mockImplementation(async () => { throw new Error('offline'); });
      await show();
      await act(async () => { fireEvent.click(within(rowOf('Lan')).getByRole('button', { name: 'Kết bạn' })); });
      expect(alert).toHaveBeenCalledExactlyOnceWith('Không gửi được lời mời', 'offline');
    });

    // Two rows by one person — a like and a copy — are one person: a tap
    // on either says Requested on both, and sends once.
    it('answers for the person on every row of theirs', async () => {
      only();
      data.fetchCopies.mockImplementation(async () => [copy(ago(2 * MIN), 'lan', 'Lan Phạm')]);
      data.sendFriendRequest.mockImplementation(() => new Promise<void>(() => {}));
      await show();
      const rows = screen.getAllByTestId('activity-row');
      fireEvent.click(within(rows[0]).getByRole('button', { name: 'Add friend' }));
      expect(rows.map((r) => (r.lastElementChild as HTMLElement).textContent)).toEqual(['Requested', 'Requested']);
      expect(data.sendFriendRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accept', () => {
    const asked = () => {
      crew.ships.data = [edge('id-lan', 'me')];
      data.fetchApplause.mockImplementation(async () => [like(ago(1 * MIN), 'lan', 'Lan Phạm')]);
    };

    it('accepts their request, says Friends at once, and reads the crew again', async () => {
      asked();
      let done!: () => void;
      data.acceptFriendRequest.mockImplementation(() => new Promise<void>((r) => { done = r; }));
      await show();
      fireEvent.click(within(rowOf('Lan')).getByRole('button', { name: 'Accept' }));
      expect(data.acceptFriendRequest).toHaveBeenCalledExactlyOnceWith('id-lan', 'me');
      expect(data.sendFriendRequest).not.toHaveBeenCalled();
      expect(buttonOf('Lan')!.textContent).toBe('Friends');
      await act(async () => { done(); });
      expect(crew.ships.reload).toHaveBeenCalledTimes(1);
    });

    it('goes back to Accept and says so when it fails', async () => {
      asked();
      data.acceptFriendRequest.mockImplementation(async () => { throw new Error('offline'); });
      await show();
      await act(async () => { fireEvent.click(within(rowOf('Lan')).getByRole('button', { name: 'Accept' })); });
      expect(alert).toHaveBeenCalledExactlyOnceWith('Could not accept the request', 'offline');
      expect(buttonOf('Lan')!.textContent).toBe('Accept');
    });

    it('says it failed in Vietnamese', async () => {
      state.lang = 'vi';
      asked();
      data.acceptFriendRequest.mockImplementation(async () => { throw new Error('offline'); });
      await show();
      await act(async () => { fireEvent.click(within(rowOf('Lan')).getByRole('button', { name: 'Đồng ý' })); });
      expect(alert).toHaveBeenCalledExactlyOnceWith('Không chấp nhận được lời mời', 'offline');
    });
  });

  // One write per person in flight: the tap takes the button away until
  // the write has answered, so there is no second tap to send; a failure
  // gives the button back.
  it('leaves nothing to tap twice while the first is out', async () => {
    crew.ships.data = [edge('id-lan', 'me')];
    data.fetchApplause.mockImplementation(async () => [like(ago(1 * MIN), 'lan')]);
    let fail!: (e: Error) => void;
    data.acceptFriendRequest.mockImplementation(() => new Promise<void>((_r, j) => { fail = j; }));
    await show();
    const accept = within(rowOf('lan')).getByRole('button', { name: 'Accept' });
    fireEvent.click(accept);
    // Friends now, and nothing to tap.
    expect(within(rowOf('lan')).queryByRole('button')).toBeNull();
    await act(async () => { fail(new Error('offline')); });
    expect(within(rowOf('lan')).getByRole('button', { name: 'Accept' })).toBeTruthy();
    expect(data.acceptFriendRequest).toHaveBeenCalledTimes(1);
  });
});

// ── a pull (owner, 13 Nov 2026) ──
//
// Both halves again, and the crew the friend buttons read. The gesture
// has no jsdom counterpart, so the pull is the RefreshControl's
// `onRefresh`, read off the committed tree, and the spinner its
// `refreshing` — as the collection page's test reads them.
describe('pulling the page down', () => {
  const propsWhere = (pick: (p: Record<string, unknown>) => boolean): Record<string, unknown> => {
    type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
    const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
    const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
    const stack: Fiber[] = [host[key].stateNode.current];
    while (stack.length) {
      const fb = stack.pop()!;
      const p = fb.memoizedProps;
      if (p && typeof p === 'object' && pick(p)) return p;
      if (fb.sibling) stack.push(fb.sibling);
      if (fb.child) stack.push(fb.child);
    }
    throw new Error('nothing matched');
  };
  const page = () => propsWhere((p) => 'onRefresh' in p && 'refreshing' in p) as { onRefresh: () => void; refreshing: boolean };
  const pull = () => act(() => { page().onRefresh(); });
  const screenEl = () => (
    <CollectionActivityScreen
      navigation={{ goBack: vi.fn(), navigate: vi.fn() } as unknown as Nav}
      route={{ params: { slug: 'old-quarter' } } as RootRoute<'CollectionActivity'>}
    />
  );
  /** An ask the test answers when it chooses. */
  const held = <T,>(fn: { mockImplementationOnce: (f: () => Promise<T>) => unknown }) => {
    let ok: (v: T) => void = () => {};
    fn.mockImplementationOnce(() => new Promise<T>((r) => { ok = r; }));
    return (v: T) => act(async () => { ok(v); });
  };

  it('asks both halves again, and the crew', async () => {
    await show();
    expect(data.fetchApplause).toHaveBeenCalledTimes(1);
    pull();
    expect(data.fetchApplause).toHaveBeenCalledTimes(2);
    expect(data.fetchCopies).toHaveBeenCalledTimes(2);
    expect(crew.ships.reload).toHaveBeenCalledTimes(1);
  });

  it('keeps the rows drawn while it asks, and spins until both halves are in', async () => {
    data.fetchApplause.mockImplementationOnce(async () => [like(ago(5 * MIN), 'lan', 'Lan Phạm')]);
    await show();
    const likes = held<Applause[]>(data.fetchApplause);
    const copies = held<Copy[]>(data.fetchCopies);
    pull();
    expect(page().refreshing).toBe(true);
    expect(rowLines()).toEqual([['Lan Phạm', '@lan · 5m']]);
    expect(screen.queryByTestId('activity-loading')).toBeNull();
    await likes([like(ago(1 * MIN), 'an', 'An Lê'), like(ago(5 * MIN), 'lan', 'Lan Phạm')]);
    expect(page().refreshing).toBe(true);
    await copies([]);
    expect(page().refreshing).toBe(false);
    expect(rowLines()).toEqual([['An Lê', '@an · 1m'], ['Lan Phạm', '@lan · 5m']]);
  });

  // Either half still out keeps it lit, whichever lands first.
  it('spins while the likes are still out after the copies are in', async () => {
    await show();
    const likes = held<Applause[]>(data.fetchApplause);
    const copies = held<Copy[]>(data.fetchCopies);
    pull();
    await copies([]);
    expect(page().refreshing).toBe(true);
    await likes([]);
    expect(page().refreshing).toBe(false);
  });

  it('keeps the rows when the pull fails', async () => {
    data.fetchApplause.mockImplementationOnce(async () => [like(ago(5 * MIN), 'lan')]);
    await show();
    data.fetchApplause.mockImplementationOnce(async () => { throw new Error('offline'); });
    data.fetchCopies.mockImplementationOnce(async () => { throw new Error('offline'); });
    pull();
    await flush();
    expect(page().refreshing).toBe(false);
    expect(rowLines()).toEqual([['lan 5m']]);
    expect(screen.queryByTestId('activity-failed')).toBeNull();
  });

  // A "Requested" the other person has accepted since: the crew read
  // again says Friends, and the spinner stays until it has.
  it('spins until the crew it asked for is in, and the button says what the crew now says', async () => {
    crew.ships.data = [edge('me', 'id-lan')];
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan')]);
    const { rerender } = render(screenEl());
    await flush();
    expect(screen.getByTestId('activity-requested')).toBeTruthy();
    // What the provider does on a reload: the edges are out again.
    crew.ships.reload.mockImplementationOnce(() => { crew.ships.loading = true; });
    pull();
    await flush();
    expect(page().refreshing).toBe(true);
    crew.ships.data = [edge('me', 'id-lan', 'accepted')];
    crew.ships.loading = false;
    rerender(screenEl());
    expect(page().refreshing).toBe(false);
    expect(screen.getByTestId('activity-friends')).toBeTruthy();
  });

  // The spinner is the pull's: the ask every open makes behind a kept
  // answer does not light it, and a pull while it is out joins it.
  it('is not lit by the refresh behind a kept answer, and joins it rather than asking again', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan')]);
    await show();
    cleanup();
    const likes = held<Applause[]>(data.fetchApplause);
    render(screenEl());
    expect(rowLines()).toEqual([['lan 5m']]);
    await flush();
    expect(page().refreshing).toBe(false);
    pull();
    expect(data.fetchApplause).toHaveBeenCalledTimes(2);
    expect(page().refreshing).toBe(true);
    await likes([like(ago(5 * MIN), 'lan')]);
    expect(page().refreshing).toBe(false);
  });

  it('leaves a crew refresh already out to land, and waits for it', async () => {
    crew.ships.loading = true;
    const { rerender } = render(screenEl());
    await flush();
    expect(page().refreshing).toBe(false);
    pull();
    await flush();
    expect(crew.ships.reload).not.toHaveBeenCalled();
    expect(page().refreshing).toBe(true);
    crew.ships.loading = false;
    rerender(screenEl());
    expect(page().refreshing).toBe(false);
  });
});
