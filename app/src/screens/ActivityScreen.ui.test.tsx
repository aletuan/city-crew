// @vitest-environment jsdom
//
// Activity is two kinds of thing on one page, so what is pinned here is
// that each kind does what the header comment promises. REQUESTS: which
// answer reaches which write, with `(requester, me)` in that order, that
// the block waits for a native confirmation, and that both halves of the
// crew copy (edges and blocks) are refreshed after a write. EARLIER: the
// wording of every row (trip countdown, named and anonymous applause,
// relative time against a fixed clock), that only an applause row whose
// list is known navigates, and to which slug. `buildActivity`,
// `splitFriendships` and `agoOf` run for real; only the I/O seams are
// mocked.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Haptics from 'expo-haptics';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav } from '../nav';
import type { Applause, FriendshipRow } from '../lib/friends';
import type { FriendProfile } from '../lib/data';

const ME = 'me';
const NOW = new Date('2026-09-11T12:00:00');

const alert = vi.hoisted(() => vi.fn<(
  title: string, body?: string, buttons?: { text?: string; style?: string; onPress?: () => void }[],
) => void>());
vi.mock('react-native', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  Alert: { alert },
}));

type Col = { id: string; slug: string; title_en: string; title_vi: string; title_ja: string };

const data = vi.hoisted(() => ({
  acceptFriendRequest: vi.fn(async (..._a: unknown[]) => {}),
  removeFriendship: vi.fn(async (..._a: unknown[]) => {}),
  blockUser: vi.fn(async (..._a: unknown[]) => {}),
  fetchApplause: vi.fn(async (_since: string): Promise<Applause[]> => []),
  mine: [] as Col[],
  useMyCollections: vi.fn(),
}));
vi.mock('../lib/data', () => ({
  acceptFriendRequest: data.acceptFriendRequest,
  removeFriendship: data.removeFriendship,
  blockUser: data.blockUser,
  fetchApplause: data.fetchApplause,
  useMyCollections: (id: string | null) => { data.useMyCollections(id); return { data: data.mine }; },
}));

const catalog = vi.hoisted(() => ({ cols: [] as Col[] }));
vi.mock('../lib/catalog', () => ({ useCollections: () => ({ data: catalog.cols }) }));

const trips = vi.hoisted(() => ({ data: [] as { id: string; title: string; day: string }[] }));
vi.mock('../lib/mytrips', () => ({ useMyTrips: () => trips }));

const crew = vi.hoisted(() => ({
  ships: { data: [] as FriendshipRow[], loading: false, reload: vi.fn() },
  blocks: { data: [] as string[], loading: false, reload: vi.fn() },
  people: {} as Record<string, FriendProfile>,
}));
vi.mock('../lib/crew', () => ({ useCrew: () => crew }));

const auth = vi.hoisted(() => ({ me: 'me' as string | null }));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: auth.me ? { user: { id: auth.me } } : null }),
}));

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

const report = vi.hoisted(() => vi.fn());
vi.mock('../components/reportFlow', () => ({ useReport: () => ({ report, node: null }) }));

import ActivityScreen from './ActivityScreen';

const nav = () => ({ navigate: vi.fn(), goBack: vi.fn() }) as unknown as Nav & {
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
const renderScreen = async (navigation = nav()) => {
  render(<ActivityScreen navigation={navigation} />);
  await flush();
  return navigation;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  for (const fn of [data.acceptFriendRequest, data.removeFriendship, data.blockUser]) {
    fn.mockImplementation(async () => {});
  }
  data.fetchApplause.mockImplementation(async () => []);
  data.mine = [];
  catalog.cols = [];
  trips.data = [];
  crew.ships.data = [];
  crew.ships.loading = false;
  crew.people = {};
  auth.me = ME;
  i18n.lang = 'en';
});
afterEach(() => { vi.useRealTimers(); });

describe('the frame', () => {
  it('names itself and goes back through the navigation prop', async () => {
    const navigation = await renderScreen();
    expect(screen.getByText('Activity')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
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
    expect(screen.getByText(/Quiet so far/)).toBeTruthy();
  });
});

describe('the EARLIER states', () => {
  it('spins while the applause is still on its way, and says nothing else', async () => {
    data.fetchApplause.mockImplementation(() => new Promise(() => {}));
    await renderScreen();
    expect(screen.getByText('Earlier')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText(/Quiet so far/)).toBeNull();
  });

  it('treats a failed applause fetch as no applause rather than hanging', async () => {
    data.fetchApplause.mockImplementation(async () => { throw new Error('offline'); });
    await renderScreen();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText(
      'Quiet so far. Likes on your lists and upcoming trips will show here.',
    )).toBeTruthy();
  });

  it('does not hide the feed behind a spinner while the crew edges reload', async () => {
    data.fetchApplause.mockImplementation(async () => [like('c1', '2026-09-11T11:00:00')]);
    catalog.cols = [col('c1', 'pho-walk', 'Pho walk')];
    crew.ships.loading = true;
    await renderScreen();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('Someone liked “Pho walk”')).toBeTruthy();
  });
});

describe('the upcoming trip', () => {
  it.each([
    ['2026-09-11', '“Hanoi day” is today'],
    ['2026-09-12', '“Hanoi day” is tomorrow'],
    ['2026-09-15', '“Hanoi day” is in 4 days'],
  ])('a trip on %s reads %s', async (day, line) => {
    trips.data = [{ id: 't1', title: 'Hanoi day', day }];
    await renderScreen();
    expect(screen.getByText(line)).toBeTruthy();
    expect(screen.queryByText(/Quiet so far/)).toBeNull();
  });

  it('names only the nearest trip, and none that is past or more than a week out', async () => {
    trips.data = [
      { id: 'past', title: 'Gone', day: '2026-09-10' },
      { id: 'far', title: 'Far', day: '2026-09-19' },
      { id: 'b', title: 'Later', day: '2026-09-14' },
      { id: 'a', title: 'Sooner', day: '2026-09-13' },
    ];
    await renderScreen();
    expect(screen.getByText('“Sooner” is in 2 days')).toBeTruthy();
    expect(screen.queryByText(/Later|Gone|Far/)).toBeNull();
  });

  it('is not a button', async () => {
    trips.data = [{ id: 't1', title: 'Hanoi day', day: '2026-09-11' }];
    await renderScreen();
    expect(screen.queryByRole('button', { name: /Hanoi day/ })).toBeNull();
  });
});

describe('the applause', () => {
  it('names the liker by handle, newest first, with the time since in words', async () => {
    catalog.cols = [col('c1', 'pho-walk', 'Pho walk')];
    data.mine = [col('c2', 'my-cafes', 'My cafes')];
    data.fetchApplause.mockImplementation(async () => [
      like('c1', '2026-09-09T12:00:00', 'dao'),
      like('c2', '2026-09-11T11:59:30', 'anh'),
      like('c1', '2026-09-11T11:55:00', 'bao'),
      like('c2', '2026-09-11T09:00:00'),
      like('c1', '2026-09-10T11:00:00', 'cam'),
    ]);
    await renderScreen();
    const lines = screen.getAllByText(/liked “/).map((n) => n.textContent);
    expect(lines).toEqual([
      '@anh liked “My cafes”',
      '@bao liked “Pho walk”',
      'Someone liked “My cafes”',
      '@cam liked “Pho walk”',
      '@dao liked “Pho walk”',
    ]);
    for (const ago of ['just now', '5m ago', '3h ago', 'yesterday', '2 days ago']) {
      expect(screen.getByText(ago)).toBeTruthy();
    }
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

describe('the requests', () => {
  it('lists each asker newest first, by full name, handle or placeholder', async () => {
    crew.ships.data = [
      ask('a', '2026-09-01'),
      ask('b', '2026-09-03'),
      ask('c', '2026-09-02'),
      // Not a request to me: an accepted edge and one I sent.
      { requester: ME, addressee: 'x', status: 'pending', created_at: '2026-09-05' } as FriendshipRow,
      { requester: 'y', addressee: ME, status: 'accepted', created_at: '2026-09-05' } as FriendshipRow,
    ];
    crew.people = { a: person('a', 'anh', 'Anh Tran'), b: person('b', 'bao') };
    await renderScreen();
    expect(screen.getByText('Requests')).toBeTruthy();
    const titles = screen.getAllByText(/wants to join your crew/).map((n) => n.textContent);
    expect(titles).toEqual([
      '@bao wants to join your crew',
      '… wants to join your crew',
      'Anh Tran wants to join your crew',
    ]);
    expect(screen.getByText('@anh')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Accept' })).toHaveLength(3);
  });

  it('accepts as (requester, me), celebrates, then refreshes the crew', async () => {
    crew.ships.data = [ask('a')];
    crew.people = { a: person('a', 'anh', 'Anh') };
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(data.acceptFriendRequest).toHaveBeenCalledWith('a', ME);
    expect(data.removeFriendship).not.toHaveBeenCalled();
    await waitFor(() => expect(crew.ships.reload).toHaveBeenCalledTimes(1));
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('declines as (requester, me), quietly, then refreshes the crew', async () => {
    crew.ships.data = [ask('a')];
    crew.people = { a: person('a', 'anh', 'Anh') };
    await renderScreen();
    const decline = screen.getByRole('button', { name: 'Decline' });
    fireEvent.click(decline);
    expect(data.removeFriendship).toHaveBeenCalledWith('a', ME);
    expect(data.acceptFriendRequest).not.toHaveBeenCalled();
    await waitFor(() => expect(crew.ships.reload).toHaveBeenCalledTimes(1));
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  // It used to stop there, silently: a refused answer looked exactly like
  // a tap that had not registered.
  it('does not refresh or celebrate an answer the server refused, and says so', async () => {
    data.acceptFriendRequest.mockImplementation(async () => { throw new Error('nope'); });
    crew.ships.data = [ask('a')];
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await flush();
    expect(crew.ships.reload).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Could not accept the request', 'nope');
  });

  it('says so when a decline is refused too', async () => {
    data.removeFriendship.mockImplementation(async () => { throw new Error('nope'); });
    crew.ships.data = [ask('a')];
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    await flush();
    expect(alert).toHaveBeenCalledWith('Could not decline the request', 'nope');
  });

  it('takes one answer per request while it is in flight, and dims both buttons', async () => {
    let settle!: () => void;
    data.acceptFriendRequest.mockImplementation(() => new Promise<void>((ok) => { settle = ok; }));
    crew.ships.data = [ask('a')];
    await renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(data.acceptFriendRequest).toHaveBeenCalledTimes(1);
    expect(data.removeFriendship).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Accept' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Decline' }).getAttribute('aria-disabled')).toBe('true');
    settle();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept' }).getAttribute('aria-disabled')).not.toBe('true'));
  });
});

describe('the ⋯ sheet', () => {
  const openSheet = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
  };

  it('names the asker and offers decline, block and report', async () => {
    crew.ships.data = [ask('a')];
    crew.people = { a: person('a', 'anh', 'Anh Tran') };
    await renderScreen();
    await openSheet();
    expect(screen.getAllByText('Anh Tran').length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: 'Decline and block' })).toBeTruthy();
    expect(screen.getByText('The request goes, silently. They can ask again another day.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report @anh' })).toBeTruthy();
  });

  it('declines from the sheet the same way the card does', async () => {
    crew.ships.data = [ask('a')];
    crew.people = { a: person('a', 'anh') };
    await renderScreen();
    await openSheet();
    const rows = screen.getAllByRole('button', { name: 'Decline' });
    fireEvent.click(rows[rows.length - 1]);
    await waitFor(() => expect(data.removeFriendship).toHaveBeenCalledWith('a', ME));
  });

  it('asks before blocking; Cancel does nothing, Block blocks and refreshes edges and blocks', async () => {
    crew.ships.data = [ask('a')];
    crew.people = { a: person('a', 'anh', 'Anh') };
    await renderScreen();
    await openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Decline and block' }));
    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    const [title, body, buttons] = alert.mock.calls[0];
    expect(title).toBe('Block @anh?');
    expect(body).toBe('They will not be told. You can undo this from Your crew.');
    expect(buttons!.map((b) => b.text)).toEqual(['Cancel', 'Block']);
    expect(buttons![0].style).toBe('cancel');
    expect(data.blockUser).not.toHaveBeenCalled();
    buttons!.find((b) => b.style === 'destructive')!.onPress!();
    expect(data.blockUser).toHaveBeenCalledWith('a');
    await waitFor(() => expect(crew.ships.reload).toHaveBeenCalledTimes(1));
    // "You can undo this from Your crew" — so Your crew must know.
    expect(crew.blocks.reload).toHaveBeenCalledTimes(1);
  });

  it('refreshes nothing when the block fails, and says so', async () => {
    data.blockUser.mockImplementation(async () => { throw new Error('nope'); });
    crew.ships.data = [ask('a')];
    crew.people = { a: person('a', 'anh') };
    await renderScreen();
    await openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Decline and block' }));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    alert.mock.calls[0][2]!.find((b) => b.style === 'destructive')!.onPress!();
    await flush();
    expect(crew.ships.reload).not.toHaveBeenCalled();
    expect(crew.blocks.reload).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Could not block', 'nope');
  });

  it('hands the report flow the asker as a profile', async () => {
    crew.ships.data = [ask('a')];
    crew.people = { a: person('a', 'anh', '', 'https://x/a.jpg') };
    await renderScreen();
    await openSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Report @anh' }));
    await waitFor(() => expect(report).toHaveBeenCalledWith({
      kind: 'profile', id: 'a', name: '@anh', avatarUrl: 'https://x/a.jpg',
    }));
  });

  it('with no profile, says "This request", offers no report, and asks generically', async () => {
    crew.ships.data = [ask('ghost')];
    await renderScreen();
    await openSheet();
    expect(screen.getByText('This request')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Report/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Decline and block' }));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls[0][0]).toBe('Block this person?');
  });

  it('opens from a long press on Decline, for readers who learned it there', async () => {
    crew.ships.data = [ask('a')];
    crew.people = { a: person('a', 'anh', 'Anh') };
    await renderScreen();
    // react-native-web's responder fires onLongPress 450ms into a held
    // press; only Date is faked here, so the real timer runs it.
    const decline = screen.getByRole('button', { name: 'Decline' });
    fireEvent.mouseDown(decline, { button: 0 });
    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    fireEvent.mouseUp(decline, { button: 0 });
    expect(await screen.findByRole('button', { name: 'Decline and block' })).toBeTruthy();
    expect(data.removeFriendship).not.toHaveBeenCalled();
  });

  it('closes on the backdrop', async () => {
    crew.ships.data = [ask('a')];
    crew.people = { a: person('a', 'anh', 'Anh') };
    await renderScreen();
    await openSheet();
    expect(screen.getByRole('button', { name: 'Decline and block' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Close'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Decline and block' })).toBeNull());
  });
});
