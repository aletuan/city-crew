// The shell: the page head, the four tiles, the two seats of the actions,
// the bell, the phone's More sheet, and the bar that ducks.
//
// Most of App.jsx is exercised by the screens it wraps (see _ui/desk.jsx).
// What is pinned here is what belongs to the shell alone — and two of
// those have already broken once: the publish button that was in one
// seat and not the other (#634, desk.test.mjs reads the source for the
// same fault), and the tab bar that strobed on a slow scroll until the
// hysteresis below was written.

import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { api } from '../src/api.js';
import { supabase } from '../src/lib/supabase.js';
import { EMPTY_PROGRESS } from './_ui/setup.jsx';
import { findToast, renderDesk } from './_ui/desk.jsx';

const progress = (extra) => ({ ...EMPTY_PROGRESS, ...extra });
const COUNTS = progress({ total: 40, by_status: { approved: 30, pending: 7, flagged: 3 }, unpublished: 3 });

const tiles = () => within(screen.getByRole('group', { name: 'Filter by review status' }));
const tile = (label) => tiles().getByRole('link', { name: new RegExp(`${label}$`) });
const sidebar = () => within(document.querySelector('.sidebar'));
const pagehead = () => within(document.querySelector('.pagehead-actions'));
const topbar = () => within(document.querySelector('.topbar'));

describe('App', () => {
  it('names the room on the line with the counts, for every room that has a name', async () => {
    const { router, unmount } = renderDesk('/');
    expect(await screen.findByRole('heading', { name: 'Places' })).toBeTruthy();
    expect(screen.getByText(/Discover, review and manage places/)).toBeTruthy();
    await act(async () => { router.navigate('/analytics/coverage'); });
    expect(await screen.findByRole('heading', { name: 'Coverage' })).toBeTruthy();
    await act(async () => { router.navigate('/place/some-cafe'); });
    expect(await screen.findByRole('heading', { name: 'Place' })).toBeTruthy();
    unmount();
    renderDesk('/search-words');
    await screen.findByRole('heading', { name: 'Search words' });
    expect(document.querySelector('.pagetitles')).toBeNull();
  });

  it('the four tiles are doors into the list, and the one already open closes', async () => {
    api.progress.mockResolvedValue(COUNTS);
    renderDesk('/?category=cafes&page=3&status=pending');
    await screen.findByRole('group', { name: 'Filter by review status' });
    expect(tile('places').getAttribute('href')).toBe('/?category=cafes');
    expect(tile('approved').getAttribute('href')).toBe('/?category=cafes&status=approved');
    // Pending is on: its door leads out of it, and it says so.
    expect(tile('pending').getAttribute('href')).toBe('/?category=cafes');
    expect(tile('pending').className).toBe('stat pending on');
    expect(tile('flagged').className).toBe('stat flagged');
    expect(tile('places').className).toBe('stat');
    expect(tile('places').textContent).toBe('40places');
    expect(tile('flagged').textContent).toBe('3flagged');
  });

  it('a queue with nothing in it stays quiet, and no total means no tiles', async () => {
    api.progress.mockResolvedValue(progress({ total: 5, by_status: { approved: 5 } }));
    const { unmount } = renderDesk('/');
    await screen.findByRole('group', { name: 'Filter by review status' });
    expect(tile('places').className).toBe('stat on');
    expect(tile('pending').className).toBe('stat');
    expect(tile('flagged').className).toBe('stat');
    unmount();
    api.progress.mockResolvedValue(EMPTY_PROGRESS);
    renderDesk('/');
    await screen.findByRole('heading', { name: 'Places' });
    await waitFor(() => expect(api.progress).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('group', { name: 'Filter by review status' })).toBeNull();
  });

  it('publish sits in both seats when something is waiting, and in neither when nothing is', async () => {
    api.progress.mockResolvedValue(COUNTS);
    api.publishApproved.mockResolvedValue({ published: 3 });
    renderDesk('/', { city: 'hcmc' });
    await screen.findByRole('group', { name: 'Filter by review status' });
    expect(pagehead().getByRole('button', { name: 'Publish 3' })).toBeTruthy();
    expect(topbar().getByRole('button', { name: 'Publish 3' })).toBeTruthy();
    api.progress.mockResolvedValue(progress({ total: 40, by_status: { approved: 30 }, unpublished: 0 }));
    fireEvent.click(topbar().getByRole('button', { name: 'Publish 3' }));
    expect(screen.getAllByRole('button', { name: 'Publishing…' }).every((b) => b.disabled)).toBe(true);
    expect((await findToast()).textContent).toBe('Published 3 approved places in Ho Chi Minh City');
    expect(api.publishApproved).toHaveBeenCalledWith('hcmc');
    await waitFor(() => expect(screen.queryByRole('button', { name: /Publish/ })).toBeNull());
  });

  it('publish across all cities, one place, nothing, and a failure each say so', async () => {
    api.progress.mockResolvedValue(progress({ total: 1, by_status: { approved: 1 }, unpublished: 1 }));
    api.publishApproved.mockResolvedValueOnce({ published: 1 });
    renderDesk('/', { city: 'all' });
    await screen.findByRole('group', { name: 'Filter by review status' });
    fireEvent.click(pagehead().getByRole('button', { name: 'Publish 1' }));
    expect((await findToast()).textContent).toBe('Published 1 approved place in all cities');
    expect(api.publishApproved).toHaveBeenCalledWith(undefined);
    api.publishApproved.mockResolvedValueOnce({ published: 0 });
    fireEvent.click(pagehead().getByRole('button', { name: 'Publish 1' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Nothing new to publish — all approved places are already live'));
    api.publishApproved.mockRejectedValueOnce(new Error('rls'));
    fireEvent.click(pagehead().getByRole('button', { name: 'Publish 1' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Publish failed: rls'));
  });

  it('the toast leaves on its own', async () => {
    api.sync.mockResolvedValue({});
    renderDesk('/');
    await screen.findByRole('heading', { name: 'Places' });
    fireEvent.click(sidebar().getByRole('button', { name: 'Sync mockup' }));
    expect((await findToast()).textContent).toBe('Mockup synced from database');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull(), { timeout: 4000 });
  }, 6000);

  it('sync says while it works and why it failed', async () => {
    let finish;
    api.sync.mockReturnValueOnce(new Promise((_, reject) => { finish = reject; }));
    renderDesk('/');
    await screen.findByRole('heading', { name: 'Places' });
    fireEvent.click(sidebar().getByRole('button', { name: 'Sync mockup' }));
    expect((await sidebar().findByRole('button', { name: 'Syncing…' })).disabled).toBe(true);
    await act(async () => finish(new Error('function missing')));
    expect((await findToast()).textContent).toBe('Sync failed: function missing');
    expect(sidebar().getByRole('button', { name: 'Sync mockup' }).disabled).toBe(false);
  });

  it('sign out is one press from the rail and one from the sheet', async () => {
    renderDesk('/');
    await screen.findByRole('heading', { name: 'Places' });
    fireEvent.click(sidebar().getByRole('button', { name: 'Sign out' }));
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(within(screen.getByRole('menu', { name: 'More' })).getByRole('menuitem', { name: 'Sign out' }));
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(2);
  });

  it('the nav wears the count of waiting reports, and the sheet says it too', async () => {
    api.reports.mockResolvedValue([{ id: 1, status: 'new' }, { id: 2, status: 'new' }, { id: 3, status: 'dismissed' }]);
    renderDesk('/');
    expect(await sidebar().findByRole('link', { name: /Reports 2/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menuitem', { name: 'Reports · 2' })).toBeTruthy();
  });

  it('the More sheet closes on Escape, on its backdrop, and on going anywhere', async () => {
    renderDesk('/');
    await screen.findByRole('heading', { name: 'Places' });
    const more = screen.getByRole('button', { name: 'More' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(more.className).toContain('active');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(more);
    fireEvent.click(document.querySelector('.sheetback'));
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(more);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Search words' }));
    expect(await screen.findByRole('heading', { name: 'Search words' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
    // Sync from the sheet shuts it and runs.
    fireEvent.click(more);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sync mockup' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(api.sync).toHaveBeenCalledTimes(1);
    // The Mockup link opens the page beside the desk in a new tab.
    expect(sidebar().getByRole('link', { name: 'Mockup' }).getAttribute('href')).toBe('mockup.html');
  });

  it('the bell counts the unfiled and names them, up to six, with a door to each', async () => {
    const unclassified = Array.from({ length: 8 }, (_, i) => ({
      slug: `p${i}`, name: `Place ${i}`, status: 'pending', no_category: i % 2 === 0, no_vibe: true,
    }));
    api.progress.mockResolvedValue(progress({ total: 8, unclassified }));
    renderDesk('/');
    const bells = await screen.findAllByRole('button', { name: '8 places missing categories or vibes' });
    expect(bells).toHaveLength(2);
    const bell = bells[0];
    expect(bell.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(bell);
    const panel = screen.getByRole('dialog', { name: 'Missing categories or vibes' });
    expect(within(panel).getByText('8 places missing categories or vibes')).toBeTruthy();
    expect(within(panel).getAllByRole('link', { name: 'Fix' })).toHaveLength(6);
    expect(within(panel).getAllByText('pending · no categories · no vibes')).toHaveLength(3);
    expect(within(panel).getAllByText('pending · no vibes')).toHaveLength(3);
    expect(within(panel).getAllByText('pending · no categories · no vibes')[0].closest('.notifyrow').textContent).toContain('Place 0');
    expect(within(panel).getByRole('link', { name: '2 more →' }).getAttribute('href')).toBe('/?needs=1');
    expect(within(panel).getAllByRole('link', { name: 'Fix' })[1].getAttribute('href')).toBe('/place/p1');
    // Escape shuts it; so does a press outside; so does taking a door.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(bell);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(bell);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getAllByRole('link', { name: 'Fix' })[0]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Place' })).toBeTruthy();
  });

  it('one unfiled place is singular, and none is no bell at all', async () => {
    api.progress.mockResolvedValue(progress({ total: 1, unclassified: [{ slug: 'p', name: 'P', status: 'approved', no_category: true, no_vibe: false }] }));
    const { unmount } = renderDesk('/');
    fireEvent.click((await screen.findAllByRole('button', { name: '1 place missing categories or vibes' }))[0]);
    expect(screen.getByText('approved · no categories')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /more →/ })).toBeNull();
    unmount();
    api.progress.mockResolvedValue(progress({ total: 1 }));
    renderDesk('/');
    await screen.findByRole('group', { name: 'Filter by review status' });
    expect(screen.queryByRole('button', { name: /missing categories/ })).toBeNull();
  });

  it('the picker offers Ho Chi Minh City when the cities cannot be read, and remembers a choice', async () => {
    api.cities.mockRejectedValue(new Error('offline'));
    renderDesk('/analytics/contributors', { city: 'hanoi' });
    const picker = await screen.findByLabelText('City');
    expect([...picker.options].map((o) => o.value)).toEqual(['all', 'hcmc']);
    fireEvent.change(picker, { target: { value: 'all' } });
    expect(localStorage.getItem('citycrew.dashboard.city')).toBe('all');
  });

  it('the bar ducks after a committed scroll down and returns on a shorter scroll up', async () => {
    renderDesk('/');
    await screen.findByRole('heading', { name: 'Places' });
    const bar = document.querySelector('.tabbar');
    // Frames are synchronous here, and the page is tall enough to scroll.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(); return 1; });
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 5000 });
    const scrollTo = (y) => act(() => { window.scrollY = y; window.dispatchEvent(new Event('scroll')); });
    // Near the top the bar is always there.
    await scrollTo(20);
    expect(bar.className).not.toContain('ducked');
    // A committed descent hides it.
    await scrollTo(100);
    expect(bar.className).toContain('ducked');
    // Ten pixels back up is not a change of mind…
    await scrollTo(90);
    expect(bar.className).toContain('ducked');
    // …but fifteen, accumulated in the same direction, is.
    await scrollTo(85);
    expect(bar.className).not.toContain('ducked');
    // Going down again takes more conviction than coming back did: fifteen
    // is not enough, thirty in two steps is.
    await scrollTo(100);
    expect(bar.className).not.toContain('ducked');
    await scrollTo(115);
    expect(bar.className).toContain('ducked');
    // A scroll that goes nowhere changes nothing; the top always shows it.
    await scrollTo(115);
    expect(bar.className).toContain('ducked');
    await scrollTo(50);
    expect(bar.className).not.toContain('ducked');
    // Overscroll past the bottom is clamped, not read as a direction.
    await scrollTo(4300);
    expect(bar.className).toContain('ducked');
    await scrollTo(9000);
    expect(bar.className).toContain('ducked');
    // With the sheet open the bar stays put whatever the scroll.
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(bar.className).not.toContain('ducked');
  });

  it('publishes the top bar\'s height for whatever sticks below it', async () => {
    renderDesk('/');
    await screen.findByRole('heading', { name: 'Places' });
    expect(document.documentElement.style.getPropertyValue('--topbar-h')).toBe('0px');
  });
});
