// @vitest-environment jsdom
//
// Pulling a sheet down to close it: when a movement is a pull, how far is
// far enough, and that the five sheets with a handle are wired to it. The
// gesture itself is played through the responder's own callbacks — jsdom
// has no fingers, but it can hand a callback the state a finger would.

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Animated, PanResponder, type PanResponderCallbacks, type PanResponderGestureState } from 'react-native';
import { act, render } from '../uitest/render';
import { dismisses, dragCallbacks, wantsDrag } from './sheetDrag';

vi.mock('../lib/i18n', () => ({
  LANGS: [{ id: 'en', label: 'English' }, { id: 'vi', label: 'Tiếng Việt' }],
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import { LanguageSwitcherModal } from './LanguageSwitcher';

afterEach(() => { vi.restoreAllMocks(); });

/** The pull's own translate: the last of the sheet's two, after the rise. */
const pulled = (sheet: HTMLElement) => Number([...sheet.style.transform.matchAll(/translateY\((-?[\d.]+)px\)/g)].at(-1)![1]);

/** A gesture's state, as much of it as the callbacks read. */
const g = (dy: number, dx = 0, vy = 0) => ({ dx, dy, vy }) as PanResponderGestureState;
const ev = {} as Parameters<NonNullable<PanResponderCallbacks['onPanResponderMove']>>[0];

describe('what counts as a pull', () => {
  it('is down, past the jitter, and mostly down', () => {
    expect(wantsDrag(g(20))).toBe(true);
    expect(wantsDrag(g(6))).toBe(false);         // a tap that wobbled
    expect(wantsDrag(g(-30))).toBe(false);       // up: the sheet has nowhere to go
    expect(wantsDrag(g(20, 20))).toBe(false);    // diagonal: not a pull
    expect(wantsDrag(g(30, 15))).toBe(true);
  });

  // A slow pull past 80pt closes; so does a flick from anywhere.
  it('closes past 80pt, or at a flick, and not short of both', () => {
    expect(dismisses(g(81))).toBe(true);
    expect(dismisses(g(80))).toBe(false);
    expect(dismisses(g(20, 0, 0.6))).toBe(true);
    expect(dismisses(g(20, 0, 0.5))).toBe(false);
  });
});

describe('the pull, played through', () => {
  it('follows the finger down, never up, and closes when let go far enough', () => {
    const drag = new Animated.Value(0);
    const close = vi.fn();
    const cb = dragCallbacks(drag, close);
    cb.onPanResponderMove!(ev, g(40));
    expect((drag as unknown as { __getValue: () => number }).__getValue()).toBe(40);
    cb.onPanResponderMove!(ev, g(-20));
    expect((drag as unknown as { __getValue: () => number }).__getValue()).toBe(0);
    cb.onPanResponderRelease!(ev, g(120));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('springs home on a short pull, or when the gesture is taken away', () => {
    const spring = vi.spyOn(Animated, 'spring');
    const close = vi.fn();
    const cb = dragCallbacks(new Animated.Value(0), close);
    cb.onPanResponderRelease!(ev, g(30));
    cb.onPanResponderTerminate!(ev, g(30));
    expect(close).not.toHaveBeenCalled();
    expect(spring).toHaveBeenCalledTimes(2);
    expect(spring.mock.calls[0][1]).toEqual(expect.objectContaining({ toValue: 0, useNativeDriver: true }));
  });

  it('takes the gesture from a row only once it is a pull', () => {
    const cb = dragCallbacks(new Animated.Value(0), () => {});
    expect(cb.onMoveShouldSetPanResponderCapture!(ev, g(4))).toBe(false);
    expect(cb.onMoveShouldSetPanResponderCapture!(ev, g(24))).toBe(true);
  });
});

describe('a sheet with a handle', () => {
  // The language sheet stands for the five: its pull closes it through the
  // same `onClose` the dimmed screen calls, and the sheet rides the pull.
  it('closes when pulled down, and moves with the finger', () => {
    const create = vi.spyOn(PanResponder, 'create');
    const onClose = vi.fn();
    const { getByText } = render(<LanguageSwitcherModal visible onClose={onClose} />);
    const cb = create.mock.calls.at(-1)![0];
    act(() => { cb.onPanResponderMove!(ev, g(50)); });
    const sheet = getByText('Choose a language').parentElement as HTMLElement;
    expect(pulled(sheet)).toBe(50);
    act(() => { cb.onPanResponderRelease!(ev, g(120)); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Closed by a pull, it fades out where the finger left it, and opens
  // again where it belongs.
  it('opens again at rest after a pull closed it', () => {
    const create = vi.spyOn(PanResponder, 'create');
    const { getByText, rerender } = render(<LanguageSwitcherModal visible onClose={() => {}} />);
    act(() => { create.mock.calls.at(-1)![0].onPanResponderMove!(ev, g(70)); });
    rerender(<LanguageSwitcherModal visible={false} onClose={() => {}} />);
    rerender(<LanguageSwitcherModal visible onClose={() => {}} />);
    const sheet = getByText('Choose a language').parentElement as HTMLElement;
    expect(pulled(sheet)).toBe(0);
  });
});
