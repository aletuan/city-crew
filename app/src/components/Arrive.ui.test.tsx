// @vitest-environment jsdom
//
// The rows of a freshly opened list arriving. What is pinned: a row inside
// the first four is timed to come in, each a step after the one above it;
// a row past them is not timed at all and is simply there, and so is every
// row for a reader who asked for less motion.
//
// Animated values do not tick here — an animation lands at once — so what
// a row was asked to do is read off the call that starts it.

import React from 'react';
import { Animated } from 'react-native';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { render, screen } from '../uitest/render';
import { ARRIVE_MS, arriveDelay } from '../lib/coverMorph';

const state = vi.hoisted(() => ({ still: false }));
vi.mock('./ui/motion', async (orig) => ({ ...(await orig<Record<string, unknown>>()), useReducedMotion: () => state.still }));

import { useRowArrival } from './Arrive';

function Row({ row }: { row: number }) {
  const arrival = useRowArrival(row);
  return <Animated.View style={arrival} testID="row" />;
}
type Timing = { toValue: number; duration: number; delay: number };

describe('useRowArrival', () => {
  let timing: MockInstance<typeof Animated.timing>;
  const asked = () => timing.mock.calls.map(([, c]) => c as Timing);
  beforeEach(() => { state.still = false; timing = vi.spyOn(Animated, 'timing'); });

  it('brings a row inside the first four in, after the cover has begun', () => {
    render(<Row row={0} />);
    expect(asked()).toEqual([expect.objectContaining({ toValue: 1, duration: ARRIVE_MS, delay: arriveDelay(0) })]);
  });

  it('starts each row later than the one above it', () => {
    render(<Row row={3} />);
    expect(asked()[0].delay).toBe(arriveDelay(3));
    expect(arriveDelay(3)).toBeGreaterThan(arriveDelay(2));
  });

  it('does not time a row past the first four: it is simply there', () => {
    render(<Row row={4} />);
    expect(asked()).toEqual([]);
    expect(getComputedStyle(screen.getByTestId('row')).opacity).toBe('1');
  });

  it('does not time any row for a reader who asked for less motion', () => {
    state.still = true;
    render(<Row row={0} />);
    expect(asked()).toEqual([]);
    expect(getComputedStyle(screen.getByTestId('row')).opacity).toBe('1');
  });
});
