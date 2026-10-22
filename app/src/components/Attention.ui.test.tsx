// @vitest-environment jsdom
//
// The app's one "look here": a ring round a control and a pulse under it,
// three times and done, none for a reader who asked for less motion. What
// is pinned: the ring sits where it is told and touches pass it by; the
// pulse waits for the reduce-motion answer before it starts, runs three
// times, starts again for a new key, and stops with the screen.

import React from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { act, render, screen, waitFor } from '../uitest/render';
import { AttentionPulse, AttentionRing } from './Attention';

const FRAME = { left: -4, top: -4, width: 52, height: 52 };
let loop: MockInstance<typeof Animated.loop>;
beforeEach(() => { loop = vi.spyOn(Animated, 'loop'); });
afterEach(() => { vi.restoreAllMocks(); });
const runs = () => loop.mock.calls.filter(([, cfg]) => cfg?.iterations === 3).length;

describe('AttentionRing', () => {
  it('rings the frame it is given, lets touches through, and pulses under the ring', async () => {
    render(<AttentionRing frame={FRAME} testID="ring" />);
    const ring = screen.getByTestId('ring');
    expect([ring.style.left, ring.style.top, ring.style.width, ring.style.height]).toEqual(['-4px', '-4px', '52px', '52px']);
    expect(getComputedStyle(ring).pointerEvents).toBe('none');
    const pulse = screen.getByTestId('ring-pulse');
    expect(pulse.compareDocumentPosition(ring) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await waitFor(() => expect(runs()).toBe(1));
  });

  it('needs no name to be drawn', async () => {
    const { container } = render(<AttentionRing frame={FRAME} />);
    expect(container.querySelector('[data-testid]')).toBeNull();
    await waitFor(() => expect(runs()).toBe(1));
  });
});

describe('AttentionPulse', () => {
  it('pulses three times, and again for a new key', async () => {
    const view = render(<AttentionPulse frame={FRAME} runKey={1} />);
    await waitFor(() => expect(runs()).toBe(1));
    view.rerender(<AttentionPulse frame={FRAME} runKey={2} />);
    await waitFor(() => expect(runs()).toBe(2));
  });

  it('draws and starts nothing for a reader who asked for less motion', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    render(<AttentionPulse frame={FRAME} testID="pulse" />);
    await act(async () => {});
    expect(screen.queryByTestId('pulse')).toBeNull();
    expect(runs()).toBe(0);
  });

  it('starts nothing once the screen has gone, and stops what it started', async () => {
    const early = render(<AttentionPulse frame={FRAME} />);
    early.unmount();
    await act(async () => {});
    expect(runs()).toBe(0);
    const stop = vi.fn();
    loop.mockImplementation(() => ({ start: () => {}, stop, reset: () => {} }) as never);
    const late = render(<AttentionPulse frame={FRAME} />);
    await waitFor(() => expect(loop).toHaveBeenCalled());
    late.unmount();
    expect(stop).toHaveBeenCalled();
  });
});

// Transient (owner, 22 Oct 2026): the ring goes once its pulses are done,
// and comes back with them for a new key. A ring that is not transient
// stays. Animated values do not tick here — an animation lands at once —
// so the timing is read off the call that starts it, against the pulse's
// own: the fade waits exactly as long as the three pulses take.
describe('a transient ring', () => {
  const opacity = () => getComputedStyle(screen.getByTestId('ring')).opacity;
  type Timing = { toValue: number; duration: number; delay?: number };
  let timing: MockInstance<typeof Animated.timing>;
  let delay: MockInstance<typeof Animated.delay>;
  beforeEach(() => { timing = vi.spyOn(Animated, 'timing'); delay = vi.spyOn(Animated, 'delay'); });
  const fades = () => timing.mock.calls.map(([, c]) => c as Timing).filter((c) => c.toValue === 0 && c.delay !== undefined);

  it('fades once the three pulses are done, and is back for a new key', async () => {
    const view = render(<AttentionRing frame={FRAME} runKey={1} transient testID="ring" />);
    await waitFor(() => expect(runs()).toBe(1));
    const pulse = timing.mock.calls.map(([, c]) => c as Timing).find((c) => c.toValue === 1)!;
    const rest = delay.mock.calls[0][0];
    expect(fades()).toHaveLength(1);
    expect(fades()[0].delay).toBe(3 * (pulse.duration + rest));
    expect(fades()[0].duration).toBeLessThanOrEqual(400);
    expect(opacity()).toBe('0');
    view.rerender(<AttentionRing frame={FRAME} runKey={2} transient testID="ring" />);
    await waitFor(() => expect(fades()).toHaveLength(2));
  });

  it('stays when it is not transient', async () => {
    render(<AttentionRing frame={FRAME} testID="ring" />);
    await waitFor(() => expect(runs()).toBe(1));
    expect(fades()).toHaveLength(0);
    expect(opacity()).toBe('1');
  });
});
