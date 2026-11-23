// @vitest-environment jsdom
//
// The pins' half of a change of set: which leave and how fast, which
// arrive and when. Driven on fake timers, since the fade is a count of
// ticks and nothing else.
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Text } from 'react-native';
import { act, render, screen } from '../uitest/render';
import { FADE_IN_AT, FADE_IN_MS, FADE_OUT_MS, TICK_MS, fadeAt, usePinFade } from './pinFade';

type Pin = { slug: string };
const pins = (...slugs: string[]): Pin[] => slugs.map((slug) => ({ slug }));
// What the hook says, written out where the test can read it back.
function Probe({ set, still = false, ask }: { set: Pin[]; still?: boolean; ask: string[] }) {
  const fade = usePinFade(set, still);
  return (
    <Text testID="probe">
      {JSON.stringify({ leaving: fade.leaving.map((p) => p.slug), opacity: Object.fromEntries(ask.map((s) => [s, fade.opacity(s)])) })}
    </Text>
  );
}
const seen = (): { leaving: string[]; opacity: Record<string, number> } => JSON.parse(screen.getByTestId('probe').textContent!);
const ask = ['a', 'b', 'c'];
const step = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('fadeAt', () => {
  it('takes a leaving pin from whole to nothing over its tenth of a second', () => {
    expect(fadeAt(0, 'leaving')).toBe(1);
    expect(fadeAt(FADE_OUT_MS / 2, 'leaving')).toBe(0.5);
    expect(fadeAt(FADE_OUT_MS, 'leaving')).toBe(0);
    expect(fadeAt(FADE_OUT_MS * 3, 'leaving')).toBe(0);
  });

  it('holds an arriving pin back until the camera is nearly there, then brings it in', () => {
    expect(fadeAt(FADE_IN_AT - 1, 'arriving')).toBe(0);
    expect(fadeAt(FADE_IN_AT + FADE_IN_MS / 2, 'arriving')).toBe(0.5);
    expect(fadeAt(FADE_IN_AT + FADE_IN_MS * 2, 'arriving')).toBe(1);
  });

  it('leaves a pin in both sets alone', () => {
    expect(fadeAt(0, 'staying')).toBe(1);
  });
});

describe('usePinFade', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('changes nothing on the first set — the map opens with its pins', () => {
    render(<Probe set={pins('a', 'b')} ask={ask} />);
    expect(seen()).toEqual({ leaving: [], opacity: { a: 1, b: 1, c: 1 } });
  });

  it('fades the pins that left, then the ones that came, then is done', () => {
    const { rerender } = render(<Probe set={pins('a', 'b')} ask={ask} />);
    rerender(<Probe set={pins('b', 'c')} ask={ask} />);
    expect(seen().leaving).toEqual(['a']);
    expect(seen().opacity).toEqual({ a: 1, b: 1, c: 0 });

    step(TICK_MS);
    expect(seen().opacity.a).toBeCloseTo(1 - TICK_MS / FADE_OUT_MS);
    expect(seen().opacity.c).toBe(0);

    step(FADE_OUT_MS);
    expect(seen().leaving).toEqual([]);

    step(FADE_IN_AT + TICK_MS - FADE_OUT_MS - 2 * TICK_MS);
    expect(seen().opacity.c).toBe(0);
    step(TICK_MS);
    expect(seen().opacity.c).toBeGreaterThan(0);
    expect(seen().opacity.c).toBeLessThan(1);

    step(FADE_IN_MS);
    expect(seen()).toEqual({ leaving: [], opacity: { a: 1, b: 1, c: 1 } });
  });

  it('does not count a re-sort of the same pins as a change', () => {
    const { rerender } = render(<Probe set={pins('a', 'b')} ask={ask} />);
    rerender(<Probe set={pins('b', 'a')} ask={ask} />);
    expect(seen()).toEqual({ leaving: [], opacity: { a: 1, b: 1, c: 1 } });
  });

  it('moves nothing for a reader who asked for less motion', () => {
    const { rerender } = render(<Probe set={pins('a', 'b')} still ask={ask} />);
    rerender(<Probe set={pins('c')} still ask={ask} />);
    expect(seen()).toEqual({ leaving: [], opacity: { a: 1, b: 1, c: 1 } });
  });

  it('starts again from the set it was fading to when the set changes mid-fade', () => {
    const { rerender } = render(<Probe set={pins('a')} ask={ask} />);
    rerender(<Probe set={pins('b')} ask={ask} />);
    step(TICK_MS);
    rerender(<Probe set={pins('c')} ask={ask} />);
    expect(seen().leaving).toEqual(['b']);
    expect(seen().opacity).toEqual({ a: 1, b: 1, c: 0 });
  });
});
