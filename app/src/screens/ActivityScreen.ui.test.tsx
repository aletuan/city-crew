// @vitest-environment jsdom
//
// Activity is a log of two weeks between you and other people: who liked
// or copied your collections, whose you liked or copied, and the
// friendships that began (owner, 28 Oct 2026). What is pinned here is the
// wording of every row (named and anonymous, relative time against a
// fixed clock), that only a row whose collection is known navigates, and
// to which slug — and that a friend request waiting on you is not here,
// since it moved to Your crew alone (20 Oct 2026). `buildActivity`,
// `friendsMade` and `agoOf` run for real; only the I/O seams are mocked.

import React from 'react';
import { RefreshControl } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, fontSizeOf, render, screen, viewStyleOf, within } from '../uitest/render';
import type { Nav } from '../nav';
import type { Applause, Copy, FriendshipRow } from '../lib/friends';
import type { FriendProfile, MyActs } from '../lib/data';
import type { CommentNews } from '../lib/commentNews';
import { appFlags } from '../lib/flags';
import { colors, space } from '../theme';

const ME = 'me';
const NOW = new Date('2026-09-11T12:00:00');

type Col = { id: string; slug: string; title_en: string; title_vi: string; title_ja: string; is_public?: boolean };

const data = vi.hoisted(() => ({
  fetchApplause: vi.fn(async (_since: string): Promise<Applause[]> => []),
  fetchCopies: vi.fn(async (_since: string): Promise<Copy[]> => []),
  fetchMyActs: vi.fn(async (_me: string, _since: string): Promise<MyActs> => ({ likes: [], copies: [], lists: [] })),
  mine: [] as Col[],
  useMyCollections: vi.fn(),
  avatars: {} as Record<string, string>,
  // Comment news: what the hook hands the page, and what the page handed it.
  news: { data: [] as CommentNews[], loaded: true, loading: false, reload: vi.fn() },
  // The mark as the page found it (`undefined`: the phone has not said
  // yet), and what the rows told `useSeenThrough` was their newest.
  before: undefined as string | null | undefined,
  seenThrough: vi.fn((_newest: string | null) => {}),
  avatarsAsked: vi.fn((_handles: string[]) => {}),
}));
vi.mock('../lib/data', () => ({
  fetchApplause: data.fetchApplause,
  fetchCopies: data.fetchCopies,
  fetchMyActs: data.fetchMyActs,
  useMyCollections: (id: string | null) => { data.useMyCollections(id); return { data: data.mine }; },
  useCuratorAvatarsQuery: (handles: string[]) => { data.avatarsAsked(handles); return { data: data.avatars }; },
}));
// The app's one copy of the comment news, and the mark — `lib/freshNews`,
// tested there; here it is what the page reads and what the rows ask.
vi.mock('../lib/freshNews', async () => {
  const { newerThan } = await import('../lib/commentNews');
  return {
    useFreshNews: () => ({ news: data.news }),
    useSeenThrough: (newest: string | null) => {
      data.seenThrough(newest);
      return (at: string) => data.before !== undefined && newerThan(at, data.before);
    },
  };
});

const catalog = vi.hoisted(() => ({ cols: [] as Col[] }));
vi.mock('../lib/catalog', () => ({ useCollections: () => ({ data: catalog.cols }) }));


// The crew's copy, holding a request in the test that proves Activity no
// longer draws one. The screen does not read it any more; if it ever does
// again, that test is what says so.
const crew = vi.hoisted(() => ({
  ships: { data: [] as FriendshipRow[], loading: false, reload: vi.fn() },
  blocks: { data: [] as string[], loading: false, reload: vi.fn() },
  people: {} as Record<string, FriendProfile>,
}));
vi.mock('../lib/crew', () => ({ useCrew: () => crew }));

const auth = vi.hoisted(() => ({ me: 'me' as string | null }));
vi.mock('../lib/auth', () => {
  const m = {
    useAuth: () => ({ session: auth.me ? { user: { id: auth.me } } : null }),
  };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});

// Language-aware so the Japanese title field can be seen to be read.
const i18n = vi.hoisted(() => ({ lang: 'en' as 'en' | 'vi' | 'ja' }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: i18n.lang,
    setLang: () => {},
    t: (en: string, vi?: string, ja?: string) =>
      (i18n.lang === 'ja' ? ja : i18n.lang === 'vi' ? vi : en) ?? en,
  }),
}));

import ActivityScreen from './ActivityScreen';

// The tab navigator above the Profile stack, which the empty state's
// ways out go through.
const tabs = { navigate: vi.fn() };
const nav = () => ({ navigate: vi.fn(), goBack: vi.fn(), getParent: () => tabs }) as unknown as Nav & {
  navigate: ReturnType<typeof vi.fn>; goBack: ReturnType<typeof vi.fn>;
};

const person = (id: string, handle: string, full_name = '', avatar_url = ''): FriendProfile =>
  ({ id, handle, full_name, avatar_url }) as FriendProfile;
const ask = (requester: string, at = '2026-09-01'): FriendshipRow =>
  ({ requester, addressee: ME, status: 'pending', created_at: at }) as FriendshipRow;
const col = (id: string, slug: string, title: string): Col =>
  ({ id, slug, title_en: title, title_vi: `${title} (vi)`, title_ja: `${title}（日本語）` });
const like = (collection_id: string, liked_at: string, liker_handle: string | null = null): Applause =>
  ({ collection_id, liked_at, liker_handle, liker_name: null });

const flush = () => act(async () => { await Promise.resolve(); });
/** The two tabs the groups became (owner, 20 Nov 2026), found by the name
 *  VoiceOver reads: "For you" may carry its figure, "For you (3)". */
const tabOf = (name: RegExp) => screen.getByRole('tab', { name });
const toYours = () => fireEvent.click(tabOf(/^What you did/));
const toForYou = () => fireEvent.click(tabOf(/^For you/));
const renderScreen = async (navigation = nav()) => {
  render(<ActivityScreen navigation={navigation} />);
  await flush();
  return navigation;
};

beforeEach(() => {
  data.avatars = {};
  data.avatarsAsked.mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  data.fetchApplause.mockImplementation(async () => []);
  data.fetchCopies.mockImplementation(async () => []);
  data.fetchMyActs.mockImplementation(async () => ({ likes: [], copies: [], lists: [] }));
  data.mine = [];
  catalog.cols = [];
  crew.ships.data = [];
  crew.ships.loading = false;
  crew.people = {};
  auth.me = ME;
  i18n.lang = 'en';
  data.news = { data: [], loaded: true, loading: false, reload: vi.fn() };
  data.before = undefined;
  data.seenThrough.mockClear();
});
afterEach(() => { vi.useRealTimers(); appFlags.reset(); });

describe('the frame', () => {
  it('names itself and goes back through the navigation prop', async () => {
    const navigation = await renderScreen();
    expect(screen.getByText('Activity')).toBeTruthy();
    // One size for a page reached from another (owner, 12 Nov 2026).
    expect(fontSizeOf(screen.getByText('Activity'))).toBe(20);
    // 11 above it, so its middle stays on the 44pt control's.
    expect(getComputedStyle(screen.getByText('Activity')).paddingTop).toBe('11px');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  // The chevron alone, with no glass disc (owner, 12 Nov 2026).
  it('draws its way back bare', async () => {
    await renderScreen();
    const back = screen.getByRole('button', { name: 'Back' });
    const fills = [back, ...back.querySelectorAll('*')]
      .map((n) => getComputedStyle(n as HTMLElement).backgroundColor)
      .filter((c) => c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent');
    expect(fills).toEqual([]);
    // Hung past the margin, so the chevron's ink, not its empty box,
    // stands on the line the cards below start at (`BACK_HANG`).
    let hung = false;
    for (let n: HTMLElement | null = back; n && !hung; n = n.parentElement) hung = getComputedStyle(n).marginLeft === '-18px';
    expect(hung).toBe(true);
  });

  it('asks for two weeks of applause, and for the reader\'s own lists', async () => {
    await renderScreen();
    expect(data.fetchApplause).toHaveBeenCalledWith(
      new Date(NOW.getTime() - 14 * 86400000).toISOString(),
    );
    expect(data.useMyCollections).toHaveBeenCalledWith(ME);
  });
});

describe('a guest', () => {
  it('fetches nothing, shows no requests, and says the page is quiet', async () => {
    auth.me = null;
    crew.ships.data = [ask('a')];
    await renderScreen();
    expect(data.fetchApplause).not.toHaveBeenCalled();
    expect(screen.queryByText('Requests')).toBeNull();
    expect(screen.getByText('No activity yet')).toBeTruthy();
  });
});

describe('the EARLIER states', () => {
  it('spins while the applause is still on its way, and says nothing else', async () => {
    data.fetchApplause.mockImplementation(() => new Promise(() => {}));
    await renderScreen();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByTestId('activity-empty')).toBeNull();
    expect(screen.queryByTestId('activity-failed')).toBeNull();
  });

  // A failure used to read as "nobody liked anything" (owner, 25 Oct
  // 2026): it says so now, and Try again asks once more.
  it('says a failed load is one, rather than calling it quiet, and tries again', async () => {
    data.fetchApplause.mockImplementation(async () => { throw new Error('offline'); });
    await renderScreen();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText("Couldn't load your activity")).toBeTruthy();
    expect(screen.queryByTestId('activity-empty')).toBeNull();
    expect(screen.queryByTestId('activity-try')).toBeNull();
    let answer: (v: Applause[]) => void = () => {};
    data.fetchApplause.mockImplementation(() => new Promise((ok) => { answer = ok; }));
    fireEvent.click(screen.getByTestId('activity-retry'));
    // Asked again, both halves, and waiting rather than still failed.
    expect(data.fetchApplause).toHaveBeenCalledTimes(2);
    expect(data.fetchCopies).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByTestId('activity-failed')).toBeNull();
    // Answered this time, and empty: the failure is forgotten.
    await act(async () => { answer([]); });
    expect(screen.getByTestId('activity-empty')).toBeTruthy();
    expect(screen.queryByTestId('activity-failed')).toBeNull();
  });

  it('fails on the copies as on the likes', async () => {
    data.fetchCopies.mockImplementation(async () => { throw new Error('offline'); });
    await renderScreen();
    expect(screen.getByTestId('activity-failed')).toBeTruthy();
  });

  it('shows what one half found when only the other failed', async () => {
    data.mine = [col('c1', 'rooftops', 'Rooftops')];
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T11:00:00', 'trang')]);
    data.fetchCopies.mockImplementation(async () => { throw new Error('offline'); });
    await renderScreen();
    expect(screen.getByText('@trang liked “Rooftops”')).toBeTruthy();
    expect(screen.queryByTestId('activity-failed')).toBeNull();
  });
});

// ── empty (owner, 25 Oct 2026) ──
//
// A heading, the sentence and the one step that would end it — which
// depends on what the reader has — and three ways into the rest of the
// app under it.
describe('the empty state', () => {
  const body = 'When someone likes or copies one of your collections, you will see it here.';
  const privateBody = 'Only public collections can be liked or copied — yours are all private for now.';

  it('offers a first collection to a reader with none, through the Collections tab', async () => {
    await renderScreen();
    expect(screen.getByText('No activity yet')).toBeTruthy();
    expect(screen.getByText(body)).toBeTruthy();
    expect(screen.queryByTestId('activity-yours')).toBeNull();
    fireEvent.click(screen.getByTestId('activity-create'));
    expect(tabs.navigate).toHaveBeenCalledWith('Collections', { screen: 'CollectionForm', initial: false });
  });

  it('tells a reader whose lists are all private why nothing comes, and opens them', async () => {
    data.mine = [col('c1', 'a', 'A'), { ...col('c2', 'b', 'B'), is_public: false }];
    await renderScreen();
    expect(screen.getByText(privateBody)).toBeTruthy();
    expect(screen.queryByText(body)).toBeNull();
    expect(screen.queryByTestId('activity-create')).toBeNull();
    fireEvent.click(screen.getByTestId('activity-yours'));
    expect(tabs.navigate).toHaveBeenCalledWith('Collections', { screen: 'CollectionsHome', params: { tab: 'yours', at: NOW.getTime() } });
  });

  it('offers nothing to do to a reader with a public list: it is a matter of waiting', async () => {
    data.mine = [col('c1', 'a', 'A'), { ...col('c2', 'b', 'B'), is_public: true }];
    await renderScreen();
    expect(screen.getByText(body)).toBeTruthy();
    expect(screen.queryByTestId('activity-create')).toBeNull();
    expect(screen.queryByTestId('activity-yours')).toBeNull();
  });

  it('offers three ways into the rest of the app, each to its own place', async () => {
    await renderScreen();
    expect(screen.getByText('You could try')).toBeTruthy();
    const card = screen.getByTestId('activity-try');
    expect([...card.querySelectorAll('[role="button"]')].map((b) => b.textContent))
      .toEqual(['Explore places', 'Browse community collections', 'Save places you love']);
    expect([...card.querySelectorAll('[data-icon]')].map((g) => g.getAttribute('data-icon')))
      .toEqual(['compass-outline', 'chevron-forward', 'globe-outline', 'chevron-forward', 'bookmark-outline', 'chevron-forward']);
    fireEvent.click(screen.getByTestId('activity-try-explore'));
    fireEvent.click(screen.getByTestId('activity-try-community'));
    fireEvent.click(screen.getByTestId('activity-try-save'));
    expect(tabs.navigate.mock.calls).toEqual([
      ['Explore'],
      ['Collections', { screen: 'CollectionsHome', params: { tab: 'community', at: NOW.getTime() } }],
      ['Collections', { screen: 'CollectionsHome', params: { tab: 'yours', at: NOW.getTime() } }],
    ]);
  });

  it('is not drawn once there is news', async () => {
    data.mine = [col('c1', 'rooftops', 'Rooftops')];
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T11:00:00', 'trang')]);
    await renderScreen();
    expect(screen.queryByTestId('activity-empty')).toBeNull();
    expect(screen.queryByTestId('activity-try')).toBeNull();
  });
});

// The feed's marks wore Profile's well — 44pt, radius 13, soft coral
// fill — until 6 Oct 2026, three days after Profile took the well off
// every row it had (#793). This screen opens from that card now, and a
// reader who taps a bare glyph and lands on a column of coral boxes has
// met two conventions in two taps. The mark is the bare glyph, lifted
// to the line's first row of text as Profile lifts its own.
describe('the faces down the left', () => {
  it('lead with the actor\u2019s avatar, and a small badge for what they did', async () => {
    data.avatars = { bao: 'https://faces/bao.jpg' };
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T10:00:00Z', 'bao'), like('c2', '2026-09-10T10:00:00Z', 'anh')]);
    data.mine = [col('c1', 'pho-walk', 'Pho walk'), col('c2', 'my-cafes', 'My cafes')];
    await renderScreen();
    expect(document.querySelector('[data-testid="round-icon"]')).toBeNull();
    const slots = screen.getAllByTestId('row-face');
    expect(slots).toHaveLength(2);
    // Asked for by handle, once, for every actor on the screen — the
    // same lookup the bylines use. A liker need not be a curator.
    expect(data.avatarsAsked).toHaveBeenLastCalledWith(['bao', 'anh']);
    // The one with a face wears it; the one without gets the blank disc.
    expect(slots[0].querySelector('img')!.getAttribute('src')).toBe('https://faces/bao.jpg');
    expect(slots[1].querySelector('img')).toBeNull();
    expect(slots[1].querySelector('[data-icon="person-outline"]')).toBeTruthy();
    for (const slot of slots) {
      const badge = slot.querySelector('[data-testid="kind-badge"] span')!;
      expect(badge.getAttribute('data-icon')).toBe('heart');
      expect(badge.getAttribute('data-size')).toBe('11');
      expect(badge.getAttribute('data-color')).toBe(colors.accent);
    }
  });

  it('are 44 across, centred on the row\u2019s two lines', async () => {
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T10:00:00Z', 'bao')]);
    data.mine = [col('c1', 'pho-walk', 'Pho walk')];
    await renderScreen();
    const slot = screen.getByTestId('row-face');
    const m = getComputedStyle(slot);
    expect(m.width).toBe('44px');
    expect(m.height).toBe('44px');
    expect(getComputedStyle(slot.parentElement!).alignItems).toBe('center');
  });

  it('shows a blank face for a like whose liker is unnamed', async () => {
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T10:00:00Z', null)]);
    data.mine = [col('c1', 'pho-walk', 'Pho walk')];
    await renderScreen();
    expect(data.avatarsAsked).toHaveBeenLastCalledWith([]);
    expect(screen.getByTestId('row-face').querySelector('[data-icon="person-outline"]')).toBeTruthy();
  });
});

// The chevron says "goes somewhere", as it does on every row of Profile,
// and it is drawn at the one size the app's row-end chevrons share. A
// row that goes nowhere — a like on a list that is gone — has none, which
// is also the only thing that tells the two apart.
describe('the chevron at the end of a row', () => {
  const chevronIn = (el: Element) => el.querySelector('[data-icon="chevron-forward"]');

  it('ends a live applause row, at 18pt in the tertiary ink', async () => {
    catalog.cols = [col('c1', 'pho-walk', 'Pho walk')];
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T10:00:00Z', 'bao')]);
    await renderScreen();
    const chevron = chevronIn(screen.getByRole('button', { name: /@bao liked “Pho walk”/ }))!;
    expect(chevron).toBeTruthy();
    expect(chevron.getAttribute('data-size')).toBe('18');
    expect(chevron.getAttribute('data-color')).toBe(colors.textTertiary);
  });

  it('is absent from a like on a list that is gone', async () => {
    data.fetchApplause.mockImplementation(async () => [like('c-gone', '2026-09-11T10:00:00Z', 'bao')]);
    await renderScreen();
    const row = screen.getByText('@bao liked “…”').closest('[data-testid="earlier-card"]')!;
    expect(chevronIn(row)).toBeNull();
  });
});

describe('the applause', () => {
  it('names the liker by handle, newest first, with the time since in words', async () => {
    data.mine = ['a', 'b', 'c', 'd', 'e'].map((k) => col(`c-${k}`, `list-${k}`, `List ${k}`));
    data.fetchApplause.mockImplementation(async () => [
      like('c-e', '2026-09-09T12:00:00', 'dao'),
      like('c-a', '2026-09-11T11:59:30', 'anh'),
      like('c-b', '2026-09-11T11:55:00', 'bao'),
      like('c-c', '2026-09-11T09:00:00'),
      like('c-d', '2026-09-10T11:00:00', 'cam'),
    ]);
    await renderScreen();
    const lines = screen.getAllByText(/liked “/).map((n) => n.textContent);
    expect(lines).toEqual([
      '@anh liked “List a”',
      '@bao liked “List b”',
      'Someone liked “List c”',
      '@cam liked “List d”',
      '@dao liked “List e”',
    ]);
    for (const ago of ['just now', '5m ago', '3h ago', 'yesterday', '2 days ago']) {
      expect(screen.getByText(ago)).toBeTruthy();
    }
  });

  // One row a list (owner, 19 Nov 2026): the latest liker named, the
  // rest counted, at the latest like's time — as hearts on a comment are.
  it('gathers the likes on one list into one row, naming the latest and counting the rest', async () => {
    catalog.cols = [col('c1', 'pho-walk', 'Pho walk')];
    data.mine = [col('c2', 'my-cafes', 'My cafes'), col('c3', 'bars', 'Bars')];
    data.avatars = { anh: 'https://faces/anh.jpg' };
    data.fetchApplause.mockImplementation(async () => [
      like('c1', '2026-09-09T12:00:00', 'dao'),
      like('c2', '2026-09-11T09:00:00'),
      like('c1', '2026-09-11T11:55:00', 'bao'),
      like('c2', '2026-09-11T11:59:30', 'anh'),
      like('c1', '2026-09-10T11:00:00', 'cam'),
      like('c3', '2026-09-08T11:00:00'),
    ]);
    const navigation = await renderScreen();
    expect(screen.getAllByText(/liked “/).map((n) => n.textContent)).toEqual([
      '@anh and 1 other liked “My cafes”',
      '@bao and 2 others liked “Pho walk”',
      'Someone liked “Bars”',
    ]);
    // The row is the latest liker's: their face, their like's time.
    const first = screen.getByRole('button', { name: /@anh and 1 other/ });
    expect(first.querySelector('img')!.getAttribute('src')).toBe('https://faces/anh.jpg');
    expect(first.textContent).toContain('just now');
    expect(screen.getByRole('button', { name: /@bao and 2 others/ }).textContent).toContain('5m ago');
    expect(screen.queryByText('3h ago')).toBeNull();
    fireEvent.click(first);
    expect(navigation.navigate).toHaveBeenLastCalledWith('CollectionDetail', { slug: 'my-cafes' });
  });

  it('says the gathered lines in the reader\u2019s language', async () => {
    data.mine = [col('c1', 'pho-walk', 'Pho walk'), col('c2', 'my-cafes', 'My cafes')];
    data.fetchApplause.mockImplementation(async () => [
      like('c1', '2026-09-11T11:00:00', 'bao'), like('c1', '2026-09-11T10:00:00', 'anh'), like('c1', '2026-09-11T09:00:00', 'cam'),
    ]);
    data.fetchCopies.mockImplementation(async () => ['dao', 'anh'].map((h, i): Copy => (
      { collection_id: 'c2', copied_at: `2026-09-11T0${8 - i}:00:00`, copier_handle: h, copier_name: null }
    )));
    i18n.lang = 'vi';
    await renderScreen();
    expect(screen.getByText('@bao và 2 người khác đã thích “Pho walk (vi)”')).toBeTruthy();
    expect(screen.getByText('@dao và 1 người khác đã lưu bản sao “My cafes (vi)”')).toBeTruthy();
  });

  // A week of distances, then the date — past a week nobody counts back.
  it('tells a time older than a week as a date, in the check-in rows\u2019 form', async () => {
    data.mine = [col('c1', 'pho-walk', 'Pho walk'), col('c2', 'my-cafes', 'My cafes')];
    data.fetchApplause.mockImplementation(async () => [
      like('c1', '2026-09-04T10:00:00', 'bao'), // 7 days: still a distance
      like('c2', '2026-09-03T10:00:00', 'anh'), // 8 days: a date
    ]);
    await renderScreen();
    expect(screen.getByText('7 days ago')).toBeTruthy();
    expect(screen.getByText('3 Sep')).toBeTruthy();
    expect(screen.queryByText('8 days ago')).toBeNull();
  });

  it('opens the liked list by its slug, from either shelf', async () => {
    catalog.cols = [col('c1', 'pho-walk', 'Pho walk')];
    data.mine = [col('c2', 'my-cafes', 'My cafes')];
    data.fetchApplause.mockImplementation(async () => [
      like('c1', '2026-09-11T11:00:00', 'bao'),
      like('c2', '2026-09-11T10:00:00', 'anh'),
    ]);
    const navigation = await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /@bao liked “Pho walk”/ }));
    expect(navigation.navigate).toHaveBeenLastCalledWith('CollectionDetail', { slug: 'pho-walk' });
    fireEvent.click(screen.getByRole('button', { name: /@anh liked “My cafes”/ }));
    expect(navigation.navigate).toHaveBeenLastCalledWith('CollectionDetail', { slug: 'my-cafes' });
  });

  it('shows an unknown list as an ellipsis, and a tap on it goes nowhere', async () => {
    data.fetchApplause.mockImplementation(async () => [like('gone', '2026-09-11T11:00:00', 'bao')]);
    const navigation = await renderScreen();
    const line = screen.getByText('@bao liked “…”');
    fireEvent.click(line);
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /@bao liked/ })).toBeNull();
  });

  it('reads the list title in the reader\'s language, Japanese included', async () => {
    i18n.lang = 'ja';
    catalog.cols = [col('c1', 'pho-walk', 'Pho walk')];
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T11:00:00', 'bao')]);
    await renderScreen();
    expect(screen.getByText('@bao が「Pho walk（日本語）」にいいねしました')).toBeTruthy();
    expect(screen.getByText('1時間前')).toBeTruthy();
  });
});

// "Save a copy" is the strongest compliment one reader pays another's
// list, and until 7 Oct 2026 it left no trace: `copyCollection` made a
// fresh list and nothing on the row said where it came from. The copy
// now remembers its original, `copies_of_mine` tells the curator, and
// the feed says so beside the likes — one timeline, by when it happened.
describe('the copies', () => {
  const copyOf = (collection_id: string, copied_at: string, handle: string | null = null): Copy =>
    ({ collection_id, copied_at, copier_handle: handle, copier_name: handle && 'Some One' });

  it('names the copier and the list, in the timeline with the likes, with its own glyph', async () => {
    catalog.cols = [col('c1', 'pho-walk', 'Pho walk')];
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T09:00:00Z', 'anh')]);
    data.mine = [col('c2', 'my-cafes', 'My cafes'), col('c3', 'bars', 'Bars')];
    data.fetchCopies.mockImplementation(async () => [
      copyOf('c1', '2026-09-11T10:00:00Z', 'bao'), copyOf('c2', '2026-09-10T10:00:00Z'),
      // One list copied by three people, one of them twice: a row, and
      // the two who are not named are the others.
      copyOf('c3', '2026-09-08T10:00:00Z', 'cam'), copyOf('c3', '2026-09-07T10:00:00Z', 'dao'),
      copyOf('c3', '2026-09-06T10:00:00Z', 'cam'), copyOf('c3', '2026-09-05T10:00:00Z', 'anh'),
    ]);
    await renderScreen();
    const lines = screen.getAllByText(/liked “|saved a copy of “/).map((n) => n.textContent);
    // A like and a copy of the same list stay two rows.
    expect(lines).toEqual([
      '@bao saved a copy of “Pho walk”',
      '@anh liked “Pho walk”',
      'Someone saved a copy of “My cafes”',
      '@cam and 2 others saved a copy of “Bars”',
    ]);
    const row = screen.getByRole('button', { name: /@bao saved a copy/ });
    expect(row.querySelector('[data-testid="kind-badge"] span')!.getAttribute('data-icon')).toBe('copy');
  });

  it('opens the list that was copied', async () => {
    catalog.cols = [col('c1', 'pho-walk', 'Pho walk')];
    data.fetchCopies.mockImplementation(async () => [copyOf('c1', '2026-09-11T10:00:00Z', 'bao')]);
    const navigation = await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /@bao saved a copy of “Pho walk”/ }));
    expect(navigation.navigate).toHaveBeenLastCalledWith('CollectionDetail', { slug: 'pho-walk' });
  });

  it('asks for the same two weeks of copies as of applause', async () => {
    await renderScreen();
    expect(data.fetchCopies).toHaveBeenCalledTimes(1);
    expect(data.fetchCopies.mock.calls[0][0]).toBe(data.fetchApplause.mock.calls[0][0]);
  });
});

// Requests moved to Your crew's Requests tab on 20 Oct 2026. The same
// list on two screens counted the same person twice on Profile.
describe('a friend request', () => {
  it('is not drawn here, however many are waiting, and has no section of its own', async () => {
    crew.ships.data = [ask('a'), ask('b')];
    crew.people = { a: person('a', 'anh', 'Anh'), b: person('b', 'bao') };
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T11:00:00', 'chi')]);
    catalog.cols = [col('c1', 'pho-walk', 'Pho walk')];
    await renderScreen();
    expect(screen.getByText('@chi liked “Pho walk”')).toBeTruthy();
    expect(screen.queryByText('Requests')).toBeNull();
    expect(screen.queryByText(/wants to join your crew/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    expect(screen.queryByText('Anh')).toBeNull();
  });
});

// ── your own side (owner, 28 Oct 2026) ──
//
// The likes you gave and the copies you saved of other people's lists,
// and the friendships that began — in the one timeline with the news.
describe('your own acts', () => {
  const theirs = col('c9', 'phở-tour', 'Phở tour');
  const acts = (over: Partial<MyActs> = {}): MyActs => ({ likes: [], copies: [], lists: [theirs], ...over });

  it('asks for them over the same two weeks, as the reader', async () => {
    await renderScreen();
    expect(data.fetchMyActs).toHaveBeenCalledWith(ME, new Date(NOW.getTime() - 14 * 86400000).toISOString());
  });

  it('says whose list you liked, and opens it', async () => {
    data.fetchMyActs.mockImplementation(async () => acts({ likes: [{ collection_id: 'c9', at: '2026-09-11T10:00:00', owner_handle: 'bao' }] }));
    const navigation = await renderScreen();
    fireEvent.click(screen.getByText('You liked @bao’s “Phở tour”'));
    expect(navigation.navigate).toHaveBeenCalledWith('CollectionDetail', { slug: 'phở-tour' });
    expect(document.querySelector('[data-testid="kind-badge"] [data-icon="heart"]')).toBeTruthy();
  });

  it('says whose list you copied, in the reader\'s language', async () => {
    i18n.lang = 'vi';
    data.fetchMyActs.mockImplementation(async () => acts({ copies: [{ collection_id: 'c9', at: '2026-09-11T10:00:00', owner_handle: 'bao' }] }));
    await renderScreen();
    expect(screen.getByText('Bạn đã lưu bản sao “Phở tour (vi)” của @bao')).toBeTruthy();
    expect(document.querySelector('[data-testid="kind-badge"] [data-icon="copy"]')).toBeTruthy();
  });

  it('keeps the sentence when the owner has no name to give', async () => {
    data.fetchMyActs.mockImplementation(async () => acts({
      likes: [{ collection_id: 'c9', at: '2026-09-11T10:00:00', owner_handle: null }],
      copies: [{ collection_id: 'c9', at: '2026-09-11T09:00:00', owner_handle: null }],
    }));
    await renderScreen();
    expect(screen.getByText('You liked “Phở tour”')).toBeTruthy();
    expect(screen.getByText('You saved a copy of “Phở tour”')).toBeTruthy();
  });

  // Until 19 Nov 2026 the two were one timeline; a reply was about to be
  // found among the reader's own likes. See `lib/commentNews`. From 20
  // Nov they are two tabs, and the page opens on the one for the reader.
  it('opens on what is for the reader, with the reader’s own acts a tab away, each newest first', async () => {
    data.mine = [col('c1', 'rooftops', 'Rooftops')];
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T09:00:00', 'trang')]);
    data.fetchMyActs.mockImplementation(async () => acts({ likes: [{ collection_id: 'c9', at: '2026-09-11T11:00:00', owner_handle: 'bao' }] }));
    await renderScreen();
    expect(screen.getAllByRole('tab').map((x) => x.getAttribute('aria-label')?.replace(/ \(\d+\)$/, ''))).toEqual(['For you', 'What you did']);
    expect(screen.getByTestId('activity-for-you').textContent).toContain('@trang liked “Rooftops”');
    expect(screen.queryByTestId('activity-yours')).toBeNull();
    // The row of tabs lines up with the cards: the page has its margins
    // already, and the wrapper takes back the ones the tabs bring.
    const insets: unknown[] = [];
    for (let el: Element | null = tabOf(/^For you/); el && el.getAttribute('data-testid') !== 'earlier-card'; el = el.parentElement) {
      const v = viewStyleOf(el);
      if (v.marginHorizontal != null) insets.push(v.marginHorizontal);
    }
    expect(insets).toEqual([space.page, -space.page]);
    // No heading over the rows: the tab is the name.
    expect(screen.queryByRole('header', { name: 'For you' })).toBeNull();
    toYours();
    expect(screen.getByTestId('activity-yours').textContent).toContain('You liked @bao’s “Phở tour”');
    expect(screen.queryByTestId('activity-for-you')).toBeNull();
    // The reader's own tab carries no figure.
    expect(tabOf(/^What you did/).getAttribute('aria-label')).toBe('What you did');
  });

  // A page that opened on an empty tab over a full one would have the
  // reader find the full one.
  it('opens on what you did when nothing is for you, and the empty tab says so', async () => {
    data.fetchMyActs.mockImplementation(async () => acts({ likes: [{ collection_id: 'c9', at: '2026-09-11T11:00:00', owner_handle: 'bao' }] }));
    await renderScreen();
    expect(screen.getByTestId('activity-yours')).toBeTruthy();
    toForYou();
    expect(screen.queryByTestId('activity-for-you')).toBeNull();
    expect(screen.getByTestId('activity-tab-empty').textContent).toBe('Nothing from anybody else in the last two weeks.');
  });

  it('says so on your own tab when only the others did anything', async () => {
    data.mine = [col('c1', 'rooftops', 'Rooftops')];
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T09:00:00', 'trang')]);
    await renderScreen();
    toYours();
    expect(screen.getByTestId('activity-tab-empty').textContent).toBe('Nothing you did in the last two weeks.');
  });

  it('counts a failure of its own as a failure, and asks again with the rest', async () => {
    data.fetchMyActs.mockImplementation(async () => { throw new Error('offline'); });
    await renderScreen();
    expect(screen.getByTestId('activity-failed')).toBeTruthy();
    fireEvent.click(screen.getByTestId('activity-retry'));
    expect(data.fetchMyActs).toHaveBeenCalledTimes(2);
  });

  it('is enough on its own to fill the screen: no empty state for a reader who only liked', async () => {
    data.fetchMyActs.mockImplementation(async () => acts({ likes: [{ collection_id: 'c9', at: '2026-09-11T10:00:00', owner_handle: 'bao' }] }));
    await renderScreen();
    expect(screen.queryByTestId('activity-empty')).toBeNull();
  });
});

describe('a friendship that began', () => {
  const made = (requester: string, addressee: string, responded_at: string): FriendshipRow =>
    ({ requester, addressee, status: 'accepted', created_at: '2026-09-01', responded_at });

  it('says who accepted the reader\'s request, with the face and the two-people mark', async () => {
    crew.ships.data = [made(ME, 'u-c', '2026-09-11T10:00:00')];
    crew.people = { 'u-c': person('u-c', 'chi') };
    data.avatars = { chi: 'http://x/chi.jpg' };
    await renderScreen();
    expect(screen.getByText('@chi accepted your friend request')).toBeTruthy();
    expect(document.querySelector('[data-testid="kind-badge"] [data-icon="people"]')).toBeTruthy();
    expect(data.avatarsAsked).toHaveBeenCalledWith(['chi']);
  });

  // Both friendship rows open the other person's page (owner, 19 Nov
  // 2026): whoever said yes, the next step is the person.
  it('says the reader and whoever asked are friends now, and opens their page', async () => {
    crew.ships.data = [made('u-d', ME, '2026-09-11T10:00:00'), made(ME, 'u-c', '2026-09-11T09:00:00')];
    crew.people = { 'u-d': person('u-d', 'dung'), 'u-c': person('u-c', 'chi') };
    i18n.lang = 'vi';
    const navigation = await renderScreen();
    fireEvent.click(screen.getByRole('tab', { name: /^Việc bạn đã làm/ }));
    fireEvent.click(screen.getByRole('button', { name: /Bạn và @dung đã thành bạn bè/ }));
    expect(navigation.navigate).toHaveBeenLastCalledWith('Person', { handle: 'dung' });
    fireEvent.click(screen.getByRole('tab', { name: /^Dành cho bạn/ }));
    fireEvent.click(screen.getByRole('button', { name: /@chi đã chấp nhận/ }));
    expect(navigation.navigate).toHaveBeenLastCalledWith('Person', { handle: 'chi' });
  });

  // The other person's profile not in yet: the sentence stands without the
  // name rather than going blank, as an unnamed like does.
  it('keeps both sentences when the other person has no name to give', async () => {
    crew.ships.data = [made(ME, 'u-c', '2026-09-11T10:00:00'), made('u-d', ME, '2026-09-11T09:00:00')];
    await renderScreen();
    expect(screen.getByText('Someone accepted your friend request')).toBeTruthy();
    // And nobody's page to open: no button, so no chevron.
    expect(screen.queryAllByRole('button', { name: /friend/ })).toHaveLength(0);
    toYours();
    expect(screen.getByText('You made a new friend')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: /friend/ })).toHaveLength(0);
    expect(data.avatarsAsked).toHaveBeenCalledWith([]);
  });

  it('is left out once older than the two weeks, and while still only asked', async () => {
    crew.ships.data = [made(ME, 'u-c', '2026-08-01T10:00:00'), ask('u-e')];
    crew.people = { 'u-c': person('u-c', 'chi'), 'u-e': person('u-e', 'em') };
    await renderScreen();
    expect(screen.queryByText(/chi/)).toBeNull();
    // A request still only asked is no friendship row; since one bell
    // (20 Nov 2026) it is the requests' own row, and only that.
    expect(screen.getAllByText(/em/)).toHaveLength(1);
    expect(screen.getByTestId('activity-requests').textContent).toMatch(/^@em wants to be friends/);
  });

  // One row however many ask, the latest named and the rest counted, at
  // the head of the list above newer news; with no profile in yet, the
  // count alone.
  it('says the requests in one row at the head, the latest named', async () => {
    crew.ships.data = [ask('u-e', '2026-10-01T09:00:00'), ask('u-g', '2026-10-02T09:00:00'), made(ME, 'u-c', '2026-10-02T11:00:00')];
    crew.people = { 'u-e': person('u-e', 'em'), 'u-g': person('u-g', 'giang', '', 'https://faces/g.jpg'), 'u-c': person('u-c', 'chi') };
    await renderScreen();
    const rows = screen.getByTestId('activity-for-you').children;
    expect(rows[0].getAttribute('data-testid')).toBe('activity-requests');
    expect(rows[0].textContent).toMatch(/^@giang and 1 other want to be friends/);
    expect(screen.getAllByTestId('activity-requests')).toHaveLength(1);
    expect(screen.getByTestId('activity-tab-for-you').textContent).toMatch(/^For you/);
    cleanup();
    crew.ships.data = [ask('u-x'), ask('u-y')];
    crew.people = {};
    await renderScreen();
    expect(screen.getByTestId('activity-requests').textContent).toMatch(/^2 friend requests/);
  });

  // One bell: the bell counts a request, so "For you" opens on it — a
  // row of the list (owner, 20 Nov 2026), first, dotted until answered,
  // the way to Crew — and its pill counts it.
  it('opens For you on a row for the requests waiting, counted in its pill, and goes to Crew', async () => {
    crew.ships.data = [ask('u-e')];
    crew.people = { 'u-e': person('u-e', 'em') };
    const navigation = await renderScreen();
    expect(screen.getByTestId('activity-tab-for-you').textContent).toBe('For you1');
    const row = screen.getByTestId('activity-requests');
    expect(screen.getByTestId('activity-for-you').contains(row)).toBe(true);
    expect(row.querySelector('[data-icon="person-add"]')).toBeTruthy();
    expect(within(row).getByTestId('row-new')).toBeTruthy();
    expect(screen.queryByTestId('person-requests')).toBeNull();
    // Not news on the other tab: what you did is yours.
    fireEvent.click(screen.getByTestId('activity-tab-yours'));
    expect(screen.queryByTestId('activity-requests')).toBeNull();
    fireEvent.click(screen.getByTestId('activity-tab-for-you'));
    fireEvent.click(screen.getByTestId('activity-requests'));
    // From the last tab's stack, through the tabs: `toProfileRoom`.
    expect(tabs.navigate).toHaveBeenCalledWith('Profile', { screen: 'Crew', initial: false });
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('activity-empty')).toBeNull();
    expect(screen.queryByTestId('activity-tab-empty')).toBeNull();
  });
});

// ── a pull (owner, 13 Nov 2026) ──
//
// Try again starts from nothing; a pull keeps what is drawn and swaps the
// answers in together, a failed half keeping its rows. The gesture has no
// jsdom counterpart, so the pull is the RefreshControl's `onRefresh`,
// read off the committed tree, and the spinner its `refreshing` — as the
// collection page's test reads them. Found by its type: `AuthScreen`,
// above it, carries the same two names.
describe('pulling the timeline down', () => {
  const list = (): { onRefresh: () => void; refreshing: boolean } => {
    type Fiber = { child: Fiber | null; sibling: Fiber | null; type: unknown; memoizedProps: Record<string, unknown> | null };
    const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
    const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
    const stack: Fiber[] = [host[key].stateNode.current];
    while (stack.length) {
      const fb = stack.pop()!;
      if (fb.type === RefreshControl) return fb.memoizedProps as { onRefresh: () => void; refreshing: boolean };
      if (fb.sibling) stack.push(fb.sibling);
      if (fb.child) stack.push(fb.child);
    }
    throw new Error('no RefreshControl');
  };
  const pull = () => act(() => { list().onRefresh(); });

  // Comment news is the page's fourth source, asked by its own hook.
  it('asks the comment news again too', async () => {
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T09:00:00', 'trang')]);
    await renderScreen();
    await pull();
    expect(data.news.reload).toHaveBeenCalledTimes(1);
  });

  it('leaves the comment news alone while it is already being asked', async () => {
    data.news = { data: [], loaded: true, loading: true, reload: vi.fn() };
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T09:00:00', 'trang')]);
    await renderScreen();
    await pull();
    expect(data.news.reload).not.toHaveBeenCalled();
  });
  /** A promise the test answers, or refuses, when it chooses. */
  const deferred = <T,>() => {
    let ok: (v: T) => void = () => {};
    let no: (e: Error) => void = () => {};
    const promise = new Promise<T>((a, b) => { ok = a; no = b; });
    return { promise, ok: (v: T) => act(async () => { ok(v); }), no: () => act(async () => { no(new Error('offline')); }) };
  };
  const NO: MyActs = { likes: [], copies: [], lists: [] };
  const HOUR = 3600000;
  const DAY = 86400000;
  const lines = () => screen.queryAllByText(/liked “|saved a copy of “|friend/).map((n) => n.textContent);

  beforeEach(() => {
    catalog.cols = [col('c1', 'pho-walk', 'Pho walk')];
  });

  it('asks the three halves again over two weeks opened now, and the crew', async () => {
    await renderScreen();
    vi.setSystemTime(new Date(NOW.getTime() + HOUR));
    crew.ships.reload.mockClear();
    pull();
    await flush();
    const since = new Date(NOW.getTime() + HOUR - 14 * DAY).toISOString();
    expect(data.fetchApplause).toHaveBeenCalledTimes(2);
    expect(data.fetchApplause).toHaveBeenLastCalledWith(since);
    expect(data.fetchCopies).toHaveBeenLastCalledWith(since);
    expect(data.fetchMyActs).toHaveBeenLastCalledWith(ME, since);
    expect(crew.ships.reload).toHaveBeenCalledTimes(1);
  });

  it('keeps the rows drawn while it asks, and swaps the answers in together when all three are in', async () => {
    data.fetchApplause.mockImplementationOnce(async () => [like('c1', '2026-09-11T09:00:00Z', 'anh')]);
    await renderScreen();
    expect(lines()).toEqual(['@anh liked “Pho walk”']);
    const likes = deferred<Applause[]>();
    const copies = deferred<Copy[]>();
    const mine = deferred<MyActs>();
    data.fetchApplause.mockImplementationOnce(() => likes.promise);
    data.fetchCopies.mockImplementationOnce(() => copies.promise);
    data.fetchMyActs.mockImplementationOnce(() => mine.promise);
    pull();
    expect(list().refreshing).toBe(true);
    // Not the spinner in place of the timeline: the rows it had.
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(lines()).toEqual(['@anh liked “Pho walk”']);
    await likes.ok([like('c1', '2026-09-11T10:00:00Z', 'bao')]);
    // One half in is not the change: it waits for the other two.
    expect(lines()).toEqual(['@anh liked “Pho walk”']);
    expect(list().refreshing).toBe(true);
    await copies.ok([]);
    await mine.ok(NO);
    expect(lines()).toEqual(['@bao liked “Pho walk”']);
    expect(list().refreshing).toBe(false);
  });

  it('keeps the rows of a half that fails, and takes the halves that answered', async () => {
    data.fetchApplause.mockImplementationOnce(async () => [like('c1', '2026-09-11T09:00:00Z', 'anh')]);
    await renderScreen();
    data.fetchApplause.mockImplementationOnce(async () => { throw new Error('offline'); });
    data.fetchCopies.mockImplementationOnce(async () => [
      { collection_id: 'c1', copied_at: '2026-09-11T10:00:00Z', copier_handle: 'bao', copier_name: null },
    ]);
    pull();
    await flush();
    expect(lines()).toEqual(['@bao saved a copy of “Pho walk”', '@anh liked “Pho walk”']);
    expect(screen.queryByTestId('activity-failed')).toBeNull();
    expect(list().refreshing).toBe(false);
  });

  it('keeps the copies through a pull that fails to read them, and takes the likes that answered', async () => {
    data.fetchCopies.mockImplementationOnce(async () => [
      { collection_id: 'c1', copied_at: '2026-09-11T10:00:00Z', copier_handle: 'bao', copier_name: null },
    ]);
    await renderScreen();
    data.fetchCopies.mockImplementationOnce(async () => { throw new Error('offline'); });
    data.fetchApplause.mockImplementationOnce(async () => [like('c1', '2026-09-11T09:00:00Z', 'anh')]);
    pull();
    await flush();
    expect(lines()).toEqual(['@bao saved a copy of “Pho walk”', '@anh liked “Pho walk”']);
  });

  it('keeps your own acts through a pull that fails to read them', async () => {
    data.fetchMyActs.mockImplementationOnce(async () => ({
      likes: [{ collection_id: 'c9', at: '2026-09-11T10:00:00Z', owner_handle: 'bao' }],
      copies: [], lists: [col('c9', 'pho-tour', 'Phở tour')],
    }));
    await renderScreen();
    expect(screen.getByText('You liked @bao’s “Phở tour”')).toBeTruthy();
    data.fetchMyActs.mockImplementationOnce(async () => { throw new Error('offline'); });
    pull();
    await flush();
    expect(screen.getByText('You liked @bao’s “Phở tour”')).toBeTruthy();
  });

  it('leaves the empty state standing when a pull fails over it: an answer stands', async () => {
    await renderScreen();
    expect(screen.getByTestId('activity-empty')).toBeTruthy();
    data.fetchApplause.mockImplementationOnce(async () => { throw new Error('offline'); });
    data.fetchCopies.mockImplementationOnce(async () => { throw new Error('offline'); });
    data.fetchMyActs.mockImplementationOnce(async () => { throw new Error('offline'); });
    pull();
    await flush();
    expect(screen.getByTestId('activity-empty')).toBeTruthy();
    expect(screen.queryByTestId('activity-failed')).toBeNull();
  });

  it('leaves a failed page failed when the pull fails too, and clears it when the pull answers', async () => {
    data.fetchApplause.mockImplementationOnce(async () => { throw new Error('offline'); });
    await renderScreen();
    expect(screen.getByTestId('activity-failed')).toBeTruthy();
    // The likes fail again; the copies and your own acts answer, which
    // is not the half that failed.
    data.fetchApplause.mockImplementationOnce(async () => { throw new Error('offline'); });
    pull();
    await flush();
    expect(screen.getByTestId('activity-failed')).toBeTruthy();
    // All three answer this time: the failure is forgotten.
    pull();
    await flush();
    expect(screen.queryByTestId('activity-failed')).toBeNull();
    expect(screen.getByTestId('activity-empty')).toBeTruthy();
  });

  // The two weeks open at the pull's own now, and `since` moves with the
  // answers, not before them: the friendships are cut where the fetches
  // were.
  it('moves the window with the answers, and cuts what a failed half kept at the new one', async () => {
    const edgeOfWindow = new Date(NOW.getTime() - 14 * DAY + 30 * 60000).toISOString();
    crew.ships.data = [{ requester: ME, addressee: 'u-c', status: 'accepted', created_at: '2026-08-01', responded_at: edgeOfWindow }];
    crew.people = { 'u-c': person('u-c', 'chi') };
    data.fetchApplause.mockImplementationOnce(async () => [like('c1', edgeOfWindow, 'anh')]);
    await renderScreen();
    expect(lines()).toEqual(['@chi accepted your friend request', '@anh liked “Pho walk”']);
    vi.setSystemTime(new Date(NOW.getTime() + HOUR));
    const likes = deferred<Applause[]>();
    data.fetchApplause.mockImplementationOnce(() => likes.promise);
    pull();
    await flush();
    // Still out: the page is the old answer, cut where it was asked.
    expect(lines()).toEqual(['@chi accepted your friend request', '@anh liked “Pho walk”']);
    await likes.no();
    expect(lines()).toEqual([]);
    expect(screen.getByTestId('activity-empty')).toBeTruthy();
  });

  // Try again opens the two weeks at its own now too, as it always has.
  it('moves the window on Try again', async () => {
    data.fetchApplause.mockImplementationOnce(async () => { throw new Error('offline'); });
    await renderScreen();
    vi.setSystemTime(new Date(NOW.getTime() + HOUR));
    fireEvent.click(screen.getByTestId('activity-retry'));
    await flush();
    const since = new Date(NOW.getTime() + HOUR - 14 * DAY).toISOString();
    expect(data.fetchApplause).toHaveBeenLastCalledWith(since);
  });

  // And `since` with it, which is where the friendships are cut: one the
  // window has moved past by the time Try again answers is not drawn.
  it('cuts the friendships at the window Try again opened', async () => {
    data.fetchApplause.mockImplementationOnce(async () => { throw new Error('offline'); });
    await renderScreen();
    vi.setSystemTime(new Date(NOW.getTime() + HOUR));
    const passed = new Date(NOW.getTime() - 14 * DAY + 30 * 60000).toISOString();
    crew.ships.data = [{ requester: ME, addressee: 'u-c', status: 'accepted', created_at: '2026-08-01', responded_at: passed }];
    crew.people = { 'u-c': person('u-c', 'chi') };
    fireEvent.click(screen.getByTestId('activity-retry'));
    await flush();
    expect(lines()).toEqual([]);
    expect(screen.getByTestId('activity-empty')).toBeTruthy();
  });

  // The spinner is the pull's: the crew's own refresh does not light it,
  // and a pull made while it is out waits for it rather than starting it
  // over.
  it('is not lit by a crew refresh nobody pulled for, and waits for one already out', async () => {
    crew.ships.loading = true;
    const { rerender } = render(<ActivityScreen navigation={nav()} />);
    await flush();
    expect(list().refreshing).toBe(false);
    pull();
    await flush();
    expect(crew.ships.reload).not.toHaveBeenCalled();
    expect(data.fetchApplause).toHaveBeenCalledTimes(2);
    expect(list().refreshing).toBe(true);
    crew.ships.loading = false;
    rerender(<ActivityScreen navigation={nav()} />);
    expect(list().refreshing).toBe(false);
  });

  it('sends nothing of its own while the first load is out, and spins until it lands', async () => {
    const likes = deferred<Applause[]>();
    data.fetchApplause.mockImplementationOnce(() => likes.promise);
    await renderScreen();
    pull();
    expect(data.fetchApplause).toHaveBeenCalledTimes(1);
    expect(list().refreshing).toBe(true);
    await likes.ok([]);
    expect(list().refreshing).toBe(false);
  });

  it('asks once for two pulls made while the first is out', async () => {
    await renderScreen();
    data.fetchApplause.mockImplementationOnce(() => new Promise(() => {}));
    pull();
    pull();
    expect(data.fetchApplause).toHaveBeenCalledTimes(2);
  });

  it('asks nothing for a guest', async () => {
    auth.me = null;
    await renderScreen();
    pull();
    await flush();
    expect(data.fetchApplause).not.toHaveBeenCalled();
    expect(list().refreshing).toBe(false);
  });

  // Try again, or a change of reader, while a pull is out: the newer ask
  // owns the page, and the pull's answers are dropped when they land.
  it('drops a pull’s answers that land after Try again', async () => {
    data.fetchApplause.mockImplementationOnce(async () => { throw new Error('offline'); });
    await renderScreen();
    const likes = deferred<Applause[]>();
    data.fetchApplause.mockImplementationOnce(() => likes.promise);
    pull();
    data.fetchApplause.mockImplementationOnce(async () => [like('c1', '2026-09-11T09:00:00Z', 'anh')]);
    fireEvent.click(screen.getByTestId('activity-retry'));
    await flush();
    expect(lines()).toEqual(['@anh liked “Pho walk”']);
    await likes.ok([like('c1', '2026-09-11T10:00:00Z', 'bao')]);
    expect(lines()).toEqual(['@anh liked “Pho walk”']);
    expect(list().refreshing).toBe(false);
  });
});

// C7b of `docs/comments-plan.md`: what happened to the reader in
// comments, among what is for them. Which rows there are is the
// server's (`comment_news`) and which group is `lib/commentNews`'s; here
// it is what a row says, shows and opens.
describe('comment news', () => {
  const news = (over: Partial<CommentNews> = {}): CommentNews => ({
    kind: 'reply', comment_id: 'k1',
    list: { id: 'c1', slug: 'hoi-an-coffee', title_en: 'Hoi An Coffee', title_vi: 'Cà phê Hội An', title_ja: null },
    actor: 'u2', handle: '@Trang', full_name: 'Trang Lê', avatar_url: 'https://faces/trang.jpg',
    body: 'Can I come with you', at: '2026-09-11T10:00:00', others: 0,
    ...over,
  });
  const row = (kind: CommentNews['kind']) => screen.getByTestId(`news-${kind}`);
  const lineOf = (kind: CommentNews['kind']) => row(kind).querySelector('[data-testid="row-face"] + * > *')!.textContent;

  it('says each of the four things in a sentence, with the comment\'s words under it', async () => {
    data.news.data = [
      news({ kind: 'tag', comment_id: 'k4', at: '2026-09-11T13:00:00', body: '@you look' }),
      news({ kind: 'reply', comment_id: 'k3', at: '2026-09-11T12:00:00' }),
      news({ kind: 'on_list', comment_id: 'k2', at: '2026-09-11T11:00:00', body: 'Lovely list' }),
      news({ kind: 'heart', comment_id: 'k1', at: '2026-09-11T10:00:00', body: 'Mine' }),
    ];
    await renderScreen();
    expect(lineOf('tag')).toBe('@trang mentioned you');
    expect(lineOf('reply')).toBe('@trang replied to you');
    expect(lineOf('on_list')).toBe('@trang commented on “Hoi An Coffee”');
    expect(lineOf('heart')).toBe('@trang liked your comment');
    expect(screen.getAllByTestId('news-quote').map((q) => q.textContent)).toEqual([
      '“@you look”', '“Can I come with you”', '“Lovely list”', '“Mine”',
    ]);
    expect(screen.getByTestId('activity-for-you').querySelectorAll('[data-testid^="news-"]:not([data-testid="news-quote"])')).toHaveLength(4);
  });

  it('wears the actor\'s own face, and a mark for the kind on its corner', async () => {
    data.news.data = [
      news({ kind: 'tag', comment_id: 'k4' }), news({ kind: 'reply', comment_id: 'k3' }),
      news({ kind: 'on_list', comment_id: 'k2' }), news({ kind: 'heart', comment_id: 'k1' }),
    ];
    await renderScreen();
    expect(row('reply').querySelector('img')!.getAttribute('src')).toBe('https://faces/trang.jpg');
    const badge = (kind: CommentNews['kind']) => row(kind).querySelector('[data-testid="kind-badge"] [data-icon]')!.getAttribute('data-icon');
    expect([badge('tag'), badge('reply'), badge('on_list'), badge('heart')]).toEqual(['at', 'arrow-undo', 'chatbubble', 'heart']);
    // The face came with the news: nobody is asked for it by handle.
    expect(data.avatarsAsked).toHaveBeenLastCalledWith([]);
  });

  it('counts the others who liked, one in the singular', async () => {
    data.news.data = [news({ kind: 'heart', others: 1 })];
    await renderScreen();
    expect(lineOf('heart')).toBe('@trang and 1 other liked your comment');
    data.news.data = [news({ kind: 'heart', others: 4 })];
    await renderScreen();
    expect(screen.getAllByTestId('news-heart').pop()!.textContent).toContain('@trang and 4 others liked your comment');
  });

  it('names somebody by their name where no handle came, and "Someone" where neither did', async () => {
    data.news.data = [news({ handle: null }), news({ kind: 'tag', comment_id: 'k2', handle: null, full_name: null })];
    await renderScreen();
    expect(lineOf('reply')).toBe('Trang Lê replied to you');
    expect(lineOf('tag')).toBe('Someone mentioned you');
  });

  it('names the list in the reader\'s language, and has no quote for a comment with no words', async () => {
    i18n.lang = 'vi';
    data.news.data = [news({ kind: 'on_list', body: '' })];
    await renderScreen();
    expect(lineOf('on_list')).toBe('@trang đã bình luận về “Cà phê Hội An”');
    expect(screen.queryByTestId('news-quote')).toBeNull();
    expect(screen.getByRole('tab', { name: /^Dành cho bạn/ })).toBeTruthy();
    expect(screen.getByTestId('activity-for-you')).toBeTruthy();
  });

  it('falls back to "…" for a list whose name did not come', async () => {
    data.news.data = [news({ kind: 'on_list', list: { id: 'c1', slug: '', title_en: null, title_vi: null, title_ja: null } })];
    await renderScreen();
    expect(lineOf('on_list')).toBe('@trang commented on “…”');
  });

  it('opens the list\'s thread, handing over which comment it was about', async () => {
    data.news.data = [news({ comment_id: 'k7' })];
    const navigation = await renderScreen();
    expect(row('reply').getAttribute('role')).toBe('button');
    expect(row('reply').querySelector('[data-icon="chevron-forward"]')).toBeTruthy();
    fireEvent.click(row('reply'));
    expect(navigation.navigate).toHaveBeenCalledExactlyOnceWith('Comments', { subject: { kind: 'collection', id: 'c1' }, focus: 'k7' });
  });

  it('is enough on its own to fill the page, and is the tab it opens on, before the reader\'s own acts', async () => {
    data.news.data = [news({ at: '2026-09-10T10:00:00' })];
    data.fetchMyActs.mockImplementation(async () => ({ likes: [{ collection_id: 'c9', at: '2026-09-11T11:00:00', owner_handle: 'bao' }], copies: [], lists: [] }));
    await renderScreen();
    expect(screen.queryByTestId('activity-empty')).toBeNull();
    expect(screen.getByTestId('activity-for-you').textContent).toContain('replied to you');
    toYours();
    expect(screen.getByTestId('activity-yours').textContent).toContain('You liked');
  });

  // C7c: what came since Activity was last opened.
  describe('what is new', () => {
    const dots = (id: string) => screen.getByTestId(id).querySelectorAll('[data-testid="row-new"]');
    const fill = () => {
      data.news.data = [
        news({ kind: 'reply', comment_id: 'k3', at: '2026-09-11T12:00:00' }),
        news({ kind: 'heart', comment_id: 'k2', at: '2026-09-11T10:00:00' }),
        news({ kind: 'tag', comment_id: 'k1', at: '2026-09-11T08:00:00' }),
      ];
      data.mine = [{ id: 'c1', slug: 'hoi-an', title_en: 'Hoi An', title_vi: 'Hội An', title_ja: '' }];
      data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T11:00:00', 'trang')]);
      data.fetchMyActs.mockImplementation(async () => ({ likes: [{ collection_id: 'c9', at: '2026-09-11T13:00:00', owner_handle: 'bao' }], copies: [], lists: [] }));
    };

    it('dots the rows for you that are later than the mark — a like or a heart as much as a reply — and never your own', async () => {
      fill();
      data.before = '2026-09-11T09:00:00';
      await renderScreen();
      const rows = [...screen.getByTestId('activity-for-you').querySelectorAll('[role="button"]')];
      expect(rows.map((r) => !!r.querySelector('[data-testid="row-new"]'))).toEqual([true, true, true, false]);
      // The tab's pill is the dots counted: one figure on the tab and on
      // the page (owner, 20 Nov 2026).
      expect(tabOf(/^For you/).getAttribute('aria-label')).toBe('For you (3)');
      // The tab's dot, before the chevron, and said.
      const dot = rows[0].querySelector('[data-testid="row-new"]') as HTMLElement;
      expect(dot.getAttribute('aria-label')).toBe('New');
      expect(viewStyleOf(dot)).toMatchObject({ width: 9, height: 9, backgroundColor: colors.accent });
      expect(dot.nextElementSibling?.getAttribute('data-icon')).toBe('chevron-forward');
      // The reader's own act is later than all of them, and is not news.
      toYours();
      expect(dots('activity-yours')).toHaveLength(0);
    });

    it('dots nothing when nothing is later than the mark', async () => {
      fill();
      data.before = '2026-09-11T12:00:00';
      await renderScreen();
      expect(dots('earlier-card')).toHaveLength(0);
    });

    it('tells the mark the newest row for you, not the reader\'s own later act', async () => {
      fill();
      await renderScreen();
      expect(data.seenThrough).toHaveBeenLastCalledWith('2026-09-11T12:00:00');
    });
  });

  it('waits for the news with the rest before drawing, and does not call a page with only news empty', async () => {
    data.news = { data: [], loaded: false, loading: true, reload: vi.fn() };
    await renderScreen();
    expect(screen.queryByTestId('activity-empty')).toBeNull();
    expect(screen.queryByTestId('earlier-card')).toBeNull();
  });
});
