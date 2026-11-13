// @vitest-environment jsdom
//
// One list's activity (owner, 13 Nov 2026): the list in a small card,
// then every like and copy on it, all time, newest first. What is pinned
// here is what the page asks for (the epoch, so all time), which rows it
// keeps (this list's, one per act), how each row reads (the handle, the
// card head's compact age with "now" for "New", the name, the badge for
// the kind), and the four states — loading, empty (private, public, not
// yours), failed with Try again — and that a row is not a control.
// `actsOn`, `listAgeOf` and `ageWord` run for real; only the I/O seams
// and the providers are stood in.

import React from 'react';
import { StyleSheet } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, fontSizeOf, render, screen, textStyleOf, viewStyleOf, within } from '../uitest/render';
import type { Nav, RootRoute } from '../nav';
import type { Applause, Copy } from '../lib/friends';
import type { Collection } from '../lib/types';
import { bgHex, colors, font } from '../theme';

const NOW = new Date(2026, 10, 13, 12, 0, 0);
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

const data = vi.hoisted(() => ({
  fetchApplause: vi.fn(async (_since: string): Promise<Applause[]> => []),
  fetchCopies: vi.fn(async (_since: string): Promise<Copy[]> => []),
  avatars: {} as Record<string, string>,
  avatarsAsked: vi.fn((_handles: string[]) => {}),
}));
vi.mock('../lib/data', () => ({
  fetchApplause: data.fetchApplause,
  fetchCopies: data.fetchCopies,
  useCuratorAvatarsQuery: (handles: string[]) => { data.avatarsAsked(handles); return { data: data.avatars }; },
}));

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

const like = (liked_at: string, liker_handle: string | null, liker_name: string | null = null, collection_id = 'c1'): Applause =>
  ({ collection_id, liked_at, liker_handle, liker_name });
const copy = (copied_at: string, copier_handle: string | null, copier_name: string | null = null, collection_id = 'c1'): Copy =>
  ({ collection_id, copied_at, copier_handle, copier_name });

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

/** Each row's two lines, as read: line one's words, then line two's. */
const rowLines = () => screen.getAllByTestId('activity-row').map((r) => {
  const lines = r.lastElementChild as HTMLElement;
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  data.fetchApplause.mockImplementation(async () => []);
  data.fetchCopies.mockImplementation(async () => []);
  data.avatars = {};
  state.me = 'me';
  state.profile = { handle: 'andy', avatar_url: 'https://faces/andy.jpg' };
  state.mine = [list()];
  state.mineLoading = false;
  state.lang = 'en';
  state.scheme = 'dark';
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
    expect(within(card).getByText('@andy')).toBeTruthy();
    expect(within(card).queryByText('@stale')).toBeNull();
    expect(within(card).getByText('3h')).toBeTruthy();
    expect(screen.getByTestId('activity-list-title').textContent).toBe('Old Quarter eats');
    expect(screen.getByTestId('activity-list-desc').textContent).toBe('Where we eat when friends visit.');
    // The head first, then the words: in that order in the card.
    expect(card.textContent).toBe('@andy3hOld Quarter eatsWhere we eat when friends visit.');
  });

  it('sets the title in bold and cuts the words at three lines', async () => {
    await show();
    expect(textStyleOf(screen.getByTestId('activity-list-title'))?.fontWeight).toBe(font.bold);
    expect(linesOf(screen.getByTestId('activity-list-desc'))).toBe(3);
    expect(linesOf(screen.getByTestId('activity-list-title'))).toBeUndefined();
    // A summary: no "Read more".
    expect(screen.queryByText(/Read more/)).toBeNull();
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

  it('asks nothing for a private list, and says only a public one can be liked or copied', async () => {
    state.mine = [list({ is_public: false })];
    await show();
    expect(data.fetchApplause).not.toHaveBeenCalled();
    expect(data.fetchCopies).not.toHaveBeenCalled();
    const empty = screen.getByTestId('activity-private');
    expect(empty.textContent).toContain('No likes or copies yet');
    expect(empty.textContent).toContain('Only a public collection can be liked or copied');
    // The card still says which list this is.
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
    expect(rowLines()).toEqual([
      ['@lan 5m', 'Lan Phạm'],
      ['@lan 30m', 'Lan Phạm'],
      ['@minh 2h', 'Minh Trần'],
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
    expect(rowLines().map((r) => r[0])).toEqual(['@a now', '@b 12 Nov', '@c 12 Nov 2025']);
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
    expect(rowLines().map((r) => r[0])).toEqual(['@a Vừa xong', '@b 5p', '@c 3h', '@d 12/11', '@e 12/11/25']);
  });

  it('calls a person whose profile is gone Someone, with no second line', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), null, null)]);
    await show();
    expect(rowLines()).toEqual([['Someone 5m']]);
  });

  it('sets the handle in semibold and the age and the name in grey', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan', 'Lan Phạm')]);
    await show();
    const row = screen.getByTestId('activity-row');
    expect(textStyleOf(within(row).getByText('@lan'))).toMatchObject({ fontWeight: font.semibold, color: colors.text });
    expect(textStyleOf(within(row).getByText('5m'))?.color).toBe(colors.textTertiary);
    expect(textStyleOf(within(row).getByText('Lan Phạm'))?.color).toBe(colors.textSecondary);
  });

  it('wears each face from the one batched ask, and the blank disc without one', async () => {
    data.avatars = { lan: 'https://faces/lan.jpg' };
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan'), like(ago(9 * MIN), 'nobody')]);
    data.fetchCopies.mockImplementation(async () => [copy(ago(7 * MIN), null)]);
    await show();
    expect(data.avatarsAsked).toHaveBeenLastCalledWith(['lan', '', 'nobody']);
    const rows = screen.getAllByTestId('activity-row');
    expect(rows[0].querySelector('img')!.getAttribute('src')).toBe('https://faces/lan.jpg');
    expect(rows[1].querySelector('img')).toBeNull();
    expect(rows[2].querySelector('img')).toBeNull();
  });

  // The faces come back keyed by the folded handle (`fetchCuratorAvatars`
  // normalises), so the row folds its own before it looks.
  it('finds the face whatever the handle’s case', async () => {
    data.avatars = { lan: 'https://faces/lan.jpg' };
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'Lan')]);
    await show();
    expect(screen.getByTestId('activity-row').querySelector('img')!.getAttribute('src')).toBe('https://faces/lan.jpg');
  });

  it('draws a 40pt face', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan')]);
    await show();
    const face = screen.getByTestId('activity-row').firstElementChild as HTMLElement;
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
      expect(b.parentElement).toBe(b.closest('[data-testid="activity-row"]')!.firstElementChild);
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

  it('draws a hairline between rows, from the text column, none above the first', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'a'), like(ago(9 * MIN), 'b')]);
    await show();
    const [first, second] = screen.getAllByTestId('activity-row');
    const lines = (r: HTMLElement) => r.lastElementChild as HTMLElement;
    expect(viewStyleOf(lines(first)).borderTopWidth ?? 0).toBe(0);
    expect(viewStyleOf(lines(second))).toMatchObject({
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderGlassSoft,
    });
    // The row itself carries none, so the face stands clear of it.
    expect(viewStyleOf(second).borderTopWidth ?? 0).toBe(0);
  });

  it('is a line to read, not a control, and says in words what the badge shows', async () => {
    data.fetchApplause.mockImplementation(async () => [like(ago(5 * MIN), 'lan', 'Lan Phạm')]);
    data.fetchCopies.mockImplementation(async () => [copy(ago(9 * MIN), null)]);
    await show();
    const rows = screen.getAllByTestId('activity-row');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      '@lan, Lan Phạm, Liked, 5m',
      'Someone, Saved a copy, 9m',
    ]);
    // No Follow, no Add friend, nothing to press in the list but Back.
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Back']);
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
    expect(rowLines()).toEqual([['@lan 5m']]);
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

  it('shows what came back when only one half failed', async () => {
    data.fetchApplause.mockImplementation(async () => { throw new Error('offline'); });
    data.fetchCopies.mockImplementation(async () => [copy(ago(5 * MIN), 'minh')]);
    await show();
    expect(screen.queryByTestId('activity-failed')).toBeNull();
    expect(rowLines()).toEqual([['@minh 5m']]);
  });
});
