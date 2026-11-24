// @vitest-environment jsdom
//
// The line from the foot of the screen: what it draws and says aloud;
// that it leaves by itself after six seconds and not before, and not at
// all while a screen reader is on; that its door goes somewhere and puts
// it away, and the words go nowhere; the swipe that dismisses it; and
// what moves.

import React from 'react';
import { AccessibilityInfo, Animated, PanResponder } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, viewStyleOf } from '../uitest/render';

const notice = vi.hoisted(() => ({
  note: null as { id: number; text: string; action: string } | null,
  dismiss: vi.fn(),
}));
vi.mock('../lib/notice', () => ({ useNotice: () => ({ note: notice.note, say: () => {}, dismiss: notice.dismiss }) }));
const ui = vi.hoisted(() => ({ still: false }));
vi.mock('./ui', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useReducedMotion: () => ui.still,
  useTabBarClearance: (extra: number) => 80 + extra,
}));

import NoticeBar, { NOTICE_MS, swipedDown } from './NoticeBar';

const onOpen = vi.fn();
const NOTE = { id: 1, text: 'Added to your page', action: 'View' };
let reader = false;
const show = async (note: typeof notice.note = NOTE) => {
  notice.note = note;
  const r = render(<NoticeBar onOpen={onOpen} />);
  // The screen reader's answer lands.
  await act(async () => { await Promise.resolve(); });
  return r;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  ui.still = false;
  reader = false;
  vi.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockImplementation(async () => reader);
  vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('NoticeBar', () => {
  it('draws nothing with nothing to say', async () => {
    await show(null);
    expect(screen.queryByTestId('notice')).toBeNull();
  });

  it('draws the line and its door, over the tab bar, and says both aloud', async () => {
    await show();
    expect(screen.getByTestId('notice-text').textContent).toBe('Added to your page');
    expect(screen.getByTestId('notice-action').textContent).toBe('View');
    expect(screen.getByTestId('notice-action').getAttribute('aria-label')).toBe('View');
    expect(viewStyleOf(screen.getByTestId('notice').parentElement as Element).bottom).toBe(88);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Added to your page. View');
  });

  it('leaves by itself after six seconds, and not a moment before', async () => {
    await show();
    expect(NOTICE_MS).toBe(6000);
    act(() => { vi.advanceTimersByTime(NOTICE_MS - 1); });
    expect(notice.dismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(notice.dismiss).toHaveBeenCalledTimes(1);
  });

  it('starts the clock again for a new line, and stops it when the line is taken away', async () => {
    const r = await show();
    act(() => { vi.advanceTimersByTime(NOTICE_MS - 1000); });
    notice.note = { ...NOTE, id: 2 };
    r.rerender(<NoticeBar onOpen={onOpen} />);
    act(() => { vi.advanceTimersByTime(NOTICE_MS - 1); });
    expect(notice.dismiss).not.toHaveBeenCalled();
    notice.note = null;
    r.rerender(<NoticeBar onOpen={onOpen} />);
    act(() => { vi.advanceTimersByTime(NOTICE_MS); });
    expect(notice.dismiss).not.toHaveBeenCalled();
  });

  it('does not go by the clock while a screen reader is on', async () => {
    reader = true;
    await show();
    act(() => { vi.advanceTimersByTime(NOTICE_MS * 3); });
    expect(notice.dismiss).not.toHaveBeenCalled();
    expect(screen.getByTestId('notice')).toBeTruthy();
  });

  it('goes by the clock again when the screen reader is turned off', async () => {
    reader = true;
    let heard: (on: boolean) => void = () => {};
    vi.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_e: string, fn: (on: boolean) => void) => {
      heard = fn;
      return { remove: () => {} };
    }) as never);
    await show();
    act(() => { heard(false); });
    act(() => { vi.advanceTimersByTime(NOTICE_MS); });
    expect(notice.dismiss).toHaveBeenCalledTimes(1);
  });

  it('opens its door and puts itself away on a press of the door; the words are not a press', async () => {
    await show();
    fireEvent.click(screen.getByTestId('notice-text'));
    expect(onOpen).not.toHaveBeenCalled();
    expect(notice.dismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('notice-action'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(notice.dismiss).toHaveBeenCalledTimes(1);
  });

  it('knows a swipe down from a tremble and from a swipe across', () => {
    expect(swipedDown({ dx: 0, dy: 13 })).toBe(true);
    expect(swipedDown({ dx: 0, dy: 12 })).toBe(false);
    expect(swipedDown({ dx: 2, dy: 3 })).toBe(false);
    expect(swipedDown({ dx: 40, dy: 20 })).toBe(false);
    expect(swipedDown({ dx: -40, dy: 20 })).toBe(false);
    expect(swipedDown({ dx: 0, dy: -30 })).toBe(false);
  });

  it('is put away by a swipe down, and by nothing less', async () => {
    const create = vi.spyOn(PanResponder, 'create');
    await show();
    const pan = create.mock.calls[create.mock.calls.length - 1][0] as {
      onMoveShouldSetPanResponder: (e: unknown, g: { dx: number; dy: number }) => boolean;
      onPanResponderRelease: (e: unknown, g: { dx: number; dy: number }) => void;
    };
    expect(pan.onMoveShouldSetPanResponder(null, { dx: 0, dy: 4 })).toBe(false);
    expect(pan.onMoveShouldSetPanResponder(null, { dx: 0, dy: 20 })).toBe(true);
    pan.onPanResponderRelease(null, { dx: 0, dy: 4 });
    expect(notice.dismiss).not.toHaveBeenCalled();
    pan.onPanResponderRelease(null, { dx: 0, dy: 20 });
    expect(notice.dismiss).toHaveBeenCalledTimes(1);
  });

  it('slides in and, near the end, out; and does neither for a reader who asked for less motion', async () => {
    const timing = vi.spyOn(Animated, 'timing');
    await show();
    expect(timing.mock.calls.map((c) => (c[1] as { toValue: number }).toValue)).toEqual([1]);
    act(() => { vi.advanceTimersByTime(NOTICE_MS - 240); });
    expect(timing.mock.calls.map((c) => (c[1] as { toValue: number }).toValue)).toEqual([1, 0]);
    cleanup();
    timing.mockClear();

    ui.still = true;
    const set = vi.spyOn(Animated.Value.prototype, 'setValue');
    await show();
    act(() => { vi.advanceTimersByTime(NOTICE_MS); });
    expect(timing).not.toHaveBeenCalled();
    // There at once: whole, not on its way.
    expect(set).toHaveBeenCalledWith(1);
    // And still gone on time.
    expect(notice.dismiss).toHaveBeenCalledTimes(1);
  });
});
