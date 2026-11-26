// @vitest-environment jsdom
//
// The row of cards: which are mounted, which covers are fetched, what a
// swipe reports, and the one-time nudge. That the snap feels right is not
// something jsdom can say; that is for a phone.
import React from 'react';
import { Text } from 'react-native';
import * as RN from 'react-native';
import { Image } from 'expo-image';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '../uitest/render';
import type { Place } from '../lib/data';
import MapDeck from './MapDeck';

// A 320 pt phone, the width the peek was drawn at, and the list's props
// caught as they go in: jsdom has no scroll to fire the settle from.
const seen = vi.hoisted(() => ({
  props: null as null | Record<string, any>, Real: null as any,
  capture(p: Record<string, any>) { this.props = p; },
}));
vi.mock('react-native', async (orig) => {
  const mod = await orig<typeof import('react-native')>();
  seen.Real = mod.FlatList;
  const Spy = React.forwardRef<unknown, Record<string, any>>(function Spy(p, ref) { seen.capture(p); return <mod.FlatList ref={ref as never} data={p.data} {...p} />; });
  return { ...mod, FlatList: Spy, useWindowDimensions: () => ({ width: 320, height: 640, scale: 2, fontScale: 1 }) };
});

const memory = vi.hoisted(() => ({ nudged: '0', origin: 'fallback', remember: vi.fn(), still: false }));
vi.mock('../lib/stored', async (orig) => ({
  ...(await orig<typeof import('../lib/stored')>()),
  useStored: () => [memory.nudged, memory.remember, memory.origin],
}));
vi.mock('./ui', async (orig) => ({ ...(await orig<typeof import('./ui')>()), useReducedMotion: () => memory.still }));

const place = (i: number): Place => ({
  slug: `p${i}`, name_en: `Place ${i}`, lat: 10, lng: 106,
  place_photos: [{ photo_uri: `https://img/p${i}.jpg`, is_cover: true, is_hidden: false, sort_order: 0 }],
} as unknown as Place);
const deck = (n: number) => Array.from({ length: n }, (_, i) => place(i));

// Card 268 (320 less 12 left, 8 between, 32 of the next showing), plus the
// 8 between: the distance one swipe travels.
const STEP = () => 276;

const moves = { next: undefined as undefined | (() => void), previous: undefined as undefined | (() => void) };
const row = (places: Place[], selected: string, onSwipe = vi.fn()) => (
  <MapDeck
    places={places}
    selectedSlug={selected}
    onSwipe={onSwipe}
    renderCard={(p, swipe) => {
      if (p.slug === selected) { moves.next = swipe.next; moves.previous = swipe.previous; }
      return <Text>{p.name_en}</Text>;
    }}
  />
);

let scrollTo: ReturnType<typeof vi.spyOn>;
void RN;
beforeEach(() => {
  memory.nudged = '1'; memory.origin = 'stored'; memory.still = false; memory.remember.mockClear();
  vi.mocked(Image.prefetch).mockClear();
  scrollTo = vi.spyOn(seen.Real.prototype, 'scrollToOffset').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const settle = (x: number) => act(() => seen.props!.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x } } }));

describe('MapDeck', () => {
  it('mounts the cards near the viewport, not the whole deck', () => {
    render(row(deck(20), 'p0'));
    expect(screen.getByText('Place 0')).toBeTruthy();
    expect(screen.queryByText('Place 19')).toBeNull();
  });

  it('fetches the cover of this card and the two ahead, and again as the reader moves', () => {
    const { rerender } = render(row(deck(20), 'p0'));
    expect(vi.mocked(Image.prefetch)).toHaveBeenLastCalledWith(
      ['https://img/p0.jpg', 'https://img/p1.jpg', 'https://img/p2.jpg'], 'memory-disk');
    rerender(row(deck(20), 'p5'));
    expect(vi.mocked(Image.prefetch)).toHaveBeenLastCalledWith(
      ['https://img/p5.jpg', 'https://img/p6.jpg', 'https://img/p7.jpg'], 'memory-disk');
  });

  it('skips places without a cover, and a fetch that fails costs nothing', async () => {
    vi.mocked(Image.prefetch).mockRejectedValueOnce(new Error('offline'));
    const bare = { ...place(1), place_photos: [] } as unknown as Place;
    render(row([place(0), bare], 'p0'));
    expect(vi.mocked(Image.prefetch)).toHaveBeenLastCalledWith(['https://img/p0.jpg'], 'memory-disk');
    await act(async () => {});
  });

  it('does not fetch when nothing in reach has a cover', () => {
    render(row([{ ...place(0), place_photos: [] } as unknown as Place], 'p0'));
    expect(vi.mocked(Image.prefetch)).not.toHaveBeenCalled();
  });

  it('reports the card a swipe settles on, and not the one it began on', () => {
    const onSwipe = vi.fn();
    render(row(deck(5), 'p0', onSwipe));
    settle(0);
    expect(onSwipe).not.toHaveBeenCalled();
    settle(STEP() * 2 + 10);
    expect(onSwipe).toHaveBeenLastCalledWith('p2');
  });

  it('holds at both ends: a rubber band past either end picks the end card', () => {
    const onSwipe = vi.fn();
    render(row(deck(3), 'p1', onSwipe));
    settle(-400);
    expect(onSwipe).toHaveBeenLastCalledWith('p0');
    settle(STEP() * 2 + 90);
    expect(onSwipe).toHaveBeenLastCalledWith('p2');
  });

  it('offers the screen reader the two moves, and only those that go somewhere', () => {
    const onSwipe = vi.fn();
    render(row(deck(3), 'p0', onSwipe));
    expect(moves.previous).toBeUndefined();
    act(() => moves.next!());
    expect(onSwipe).toHaveBeenLastCalledWith('p1');
    expect(scrollTo).toHaveBeenLastCalledWith({ offset: STEP(), animated: true });
    // The last card of a deck (two cards, so both are mounted).
    render(row(deck(2), 'p1', onSwipe));
    expect(moves.next).toBeUndefined();
    act(() => moves.previous!());
    expect(onSwipe).toHaveBeenLastCalledWith('p0');
  });
});

describe('MapDeck nudge', () => {
  beforeEach(() => { memory.nudged = '0'; vi.useFakeTimers(); });

  it('pulls the row a few points and lets it back, once, and writes that it did', () => {
    render(row(deck(3), 'p0'));
    expect(memory.remember).toHaveBeenCalledWith('1');
    act(() => { vi.advanceTimersByTime(300); });
    expect(scrollTo).toHaveBeenLastCalledWith({ offset: 36, animated: true });
    act(() => { vi.advanceTimersByTime(320); });
    expect(scrollTo).toHaveBeenLastCalledWith({ offset: 0, animated: true });
  });

  it('is cancelled with the row, so a timer never lands on a gone list', () => {
    const { unmount } = render(row(deck(3), 'p0'));
    unmount();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('is spent without motion for a reader who asked for none', () => {
    memory.still = true;
    render(row(deck(3), 'p0'));
    expect(memory.remember).toHaveBeenCalledWith('1');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it.each([
    ['already shown', () => { memory.nudged = '1'; }, 3],
    ['still reading the flag', () => { memory.origin = 'reading'; }, 3],
    ['a deck of one, with no neighbour to promise', () => {}, 1],
  ])('does not nudge when %s', (_why, set, n) => {
    set();
    render(row(deck(n), 'p0'));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(memory.remember).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
