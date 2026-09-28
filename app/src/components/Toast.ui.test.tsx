// @vitest-environment jsdom
//
// The two-second note: that it comes, that it is heard, that it goes, and
// that a second note starts its own two seconds rather than inheriting
// what was left of the first.

import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '../uitest/render';
import { Toast, TOAST_MS, type ToastNote } from './Toast';

let announce: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.useFakeTimers();
  announce = vi.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  announce.mockRestore();
});

const at = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const shown = () => screen.queryByTestId('toast')?.textContent ?? null;

describe('Toast', () => {
  it('draws nothing until there is something to say', () => {
    render(<Toast note={null} testID="toast" />);
    expect(shown()).toBeNull();
    expect(announce).not.toHaveBeenCalled();
  });

  it('shows the note, says it to VoiceOver, and is gone after two seconds', async () => {
    render(<Toast note={{ id: 1, text: 'Open now · 12 places' }} testID="toast" />);
    expect(shown()).toBe('Open now · 12 places');
    expect(announce).toHaveBeenCalledWith('Open now · 12 places');
    await at(TOAST_MS - 1);
    expect(shown()).toBe('Open now · 12 places');
    await at(1);
    expect(shown()).toBeNull();
  });

  it('gives a new note its own two seconds, even in the same words', async () => {
    const first: ToastNote = { id: 1, text: 'Open now · 12 places' };
    const { rerender } = render(<Toast note={first} testID="toast" />);
    await at(1500);
    rerender(<Toast note={{ id: 2, text: first.text }} testID="toast" />);
    // Past where the first note would have gone.
    await at(1000);
    expect(shown()).toBe(first.text);
    expect(announce).toHaveBeenCalledTimes(2);
    await at(TOAST_MS - 1000);
    expect(shown()).toBeNull();
  });

  it('keeps nothing ticking once it is unmounted', async () => {
    const { unmount } = render(<Toast note={{ id: 1, text: 'x' }} testID="toast" />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
