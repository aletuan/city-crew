// @vitest-environment jsdom
//
// A thread, read (C3): what the page asks for (the subject it was handed,
// once), the order and the indent it draws the answer in, the fold under
// a root and what opens it, the roots arriving as the reader scrolls, a
// gone comment as its line, and the four states — waiting, empty, failed
// with Try again, and rows kept when a refresh fails behind them.
// `threadOf`, `agoLabel`, `nearEnd` and the hook under the page run for
// real; only the one RPC wrapper and the providers are stood in.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, viewStyleOf, within } from '../uitest/render';
import type { CommentRow as Row, Subject } from '../lib/comments';
import type { Nav, RootRoute } from '../nav';
import { commentsChanged } from '../lib/commentsChanged';
import { INDENT } from '../components/CommentRow';

const NOW = new Date(2026, 10, 18, 12, 0, 0);
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();

const data = vi.hoisted(() => ({
  fetchThread: vi.fn(async (_s: unknown): Promise<unknown[]> => []),
}));
// The module the hook reads the RPC from, not the barrel.
vi.mock('../lib/data/comments', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchThread: data.fetchThread,
}));
const duck = vi.hoisted(() => ({ fn: vi.fn() as ((e: unknown) => void) | undefined }));
vi.mock('../components/tabBarDuck', () => ({ useDuckOnScroll: () => duck.fn }));
const state = vi.hoisted(() => ({ lang: 'en' as 'en' | 'vi', me: 'me' as string | null }));
const askToSignIn = vi.hoisted(() => vi.fn());
vi.mock('../lib/auth', () => {
  const all = () => ({
    session: state.me ? { user: { id: state.me } } : null,
    profile: state.me ? { avatar_url: 'https://faces/me.jpg' } : null,
  });
  return { useSession: all, useProfile: all };
});
vi.mock('../lib/save', () => ({ useSaveActions: () => ({ askToSignIn }) }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang, setLang: () => {},
    t: (en: string | null, vi: string | null) => (state.lang === 'vi' ? vi ?? en ?? '' : en ?? vi ?? ''),
  }),
}));

import CommentsScreen, { PAGE, REPLIES_SHOWN } from './CommentsScreen';

const row = (id: string, parent: string | null, over: Partial<Row> = {}): Row => ({
  id, parent_id: parent, root_id: null, depth: parent ? 1 : 0, body: `says ${id}`, created_at: ago(60),
  gone: false, author: `u-${id}`, handle: `h${id}`, full_name: null, avatar_url: null, mentions: [],
  ...over,
});
const SUBJECT: Subject = { kind: 'collection', id: 'c1' };

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const show = async (rows: Row[] = [], subject: Subject = SUBJECT) => {
  data.fetchThread.mockImplementation(async () => rows);
  const navigation = { goBack: vi.fn(), navigate: vi.fn() };
  render(
    <CommentsScreen
      navigation={navigation as unknown as Nav}
      route={{ params: { subject } } as RootRoute<'Comments'>}
    />,
  );
  await flush();
  return navigation;
};

/** The first props in the committed tree that `pick` accepts. */
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
// A screen is 844 here, so "near the end" is less than 1266 left under it.
const scrollAt = (y: number, content: number) => act(() => {
  (propsWhere((q) => typeof q.onScroll === 'function' && 'contentContainerStyle' in q).onScroll as (e: unknown) => void)({
    nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 390, height: content }, layoutMeasurement: { width: 390, height: 844 } },
  });
});
const page = () => propsWhere((p) => 'onRefresh' in p && 'refreshing' in p) as { onRefresh: () => void; refreshing: boolean };

const branches = () => screen.queryAllByTestId('comment-branch');
/** Each branch as the bodies it draws, top to bottom; a gone line as "—". */
const drawn = () => branches().map((b) => [...b.querySelectorAll('[data-testid="comment-body"],[data-testid="comment-gone"]')]
  .map((el) => (el.getAttribute('data-testid') === 'comment-gone' ? '—' : el.textContent)));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  duck.fn = vi.fn();
  state.lang = 'en';
  state.me = 'me';
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('what the page asks', () => {
  it('asks for the subject it was handed, once, and says "Comments"', async () => {
    await show([], { kind: 'collection', id: 'c9' });
    expect(data.fetchThread).toHaveBeenCalledTimes(1);
    expect(data.fetchThread).toHaveBeenCalledWith({ kind: 'collection', id: 'c9' });
    expect(screen.getByText('Comments')).toBeTruthy();
  });

  it('goes back from its back button', async () => {
    const nav = await show();
    fireEvent.click(screen.getByTestId('comments-back'));
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('a thread', () => {
  it('draws the roots in the order they came, each with its answers indented under it', async () => {
    await show([
      row('b', null), row('a', null),
      row('a1', 'a'), row('a1x', 'a1', { depth: 2 }),
      row('b1', 'b'),
    ]);
    expect(drawn()).toEqual([['says b', 'says b1'], ['says a', 'says a1', 'says a1x']]);
    const [, a] = branches();
    const margins = within(a).getAllByTestId('comment-row').map((r) => viewStyleOf(r).marginLeft);
    expect(margins).toEqual([0, INDENT[1], INDENT[2]]);
  });

  it('says how long ago each was written', async () => {
    await show([row('a', null, { created_at: ago(5) })]);
    expect(screen.getByTestId('comment-when').textContent).toBe('5m ago');
  });

  it('draws a gone comment as its line while an answer hangs from it, and not otherwise', async () => {
    const gone = { gone: true, body: null, author: null, handle: null };
    await show([row('a', null, gone), row('a1', 'a'), row('b', null, gone)]);
    expect(drawn()).toEqual([['—', 'says a1']]);
  });

  it('opens a person from their face', async () => {
    const nav = await show([row('a', null, { handle: '@Trang' })]);
    fireEvent.click(screen.getByTestId('comment-face'));
    expect(nav.navigate).toHaveBeenCalledWith('Person', { handle: 'trang' });
  });
});

describe('the fold under a root', () => {
  const long = [row('a', null), row('a1', 'a'), row('a2', 'a'), row('a3', 'a'), row('a4', 'a'), row('b', null), row('b1', 'b'), row('b2', 'b')];

  it('draws two answers and counts the rest; a root with two or fewer has no fold', async () => {
    await show(long);
    expect(REPLIES_SHOWN).toBe(2);
    expect(drawn()).toEqual([['says a', 'says a1', 'says a2'], ['says b', 'says b1', 'says b2']]);
    const folds = screen.getAllByTestId('comment-more');
    expect(folds).toHaveLength(1);
    expect(folds[0].textContent).toBe('View 2 more replies');
    // Under the answers, where an answer's words start.
    expect(viewStyleOf(folds[0]).marginLeft).toBe(INDENT[1]);
  });

  it('opens that branch on a press, and it stays open', async () => {
    await show(long);
    fireEvent.click(screen.getByTestId('comment-more'));
    expect(drawn()[0]).toEqual(['says a', 'says a1', 'says a2', 'says a3', 'says a4']);
    expect(screen.queryByTestId('comment-more')).toBeNull();
  });

  it('opens the one pressed and leaves the others folded', async () => {
    await show([...long, row('b3', 'b'), row('b4', 'b'), row('b5', 'b')]);
    const [, second] = screen.getAllByTestId('comment-more');
    expect(second.textContent).toBe('View 3 more replies');
    fireEvent.click(second);
    expect(drawn().map((b) => b.length)).toEqual([3, 6]);
    expect(screen.getAllByTestId('comment-more')).toHaveLength(1);
  });

  it('counts one in the singular, and speaks the reader\'s language', async () => {
    await show([row('a', null), row('a1', 'a'), row('a2', 'a'), row('a3', 'a')]);
    expect(screen.getByTestId('comment-more').textContent).toBe('View 1 more reply');
    cleanup();
    state.lang = 'vi';
    await show(long);
    expect(screen.getByTestId('comment-more').textContent).toBe('Xem thêm 2 trả lời');
    cleanup();
    await show([row('a', null), row('a1', 'a'), row('a2', 'a'), row('a3', 'a')]);
    expect(screen.getByTestId('comment-more').textContent).toBe('Xem thêm 1 trả lời');
  });
});

describe('as the reader scrolls', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => row(`r${i}`, null));

  it('draws ten roots at first, and tells the tab bar of every scroll', async () => {
    await show(many(25));
    expect(PAGE).toBe(10);
    expect(branches()).toHaveLength(10);
    // 5000 of page, 2890 left: far from the end.
    scrollAt(1266, 5000);
    expect(branches()).toHaveLength(10);
    expect(duck.fn).toHaveBeenCalledTimes(1);
  });

  it('adds ten within a screen and a half of the end, once for each height the page has had', async () => {
    await show(many(25));
    scrollAt(2891, 5000);
    scrollAt(2950, 5000);
    expect(branches()).toHaveLength(20);
    scrollAt(5000, 6900);
    expect(branches()).toHaveLength(25);
  });

  it('adds nothing once every root is drawn, and scrolls without a tab bar to tell', async () => {
    duck.fn = undefined;
    await show(many(3));
    scrollAt(100, 900);
    expect(branches()).toHaveLength(3);
  });
});

describe('the states', () => {
  it('turns while the first answer is out', async () => {
    let land: (rows: Row[]) => void = () => {};
    data.fetchThread.mockImplementation(() => new Promise((res) => { land = res as (rows: Row[]) => void; }));
    render(<CommentsScreen navigation={{} as Nav} route={{ params: { subject: SUBJECT } } as RootRoute<'Comments'>} />);
    await flush();
    expect(screen.getByTestId('comments-loading')).toBeTruthy();
    await act(async () => { land([row('a', null)]); });
    expect(screen.queryByTestId('comments-loading')).toBeNull();
    expect(drawn()).toEqual([['says a']]);
  });

  it('says there are none yet for an empty thread', async () => {
    await show([]);
    expect(within(screen.getByTestId('comments-empty')).getByText('No comments yet')).toBeTruthy();
    expect(screen.queryByTestId('comments-failed')).toBeNull();
  });

  it('says it could not load, and asks again on Try again', async () => {
    data.fetchThread.mockRejectedValueOnce(new Error('timeout'));
    render(<CommentsScreen navigation={{} as Nav} route={{ params: { subject: SUBJECT } } as RootRoute<'Comments'>} />);
    await flush();
    expect(screen.getByTestId('comments-failed')).toBeTruthy();
    let land: (rows: Row[]) => void = () => {};
    data.fetchThread.mockImplementation(() => new Promise((res) => { land = res as (rows: Row[]) => void; }));
    fireEvent.click(screen.getByTestId('comments-retry'));
    await flush();
    // Nothing was ever answered, so the question being open again is a
    // spinner — not "No comments yet", which would be a claim.
    expect(screen.getByTestId('comments-loading')).toBeTruthy();
    expect(screen.queryByTestId('comments-empty')).toBeNull();
    await act(async () => { land([row('a', null)]); });
    expect(screen.queryByTestId('comments-failed')).toBeNull();
    expect(drawn()).toEqual([['says a']]);
  });
});

describe('pulling the page down', () => {
  it('asks again, lights the pull\'s spinner until the answer lands, and draws what came', async () => {
    await show([row('a', null)]);
    expect(page().refreshing).toBe(false);
    let land: (rows: Row[]) => void = () => {};
    data.fetchThread.mockImplementation(() => new Promise((res) => { land = res as (rows: Row[]) => void; }));
    act(() => { page().onRefresh(); });
    expect(page().refreshing).toBe(true);
    expect(data.fetchThread).toHaveBeenCalledTimes(2);
    // The rows stay through it; no page spinner behind a pull.
    expect(drawn()).toEqual([['says a']]);
    expect(screen.queryByTestId('comments-loading')).toBeNull();
    await act(async () => { land([row('b', null), row('a', null)]); });
    expect(page().refreshing).toBe(false);
    expect(drawn()).toEqual([['says b'], ['says a']]);
  });

  it('goes on saying there are none while an empty thread is asked about again', async () => {
    await show([]);
    data.fetchThread.mockImplementation(() => new Promise(() => {}));
    act(() => { page().onRefresh(); });
    // An empty answer is an answer: the pull's spinner turns, the page's does not.
    expect(page().refreshing).toBe(true);
    expect(screen.getByTestId('comments-empty')).toBeTruthy();
    expect(screen.queryByTestId('comments-loading')).toBeNull();
  });

  it('keeps the rows when the pull fails', async () => {
    await show([row('a', null)]);
    data.fetchThread.mockRejectedValueOnce(new Error('timeout'));
    act(() => { page().onRefresh(); });
    await flush();
    expect(drawn()).toEqual([['says a']]);
    expect(screen.queryByTestId('comments-failed')).toBeNull();
  });
});

// C4: the two ways from the thread to writing, and the thread asking
// again once something was written.
describe('writing', () => {
  it('opens the form for this subject from the line at the head of the page, which wears the reader\'s face', async () => {
    const nav = await show([row('a', null)]);
    const line = screen.getByTestId('comments-write');
    expect(line.textContent).toBe('Write a comment…');
    expect(line.querySelector('img')!.getAttribute('src')).toBe('https://faces/me.jpg');
    // Above the newest root.
    expect(line.compareDocumentPosition(branches()[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(line);
    expect(nav.navigate).toHaveBeenCalledExactlyOnceWith('CommentForm', { subject: SUBJECT });
  });

  it('is there on an empty thread too, above "No comments yet"', async () => {
    await show([]);
    expect(screen.getByTestId('comments-write')).toBeTruthy();
    expect(screen.getByTestId('comments-empty')).toBeTruthy();
  });

  it('answers a comment with what the form will quote: who, by handle or else by name, and what they said', async () => {
    const nav = await show([row('a', null, { handle: '@Trang', body: 'Lovely rooftop' }), row('a1', 'a', { handle: null, full_name: 'Lan Pham' })]);
    const [first, second] = screen.getAllByTestId('comment-reply');
    fireEvent.click(first);
    expect(nav.navigate).toHaveBeenLastCalledWith('CommentForm', { subject: SUBJECT, replyTo: { id: 'a', who: 'trang', body: 'Lovely rooftop' } });
    fireEvent.click(second);
    expect(nav.navigate).toHaveBeenLastCalledWith('CommentForm', { subject: SUBJECT, replyTo: { id: 'a1', who: 'Lan Pham', body: 'says a1' } });
  });

  it('names nobody for a writer with neither handle nor name', async () => {
    const nav = await show([row('a', null, { handle: null })]);
    fireEvent.click(screen.getByTestId('comment-reply'));
    expect(nav.navigate).toHaveBeenLastCalledWith('CommentForm', { subject: SUBJECT, replyTo: { id: 'a', who: '', body: 'says a' } });
  });

  it('offers no reply to a comment that is gone', async () => {
    await show([row('a', null, { gone: true, body: null, author: null, handle: null }), row('a1', 'a')]);
    expect(screen.getAllByTestId('comment-reply')).toHaveLength(1);
  });

  it('asks a guest to sign in from either way, and opens no form', async () => {
    state.me = null;
    const nav = await show([row('a', null)]);
    fireEvent.click(screen.getByTestId('comments-write'));
    fireEvent.click(screen.getByTestId('comment-reply'));
    expect(askToSignIn).toHaveBeenCalledTimes(2);
    expect(askToSignIn).toHaveBeenCalledWith('comment');
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('asks for the thread again when a comment is written or taken back anywhere', async () => {
    await show([row('a', null)]);
    expect(data.fetchThread).toHaveBeenCalledTimes(1);
    data.fetchThread.mockImplementation(async () => [row('b', null), row('a', null)]);
    act(() => { commentsChanged(); });
    await flush();
    expect(data.fetchThread).toHaveBeenCalledTimes(2);
    expect(drawn()).toEqual([['says b'], ['says a']]);
    // The rows stood through the ask: no page spinner behind them.
    expect(screen.queryByTestId('comments-loading')).toBeNull();
  });
});

// C4b: the ⋯ on each comment. What the menu holds and does is pinned in
// `useCommentMenu`'s test; here it is which rows wear one, and that the
// page raises the right sheet for the reader it has.
describe('what can be done about a comment', () => {
  it('puts a ⋯ on every living comment for a reader who is signed in, and none for a guest', async () => {
    const rows = [row('a', null, { gone: true, body: null, author: null, handle: null }), row('a1', 'a'), row('b', null)];
    await show(rows);
    expect(screen.getAllByTestId('comment-more-menu')).toHaveLength(2);
    cleanup();
    state.me = null;
    await show(rows);
    expect(screen.queryByTestId('comment-more-menu')).toBeNull();
  });

  it('offers the reader\'s own comment for deleting and anybody else\'s for reporting', async () => {
    await show([row('mine', null, { author: 'me' }), row('theirs', null)]);
    fireEvent.click(screen.getAllByTestId('comment-more-menu')[0]);
    expect(screen.getByTestId('sheet-action-delete')).toBeTruthy();
    expect(screen.queryByTestId('sheet-action-report')).toBeNull();
    cleanup();
    await show([row('mine', null, { author: 'me' }), row('theirs', null)]);
    fireEvent.click(screen.getAllByTestId('comment-more-menu')[1]);
    expect(screen.getByTestId('sheet-action-report')).toBeTruthy();
    expect(screen.queryByTestId('sheet-action-delete')).toBeNull();
  });
});
