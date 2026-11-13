// @vitest-environment jsdom
//
// A list's statistics (owner, 13 Nov 2026): the list in its small card,
// then four tiles — Views, Likes, Copies, Trips — each its total large
// and the last seven days under it. What is pinned here is what the page
// asks for (this list, by id, for its owner alone), how a tile reads in
// either language, and the states: loading, nothing counted, failed with
// Try again, not yours. `statsOf`, `groupDigits` and the kept, shared
// answer (`useCollectionStatsQuery`) run for real; only the one RPC
// wrapper under them and the providers are stood in.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, render, screen, textStyleOf, viewStyleOf, within } from '../uitest/render';
import { cacheKey } from '../lib/data/cache';
import { forgetSharedFetches, prefetchShared } from '../lib/data/fetch';
import type { StatsRow } from '../lib/listStats';
import type { Nav, RootRoute } from '../nav';
import type { Collection } from '../lib/types';
import { colors, display } from '../theme';

const data = vi.hoisted(() => ({
  fetchCollectionStats: vi.fn(async (_id: string): Promise<StatsRow[]> => []),
}));
// The module the hook reads the RPC from, not the barrel.
vi.mock('../lib/data/stats', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchCollectionStats: data.fetchCollectionStats,
}));

const state = vi.hoisted(() => ({
  me: 'me' as string | null,
  mine: [] as unknown[],
  mineLoading: false,
  lang: 'en' as 'en' | 'vi',
}));
vi.mock('../lib/auth', () => {
  const all = () => ({
    session: state.me ? { user: { id: state.me } } : null,
    profile: { handle: 'andy', avatar_url: 'https://faces/andy.jpg' },
  });
  return { useAuth: all, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
vi.mock('../lib/save', () => ({
  useMyLists: () => ({ data: state.mine, loading: state.mineLoading, reload: () => {} }),
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string | null, vi: string | null) => (state.lang === 'vi' ? vi ?? en ?? '' : en ?? vi ?? ''),
  }),
}));

import CollectionStatsScreen from './CollectionStatsScreen';

const list = (over: Partial<Collection> = {}): Collection => ({
  id: 'c1', slug: 'old-quarter', title_en: 'Old Quarter eats', title_vi: 'Ăn phố cổ', title_ja: null,
  desc_en: 'Where we eat when friends visit.', desc_vi: null, desc_ja: null,
  curator_handle: null, cover: null, owner_id: 'me', is_public: true, city_id: 'hanoi',
  collection_places: [], created_at: '2026-11-01T00:00:00Z',
  ...over,
} as Collection);

const row = (over: Partial<StatsRow> = {}): StatsRow => ({
  views_total: 1284, views_7d: 37, likes_total: 12, likes_7d: 3,
  copies_total: 0, copies_7d: 0, trips_total: 5, trips_7d: 1, ...over,
});
const ZERO = row({ views_total: 0, views_7d: 0, likes_total: 0, likes_7d: 0, trips_total: 0, trips_7d: 0 });

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const show = async (slug = 'old-quarter') => {
  const navigation = { goBack: vi.fn(), navigate: vi.fn() };
  render(
    <CollectionStatsScreen
      navigation={navigation as unknown as Nav}
      route={{ params: { slug } } as RootRoute<'CollectionStats'>}
    />,
  );
  await flush();
  return navigation;
};
const tile = (k: string) => screen.getByTestId(`stats-${k}`);
const total = (k: string) => screen.getByTestId(`stats-${k}-total`).textContent;
const week = (k: string) => screen.getByTestId(`stats-${k}-week`).textContent;

beforeEach(async () => {
  vi.clearAllMocks();
  data.fetchCollectionStats.mockImplementation(async () => [row()]);
  forgetSharedFetches();
  await AsyncStorage.removeItem(cacheKey('liststats', 'c1', 'me'));
  state.me = 'me';
  state.mine = [list()];
  state.mineLoading = false;
  state.lang = 'en';
});

describe('the frame', () => {
  it('is called Statistics, at the compact size, and goes back', async () => {
    const navigation = await show();
    expect(screen.getByText('Statistics')).toBeTruthy();
    fireEvent.click(screen.getByTestId('stats-back'));
    expect(navigation.goBack).toHaveBeenCalledOnce();
  });

  it('says it in Vietnamese', async () => {
    state.lang = 'vi';
    await show();
    expect(screen.getByText('Thống kê')).toBeTruthy();
  });

  // The Activity page's reminder of which list this is, the same card.
  it('leads with the list’s own small card', async () => {
    await show();
    expect(screen.getByTestId('stats-list-title').textContent).toBe('Old Quarter eats');
    const card = screen.getByTestId('stats-list');
    expect(card.compareDocumentPosition(screen.getByTestId('stats-grid')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('what it asks for', () => {
  it('asks for this list, by its id', async () => {
    await show();
    expect(data.fetchCollectionStats).toHaveBeenCalledExactlyOnceWith('c1');
  });

  it('asks nothing for a list that is not yours, and says nothing is counted', async () => {
    await show('somebody-elses');
    expect(data.fetchCollectionStats).not.toHaveBeenCalled();
    expect(screen.getByTestId('stats-empty')).toBeTruthy();
    expect(screen.queryByTestId('stats-list')).toBeNull();
  });

  it('asks nothing for a list from the launch cache with no id', async () => {
    state.mine = [list({ id: undefined })];
    await show();
    expect(data.fetchCollectionStats).not.toHaveBeenCalled();
    expect(screen.getByTestId('stats-empty')).toBeTruthy();
  });

  it('asks nothing signed out', async () => {
    state.me = null;
    await show();
    expect(data.fetchCollectionStats).not.toHaveBeenCalled();
  });
});

describe('the tiles', () => {
  it('draws Views, Likes, Copies and Trips, two by two, each its total and its week', async () => {
    await show();
    const grid = screen.getByTestId('stats-grid');
    const rows = [...grid.children].map((r) => [...r.children].map((c) => c.getAttribute('data-testid')));
    expect(rows).toEqual([['stats-views', 'stats-likes'], ['stats-copies', 'stats-trips']]);
    expect([total('views'), total('likes'), total('copies'), total('trips')]).toEqual(['1,284', '12', '0', '5']);
    expect([week('views'), week('likes'), week('copies'), week('trips')])
      .toEqual(['Last 7 days: 37', 'Last 7 days: 3', 'Last 7 days: 0', 'Last 7 days: 1']);
    expect(within(tile('views')).getByText('Views')).toBeTruthy();
    expect(within(tile('trips')).getByText('Trips')).toBeTruthy();
  });

  it('says them in Vietnamese, grouped with a point', async () => {
    state.lang = 'vi';
    data.fetchCollectionStats.mockImplementation(async () => [row({ views_7d: 1500 })]);
    await show();
    expect(total('views')).toBe('1.284');
    expect(week('views')).toBe('7 ngày qua: 1.500');
    expect(['views', 'likes', 'copies', 'trips'].map((k) => within(tile(k)).getAllByText(/./)[0].textContent))
      .toEqual(['Lượt xem', 'Lượt thích', 'Bản sao', 'Chuyến đi']);
  });

  it('leads each with its mark', async () => {
    await show();
    const mark = (k: string) => tile(k).querySelector('[data-icon]')?.getAttribute('data-icon');
    expect([mark('views'), mark('likes'), mark('copies'), mark('trips')])
      .toEqual(['eye-outline', 'heart-outline', 'duplicate-outline', 'calendar-outline']);
    // The trips tab's own calendar, from the line set.
    expect(tile('trips').querySelector('[data-icon]')?.getAttribute('data-family')).toBe('lucide');
  });

  it('sets the total large in the display face, on one line that shrinks rather than wraps', async () => {
    await show();
    const el = screen.getByTestId('stats-views-total');
    expect(textStyleOf(el)).toMatchObject({ fontSize: 30, fontFamily: display.bold, color: colors.text });
    expect(textStyleOf(screen.getByTestId('stats-views-week'))).toMatchObject({ fontSize: 13, color: colors.textSecondary });
    // The Text's own props, read off its fiber: one line, shrinking to fit.
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'))!;
    type Fiber = { memoizedProps?: Record<string, unknown>; return?: Fiber };
    let f: Fiber | undefined = (el as unknown as Record<string, Fiber>)[key];
    while (f && f.memoizedProps?.testID !== 'stats-views-total') f = f.return;
    while (f && f.memoizedProps?.adjustsFontSizeToFit === undefined) f = f.return;
    expect([f?.memoizedProps?.numberOfLines, f?.memoizedProps?.adjustsFontSizeToFit]).toEqual([1, true]);
  });

  it('reads each tile as one line to VoiceOver', async () => {
    await show();
    expect(screen.getByTestId('stats-views-figure').getAttribute('aria-label')).toBe('Views, 1,284, Last 7 days: 37');
  });

  // No footnote under the grid (owner, 13 Nov 2026).
  it('draws nothing under the four figures', async () => {
    await show();
    expect(screen.queryByTestId('stats-note')).toBeNull();
    expect(screen.queryByText(/include your own/)).toBeNull();
  });

  it('is not a control', async () => {
    await show();
    expect(screen.queryAllByRole('button').map((b) => b.getAttribute('data-testid'))).toEqual(['stats-back']);
  });

  it('sits each tile in a card, half the row', async () => {
    await show();
    expect(viewStyleOf(tile('views'))).toMatchObject({ flex: 1 });
  });
});

describe('the states', () => {
  it('turns while your lists are still loading, with no card yet', async () => {
    state.mine = [];
    state.mineLoading = true;
    await show();
    expect(document.querySelector('[role="progressbar"]')).toBeTruthy();
    expect(screen.queryByTestId('stats-list')).toBeNull();
    expect(data.fetchCollectionStats).not.toHaveBeenCalled();
  });

  it('turns under the card while the figures are on their way', async () => {
    data.fetchCollectionStats.mockImplementation(() => new Promise(() => {}));
    await show();
    expect(screen.getByTestId('stats-loading')).toBeTruthy();
    expect(screen.getByTestId('stats-list')).toBeTruthy();
    expect(screen.queryByTestId('stats-grid')).toBeNull();
  });

  it('says nothing is counted yet, in a sentence, when all four are 0', async () => {
    data.fetchCollectionStats.mockImplementation(async () => [ZERO]);
    await show();
    expect(screen.getByTestId('stats-empty').textContent).toContain('Nothing counted yet');
    expect(screen.queryByTestId('stats-grid')).toBeNull();
  });

  it('draws every tile, zeros too, the moment one figure has something', async () => {
    data.fetchCollectionStats.mockImplementation(async () => [{ ...ZERO, trips_total: 1 }]);
    await show();
    expect([total('views'), total('trips')]).toEqual(['0', '1']);
  });

  // No row is the server saying the list is not yours: no figures to draw.
  it('says nothing is counted when the server answers no row', async () => {
    data.fetchCollectionStats.mockImplementation(async () => []);
    await show();
    expect(screen.getByTestId('stats-empty')).toBeTruthy();
  });

  it('says it failed, with Try again — and Try again asks again', async () => {
    data.fetchCollectionStats.mockImplementation(async () => { throw new Error('offline'); });
    await show();
    expect(screen.getByTestId('stats-failed')).toBeTruthy();
    data.fetchCollectionStats.mockImplementation(async () => [row()]);
    await act(async () => { fireEvent.click(screen.getByTestId('stats-retry')); });
    await flush();
    expect(data.fetchCollectionStats).toHaveBeenCalledTimes(2);
    expect(total('views')).toBe('1,284');
  });

  it('turns while Try again asks, rather than saying there is nothing', async () => {
    data.fetchCollectionStats.mockImplementation(async () => { throw new Error('offline'); });
    await show();
    data.fetchCollectionStats.mockImplementation(() => new Promise(() => {}));
    await act(async () => { fireEvent.click(screen.getByTestId('stats-retry')); });
    expect(screen.getByTestId('stats-loading')).toBeTruthy();
  });

  it('opens on the figures the Activity page asked ahead, without a spinner', async () => {
    await act(async () => {
      prefetchShared(cacheKey('liststats', 'c1', 'me'), async () => [row({ views_total: 9 })], [] as StatsRow[]);
    });
    data.fetchCollectionStats.mockImplementation(() => new Promise(() => {}));
    await show();
    expect(screen.queryByTestId('stats-loading')).toBeNull();
    expect(total('views')).toBe('9');
  });

  it('keeps the figures it has when the refresh behind them fails', async () => {
    await act(async () => {
      prefetchShared(cacheKey('liststats', 'c1', 'me'), async () => [row({ views_total: 9 })], [] as StatsRow[]);
    });
    data.fetchCollectionStats.mockImplementation(async () => { throw new Error('offline'); });
    await show();
    expect(screen.queryByTestId('stats-failed')).toBeNull();
    expect(total('views')).toBe('9');
  });
});

// ── a pull (owner, 13 Nov 2026) ──
//
// The four figures again, drawn throughout. The gesture has no jsdom
// counterpart, so the pull is the RefreshControl's `onRefresh`, read off
// the committed tree, and the spinner its `refreshing` — as the
// collection page's test reads them.
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
  /** An ask the test answers when it chooses. */
  const held = () => {
    let ok: (v: StatsRow[]) => void = () => {};
    data.fetchCollectionStats.mockImplementationOnce(() => new Promise((r) => { ok = r; }));
    return (v: StatsRow[]) => act(async () => { ok(v); });
  };

  it('asks for the figures again, keeps them drawn while it does, and spins until they are in', async () => {
    await show();
    expect(total('views')).toBe('1,284');
    const answer = held();
    pull();
    expect(data.fetchCollectionStats).toHaveBeenCalledTimes(2);
    expect(page().refreshing).toBe(true);
    expect(total('views')).toBe('1,284');
    expect(screen.queryByTestId('stats-loading')).toBeNull();
    await answer([row({ views_total: 1285 })]);
    expect(page().refreshing).toBe(false);
    expect(total('views')).toBe('1,285');
  });

  it('keeps the figures when the pull fails', async () => {
    await show();
    data.fetchCollectionStats.mockImplementationOnce(async () => { throw new Error('offline'); });
    pull();
    await flush();
    expect(page().refreshing).toBe(false);
    expect(total('views')).toBe('1,284');
    expect(screen.queryByTestId('stats-failed')).toBeNull();
  });

  // The spinner is the pull's: the ask every open makes behind kept
  // figures does not light it, and a pull while it is out joins it.
  it('is not lit by the refresh behind kept figures, and joins it rather than asking again', async () => {
    await show();
    cleanup();
    const answer = held();
    await show();
    expect(total('views')).toBe('1,284');
    expect(page().refreshing).toBe(false);
    pull();
    expect(data.fetchCollectionStats).toHaveBeenCalledTimes(2);
    expect(page().refreshing).toBe(true);
    await answer([row()]);
    expect(page().refreshing).toBe(false);
  });
});
