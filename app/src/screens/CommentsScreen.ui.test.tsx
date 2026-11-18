// @vitest-environment jsdom
//
// A thread, read (C3): what the page asks for (the subject it was handed,
// once), the order and the indent it draws the answer in, the fold under
// a root and what opens it, the roots arriving as the reader scrolls, and the four states — waiting, empty, failed
// with Try again, and rows kept when a refresh fails behind them.
// `threadOf`, `agoLabel`, `nearEnd` and the hook under the page run for
// real; only the one RPC wrapper and the providers are stood in.

import React from 'react';
import { Keyboard, StyleSheet } from 'react-native';
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
  postComment: vi.fn(async (_s: unknown, _parent: string | null, _body: string): Promise<string> => 'k-new'),
  likeComment: vi.fn(async (_id: string, _on: boolean): Promise<void> => {}),
}));
// The module the hook reads the RPC from, not the barrel.
vi.mock('../lib/data/comments', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchThread: data.fetchThread,
  postComment: data.postComment,
  likeComment: data.likeComment,
}));
// A phone with a home indicator: 34 under the page, where the bench's
// own stand-in says zero and the field's margin could not be told from
// its padding.
vi.mock('react-native-safe-area-context', () => {
  const through = ({ children }: { children?: React.ReactNode }) => children;
  return {
    SafeAreaProvider: through, SafeAreaView: through,
    useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
  };
});
// The hold on the tab bar: what the page asks of it, and with whose navigator.
const away = vi.hoisted(() => vi.fn());
vi.mock('../components/tabBarDuck', () => ({ useTabBarAway: away }));
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
  author: `u-${id}`, handle: `h${id}`, full_name: null, avatar_url: null, mentions: [], likes: 0, liked: false,
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
/** Each branch as the bodies it draws, top to bottom. */
const drawn = () => branches().map((b) => [...b.querySelectorAll('[data-testid="comment-body"]')].map((el) => el.textContent));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  data.postComment.mockImplementation(async () => 'k-new');
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

  it('draws ten roots at first, and none more far from the end', async () => {
    await show(many(25));
    expect(PAGE).toBe(10);
    expect(branches()).toHaveLength(10);
    // 5000 of page, 2890 left: far from the end.
    scrollAt(1266, 5000);
    expect(branches()).toHaveLength(10);
  });

  it('adds ten within a screen and a half of the end, once for each height the page has had', async () => {
    await show(many(25));
    scrollAt(2891, 5000);
    scrollAt(2950, 5000);
    expect(branches()).toHaveLength(20);
    scrollAt(5000, 6900);
    expect(branches()).toHaveLength(25);
  });

  it('adds nothing once every root is drawn', async () => {
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

// C4, as it stands since 18 Nov 2026: a field at the foot of the page.
// What the field shows of the rules is pinned in `CommentComposer`'s
// test; here it is what the page does with it — whom the words answer,
// what is sent and under what, the thread asking again, and the bar.
describe('writing', () => {
  const field = () => screen.getByTestId('composer-field') as HTMLTextAreaElement;
  const type = (words: string) => fireEvent.change(field(), { target: { value: words } });
  const sendIt = () => act(async () => { fireEvent.click(screen.getByTestId('composer-send')); await Promise.resolve(); await Promise.resolve(); });
  const replying = () => screen.queryByTestId('composer-replying')?.textContent ?? null;

  it('keeps the tab bar away while it is in front, by its own navigator', async () => {
    const nav = await show([]);
    expect(away).toHaveBeenCalledWith(nav);
  });

  it('has the field under the thread, wearing the reader\'s face, on an empty thread too', async () => {
    await show([row('a', null)]);
    const bar = screen.getByTestId('composer');
    expect(bar.querySelector('img')!.getAttribute('src')).toBe('https://faces/me.jpg');
    expect(branches()[0].compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    cleanup();
    await show([]);
    expect(screen.getByTestId('composer')).toBeTruthy();
    expect(screen.getByTestId('comments-empty')).toBeTruthy();
  });

  // The home indicator's margin, which the field gives up to the keyboard.
  it('sits on the phone\'s own margin, and on the keyboard without it', async () => {
    // Every listener, not the last: the page's is not the only one on the keyboard.
    const heard: Record<string, (() => void)[]> = {};
    const removed: string[] = [];
    const listen = vi.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
      (heard[event] ??= []).push(cb);
      return { remove: () => { removed.push(event); } };
    }) as never);
    await show([]);
    // Off the committed tree: an element's own fiber can be the one from
    // before the last render, and would answer with the old margin.
    const pad = () => (StyleSheet.flatten(propsWhere((q) => q.testID === 'composer').style as never) as { paddingBottom?: number }).paddingBottom;
    expect(pad()).toBe(42);
    act(() => heard.keyboardWillShow.forEach((f) => f()));
    expect(pad()).toBe(8);
    act(() => heard.keyboardWillHide.forEach((f) => f()));
    expect(pad()).toBe(42);
    cleanup();
    expect([...new Set(removed)].sort()).toEqual(['keyboardWillHide', 'keyboardWillShow']);
    listen.mockRestore();
  });

  it('posts a comment that answers nobody under this subject, and the thread asks again', async () => {
    await show([row('a', null)]);
    data.fetchThread.mockImplementation(async () => [row('new', null), row('a', null)]);
    type('Lovely rooftop');
    await sendIt();
    await flush();
    expect(data.postComment).toHaveBeenCalledExactlyOnceWith(SUBJECT, null, 'Lovely rooftop');
    expect(data.fetchThread).toHaveBeenCalledTimes(2);
    expect(drawn()).toEqual([['says new'], ['says a']]);
    expect(field().value).toBe('');
  });

  it('answers the comment whose "Reply" was pressed: says whom, puts the cursor in the field, and sends under it', async () => {
    await show([row('a', null, { handle: '@Trang' }), row('a1', 'a', { handle: null, full_name: 'Lan Pham' })]);
    expect(replying()).toBeNull();
    const [first, second] = screen.getAllByTestId('comment-reply');
    fireEvent.click(second);
    expect(replying()).toBe('Replying to Lan Pham');
    fireEvent.click(first);
    expect(replying()).toBe('Replying to trang');
    expect(document.activeElement).toBe(field());
    type('Agreed');
    await sendIt();
    expect(data.postComment).toHaveBeenCalledExactlyOnceWith(SUBJECT, 'a', 'Agreed');
    // Sent, the next words answer nobody again.
    expect(replying()).toBeNull();
    // And the keyboard goes down, off the comment just written.
    expect(document.activeElement).not.toBe(field());
  });

  it('answers nobody after the ✕, and the words typed stay', async () => {
    await show([row('a', null)]);
    fireEvent.click(screen.getByTestId('comment-reply'));
    type('On second thought');
    fireEvent.click(screen.getByTestId('composer-cancel-reply'));
    expect(replying()).toBeNull();
    expect(field().value).toBe('On second thought');
    await sendIt();
    expect(data.postComment).toHaveBeenCalledExactlyOnceWith(SUBJECT, null, 'On second thought');
  });

  it('keeps whom it answers, and the words, when the server refuses', async () => {
    await show([row('a', null, { handle: 'trang' })]);
    data.postComment.mockRejectedValueOnce(new Error('comment:cap'));
    fireEvent.click(screen.getByTestId('comment-reply'));
    type('One more');
    await sendIt();
    expect(screen.getByTestId('composer-error').textContent).toContain('limit');
    expect(replying()).toBe('Replying to trang');
    expect(field().value).toBe('One more');
    // The keyboard stays, for the words to be mended.
    expect(document.activeElement).toBe(field());
    // Nothing was written, so nothing is asked again.
    expect(data.fetchThread).toHaveBeenCalledTimes(1);
  });

  it('asks a guest to sign in from the field and from "Reply", and answers nobody', async () => {
    state.me = null;
    await show([row('a', null)]);
    expect(screen.queryByTestId('composer-field')).toBeNull();
    fireEvent.click(screen.getByTestId('composer-guest'));
    fireEvent.click(screen.getByTestId('comment-reply'));
    expect(askToSignIn).toHaveBeenCalledTimes(2);
    expect(askToSignIn).toHaveBeenCalledWith('comment');
    expect(replying()).toBeNull();
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
  it('puts a ⋯ on every comment for a reader who is signed in, and none for a guest', async () => {
    const rows = [row('a', null), row('a1', 'a'), row('b', null)];
    await show(rows);
    expect(screen.getAllByTestId('comment-more-menu')).toHaveLength(3);
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

describe('a heart on each comment', () => {
  const hearts = () => screen.getAllByTestId('comment-heart');
  const icon = (el: HTMLElement) => el.querySelector('[data-icon]')!.getAttribute('data-icon');

  it('is drawn on a comment and on a reply, as the thread has them, and a press fills it and tells the server', async () => {
    data.likeComment.mockClear();
    await show([row('a', null, { likes: 2 }), row('b', 'a', { likes: 1, liked: true })]);
    expect(hearts().map(icon)).toEqual(['heart-outline', 'heart']);
    expect(screen.getAllByTestId('comment-likes').map((el) => el.textContent)).toEqual(['2', '1']);
    await act(async () => { fireEvent.click(hearts()[0]); });
    await act(async () => { fireEvent.click(hearts()[1]); });
    expect(hearts().map(icon)).toEqual(['heart', 'heart-outline']);
    expect(data.likeComment.mock.calls).toEqual([['a', true], ['b', false]]);
    // The thread is not asked again for a like.
    expect(data.fetchThread).toHaveBeenCalledTimes(1);
  });

  it('asks a guest in, as a comment would', async () => {
    state.me = null;
    askToSignIn.mockClear(); data.likeComment.mockClear();
    await show([row('a', null)]);
    fireEvent.click(hearts()[0]);
    expect(askToSignIn).toHaveBeenCalledWith('comment');
    expect(data.likeComment).not.toHaveBeenCalled();
    state.me = 'me';
  });
});
