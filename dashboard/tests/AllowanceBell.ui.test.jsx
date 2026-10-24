// The Google allowance bell: absent when nothing is past an allowance, a
// count and a panel when something is, and quiet again about what has
// been read — except today's total, which is true until the day turns.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { api } from '../src/api.js';
import { renderDesk } from './_ui/desk.jsx';

const SEEN_KEY = 'citycrew.dashboard.allowanceSeen';
const TODAY = '2026-10-24';
const ACCOUNT = {
  day: TODAY, user_id: 'a1b2c3d4-0000-0000-0000-000000000000', handle: 'looper', full_name: 'Lớp Học',
  action: 'search', n: 412, cap: 60,
};
const usage = (extra = {}) => ({ today: TODAY, days: [], over: [], ...extra });

const bells = (n) => screen.findAllByRole('button', { name: `Google allowance: ${n} notice${n === 1 ? '' : 's'}` });
const noBell = () => expect(screen.queryByRole('button', { name: /Google allowance/ })).toBeNull();

beforeEach(() => localStorage.removeItem(SEEN_KEY));

describe('AllowanceBell', () => {
  it('is absent when nothing is past an allowance, and when the read fails', async () => {
    const { unmount } = renderDesk('/');
    await screen.findByRole('heading', { name: 'Places' });
    await waitFor(() => expect(api.fetchPlaceUsage).toHaveBeenCalled());
    noBell();
    unmount();
    api.fetchPlaceUsage.mockRejectedValue(new Error('function fetch_place_usage does not exist'));
    renderDesk('/');
    await screen.findByRole('heading', { name: 'Places' });
    await waitFor(() => expect(api.fetchPlaceUsage).toHaveBeenCalledTimes(2));
    noBell();
  });

  it('names each notice, and forgets the read ones — never today\'s total', async () => {
    api.fetchPlaceUsage.mockResolvedValue(usage({ days: [{ day: TODAY, total: 1640, cap: 2000 }], over: [ACCOUNT] }));
    const { router } = renderDesk('/');
    // Both seats, the phone's bar and the page head, as the unfiled bell.
    const both = await bells(2);
    expect(both).toHaveLength(2);
    fireEvent.click(both[0]);
    const panel = screen.getByRole('dialog', { name: 'Google allowance' });
    expect(within(panel).getByText(/a script, not a reader/)).toBeTruthy();
    expect(within(panel).getByText("82% of today's Google calls used")).toBeTruthy();
    expect(within(panel).getByText('@looper · Lớp Học')).toBeTruthy();
    expect(within(panel).getByText('412 searches of 60 · today · 352 refused')).toBeTruthy();
    // A press inside is reading, not leaving.
    fireEvent.mouseDown(panel);
    expect(screen.getByRole('dialog')).toBeTruthy();
    // Closing marks the account seen; today's total stays counted.
    fireEvent.click(both[0]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await bells(1)).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(SEEN_KEY))).toEqual([`account:${TODAY}:${ACCOUNT.user_id}:search`]);
    // And the next page asks again, and still remembers.
    await act(async () => { router.navigate('/reports'); });
    await waitFor(() => expect(api.fetchPlaceUsage).toHaveBeenCalledTimes(2));
    expect(await bells(1)).toHaveLength(2);
  });

  it('goes away once everything it had to say has been read', async () => {
    api.fetchPlaceUsage.mockResolvedValue(usage({ over: [ACCOUNT] }));
    const { unmount } = renderDesk('/');
    fireEvent.click((await bells(1))[1]);
    fireEvent.keyDown(document, { key: 'Escape' });
    noBell();
    unmount();
    // A fresh desk in the same browser remembers.
    renderDesk('/');
    await screen.findByRole('heading', { name: 'Places' });
    await waitFor(() => expect(api.fetchPlaceUsage).toHaveBeenCalledTimes(2));
    noBell();
  });

  it('closes on a press outside, and survives storage that will not keep anything', async () => {
    localStorage.setItem(SEEN_KEY, '{not json');
    api.fetchPlaceUsage.mockResolvedValue(usage({ over: [ACCOUNT] }));
    // Only the bell's key is refused: the list keeps its own settings here.
    const real = Storage.prototype.setItem;
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
      if (k === SEEN_KEY) throw new Error('quota');
      return real.call(this, k, v);
    });
    try {
      renderDesk('/');
      fireEvent.click((await bells(1))[0]);
      fireEvent.mouseDown(document.body);
      expect(screen.queryByRole('dialog')).toBeNull();
      // Not kept, but read for this visit all the same.
      noBell();
    } finally {
      set.mockRestore();
    }
  });

  it('a stored value that is not a list counts as nothing seen', async () => {
    localStorage.setItem(SEEN_KEY, '{"a":1}');
    api.fetchPlaceUsage.mockResolvedValue(usage({ over: [ACCOUNT] }));
    renderDesk('/');
    expect(await bells(1)).toHaveLength(2);
  });
});
