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
    wall_kind: 'upload', wall_ref: 'https://storage/avatars/u2/wall.jpg?v=1',
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

  // docs/wall-plan.md, W4: the one picture on a page nobody at the desk
  // has seen is drawn; a cover from the catalog is named; a page on
  // automatic has nothing to take down.
  it('draws an uploaded cover and takes it down as its own act', async () => {
    api.reports.mockResolvedValue(ROWS);
    renderDesk('/reports');
    await screen.findByText('a bio with words in it');
    const c = card('a bio with words in it');
    expect(within(c).getByAltText('Uploaded cover').getAttribute('src')).toBe('https://storage/avatars/u2/wall.jpg?v=1');
    fireEvent.click(within(c).getByRole('button', { name: 'Take the cover down' }));
    expect((await findToast()).textContent).toBe('Cover taken down');
    expect(api.moderateProfile).toHaveBeenCalledWith('u2', { wall: true });
    expect(api.markReport).toHaveBeenCalledWith('r-bio', 'actioned');
  });

  it('names a cover from the catalog, and offers nothing for a page on automatic', async () => {
    api.reports.mockResolvedValue([{ ...ROWS[1], wall_kind: 'city', wall_ref: 'hanoi' }, ROWS[2]]);
    renderDesk('/reports');
    await screen.findByText('a bio with words in it');
    expect(within(card('a bio with words in it')).getByText('Cover: city hanoi')).toBeTruthy();
    expect(within(card('a bio with words in it')).queryByAltText('Uploaded cover')).toBeNull();
    expect(within(card('Nothing left to show — already cleared.')).queryByRole('button', { name: 'Take the cover down' })).toBeNull();
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

  // ── comments (C8) ──
  const COMMENTS = [
    {
      id: 'r-said', kind: 'comment', reason: 'spam', status: 'new', created_at: ago(3),
      target_id: 'k1', owner_id: 'u7', owner_handle: 'trang', title: 'Coffee in Hoi An', body: 'buy followers here',
    },
    // Reported, and since removed by its author: no row behind it.
    {
      id: 'r-gone', kind: 'comment', reason: 'offensive', status: 'new', created_at: ago(1),
      target_id: 'k2', owner_id: null, owner_handle: null, title: null, body: null,
    },
  ];

  it('shows a reported comment as a comment: its words, its writer and the list it is on', async () => {
    api.reports.mockResolvedValue(COMMENTS);
    renderDesk('/reports');
    const said = (await screen.findByText('buy followers here')).closest('section');
    expect(said.querySelector('.repkind').textContent).toBe('comment');
    expect(within(said).getByText('@trang')).toBeTruthy();
    expect(within(said).getByText('on “Coffee in Hoi An”')).toBeTruthy();
    // A comment has no bio and no photo to clear, and is not a list to hide.
    expect(within(said).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Remove the comment', 'Suspend the account', 'Nothing wrong',
    ]);
    // One already gone has nothing to remove; it can only be closed.
    const gone = card('Nothing left to show — already cleared.');
    expect(gone.querySelector('.repkind').textContent).toBe('comment');
    expect(gone.querySelector('.repplace')).toBeNull();
    expect(within(gone).getAllByRole('button').map((b) => b.textContent)).toEqual(['Nothing wrong']);
  });

  it('asks before removing a comment, says it cannot be undone, and does nothing when told no', async () => {
    api.reports.mockResolvedValue(COMMENTS);
    window.confirm.mockReturnValue(false);
    renderDesk('/reports');
    await screen.findByText('buy followers here');
    fireEvent.click(screen.getByRole('button', { name: 'Remove the comment' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('cannot be put back'));
    expect(api.moderateComment).not.toHaveBeenCalled();
    expect(api.markReport).not.toHaveBeenCalled();
  });

  it('removes the comment through the desk\u2019s own function, then marks the report', async () => {
    api.reports.mockResolvedValue(COMMENTS);
    const order = [];
    api.moderateComment.mockImplementation(async () => { order.push('remove'); });
    api.markReport.mockImplementation(async () => { order.push('mark'); });
    renderDesk('/reports');
    await screen.findByText('buy followers here');
    fireEvent.click(screen.getByRole('button', { name: 'Remove the comment' }));
    expect((await findToast()).textContent).toBe('Comment removed');
    expect(api.moderateComment).toHaveBeenCalledWith('k1');
    expect(api.markReport).toHaveBeenCalledWith('r-said', 'actioned');
    expect(order).toEqual(['remove', 'mark']);
  });

  // K5 of docs/checkin-photos-plan.md.
  const PHOTOS = [
    {
      id: 'r-photo', kind: 'checkin_photo', reason: 'offensive', status: 'new', created_at: ago(3),
      target_id: 'ph1', owner_id: 'u8', owner_handle: 'lan', title: 'Cộng Cà Phê', body: 'look at this',
      photo_path: 'u8/k1/ph1.jpg', photo_hidden: false,
    },
    {
      id: 'r-down', kind: 'checkin_photo', reason: 'spam', status: 'new', created_at: ago(2),
      target_id: 'ph2', owner_id: 'u8', owner_handle: 'lan', title: 'Cộng Cà Phê', body: null,
      photo_path: 'u8/k1/ph2.jpg', photo_hidden: true,
    },
  ];

  it('draws a reported check-in photo from a link the desk asks for, with its note and its place', async () => {
    api.reports.mockResolvedValue(PHOTOS.slice(0, 1));
    renderDesk('/reports');
    const said = (await screen.findByText('look at this')).closest('section');
    expect(said.querySelector('.repkind').textContent).toBe('check-in photo');
    expect(within(said).getByText('on “Cộng Cà Phê”')).toBeTruthy();
    const img = await within(said).findByAltText('Reported check-in photo');
    expect(img.getAttribute('src')).toBe('https://signed/u8/k1/ph1.jpg');
    expect(img.className).toBe('repphoto');
    expect(api.signCheckinPhoto).toHaveBeenCalledWith('u8/k1/ph1.jpg');
    expect(within(said).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Hide the photo', 'Suspend the account', 'Nothing wrong',
    ]);
  });

  it('hides the photo, then marks the report — in that order', async () => {
    api.reports.mockResolvedValue(PHOTOS.slice(0, 1));
    const order = [];
    api.moderateCheckinPhoto.mockImplementation(async () => { order.push('hide'); });
    api.markReport.mockImplementation(async () => { order.push('mark'); });
    renderDesk('/reports');
    await screen.findByText('look at this');
    fireEvent.click(screen.getByRole('button', { name: 'Hide the photo' }));
    expect((await findToast()).textContent).toBe('Photo hidden');
    expect(api.moderateCheckinPhoto).toHaveBeenCalledWith('ph1', true);
    expect(api.markReport).toHaveBeenCalledWith('r-photo', 'actioned');
    expect(order).toEqual(['hide', 'mark']);
  });

  it('shows one already down as down, and puts it back as an answer of nothing wrong', async () => {
    api.reports.mockResolvedValue(PHOTOS.slice(1));
    renderDesk('/reports');
    const down = (await screen.findByText(/nobody but the desk/)).closest('section');
    expect((await within(down).findByAltText('Reported check-in photo')).className).toBe('repphoto off');
    fireEvent.click(within(down).getByRole('button', { name: 'Put the photo back' }));
    expect((await findToast()).textContent).toBe('Photo put back');
    expect(api.moderateCheckinPhoto).toHaveBeenCalledWith('ph2', false);
    expect(api.markReport).toHaveBeenCalledWith('r-down', 'dismissed');
  });

  it('says so when the photo cannot be signed', async () => {
    api.reports.mockResolvedValue(PHOTOS.slice(0, 1));
    api.signCheckinPhoto.mockRejectedValue(new Error('forbidden'));
    renderDesk('/reports');
    expect(await screen.findByText('The photo could not be loaded.')).toBeTruthy();
    expect(screen.queryByAltText('Reported check-in photo')).toBeNull();
  });

  // A check-in reported whole (20261126090000).
  const VISITS = [
    {
      id: 'r-visit', kind: 'checkin', reason: 'spam', status: 'new', created_at: ago(3),
      target_id: 'k1', owner_id: 'u8', owner_handle: 'lan', title: 'Omu-Ba', body: 'buy my course',
      visit_photos: [{ id: 'ph1', path: 'u8/k1/ph1.jpg', hidden: false }, { id: 'ph2', path: 'u8/k1/ph2.jpg', hidden: true }],
      visit_hidden: false, visit_note_hidden: false, visit_audience: 'public',
    },
    {
      id: 'r-visit-down', kind: 'checkin', reason: 'offensive', status: 'new', created_at: ago(2),
      target_id: 'k2', owner_id: 'u8', owner_handle: 'lan', title: 'Omu-Ba', body: null,
      visit_photos: [], visit_hidden: true, visit_note_hidden: true, visit_audience: 'friends',
    },
  ];

  it('draws a reported check-in whole: its note, its place, every photo, and what can come down', async () => {
    api.reports.mockResolvedValue(VISITS.slice(0, 1));
    renderDesk('/reports');
    const card = (await screen.findByText('buy my course')).closest('section');
    expect(card.querySelector('.repkind').textContent).toBe('check-in');
    expect(within(card).getByText('on “Omu-Ba”')).toBeTruthy();
    const imgs = await within(card).findAllByAltText('Reported check-in photo');
    expect(imgs.map((i) => [i.getAttribute('src'), i.className])).toEqual([
      ['https://signed/u8/k1/ph1.jpg', 'repphoto'], ['https://signed/u8/k1/ph2.jpg', 'repphoto off'],
    ]);
    expect(within(card).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Hide the photo', 'Put the photo back', 'Hide the note', 'Hide the check-in', 'Suspend the account', 'Nothing wrong',
    ]);
  });

  it('hides the note, one photo, or the whole, and marks the report after each', async () => {
    api.reports.mockResolvedValue(VISITS.slice(0, 1));
    renderDesk('/reports');
    await screen.findByText('buy my course');
    fireEvent.click(screen.getByRole('button', { name: 'Hide the note' }));
    expect((await findToast()).textContent).toBe('Note hidden');
    expect(api.moderateCheckin).toHaveBeenLastCalledWith('k1', 'note', true);
    expect(api.markReport).toHaveBeenLastCalledWith('r-visit', 'actioned');
    fireEvent.click(screen.getAllByRole('button', { name: 'Hide the photo' })[0]);
    await waitFor(() => expect(api.moderateCheckinPhoto).toHaveBeenLastCalledWith('ph1', true));
    fireEvent.click(screen.getByRole('button', { name: 'Hide the check-in' }));
    await waitFor(() => expect(api.moderateCheckin).toHaveBeenLastCalledWith('k1', 'visit', true));
  });

  it('puts a hidden photo of the visit back, and offers no note to hide where there is none', async () => {
    api.reports.mockResolvedValue([{ ...VISITS[0], body: null }]);
    renderDesk('/reports');
    const card = (await screen.findAllByAltText('Reported check-in photo'))[0].closest('section');
    expect(within(card).queryByRole('button', { name: 'Hide the note' })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Put the photo back' }));
    expect((await findToast()).textContent).toBe('Photo put back');
    expect(api.moderateCheckinPhoto).toHaveBeenCalledWith('ph2', false);
    expect(api.markReport).toHaveBeenCalledWith('r-visit', 'dismissed');
  });

  it('says what is down already, and puts it back as an answer of nothing wrong', async () => {
    api.reports.mockResolvedValue(VISITS.slice(1));
    renderDesk('/reports');
    const card = (await screen.findByText(/whole check-in is hidden/)).closest('section');
    expect(within(card).getByText(/note is hidden/)).toBeTruthy();
    expect(within(card).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Put the note back', 'Put the check-in back', 'Suspend the account', 'Nothing wrong',
    ]);
    fireEvent.click(within(card).getByRole('button', { name: 'Put the check-in back' }));
    expect((await findToast()).textContent).toBe('Check-in put back');
    expect(api.moderateCheckin).toHaveBeenCalledWith('k2', 'visit', false);
    expect(api.markReport).toHaveBeenCalledWith('r-visit-down', 'dismissed');
  });

  it('points at the banned words, which have a page of their own', async () => {
    renderDesk('/reports');
    await screen.findByText(/Nothing reported/);
    expect(screen.getByRole('link', { name: 'Banned words' }).getAttribute('href')).toBe('/banned-words');
  });
});
