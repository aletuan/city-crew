// @vitest-environment jsdom
//
// What is new for the reader, held once (C7c, and one bell since 20 Nov
// 2026): the number the last tab's dot and the bell read, the mark on
// the phone that decides it, and the hook Activity's rows use to say
// which are new and to move the mark.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import { appStateStub } from '../uitest/appState';
import type { CommentNews } from './commentNews';
import { appFlags } from './flags';
import { STALE_MS } from './stale';

const world = vi.hoisted(() => ({
  ready: true,
  session: { user: { id: 'me' } } as { user: { id: string } } | null,
  rows: [] as unknown[],
  applause: [] as unknown[],
  copies: [] as unknown[],
  ships: [] as unknown[],
}));
const fetchCommentNews = vi.hoisted(() => vi.fn(async (_since: string) => [...world.rows] as never[]));
const fetchApplause = vi.hoisted(() => vi.fn(async (_since: string) => [...world.applause] as never[]));
const fetchCopies = vi.hoisted(() => vi.fn(async (_since: string) => [...world.copies] as never[]));

vi.mock('./auth', () => {
  const m = { useAuth: () => ({ ready: world.ready, session: world.session }) };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
vi.mock('./data/comments', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchCommentNews,
}));
vi.mock('./data/people', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchApplause,
  fetchCopies,
}));
vi.mock('./crew', () => ({ useCrew: () => ({ ships: { data: world.ships } }) }));

import { FreshNewsProvider, markKey, useFreshNews, useSeenThrough } from './freshNews';

const row = (at: string, kind: CommentNews['kind'] = 'reply'): CommentNews => ({
  kind, comment_id: `k-${at}-${kind}`,
  list: { id: 'c1', slug: 'hoi-an', title_en: 'Hoi An', title_vi: 'Hội An', title_ja: null },
  actor: 'u2', handle: 'trang', full_name: 'Trang', avatar_url: null, body: 'Hi', at, others: 0,
});

const NINE = '2026-11-18T09:00:00Z';
const TEN = '2026-11-18T10:00:00Z';
const ELEVEN = '2026-11-18T11:00:00Z';

function Probe() {
  const { news, mark, read, fresh, see, freshen } = useFreshNews();
  return (
    <>
      <span data-testid="rows">{String(news.data.length)}</span>
      <span data-testid="mark">{String(mark)}</span>
      <span data-testid="read">{String(read)}</span>
      <span data-testid="fresh">{String(fresh)}</span>
      <button type="button" onClick={() => see(TEN)}>see ten</button>
      <button type="button" onClick={() => see(NINE)}>see nine</button>
      <button type="button" onClick={() => freshen()}>freshen</button>
    </>
  );
}

/** Activity's rows, as far as this hook goes: the newest shown, and
 *  which of three times it calls new. */
function Page({ newest }: { newest: string | null }) {
  const isNew = useSeenThrough(newest);
  return <span data-testid="new">{[NINE, TEN, ELEVEN].filter(isNew).join(' ')}</span>;
}

const text = (id: string) => screen.getByTestId(id).textContent;
const mount = (extra: React.ReactNode = null) => render(<FreshNewsProvider><Probe />{extra}</FreshNewsProvider>);
const settled = () => waitFor(() => expect(text('read')).toBe('true'));

beforeEach(async () => {
  world.ready = true;
  world.session = { user: { id: 'me' } };
  world.rows = [];
  world.applause = [];
  world.copies = [];
  world.ships = [];
  appFlags.set('comments', true);
  await AsyncStorage.removeItem(markKey('me')!);
  await AsyncStorage.removeItem(markKey('you')!);
  fetchCommentNews.mockClear();
  fetchApplause.mockClear();
  fetchCopies.mockClear();
});
afterEach(() => { appFlags.reset(); });

describe('with no provider above', () => {
  it('says nothing is new and does nothing when told', () => {
    render(<Probe />);
    expect([text('rows'), text('mark'), text('read'), text('fresh')]).toEqual(['0', 'null', 'false', '0']);
    fireEvent.click(screen.getByText('see ten'));
    fireEvent.click(screen.getByText('freshen'));
    expect(text('mark')).toBe('null');
  });
});

describe('the number', () => {
  // One bell (owner, 20 Nov 2026): a heart counts as a reply does.
  it('counts every comment row on a phone that has marked nothing, hearts too', async () => {
    world.rows = [row(ELEVEN, 'tag'), row(TEN, 'reply'), row(NINE, 'on_list'), row(ELEVEN, 'heart')];
    mount();
    await waitFor(() => expect(text('fresh')).toBe('4'));
    expect(text('mark')).toBe('null');
  });

  // A like and a copy of the reader's lists ring the bell too, gathered
  // one row a list as Activity draws them; a friend request waiting is
  // news until answered, whatever the mark; a request of yours accepted
  // since the window opened is a row like any other.
  it('counts likes and copies one row a list, requests waiting, and friendships begun', async () => {
    await AsyncStorage.setItem(markKey('me')!, TEN);
    const now = new Date().toISOString();
    world.applause = [
      { collection_id: 'c1', liked_at: ELEVEN, liker_id: 'u2', liker_handle: 'hado', liker_name: 'Ha Do' },
      { collection_id: 'c1', liked_at: ELEVEN, liker_id: 'u3', liker_handle: 'tuan', liker_name: 'Tuan' },
      { collection_id: 'c2', liked_at: NINE, liker_id: 'u2', liker_handle: 'hado', liker_name: 'Ha Do' },
    ];
    world.copies = [{ collection_id: 'c1', copied_at: ELEVEN, copier_id: 'u4', copier_handle: 'an', copier_name: 'An' }];
    world.ships = [
      { requester: 'u5', addressee: 'me', status: 'pending', created_at: NINE, responded_at: null },
      { requester: 'me', addressee: 'u6', status: 'accepted', created_at: NINE, responded_at: now },
      { requester: 'u7', addressee: 'me', status: 'accepted', created_at: NINE, responded_at: now },
    ];
    mount();
    // c1's likes (one row), c1's copy, the request, the friendship you
    // asked for — and not c2's like, older than the mark, nor the
    // friendship you accepted, which you did.
    await waitFor(() => expect(text('fresh')).toBe('4'));
    expect(fetchApplause).toHaveBeenCalledTimes(1);
    expect(fetchCopies.mock.calls[0][0]).toBe(fetchApplause.mock.calls[0][0]);
  });

  it('counts only what is later than the mark the phone kept', async () => {
    await AsyncStorage.setItem(markKey('me')!, TEN);
    world.rows = [row(ELEVEN), row(TEN), row(NINE)];
    mount();
    await waitFor(() => expect(text('fresh')).toBe('1'));
    expect(text('mark')).toBe(TEN);
  });

  // Before the read, every row looks unseen: the dot would light on each
  // launch and go out a moment later.
  it('says nothing is new until the phone has said what it remembers', async () => {
    await AsyncStorage.setItem(markKey('me')!, ELEVEN);
    world.rows = [row(TEN)];
    let give: (raw: string | null) => void = () => {};
    vi.mocked(AsyncStorage.getItem).mockImplementationOnce(() => new Promise((res) => { give = res; }));
    mount();
    await waitFor(() => expect(text('rows')).toBe('1'));
    expect([text('read'), text('fresh')]).toEqual(['false', '0']);
    await act(async () => { give(ELEVEN); });
    expect([text('read'), text('fresh')]).toEqual(['true', '0']);
  });

  it('reads text that is not a time as no mark at all', async () => {
    await AsyncStorage.setItem(markKey('me')!, 'yesterday');
    world.rows = [row(TEN)];
    mount();
    await waitFor(() => expect(text('fresh')).toBe('1'));
    expect(text('mark')).toBe('null');
  });

  it('asks nothing and says nothing new for nobody, before auth has decided, and with the switch off', async () => {
    world.rows = [row(TEN)];
    world.session = null;
    const signedOut = mount();
    await waitFor(() => expect(text('rows')).toBe('0'));
    signedOut.unmount();

    world.session = { user: { id: 'me' } };
    world.ready = false;
    const early = mount();
    await waitFor(() => expect(text('rows')).toBe('0'));
    early.unmount();

    world.ready = true;
    appFlags.set('comments', false);
    mount();
    await settled();
    expect([text('rows'), text('fresh')]).toEqual(['0', '0']);
    expect(fetchCommentNews).not.toHaveBeenCalled();
  });

  it('keeps a mark for each account', async () => {
    await AsyncStorage.setItem(markKey('me')!, ELEVEN);
    world.rows = [row(TEN)];
    world.session = { user: { id: 'you' } };
    mount();
    await waitFor(() => expect(text('fresh')).toBe('1'));
    expect(markKey(null)).toBeNull();
  });
});

describe('the mark', () => {
  it('moves forward, is written for the next launch, and takes the number with it', async () => {
    world.rows = [row(ELEVEN), row(TEN), row(NINE)];
    mount();
    await waitFor(() => expect(text('fresh')).toBe('3'));
    fireEvent.click(screen.getByText('see ten'));
    expect([text('mark'), text('fresh')]).toEqual([TEN, '1']);
    expect(await AsyncStorage.getItem(markKey('me')!)).toBe(TEN);
  });

  it('never moves back', async () => {
    await AsyncStorage.setItem(markKey('me')!, TEN);
    mount();
    await settled();
    vi.mocked(AsyncStorage.setItem).mockClear();
    fireEvent.click(screen.getByText('see nine'));
    fireEvent.click(screen.getByText('see ten'));
    expect(text('mark')).toBe(TEN);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('asking again', () => {
  let app: ReturnType<typeof appStateStub>;
  beforeEach(() => { app = appStateStub(); });
  afterEach(() => { app.restore(); });

  it('asks again on coming back to the app, and when told to, only once the answer is stale', async () => {
    mount();
    await waitFor(() => expect(fetchCommentNews).toHaveBeenCalledTimes(1));
    await settled();
    await waitFor(() => expect(text('rows')).toBe('0'));
    await app.emit('active');
    fireEvent.click(screen.getByText('freshen'));
    expect(fetchCommentNews).toHaveBeenCalledTimes(1);

    app.later(STALE_MS);
    await app.emit('background');
    expect(fetchCommentNews).toHaveBeenCalledTimes(1);
    world.rows = [row(TEN)];
    await app.emit('active');
    await waitFor(() => expect(text('fresh')).toBe('1'));
    expect(fetchCommentNews).toHaveBeenCalledTimes(2);

    app.later(2 * STALE_MS);
    fireEvent.click(screen.getByText('freshen'));
    await waitFor(() => expect(fetchCommentNews).toHaveBeenCalledTimes(3));
    // The likes and copies keep the same time as the comments.
    expect(fetchApplause).toHaveBeenCalledTimes(3);
  });

  it('does not ask twice while an ask is out', async () => {
    let land: (rows: never[]) => void = () => {};
    fetchCommentNews.mockImplementationOnce(() => new Promise((res) => { land = res; }));
    mount();
    await waitFor(() => expect(fetchCommentNews).toHaveBeenCalledTimes(1));
    app.later(STALE_MS);
    await app.emit('active');
    fireEvent.click(screen.getByText('freshen'));
    expect(fetchCommentNews).toHaveBeenCalledTimes(1);
    await act(async () => { land([]); });
  });

  it('stops listening when it is taken down', async () => {
    const { unmount } = mount();
    await waitFor(() => expect(fetchCommentNews).toHaveBeenCalledTimes(1));
    unmount();
    app.later(STALE_MS);
    await app.emit('active');
    expect(fetchCommentNews).toHaveBeenCalledTimes(1);
  });
});

describe('Activity\'s rows', () => {
  /** The page, opened by a press: the app has been up a while when
   *  Activity opens. */
  function Door({ newest }: { newest: string | null }) {
    const [open, setOpen] = React.useState(false);
    return open ? <Page newest={newest} /> : <button type="button" onClick={() => setOpen(true)}>open</button>;
  }
  const open = () => fireEvent.click(screen.getByText('open'));
  let app: ReturnType<typeof appStateStub>;
  beforeEach(() => { app = appStateStub(); });
  afterEach(() => { app.restore(); });

  /** Up, with the launch's answer in and the phone's mark read. */
  const up = async (newest: string | null) => {
    mount(<Door newest={newest} />);
    await waitFor(() => expect(fetchCommentNews).toHaveBeenCalledTimes(1));
    await settled();
    await waitFor(() => expect(text('rows')).toBe(String(world.rows.length)));
    // The page opens later than the launch's answer landed.
    app.later(1000);
  };

  it('asks the news again as the page opens, calls new what is later than the mark it found, and moves the mark past the newest shown', async () => {
    await AsyncStorage.setItem(markKey('me')!, NINE);
    world.rows = [row(ELEVEN), row(TEN)];
    await up(ELEVEN);
    expect(text('fresh')).toBe('2');
    open();
    expect(text('new')).toBe(`${TEN} ${ELEVEN}`);
    await waitFor(() => expect(text('mark')).toBe(ELEVEN));
    expect(fetchCommentNews).toHaveBeenCalledTimes(2);
    // The likes are asked again with it, so the figure is worked from
    // what the page shows.
    expect(fetchApplause).toHaveBeenCalledTimes(2);
    expect(text('fresh')).toBe('0');
    expect(await AsyncStorage.getItem(markKey('me')!)).toBe(ELEVEN);
    // For this visit the rows stay new: judged against the mark as it
    // stood when the page opened.
    expect(text('new')).toBe(`${TEN} ${ELEVEN}`);
  });

  it('calls every row new on a phone that has marked nothing', async () => {
    world.rows = [row(TEN)];
    await up(TEN);
    open();
    expect(text('new')).toBe(`${NINE} ${TEN} ${ELEVEN}`);
    await waitFor(() => expect(text('mark')).toBe(TEN));
  });

  // The shared news may be minutes old when the page opens; moved before
  // the fresh answer, the mark could pass a reply this phone has not
  // heard of yet.
  it('holds the mark until the ask the page made has answered', async () => {
    await AsyncStorage.setItem(markKey('me')!, NINE);
    world.rows = [row(TEN)];
    await up(TEN);
    let land: (rows: never[]) => void = () => {};
    fetchCommentNews.mockImplementationOnce(() => new Promise((res) => { land = res; }));
    open();
    await act(async () => {});
    expect(text('mark')).toBe(NINE);
    await act(async () => { land([row(TEN)] as never[]); });
    expect(text('mark')).toBe(TEN);
  });

  it('moves nothing when that ask fails, so the dot is there for the next visit', async () => {
    await AsyncStorage.setItem(markKey('me')!, NINE);
    world.rows = [row(TEN)];
    await up(TEN);
    fetchCommentNews.mockImplementationOnce(async () => { throw new Error('offline'); });
    open();
    await waitFor(() => expect(fetchCommentNews).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect([text('mark'), text('fresh')]).toEqual([NINE, '1']);
  });

  it('moves nothing for a page with no rows', async () => {
    await AsyncStorage.setItem(markKey('me')!, NINE);
    await up(null);
    open();
    await waitFor(() => expect(fetchCommentNews).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(text('mark')).toBe(NINE);
  });

  it('asks once as it opens, not again when a comment is written', async () => {
    const { commentsChanged: changed } = await import('./commentsChanged');
    await up(null);
    open();
    await waitFor(() => expect(fetchCommentNews).toHaveBeenCalledTimes(2));
    await act(async () => { changed(); });
    // The query's own ask for the change, and no second one from the page.
    await waitFor(() => expect(fetchCommentNews).toHaveBeenCalledTimes(3));
    await act(async () => {});
    expect(fetchCommentNews).toHaveBeenCalledTimes(3);
  });

  it('calls nothing new until the phone has said what it remembers', async () => {
    world.session = null;
    mount(<Page newest={TEN} />);
    await act(async () => {});
    expect(text('new')).toBe('');
    expect(text('mark')).toBe('null');
  });
});
