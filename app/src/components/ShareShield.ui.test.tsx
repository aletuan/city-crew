// @vitest-environment jsdom
//
// The pane over the app while a share is open: there exactly while
// `lib/share` says the shield is up, over everything, and nothing to a
// screen reader.

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '../uitest/render';
import { SHIELD_GRACE_MS, shareSafely } from '../lib/share';
import ShareShield from './ShareShield';

afterEach(() => { vi.useRealTimers(); });

describe('the share shield', () => {
  it('is not there when nothing is being shared', () => {
    render(<ShareShield />);
    expect(screen.queryByTestId('share-shield')).toBeNull();
  });

  it('covers the app while the sheet is open, and goes after the grace', async () => {
    vi.useFakeTimers();
    let close!: () => void;
    render(<ShareShield />);
    act(() => { void shareSafely({ message: 'hi' }, () => new Promise((res) => { close = () => res({}); })); });
    const pane = screen.getByTestId('share-shield');
    const st = getComputedStyle(pane);
    expect([st.position, st.top, st.left, st.right, st.bottom]).toEqual(['absolute', '0px', '0px', '0px', '0px']);
    await act(async () => { close(); await vi.advanceTimersByTimeAsync(SHIELD_GRACE_MS); });
    expect(screen.queryByTestId('share-shield')).toBeNull();
  });
});
