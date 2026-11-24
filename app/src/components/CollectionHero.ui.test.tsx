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
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import { MORPH_MS } from '../lib/coverMorph';
import type { Collection, Place } from '../lib/types';

const state = vi.hoisted(() => ({
  alerts: [] as string[],
  saved: [] as [string, string | null][],
  fail: false,
  asked: [] as (string[] | null)[],
  still: false,
  to: { x: 22, y: 100, w: 300, h: 150 } as { x: number; y: number; w: number; h: number } | null,
}));
vi.mock('./ui/motion', async (orig) => ({ ...(await orig<Record<string, unknown>>()), useReducedMotion: () => state.still }));
vi.mock('../lib/coverMorph', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  measureWindow: () => Promise.resolve(state.to),
}));

vi.mock('../lib/data', async (orig) => ({
  ...(await orig<typeof import('../lib/data')>()),
  usePlacePhotos: (slugs: string[] | null) => { state.asked.push(slugs); return { data: {} }; },
  setCollectionCover: async (slug: string, id: string | null) => {
    if (state.fail) throw new Error('x');
    state.saved.push([slug, id]);
  },
}));
vi.mock('react-native', async (orig) => {
  const rn = await orig<typeof import('react-native')>();
  return { ...rn, Alert: { alert: (m: string) => { state.alerts.push(m); } } };
});

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

// ── on your own list: the camera, and the sheet it opens ──

const shots = (slug: string, ids: string[]) => ({
  slug, name_en: slug, name_vi: slug, name_ja: null,
  place_photos: ids.map((id, i) => ({ id, photo_uri: `https://x/${id}.jpg`, is_hidden: false, sort_order: i, is_cover: i === 0 })),
}) as unknown as Place;
const HEIM = shots('heim', ['h1', 'h2']);
const SAM = shots('sam', ['s1']);
const mine = (cover: object | null = null, places = [HEIM, SAM]) => ({
  id: 'c1', slug: 'night-bar', cover,
  collection_places: places.map((m, i) => ({ sort_order: i, places: { slug: m.slug } })),
}) as unknown as Collection;
const shown = () => screen.getByTestId('collection-hero-image').getAttribute('data-uri');
const settleModal = () => {
  document.querySelectorAll('[class*="r-animationKeyframes"]').forEach((el) => fireEvent.animationEnd(el));
};
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Change cover' }));
const tile = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const sheetOpen = () => !!screen.queryByTestId('cover-sheet');

describe('CollectionHero on your own list', () => {
  beforeEach(() => {
    state.still = false;
    state.alerts = [];
    state.saved = [];
    state.fail = false;
    state.asked = [];
  });

  it('is only a picture on somebody else’s list: no camera, no door', () => {
    render(<CollectionHero list={mine()} members={[HEIM, SAM]} />);
    expect(screen.queryByTestId('collection-hero-camera')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change cover' })).toBeNull();
    expect(sheetOpen()).toBe(false);
  });

  it('carries the camera, and the cover itself opens the sheet', () => {
    render(<CollectionHero list={mine()} members={[HEIM, SAM]} owned />);
    // The person page's disc, figure for figure.
    const camera = screen.getByTestId('collection-hero-camera');
    expect(camera.querySelector('[data-icon="camera-outline"]')!.getAttribute('data-size')).toBe('18');
    const disc = getComputedStyle(camera);
    expect([disc.width, disc.height]).toEqual(['36px', '36px']);
    expect(disc.borderTopColor).toBe('rgba(255, 255, 255, 0.45)');
    expect(sheetOpen()).toBe(false);
    open();
    expect(sheetOpen()).toBe(true);
  });

  it('asks for every place’s photographs only once the sheet is wanted', () => {
    render(<CollectionHero list={mine()} members={[HEIM, SAM]} owned />);
    expect(state.asked.every((a) => a === null)).toBe(true);
    open();
    expect(state.asked.at(-1)).toEqual(['heim', 'sam']);
  });

  it('puts a tapped photograph on the cover at once, and says it is only a look', () => {
    render(<CollectionHero list={mine()} members={[HEIM, SAM]} owned />);
    open();
    expect(screen.queryByTestId('collection-hero-trying')).toBeNull();
    tile('sam');
    expect(shown()).toBe('https://x/s1.jpg');
    expect(screen.getByTestId('collection-hero-trying')).toBeTruthy();
    expect(state.saved).toEqual([]);
  });

  it('puts the cover back when the sheet is closed without Save', async () => {
    render(<CollectionHero list={mine()} members={[HEIM, SAM]} owned />);
    const before = shown();
    open();
    tile('sam');
    fireEvent.click(screen.getByTestId('cover-close'));
    settleModal();
    expect(shown()).toBe(before);
    expect(screen.queryByTestId('collection-hero-trying')).toBeNull();
    expect(state.saved).toEqual([]);
    // And the next opening starts from the saved cover, not the look.
    open();
    expect(screen.getByTestId('cover-save').getAttribute('aria-disabled')).toBe('true');
  });

  it('writes the photograph on Save, closes, and tells the page', async () => {
    const changed = vi.fn();
    render(<CollectionHero list={mine()} members={[HEIM, SAM]} owned onChanged={changed} />);
    open();
    expect(screen.getByTestId('cover-save').getAttribute('aria-disabled')).toBe('true');
    tile('sam');
    fireEvent.click(screen.getByTestId('cover-save'));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(state.saved).toEqual([['night-bar', 's1']]);
    settleModal();
    expect(sheetOpen()).toBe(false);
  });

  it('saves without a page to tell', async () => {
    render(<CollectionHero list={mine()} members={[HEIM, SAM]} owned />);
    open();
    tile('sam');
    fireEvent.click(screen.getByTestId('cover-save'));
    await waitFor(() => expect(state.saved).toHaveLength(1));
  });

  it('says so and stays open when the save fails', async () => {
    state.fail = true;
    const changed = vi.fn();
    render(<CollectionHero list={mine()} members={[HEIM, SAM]} owned onChanged={changed} />);
    open();
    tile('sam');
    fireEvent.click(screen.getByTestId('cover-save'));
    await waitFor(() => expect(state.alerts).toEqual(['Couldn\'t save the cover. Try again.']));
    expect(changed).not.toHaveBeenCalled();
    expect(sheetOpen()).toBe(true);
    expect(shown()).toBe('https://x/s1.jpg');
  });

  it('goes back to the first place’s own picture on Auto, and saves it as null', async () => {
    render(<CollectionHero list={mine()} members={[HEIM, SAM]} owned />);
    const auto = shown();
    open();
    tile('sam');
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    expect(shown()).toBe(auto);
    expect(screen.queryByTestId('collection-hero-trying')).toBeNull();
    expect(screen.getByTestId('cover-save').getAttribute('aria-disabled')).toBe('true');
  });

  it('leads with the cover the list has, and names Auto only when it has none', () => {
    const cover = { id: 'h2', photo_uri: 'https://x/h2.jpg', place: { slug: 'heim' } };
    render(<CollectionHero list={mine(cover)} members={[HEIM, SAM]} owned />);
    expect(shown()).toBe('https://x/h2.jpg');
    open();
    expect(screen.queryByRole('button', { name: 'Auto' })).toBeNull();
    expect(screen.getByRole('button', { name: 'heim, photo 2 of 2' }).getAttribute('aria-selected')).toBe('true');
  });

  it('finds a cover its row knew only by its picture', () => {
    const cover = { photo_uri: 'https://x/h2.jpg', place: { slug: 'heim' } };
    render(<CollectionHero list={mine(cover)} members={[HEIM, SAM]} owned />);
    open();
    expect(screen.getByRole('button', { name: 'heim, photo 2 of 2' }).getAttribute('aria-selected')).toBe('true');
  });

  it('reads a cover whose place has left the list as none', () => {
    const cover = { id: 's1', photo_uri: 'https://x/s1.jpg', place: { slug: 'sam' } };
    render(<CollectionHero list={mine(cover, [HEIM])} members={[HEIM]} owned />);
    expect(shown()).toBe('https://x/h1.jpg');
    open();
    expect(screen.getByRole('button', { name: 'Auto' }).getAttribute('aria-selected')).toBe('true');
  });

  it('offers Auto, unringed, while the chosen photograph is not on offer', () => {
    const cover = { id: 'gone', photo_uri: 'https://x/gone.jpg', place: { slug: 'heim' } };
    render(<CollectionHero list={mine(cover)} members={[HEIM, SAM]} owned />);
    open();
    expect(screen.getByRole('button', { name: 'Auto' })).toBeTruthy();
  });

  it('leaves the Auto tile bare when the first place has no photograph to preview', () => {
    const BARE = shots('bare', []);
    const cover = { id: 'gone', photo_uri: 'https://x/gone.jpg', place: { slug: 'bare' } };
    render(<CollectionHero list={mine(cover, [BARE, SAM])} members={[BARE, SAM]} owned />);
    open();
    const auto = screen.getByRole('button', { name: 'Auto' });
    expect(auto.querySelector('[data-testid="image"]')).toBeNull();
    expect(auto.textContent).toBe('Auto');
  });

  it('is the way back to Auto from a cover that is not on offer: saved as null', async () => {
    const cover = { id: 'gone', photo_uri: 'https://x/gone.jpg', place: { slug: 'heim' } };
    render(<CollectionHero list={mine(cover)} members={[HEIM, SAM]} owned />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    fireEvent.click(screen.getByTestId('cover-save'));
    await waitFor(() => expect(state.saved).toEqual([['night-bar', null]]));
  });
});
