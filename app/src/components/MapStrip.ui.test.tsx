// @vitest-environment jsdom
//
// The strip's coming and going. `Animated` does not tick here, so each
// run is caught as it starts and finished by hand: what is asserted is
// what was asked of it and what the strip does when it ends.
import React from 'react';
import { Animated, Text } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '../uitest/render';
import MapStrip from './MapStrip';

const motion = vi.hoisted(() => ({ still: false }));
vi.mock('./ui', async (orig) => ({ ...(await orig<typeof import('./ui')>()), useReducedMotion: () => motion.still }));

type Run = { to: number; ms: number; finish: (finished: boolean) => void };
let runs: Run[] = [];
beforeEach(() => {
  runs = [];
  motion.still = false;
  vi.spyOn(Animated, 'timing').mockImplementation(((_v: unknown, c: { toValue: number; duration: number }) => {
    let done: ((r: { finished: boolean }) => void) | undefined;
    runs.push({ to: c.toValue, ms: c.duration, finish: (finished) => done?.({ finished }) });
    return { start: (cb?: (r: { finished: boolean }) => void) => { done = cb; }, stop: () => {} };
  }) as never);
});
afterEach(() => { vi.restoreAllMocks(); });

const card = (name: string) => <Text>{name}</Text>;

describe('MapStrip', () => {
  it('rises in when a place is chosen, in the dock\'s 220ms', () => {
    const { rerender } = render(<MapStrip onGone={() => {}}>{null}</MapStrip>);
    expect(screen.queryByTestId('map-strip')).toBeNull();
    rerender(<MapStrip onGone={() => {}}>{card('Lá coffee')}</MapStrip>);
    expect(screen.getByText('Lá coffee')).toBeTruthy();
    expect(runs.at(-1)).toMatchObject({ to: 1, ms: 220 });
  });

  // Sinking out with the words it had, gone at the end — and the choice
  // let go as it starts. (That it takes no touches on the way out is a
  // `pointerEvents` the web build renders the same both ways, so it is
  // not asserted here.)
  it('sinks out holding what it showed, lets the choice go, and leaves when the fade ends', () => {
    const onGone = vi.fn();
    const { rerender } = render(<MapStrip onGone={onGone}>{card('Lá coffee')}</MapStrip>);
    expect(onGone).not.toHaveBeenCalled();
    rerender(<MapStrip onGone={onGone}>{null}</MapStrip>);
    expect(onGone).toHaveBeenCalledOnce();
    expect(runs.at(-1)).toMatchObject({ to: 0, ms: 140 });
    expect(screen.getByText('Lá coffee')).toBeTruthy();
    act(() => { runs.at(-1)!.finish(true); });
    expect(screen.queryByTestId('map-strip')).toBeNull();
  });

  it('stays when its way out is cut short by a new place, and shows that one', () => {
    const onGone = vi.fn();
    const { rerender } = render(<MapStrip onGone={onGone}>{card('Lá coffee')}</MapStrip>);
    rerender(<MapStrip onGone={onGone}>{null}</MapStrip>);
    const out = runs.at(-1)!;
    rerender(<MapStrip onGone={onGone}>{card('Nerd.society')}</MapStrip>);
    act(() => { out.finish(false); });
    expect(screen.getByText('Nerd.society')).toBeTruthy();
    expect(runs.at(-1)).toMatchObject({ to: 1 });
  });

  it('swaps one place for another without going anywhere', () => {
    const onGone = vi.fn();
    const { rerender } = render(<MapStrip onGone={onGone}>{card('Lá coffee')}</MapStrip>);
    rerender(<MapStrip onGone={onGone}>{card('Nerd.society')}</MapStrip>);
    expect(screen.getByText('Nerd.society')).toBeTruthy();
    expect(onGone).not.toHaveBeenCalled();
  });

  it('comes and goes at once for a reader who asked for less motion', () => {
    motion.still = true;
    const { rerender } = render(<MapStrip onGone={() => {}}>{card('Lá coffee')}</MapStrip>);
    rerender(<MapStrip onGone={() => {}}>{null}</MapStrip>);
    expect(runs.at(-1)).toMatchObject({ to: 0, ms: 0 });
  });
});
