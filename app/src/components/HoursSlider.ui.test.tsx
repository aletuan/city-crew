// @vitest-environment jsdom
//
// The opening-hours slider, in the sheet it lives in: the segments move
// the heads, the heads light the segments, and the heading says the span
// in words. The finger is played through the heads' own responders —
// jsdom has no fingers, but a callback can be handed what one would give.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Animated, LayoutAnimation, PanResponder, type PanResponderCallbacks, type PanResponderGestureState } from 'react-native';
import { act, fireEvent, render, screen } from '../uitest/render';
import type { ExploreFilters } from '../lib/exploreFilters';
import { AXIS } from '../lib/hoursSlider';
import ExploreFilterSheet, { statusLabel } from './ExploreFilterSheet';

const NONE: ExploreFilters = { sort: 'recommended', status: 'any', savedOnly: false, visitedOnly: false };
const NOW_MIN = 14 * 60 + 37;
/** The track as laid out on a 390pt phone: the sheet's 20pt gutters. */
const TRACK_W = 350;
/** Points per minute along it: the head's centre runs the track less its
 *  4pt padding and its own 28pt disc. */
const PER_MIN = (TRACK_W - 8 - 28) / AXIS;

let made: PanResponderCallbacks[] = [];
beforeEach(() => {
  made = [];
  const real = PanResponder.create.bind(PanResponder);
  vi.spyOn(PanResponder, 'create').mockImplementation((config) => { made.push(config); return real(config); });
});
afterEach(() => { vi.restoreAllMocks(); });

const open = (applied: ExploreFilters = NONE, onApply = vi.fn(async () => null)) => {
  const view = render(
    <ExploreFilterSheet
      visible
      applied={applied}
      signedIn
      visitedAvailable={false}
      countFor={(f) => (f.status === 'window' ? 7 : f.status === 'open' ? 3 : 10)}
      nowMin={NOW_MIN}
      onClose={() => {}}
      onApply={onApply}
      onNeedSignIn={() => {}}
    />,
  );
  layOut();
  return view;
};

type Fiber = { return: Fiber | null; memoizedProps: Record<string, unknown> };
/** The props React holds for the element with this testID and this handler. */
const propsOf = (testID: string, handler: string) => {
  const node = screen.getByTestId(testID);
  const key = Object.keys(node).find((k) => k.startsWith('__reactFiber'))!;
  let f = (node as unknown as Record<string, Fiber>)[key];
  while (f && !(f.memoizedProps.testID === testID && typeof f.memoizedProps[handler] === 'function')) f = f.return!;
  return f.memoizedProps;
};
const layOut = () => act(() => {
  (propsOf('hours-track', 'onLayout').onLayout as (e: unknown) => void)({ nativeEvent: { layout: { width: TRACK_W } } });
});

/** The heads' responders: the last two made that take a grant — the
 *  sheet's own pull takes none. */
const heads = () => {
  const mine = made.filter((c) => c.onPanResponderGrant);
  return { from: mine.at(-2)!, to: mine.at(-1)! };
};
const ev = {} as Parameters<NonNullable<PanResponderCallbacks['onPanResponderMove']>>[0];
const g = (dx: number) => ({ dx, dy: 0 }) as PanResponderGestureState;
/** A drag of a head by so many minutes, let go at the end. */
const drag = (head: 'from' | 'to', ...minutes: number[]) => {
  const cb = heads()[head];
  act(() => { cb.onPanResponderGrant!(ev, g(0)); });
  for (const m of minutes) act(() => { cb.onPanResponderMove!(ev, g(m * PER_MIN)); });
  act(() => { cb.onPanResponderRelease!(ev, g(0)); });
};

const valueOf = (name: string) => screen.getByRole('slider', { name }).getAttribute('aria-valuetext');
const note = () => screen.getByTestId('filter-hours-note').textContent;
const checked = () => screen.queryByRole('radio', { checked: true, name: /Any time|Open now|Closed now/ })?.textContent ?? null;

describe('segments to heads', () => {
  it('puts the heads on both ends for Any time, and says nothing beside the heading', () => {
    open();
    expect(valueOf('Open from')).toBe('06:00');
    expect(valueOf('Open until')).toBe('06:00');
    expect(note()).toBe('');
  });

  // The owner's ask, word for word: "Open now" points the heads at now.
  it('brings both heads to the present for Open now, and says so', () => {
    open();
    fireEvent.click(screen.getByRole('radio', { name: 'Open now' }));
    expect(valueOf('Open from')).toBe('14:37');
    expect(valueOf('Open until')).toBe('14:37');
    expect(note()).toBe('Now · 14:37');
    expect(screen.getByText('Show 3 places')).toBeTruthy();
  });

  it('marks the present for Closed now, faded', () => {
    open();
    fireEvent.click(screen.getByRole('radio', { name: 'Closed now' }));
    expect(valueOf('Open from')).toBe('14:37');
    expect(note()).toBe('Closed at 14:37');
    expect(getComputedStyle(screen.getByTestId('hours-span')).opacity).toBe('0.45');
  });

  // The travel is what shows the two are one answer; a finger's move is
  // where the finger is, and Reduce Motion asks for no travel at all.
  it('travels to a segment chosen, and not under the finger or Reduce Motion', async () => {
    const timing = vi.spyOn(Animated, 'timing');
    open();
    timing.mockClear();
    fireEvent.click(screen.getByRole('radio', { name: 'Open now' }));
    expect(timing).toHaveBeenCalledTimes(2);
    timing.mockClear();
    drag('to', 90);
    expect(timing).not.toHaveBeenCalled();
  });

  it('does not travel under Reduce Motion', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = vi.spyOn(Animated, 'timing');
    open();
    await act(async () => {});
    timing.mockClear();
    fireEvent.click(screen.getByRole('radio', { name: 'Open now' }));
    expect(timing).not.toHaveBeenCalled();
    expect(valueOf('Open until')).toBe('14:37');
  });
});

describe('heads to segments', () => {
  it('lets go of every segment once a head is pulled in, and writes the span', () => {
    open();
    drag('from', 120);
    drag('to', -8 * 60);
    expect(checked()).toBeNull();
    expect(note()).toBe('Open throughout 08:00–22:00');
    expect(screen.getByText('Show 7 places')).toBeTruthy();
    expect(screen.getByTestId('filter-reset')).toBeTruthy();
  });

  // The owner's two questions (11 Nov 2026): one head moved, the other
  // left on its end and asking nothing.
  it('says "open at" for the left head alone and "open until" for the right', () => {
    open();
    drag('from', 180);
    expect(note()).toBe('Open at 09:00');
    drag('from', -180);
    drag('to', -7 * 60);
    expect(note()).toBe('Open until 23:00');
  });

  it('lights Any time again when both heads are back on the ends', () => {
    open();
    drag('from', 120);
    expect(checked()).toBeNull();
    drag('from', -400);
    expect(checked()).toBe('Any time');
    expect(screen.queryByTestId('filter-reset')).toBeNull();
  });

  // Pulled out of "Open now" and brought back onto the present's half
  // hour, the heads ask the segment's question again.
  it('lights Open now again when the heads meet on the present', () => {
    open({ ...NONE, status: 'open' });
    drag('to', 60);
    expect(checked()).toBeNull();
    expect(note()).toBe('Open throughout 14:30–15:30');
    drag('to', -60);
    expect(checked()).toBe('Open now');
    expect(note()).toBe('Now · 14:37');
  });

  // Together, the heads are drawn as one; the way the finger goes says
  // which one it is pulling.
  it('opens two heads together to whichever side the finger goes', () => {
    open({ ...NONE, status: 'open' });
    drag('to', -90);
    expect(valueOf('Open from')).toBe('13:00');
    expect(valueOf('Open until')).toBe('14:30');
  });

  it('turns Closed now into a window open from the present when a head moves', () => {
    open({ ...NONE, status: 'closed' });
    drag('from', 60);
    expect(checked()).toBeNull();
    expect(getComputedStyle(screen.getByTestId('hours-span')).opacity).not.toBe('0.45');
  });

  it('says a moment as a moment', () => {
    open({ ...NONE, status: 'window', window: { from: 9 * 60, to: 9 * 60 } });
    expect(note()).toBe('Open at 15:00');
  });

  // Nothing writes this, but a window with no span asks nothing, and the
  // heading should not claim a span either.
  it('says nothing of a window status with no window', () => {
    open({ ...NONE, status: 'window' });
    expect(note()).toBe('');
    expect(valueOf('Open from')).toBe('06:00');
  });

  // Reset comes and goes with the heads as it does with the segments:
  // slid in on the drag that brings it, out on the one that takes it.
  it('slides Reset in and out on the drags that bring and take it', () => {
    open();
    const spy = vi.spyOn(LayoutAnimation, 'configureNext');
    drag('from', 120);
    expect(spy).toHaveBeenCalledTimes(1);
    drag('to', -60);
    expect(spy).toHaveBeenCalledTimes(1);
    drag('to', 60);
    drag('from', -120);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('applies the span it shows, and Reset takes it back to Any time', async () => {
    const onApply = vi.fn(async () => null);
    open(NONE, onApply);
    drag('from', 120);
    fireEvent.click(screen.getByTestId('filter-reset'));
    expect(checked()).toBe('Any time');
    drag('to', -60);
    await act(async () => { fireEvent.click(screen.getByTestId('filter-apply')); });
    expect(onApply).toHaveBeenCalledWith({ ...NONE, status: 'window', window: { from: 0, to: AXIS - 60 } });
  });
});

describe('the finger', () => {
  it('shows the time over the head it holds, only while held', () => {
    open();
    const cb = heads().from;
    act(() => { cb.onPanResponderGrant!(ev, g(0)); });
    act(() => { cb.onPanResponderMove!(ev, g(150 * PER_MIN)); });
    expect(screen.getByTestId('hours-bubble').textContent).toBe('08:30');
    act(() => { cb.onPanResponderTerminate!(ev, g(0)); });
    expect(screen.queryByTestId('hours-bubble')).toBeNull();
  });

  // Two heads together, taken by the closing one and pulled left: it is
  // the opening head that moves, and its time the bubble shows.
  it('shows the time of the head that moved, not of the one touched', () => {
    open({ ...NONE, status: 'open' });
    const cb = heads().to;
    act(() => { cb.onPanResponderGrant!(ev, g(0)); });
    act(() => { cb.onPanResponderMove!(ev, g(-90 * PER_MIN)); });
    expect(screen.getByTestId('hours-bubble').textContent).toBe('13:00');
  });

  it('keeps the finger once it has it, so the sheet cannot take it mid-drag', () => {
    open();
    expect(heads().from.onPanResponderTerminationRequest!(ev, g(0))).toBe(false);
    expect(heads().to.onStartShouldSetPanResponder!(ev, g(0))).toBe(true);
    expect(heads().to.onMoveShouldSetPanResponder!(ev, g(0))).toBe(true);
  });

  // A tick on the whole hours, not on every half: across the day that is
  // twenty-four, not forty-eight. A move that lands where the head is
  // already ticks nothing and changes nothing.
  it('ticks on the whole hours only', () => {
    open();
    const tick = vi.mocked(Haptics.selectionAsync);
    tick.mockClear();
    drag('from', 30, 60, 60, 90);
    expect(tick).toHaveBeenCalledTimes(1);
  });
});

describe('VoiceOver', () => {
  it('moves one head a step at a time', () => {
    open();
    const act_ = (testID: string, actionName: string) => act(() => {
      (propsOf(testID, 'onAccessibilityAction').onAccessibilityAction as (e: unknown) => void)({ nativeEvent: { actionName } });
    });
    act_('hours-head-from', 'increment');
    expect(valueOf('Open from')).toBe('06:30');
    act_('hours-head-to', 'decrement');
    expect(valueOf('Open until')).toBe('05:30');
    act_('hours-head-from', 'decrement');
    expect(checked()).toBeNull();
    act_('hours-head-to', 'increment');
    expect(checked()).toBe('Any time');
  });
});

describe('the map button’s words', () => {
  const t = ((en: string) => en) as unknown as Parameters<typeof statusLabel>[1];
  it('says what the heads ask, as the heading does', () => {
    expect(statusLabel('window', t, { from: 120, to: 960 })).toBe('Open throughout 08:00–22:00');
    expect(statusLabel('window', t, { from: 120, to: 120 })).toBe('Open at 08:00');
    expect(statusLabel('window', t, { from: 180, to: AXIS })).toBe('Open at 09:00');
    expect(statusLabel('window', t, { from: 0, to: 1020 })).toBe('Open until 23:00');
    expect(statusLabel('window', t)).toBe('Any time');
  });
});
