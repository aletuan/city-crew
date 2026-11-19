// @vitest-environment jsdom
//
// The way into a list's comments: drawn only with the `comments` switch
// on, on a public list that has an id — and then it hands back that id,
// and wears the number of comments once there is one. Nothing is asked
// while it is not drawn.

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '../../uitest/render';
import { appFlags } from '../../lib/flags';
import { commentsChanged } from '../../lib/commentsChanged';

const data = vi.hoisted(() => ({
  fetchPreviews: vi.fn(async (_s: { id: string }[]): Promise<Record<string, unknown>> => ({})),
}));
vi.mock('../../lib/data/comments', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchPreviews: data.fetchPreviews,
}));
const state = vi.hoisted(() => ({ me: 'me' as string | null }));
vi.mock('../../lib/auth', () => ({
  useSession: () => ({ session: state.me ? { user: { id: state.me } } : null }),
  useProfile: () => ({ profile: null }),
}));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ lang: 'vi', t: (_en: string, vi: string) => vi }) }));

import { CommentQuickProvider } from '../../components/CommentQuick';
import { CommentsDoor } from './CommentsDoor';

const onPress = vi.fn();
// Under the app's one field, as the page is.
const show = (list: Parameters<typeof CommentsDoor>[0]['list']) => render(
  <CommentQuickProvider><CommentsDoor list={list} about="Hội An Coffee" onPress={onPress} /></CommentQuickProvider>,
);
const door = () => screen.queryByTestId('collection-comments');

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
afterEach(() => { cleanup(); appFlags.reset(); vi.clearAllMocks(); data.fetchPreviews.mockImplementation(async () => ({})); state.me = 'me'; });

describe('CommentsDoor', () => {
  it('is nothing while the switch is off, which is how it ships', () => {
    show({ id: 'c1', is_public: true });
    expect(door()).toBeNull();
  });

  it('opens a thread that has comments, and names itself for VoiceOver', async () => {
    appFlags.set('comments', true);
    data.fetchPreviews.mockImplementation(async () => ({ c1: { n: 2, latest: [] } }));
    show({ id: 'c1', is_public: true });
    expect(door()!.getAttribute('aria-label')).toBe('Bình luận');
    await flush();
    fireEvent.click(door()!);
    expect(onPress).toHaveBeenCalledExactlyOnceWith('c1');
    expect(screen.queryByTestId('comment-quick')).toBeNull();
  });

  // The first comment is written on the page it is about (18 Nov 2026).
  it('raises the field over the page while nobody has commented, saying which list, and opens nothing', async () => {
    appFlags.set('comments', true);
    show({ id: 'c1', is_public: true });
    await flush();
    fireEvent.click(door()!);
    expect(screen.getByTestId('comment-quick')).toBeTruthy();
    expect(screen.getByTestId('composer-about').textContent).toBe('Hội An Coffee');
    expect(onPress).not.toHaveBeenCalled();
  });

  // C6: a thread its owner has closed.
  it('is dimmed and opens nothing on a closed thread with nothing in it, and opens one with something to read', async () => {
    appFlags.set('comments', true);
    data.fetchPreviews.mockImplementation(async () => ({ c1: { n: 0, latest: [], off: true } }));
    show({ id: 'c1', is_public: true, owner_id: 'them' });
    await flush();
    expect(door()!.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(door()!);
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByTestId('comment-quick')).toBeNull();
    cleanup();
    data.fetchPreviews.mockImplementation(async () => ({ c1: { n: 2, latest: [], off: true } }));
    show({ id: 'c1', is_public: true, owner_id: 'them' });
    await flush();
    expect(door()!.getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(door()!);
    expect(onPress).toHaveBeenCalledExactlyOnceWith('c1');
  });

  it('stays for the owner of a closed, empty thread, and opens the thread, where the switch is', async () => {
    appFlags.set('comments', true);
    data.fetchPreviews.mockImplementation(async () => ({ c1: { n: 0, latest: [], off: true } }));
    show({ id: 'c1', is_public: true, owner_id: 'me' });
    await flush();
    expect(door()!.getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.click(door()!);
    expect(onPress).toHaveBeenCalledExactlyOnceWith('c1');
    expect(screen.queryByTestId('comment-quick')).toBeNull();
  });

  it('opens the thread for the owner of an open, empty one too, and the field for anybody else', async () => {
    appFlags.set('comments', true);
    show({ id: 'c1', is_public: true, owner_id: 'me' });
    await flush();
    fireEvent.click(door()!);
    expect(onPress).toHaveBeenCalledExactlyOnceWith('c1');
    cleanup(); onPress.mockClear();
    show({ id: 'c1', is_public: true, owner_id: 'them' });
    await flush();
    fireEvent.click(door()!);
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('comment-quick')).toBeTruthy();
  });

  it('is nobody\'s own for a guest, whatever the list says', async () => {
    appFlags.set('comments', true);
    state.me = null;
    data.fetchPreviews.mockImplementation(async () => ({ c1: { n: 0, latest: [], off: true } }));
    show({ id: 'c1', is_public: true, owner_id: null });
    await flush();
    expect(door()!.getAttribute('aria-disabled')).toBe('true');
  });

  it('opens the thread where no field is mounted to raise', async () => {
    appFlags.set('comments', true);
    render(<CommentsDoor list={{ id: 'c1', is_public: true }} onPress={onPress} />);
    await flush();
    fireEvent.click(door()!);
    expect(onPress).toHaveBeenCalledExactlyOnceWith('c1');
  });

  it('opens the thread for a guest, and before the count is in', async () => {
    appFlags.set('comments', true);
    // Pressed before the answer: nothing says the thread is empty yet.
    show({ id: 'c1', is_public: true });
    fireEvent.click(door()!);
    expect(onPress).toHaveBeenCalledTimes(1);
    cleanup();
    state.me = null;
    show({ id: 'c1', is_public: true });
    await flush();
    fireEvent.click(door()!);
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('comment-quick')).toBeNull();
  });

  it('wears the number of comments, from the card\'s own function, and says it to VoiceOver', async () => {
    appFlags.set('comments', true);
    data.fetchPreviews.mockImplementation(async () => ({ c1: { n: 4, latest: [] } }));
    show({ id: 'c1', is_public: true });
    // No figure until the answer says there is one.
    expect(screen.queryByTestId('collection-comments-count')).toBeNull();
    await flush();
    expect(data.fetchPreviews).toHaveBeenCalledExactlyOnceWith([{ kind: 'collection', id: 'c1' }]);
    expect(screen.getByTestId('collection-comments-count').textContent).toBe('4');
    expect(door()!.getAttribute('aria-label')).toBe('Bình luận, 4');
  });

  it('asks again when a comment is written or taken back, and wears the new figure', async () => {
    appFlags.set('comments', true);
    data.fetchPreviews.mockImplementation(async () => ({ c1: { n: 4, latest: [] } }));
    show({ id: 'c1', is_public: true });
    await flush();
    data.fetchPreviews.mockImplementation(async () => ({ c1: { n: 5, latest: [] } }));
    act(() => { commentsChanged(); });
    await flush();
    expect(data.fetchPreviews).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('collection-comments-count').textContent).toBe('5');
  });

  it('asks nothing while it is not drawn', async () => {
    show({ id: 'c1', is_public: true });
    await flush();
    appFlags.set('comments', true);
    cleanup();
    show({ id: 'c1', is_public: false });
    await flush();
    expect(data.fetchPreviews.mock.calls.every(([s]) => s.length === 0)).toBe(true);
  });

  it('is nothing on a list that is not public, has no id, or is not there', () => {
    appFlags.set('comments', true);
    for (const list of [{ id: 'c1', is_public: false }, { id: null, is_public: true }, { is_public: true }, null, undefined]) {
      show(list);
      expect(door()).toBeNull();
      cleanup();
    }
  });

  it('appears when the switch is turned on under it, without a new render from above', () => {
    show({ id: 'c1', is_public: true });
    expect(door()).toBeNull();
    act(() => { appFlags.set('comments', true); });
    expect(door()).not.toBeNull();
  });
});
