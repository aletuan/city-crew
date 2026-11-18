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

const data = vi.hoisted(() => ({
  fetchPreviews: vi.fn(async (_s: { id: string }[]): Promise<Record<string, unknown>> => ({})),
}));
vi.mock('../../lib/data/comments', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchPreviews: data.fetchPreviews,
}));
vi.mock('../../lib/i18n', () => ({ useI18n: () => ({ lang: 'vi', t: (_en: string, vi: string) => vi }) }));

import { CommentsDoor } from './CommentsDoor';

const onPress = vi.fn();
const show = (list: Parameters<typeof CommentsDoor>[0]['list']) => render(<CommentsDoor list={list} onPress={onPress} />);
const door = () => screen.queryByTestId('collection-comments');

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
afterEach(() => { cleanup(); appFlags.reset(); vi.clearAllMocks(); data.fetchPreviews.mockImplementation(async () => ({})); });

describe('CommentsDoor', () => {
  it('is nothing while the switch is off, which is how it ships', () => {
    show({ id: 'c1', is_public: true });
    expect(door()).toBeNull();
  });

  it('opens the list\'s thread with the switch on, and names itself for VoiceOver', () => {
    appFlags.set('comments', true);
    show({ id: 'c1', is_public: true });
    expect(door()!.getAttribute('aria-label')).toBe('Bình luận');
    fireEvent.click(door()!);
    expect(onPress).toHaveBeenCalledWith('c1');
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
