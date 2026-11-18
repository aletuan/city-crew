// @vitest-environment jsdom
//
// What a card shows of its collection's thread (C3b): nothing at all
// where there is no thread to open; the way in, with a figure once there
// is something to count; and under the foot the two newest, a line each,
// with "View all N" when there are more than it shows. The rest of the
// card — its head, its photograph, its heart — is pinned where it is
// used, in the person page's test.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '../uitest/render';
import type { Preview, PreviewComment } from '../lib/comments';

const state = vi.hoisted(() => ({ lang: 'en' as 'en' | 'vi' }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: state.lang, t: (en: string, vi: string) => (state.lang === 'vi' ? vi : en) }),
}));

import ActivityCard, { PREVIEWS } from './ActivityCard';

const said = (id: string, over: Partial<PreviewComment> = {}): PreviewComment => ({
  id, body: `says ${id}`, created_at: '2026-11-18T00:00:00Z', author: `u-${id}`,
  handle: `@H${id}`, full_name: null, avatar_url: null, ...over,
});
const onComments = vi.fn();
const onHeart = vi.fn();
const show = (comments?: Preview, withThread = true) => render(
  <ActivityCard
    who="Lan" did=" created a collection" title="Old Quarter eats" meta="3 places"
    liked={false} likes={2} onOpen={() => {}} onHeart={onHeart}
    comments={comments} onComments={withThread ? onComments : undefined}
  />,
);
const bubble = () => screen.queryByTestId('activity-comments');
const lines = () => screen.queryAllByTestId('activity-preview').map((l) => l.textContent);

beforeEach(() => { vi.clearAllMocks(); state.lang = 'en'; });
afterEach(cleanup);

describe('a card with no thread to open', () => {
  it('draws nothing about comments, whatever it was told of them', () => {
    show({ n: 3, latest: [said('a')] }, false);
    expect(bubble()).toBeNull();
    expect(screen.queryByTestId('activity-previews')).toBeNull();
    // And the heart is as it was.
    expect(screen.getByTestId('activity-heart')).toBeTruthy();
  });
});

describe('the way into the thread', () => {
  it('stands after the heart with no figure while nobody has commented', () => {
    show();
    expect(bubble()!.getAttribute('aria-label')).toBe('Comments');
    expect(screen.queryByTestId('activity-comments-count')).toBeNull();
    expect(screen.queryByTestId('activity-previews')).toBeNull();
    const foot = bubble()!.parentElement!;
    expect(foot.contains(screen.getByTestId('activity-heart'))).toBe(true);
    expect(foot.lastElementChild!.contains(bubble())).toBe(true);
  });

  it('counts the comments, one in the singular', () => {
    show({ n: 1, latest: [said('a')] });
    expect(screen.getByTestId('activity-comments-count').textContent).toBe('1');
    expect(bubble()!.getAttribute('aria-label')).toBe('1 comment');
    cleanup();
    state.lang = 'vi';
    show({ n: 12, latest: [said('a'), said('b')] });
    expect(screen.getByTestId('activity-comments-count').textContent).toBe('12');
    expect(bubble()!.getAttribute('aria-label')).toBe('12 bình luận');
  });

  it('opens the thread, and leaves the heart alone', () => {
    show({ n: 1, latest: [said('a')] });
    fireEvent.click(bubble()!);
    expect(onComments).toHaveBeenCalledTimes(1);
    expect(onHeart).not.toHaveBeenCalled();
  });
});

describe('the two newest', () => {
  it('are a line each, who and then what, and open the thread on a press', () => {
    show({ n: 2, latest: [said('a'), said('b', { body: 'second' })] });
    expect(lines()).toEqual(['ha says a', 'hb second']);
    // Both are shown: nothing more to view.
    expect(screen.queryByTestId('activity-previews-all')).toBeNull();
    const block = screen.getByTestId('activity-previews');
    expect(block.getAttribute('aria-label')).toBe('ha: says a. hb: second');
    fireEvent.click(block);
    expect(onComments).toHaveBeenCalledTimes(1);
  });

  it('say how many there are when there are more than it shows', () => {
    show({ n: 7, latest: [said('a'), said('b')] });
    expect(screen.getByTestId('activity-previews-all').textContent).toBe('View all 7 comments');
    cleanup();
    state.lang = 'vi';
    show({ n: 7, latest: [said('a'), said('b')] });
    expect(screen.getByTestId('activity-previews-all').textContent).toBe('Xem tất cả 7 bình luận');
  });

  it('draws two at most, however many came', () => {
    expect(PREVIEWS).toBe(2);
    show({ n: 3, latest: [said('a'), said('b'), said('c')] });
    expect(lines()).toHaveLength(2);
    expect(screen.getByTestId('activity-previews-all').textContent).toBe('View all 3 comments');
  });

  it('names a writer with no handle by their name, and one with neither as "Someone"', () => {
    show({ n: 2, latest: [said('a', { handle: null, full_name: 'Lan Pham' }), said('b', { handle: null })] });
    expect(lines()).toEqual(['Lan Pham says a', 'Someone says b']);
  });
});
