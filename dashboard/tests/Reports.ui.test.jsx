// Reports: the queue with a day's deadline on it.
//
// Two things are pinned that the module tests on reports.js cannot see:
// that an action runs *before* the report is marked answered — a failed
// hide must not leave the queue claiming it was handled — and that the
// one act reaching past the content to the person asks first.

import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { api } from '../src/api.js';
import { findToast, renderDesk } from './_ui/desk.jsx';

const H = 3600 * 1000;
const ago = (hours) => new Date(Date.now() - hours * H).toISOString();

const ROWS = [
  {
    id: 'r-list', kind: 'collection', reason: 'spam', status: 'new', created_at: ago(26),
    target_id: 'col-1', owner_id: 'u1', owner_handle: 'minh', title: 'Best bars', body: 'buy followers here', note: 'obvious spam',
  },
  {
    id: 'r-bio', kind: 'profile', reason: 'offensive', status: 'new', created_at: ago(13),
    target_id: 'u2', owner_id: 'u2', owner_handle: 'an', body: 'a bio with words in it',
  },
  {
    id: 'r-fresh', kind: 'profile', reason: 'other', status: 'new', created_at: ago(0.1),
    target_id: 'u3', owner_id: null, owner_handle: null, body: '',
  },
  {
    id: 'r-done', kind: 'collection', reason: 'impersonation', status: 'dismissed', created_at: ago(2),
    target_id: 'col-2', owner_id: 'u4', owner_handle: 'thu', title: 'Not really Anthony',
  },
];

const card = (text) => screen.getByText(text).closest('section');

describe('Reports', () => {
  it('is the quietest page in the desk when nothing is reported', async () => {
    renderDesk('/reports');
    expect(await screen.findByText(/Nothing reported/)).toBeTruthy();
    expect(screen.getByText('0 waiting')).toBeTruthy();
  });

  it('orders the queue by deadline and colours each card by its clock', async () => {
    api.reports.mockResolvedValue(ROWS);
    renderDesk('/reports');
    await screen.findByText('Best bars — buy followers here');
    const cards = document.querySelectorAll('.repcard');
    // Unanswered oldest first, then the answered ones.
    expect([...cards].map((c) => c.querySelector('.repstate').textContent)).toEqual([
      '26h · overdue', '13h · due today', '6m · waiting', 'dismissed',
    ]);
    expect(cards[0].querySelector('.repstate').className).toContain('overdue');
    expect(cards[3].className).toContain('done');
    // The pill counts the waiting and the late.
    const pill = screen.getByText('3 waiting · 1 overdue');
    expect(pill.className).toContain('bad');
    // The words being judged, the reason, the handle, the reporter's note.
    expect(screen.getByText('Spam or advertising')).toBeTruthy();
    expect(screen.getByText('@minh')).toBeTruthy();
    expect(screen.getByText('“obvious spam”')).toBeTruthy();
    expect(screen.getByText(/Nothing left to show/)).toBeTruthy();
    // An answered card offers nothing more to do.
    expect(within(cards[3]).queryAllByRole('button')).toHaveLength(0);
    // The nav carries the count too.
    expect(screen.getByRole('link', { name: /Reports 3/ })).toBeTruthy();
  });

  it('hides a list, then marks the report — in that order', async () => {
    api.reports.mockResolvedValue(ROWS);
    const order = [];
    api.moderateCollection.mockImplementation(async () => { order.push('hide'); });
    api.markReport.mockImplementation(async () => { order.push('mark'); });
    renderDesk('/reports');
    await screen.findByText('Best bars — buy followers here');
    fireEvent.click(within(card('Best bars — buy followers here')).getByRole('button', { name: 'Hide the list' }));
    expect((await findToast()).textContent).toBe('List hidden');
    expect(api.moderateCollection).toHaveBeenCalledWith('col-1', true);
    expect(api.markReport).toHaveBeenCalledWith('r-list', 'actioned');
    expect(order).toEqual(['hide', 'mark']);
    // And the queue is re-read, so the card leaves. (Three reads, not
    // two: the nav's badge read the queue once on the way in.)
    await waitFor(() => expect(api.reports).toHaveBeenCalledTimes(3));
  });

  it('a failed action never marks the report answered', async () => {
    api.reports.mockResolvedValue(ROWS);
    api.moderateProfile.mockRejectedValue(new Error('not an editor'));
    renderDesk('/reports');
    await screen.findByText('a bio with words in it');
    fireEvent.click(within(card('a bio with words in it')).getByRole('button', { name: 'Clear the bio' }));
    expect((await findToast()).textContent).toBe('not an editor');
    expect(api.moderateProfile).toHaveBeenCalledWith('u2', { bio: true });
    expect(api.markReport).not.toHaveBeenCalled();
    // The buttons come back, so it can be tried again.
    expect(within(card('a bio with words in it')).getByRole('button', { name: 'Clear the bio' }).disabled).toBe(false);
  });

  it('clears a photo as its own act, apart from the bio', async () => {
    api.reports.mockResolvedValue(ROWS);
    renderDesk('/reports');
    await screen.findByText('a bio with words in it');
    fireEvent.click(within(card('a bio with words in it')).getByRole('button', { name: 'Clear the photo' }));
    expect((await findToast()).textContent).toBe('Photo cleared');
    expect(api.moderateProfile).toHaveBeenCalledWith('u2', { avatar: true });
  });

  it('asks before suspending, and does nothing when told no', async () => {
    api.reports.mockResolvedValue(ROWS);
    window.confirm.mockReturnValue(false);
    renderDesk('/reports');
    await screen.findByText('a bio with words in it');
    fireEvent.click(within(card('a bio with words in it')).getByRole('button', { name: 'Suspend the account' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Suspend @an?'));
    expect(api.suspendUser).not.toHaveBeenCalled();
    expect(api.markReport).not.toHaveBeenCalled();
    // A report with no owner on it cannot offer the act at all.
    expect(within(card('Nothing left to show — already cleared.')).queryByRole('button', { name: 'Suspend the account' })).toBeNull();
  });

  it('suspends when told yes', async () => {
    api.reports.mockResolvedValue(ROWS);
    renderDesk('/reports');
    await screen.findByText('a bio with words in it');
    fireEvent.click(within(card('a bio with words in it')).getByRole('button', { name: 'Suspend the account' }));
    expect((await findToast()).textContent).toBe('Account suspended');
    expect(api.suspendUser).toHaveBeenCalledWith('u2', true);
    expect(api.markReport).toHaveBeenCalledWith('r-bio', 'actioned');
  });

  it('"Nothing wrong" is an answer of its own, and runs nothing', async () => {
    api.reports.mockResolvedValue(ROWS);
    renderDesk('/reports');
    await screen.findByText('Best bars — buy followers here');
    fireEvent.click(within(card('Best bars — buy followers here')).getByRole('button', { name: 'Nothing wrong' }));
    expect((await findToast()).textContent).toBe('Dismissed');
    expect(api.markReport).toHaveBeenCalledWith('r-list', 'dismissed');
    expect(api.moderateCollection).not.toHaveBeenCalled();
    expect(api.suspendUser).not.toHaveBeenCalled();
  });

  it('holds the row while an act is in flight, and Refresh re-reads the queue', async () => {
    api.reports.mockResolvedValue(ROWS);
    let finish;
    api.markReport.mockReturnValueOnce(new Promise((r) => { finish = r; }));
    renderDesk('/reports');
    await screen.findByText('Best bars — buy followers here');
    const buttons = within(card('Best bars — buy followers here')).getAllByRole('button');
    fireEvent.click(within(card('Best bars — buy followers here')).getByRole('button', { name: 'Nothing wrong' }));
    await waitFor(() => expect(buttons.every((b) => b.disabled)).toBe(true));
    // The other card is not held.
    expect(within(card('a bio with words in it')).getByRole('button', { name: 'Clear the bio' }).disabled).toBe(false);
    finish();
    await findToast();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    // Badge, screen, after the act, and now Refresh.
    await waitFor(() => expect(api.reports).toHaveBeenCalledTimes(4));
  });

  it('says so when the queue cannot be read', async () => {
    api.reports.mockRejectedValue(new Error('rpc missing'));
    renderDesk('/reports');
    expect((await findToast()).textContent).toBe('rpc missing');
  });
});
