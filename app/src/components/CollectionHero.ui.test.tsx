// @vitest-environment jsdom
//
// A collection's cover across the top of its page. What is pinned: it is
// drawn when the list has a picture and not when it has none; opened from
// a tile it grows out of the tile's place and then shows itself, the
// picture hidden while the copy is on its way; and every way it cannot
// grow — no tile, a tile that could not be measured, a page that could
// not, Reduce Motion — is the cover simply there.

import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { beforeEach, describe, expect, it, vi, type Mock, type MockInstance } from 'vitest';
import { act, render, screen } from '../uitest/render';
import { MORPH_MS } from '../lib/coverMorph';
import type { Collection, Place } from '../lib/types';

const state = vi.hoisted(() => ({
  still: false,
  to: { x: 22, y: 100, w: 300, h: 150 } as { x: number; y: number; w: number; h: number } | null,
}));
vi.mock('./ui/motion', async (orig) => ({ ...(await orig<Record<string, unknown>>()), useReducedMotion: () => state.still }));
vi.mock('../lib/coverMorph', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  measureWindow: () => Promise.resolve(state.to),
}));

// expo-image draws a bare <img> here, without its style: this one says what
// the page asked of it, which is what the hero's own logic decides.
vi.mock('expo-image', () => ({
  Image: ({ testID, style, source }: { testID?: string; style?: unknown; source: { uri: string } }) => (
    <div data-testid={testID ?? 'image'} data-uri={source.uri} data-hidden={String(StyleSheet.flatten(style as never)?.opacity === 0)} />
  ),
}));

import CollectionHero from './CollectionHero';

const withCover = { cover: { photo_uri: 'wide.jpg' }, collection_places: [] } as unknown as Collection;
const bare = { cover: null, collection_places: [] } as unknown as Collection;
const from = { rect: { x: 40, y: 400, w: 150, h: 170 }, uri: 'tile.jpg' };
const members: Place[] = [];

const hidden = () => screen.getByTestId('collection-hero-image').getAttribute('data-hidden') === 'true';

/** The page's own `onLayout`, which jsdom never fires: called with what a phone would report. */
function layout() {
  const el = screen.getByTestId('collection-hero');
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'))!;
  type Fiber = { memoizedProps?: { onLayout?: (e: unknown) => void }; return?: Fiber };
  let f: Fiber | undefined = (el as unknown as Record<string, Fiber>)[key];
  while (f && !f.memoizedProps?.onLayout) f = f.return;
  return act(async () => { f!.memoizedProps!.onLayout!({}); });
}

describe('CollectionHero', () => {
  let start: Mock;
  let stop: Mock;
  let timing: MockInstance<typeof Animated.timing>;
  beforeEach(() => {
    state.still = false;
    state.to = { x: 22, y: 100, w: 300, h: 150 };
    start = vi.fn();
    stop = vi.fn();
    // Held where it is: animated values land at once here, and the way
    // across is what is being looked at.
    timing = vi.spyOn(Animated, 'timing').mockImplementation((() => ({ start, stop, reset: vi.fn() })) as never);
  });

  it('draws the cover of a list that has one', () => {
    render(<CollectionHero list={withCover} members={members} />);
    expect(screen.getByTestId('collection-hero')).toBeTruthy();
    expect(screen.queryByTestId('collection-hero-grow')).toBeNull();
    expect(hidden()).toBe(false);
  });

  it('draws nothing for a list with no picture, or no list yet', () => {
    const { rerender } = render(<CollectionHero list={bare} members={members} />);
    expect(screen.queryByTestId('collection-hero')).toBeNull();
    rerender(<CollectionHero list={undefined} members={members} />);
    expect(screen.queryByTestId('collection-hero')).toBeNull();
  });

  it('grows out of the tile, hides the picture on the way, and shows it on arrival', async () => {
    render(<CollectionHero list={withCover} members={members} from={from} />);
    expect(hidden()).toBe(true);
    expect(screen.queryByTestId('collection-hero-grow')).toBeNull();
    await layout();
    expect(screen.getByTestId('collection-hero-grow')).toBeTruthy();
    expect(hidden()).toBe(true);
    expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 1, duration: MORPH_MS, useNativeDriver: false }));
    act(() => start.mock.calls[0][0]({ finished: true }));
    expect(screen.queryByTestId('collection-hero-grow')).toBeNull();
    expect(hidden()).toBe(false);
  });

  it('stays on its way when the animation is stopped before it arrives', async () => {
    render(<CollectionHero list={withCover} members={members} from={from} />);
    await layout();
    act(() => start.mock.calls[0][0]({ finished: false }));
    expect(screen.getByTestId('collection-hero-grow')).toBeTruthy();
  });

  it('stops the animation when the page goes', async () => {
    const view = render(<CollectionHero list={withCover} members={members} from={from} />);
    await layout();
    view.unmount();
    expect(stop).toHaveBeenCalled();
  });

  it('is simply there when the tile could not be measured', () => {
    render(<CollectionHero list={withCover} members={members} from={{ ...from, rect: { x: 0, y: 0, w: 0, h: 0 } }} />);
    expect(screen.queryByTestId('collection-hero-grow')).toBeNull();
    expect(hidden()).toBe(false);
  });

  it('is simply there when its own place could not be measured', async () => {
    state.to = { x: 0, y: 0, w: 0, h: 0 };
    render(<CollectionHero list={withCover} members={members} from={from} />);
    await layout();
    expect(screen.queryByTestId('collection-hero-grow')).toBeNull();
    expect(hidden()).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });

  it('is simply there for a reader who asked for less motion', async () => {
    state.still = true;
    render(<CollectionHero list={withCover} members={members} from={from} />);
    await layout();
    expect(screen.queryByTestId('collection-hero-grow')).toBeNull();
    expect(hidden()).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });

  it('does not measure itself when nothing opened it from a tile', async () => {
    render(<CollectionHero list={withCover} members={members} />);
    await layout();
    expect(start).not.toHaveBeenCalled();
    expect(hidden()).toBe(false);
  });
});
