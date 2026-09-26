// The list: the rail that asks, the rows that answer, and the batch.
//
// Everything the rail does lives in the URL, so most of what is pinned
// here is what a press does to the address — a filter sets its key and
// drops the page, the tile that is on turns off, a search lands after a
// pause — and what a row says about a place, which used to differ between
// the row, the card and the phone until Facts made it one account.

import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { api } from '../src/api.js';
import { EMPTY_PROGRESS } from './_ui/setup.jsx';
import { findToast, renderDesk } from './_ui/desk.jsx';

const place = (slug, extra = {}) => ({
  slug, name_en: slug, name_vi: `${slug} vi`, categories: ['cafes'], vibe_tags: [], neighborhood_en: 'District 1',
  review_status: 'pending', is_published: false, rating: 4.5, rating_count: 2100, price_vnd: null, price_display: null,
  cover_url: `https://x/${slug}.jpg`, photo_count: 3, channel: 'desk', submitter: null, is_featured: false, ...extra,
});

const ROWS = [
  place('cafe-a', { categories: ['cafes', 'views', 'focus'], vibe_tags: ['quiet'], price_display: '50–80k', is_featured: true,
    submitter: { handle: 'minh', full_name: 'Minh Anh' } }),
  place('bar-b', { categories: [], vibe_tags: ['nightlife', 'food_tour'], price_vnd: 120000, rating: null, rating_count: 0,
    cover_url: null, channel: null, review_status: 'approved' }),
  place('park-c', { price_vnd: 0, channel: 'mobile', submitter: { handle: 'an', full_name: null } }),
];
const PAGE = { rows: ROWS, total: 3, pageSize: 24 };

const PROGRESS = {
  ...EMPTY_PROGRESS, total: 3, by_status: { pending: 2, approved: 1 },
  by_category_tag: { cafes: 3, views: 1, focus: 1 }, by_vibe: { quiet: 1, nightlife: 1 }, by_threads: { yes: 0, no: 3 },
};

const rows = () => [...document.querySelectorAll('.prow')];
const cards = () => [...document.querySelectorAll('.gcard')];
const rail = () => within(screen.getByRole('complementary', { name: 'Filters' }));
const group = (label) => within(rail().getByRole('group', { name: label }));
const search = () => screen.getByRole('textbox', { name: 'Search places' });
const url = (router) => router.state.location.pathname + router.state.location.search;
const lastPlacesCall = () => api.places.mock.calls.at(-1)[0];

describe('PlaceList', () => {
  it('shows each place the same way: names, reviews, stamp, facts and where it came from', async () => {
    api.places.mockResolvedValue(PAGE);
    api.progress.mockResolvedValue(PROGRESS);
    const { router } = renderDesk('/');
    expect(screen.getByText('Loading places…')).toBeTruthy();
    await screen.findByText('cafe-a');
    expect(api.places).toHaveBeenCalledWith({ city: 'hcmc' });
    const [a, b, c] = rows();
    expect(a.getAttribute('href')).toBe('/place/cafe-a');
    expect(a.querySelector('.vi').textContent).toBe('cafe-a vi');
    expect(a.querySelector('.loc').textContent).toBe('District 1 · 4.5★ · 2.1k Google reviews');
    expect(b.querySelector('.loc').textContent).toBe('District 1 · —★ · no reviews');
    expect(within(a).getByText('featured')).toBeTruthy();
    expect(within(a).getByText('pending').className).toContain('stamp');
    // Two facts and the rest folded, with every one on the fold's title.
    const factsA = a.querySelector('.facts');
    expect([...factsA.querySelectorAll('.tag')].map((t) => t.textContent)).toEqual(['cafés', 'views', '+2']);
    expect(factsA.querySelector('.more').getAttribute('title')).toBe('cafés · views · focus · quiet');
    expect(factsA.textContent).toContain('3 photos');
    expect(factsA.textContent).toContain('50–80k');
    // The two warnings are never folded away; the three price rules.
    expect([...b.querySelector('.facts').querySelectorAll('.tag')].map((t) => t.textContent)).toEqual(['no category', 'nightlife', 'food tour']);
    expect(b.querySelector('.facts').textContent).toContain('120k₫');
    expect(c.querySelector('.facts').textContent).toContain('free');
    expect(c.querySelector('.facts').textContent).not.toContain('no price');
    expect(a.querySelector('.facts').textContent).not.toContain('no price');
    // Where it came from: channel and, when known, who.
    expect(a.querySelector('.srcchannel').textContent).toBe('desk');
    expect(a.querySelector('.srcchannel').getAttribute('title')).toBe('Searched for and imported here at the desk');
    expect(a.querySelector('.srcwho').textContent).toBe('@minh');
    expect(a.querySelector('.srcwho').getAttribute('title')).toBe('Added by Minh Anh');
    expect(b.querySelector('.srcmark')).toBeNull();
    expect(c.querySelector('.srcwho').getAttribute('title')).toBe('Added by an');
    // A row with no cover keeps its shape.
    expect(b.querySelector('img')).toBeNull();
    expect(b.querySelector('.thumb')).toBeTruthy();
    // No filter, no search: the tally would repeat the page head.
    expect(document.querySelector('.resultlead')).toBeNull();
    expect(url(router)).toBe('/');
  });

  it('the grid says the same things, and the layout is remembered', async () => {
    api.places.mockResolvedValue(PAGE);
    localStorage.setItem('citycrew.dashboard.view', 'grid');
    renderDesk('/');
    await screen.findByText('cafe-a');
    expect(cards()).toHaveLength(3);
    expect(rows()).toHaveLength(0);
    const [a, b] = cards();
    expect(a.querySelector('.gcard-meta').textContent).toBe('District 1 · 4.5★ · 2.1k');
    expect(b.querySelector('.gcard-meta').textContent).toBe('District 1 · —★');
    expect(within(a).getByText('featured')).toBeTruthy();
    expect(a.querySelector('.srcwho').textContent).toBe('@minh');
    expect(screen.getByRole('button', { name: 'Grid' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(rows()).toHaveLength(3);
    expect(localStorage.getItem('citycrew.dashboard.view')).toBe('row');
  });

  it('a search lands in the address after a pause, and drops the page', async () => {
    api.places.mockResolvedValue(PAGE);
    const { router } = renderDesk('/?page=2');
    await screen.findByText('cafe-a');
    // A pasted link to page 2 opens on page 2. It did not: the debounce
    // ran on arrival and took the page with it.
    await new Promise((r) => setTimeout(r, 300));
    expect(url(router)).toBe('/?page=2');
    expect(lastPlacesCall()).toEqual({ page: '2', city: 'hcmc' });
    fireEvent.change(search(), { target: { value: 'ph' } });
    fireEvent.change(search(), { target: { value: 'pho' } });
    expect(url(router)).toBe('/?page=2');
    await waitFor(() => expect(url(router)).toBe('/?q=pho'));
    expect(lastPlacesCall()).toEqual({ q: 'pho', city: 'hcmc' });
    // Now the tally says how many answered.
    expect(await screen.findByText('3 places')).toBeTruthy();
    fireEvent.change(search(), { target: { value: '' } });
    await waitFor(() => expect(url(router)).toBe('/'));
  });

  it('a filter row sets its key and drops the page; the row that is on turns off', async () => {
    api.places.mockResolvedValue(PAGE);
    api.progress.mockResolvedValue(PROGRESS);
    const { router } = renderDesk('/?page=2&sort=rating&dir=asc');
    await screen.findByText('cafe-a');
    const pending = group('Status').getByRole('checkbox', { name: /^Pending/ });
    expect(pending.textContent).toContain('2');
    expect(pending.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(pending);
    expect(url(router)).toBe('/?sort=rating&dir=asc&status=pending');
    expect(group('Status').getByRole('checkbox', { name: /^Pending/ }).getAttribute('aria-checked')).toBe('true');
    await waitFor(() => expect(lastPlacesCall()).toEqual({ sort: 'rating', dir: 'asc', status: 'pending', city: 'hcmc' }));
    // The chip over the results names it, in the rail's word, and removes it.
    const chip = screen.getByRole('button', { name: 'Remove filter Pending' });
    expect(chip.className).toContain('st-pending');
    expect(screen.getByRole('button', { name: /Filters/ }).querySelector('.filterbadge').textContent).toBe('1');
    fireEvent.click(group('Category').getByRole('checkbox', { name: /^cafés/ }));
    expect(url(router)).toBe('/?sort=rating&dir=asc&status=pending&category=cafes');
    fireEvent.click(group('Vibe').getByRole('checkbox', { name: /^food tour/ }));
    fireEvent.click(group('Threads').getByRole('checkbox', { name: /^No handle/ }));
    expect(url(router)).toBe('/?sort=rating&dir=asc&status=pending&category=cafes&vibe=food_tour&threads=no');
    expect(screen.getByRole('button', { name: 'Remove filter cafés' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove filter food tour' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove filter No handle' })).toBeTruthy();
    // Pressing the row again is off; the chip's cross is the same press.
    fireEvent.click(group('Status').getByRole('checkbox', { name: /^Pending/ }));
    expect(url(router)).toBe('/?sort=rating&dir=asc&category=cafes&vibe=food_tour&threads=no');
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter food tour' }));
    expect(url(router)).toBe('/?sort=rating&dir=asc&category=cafes&threads=no');
    // Reset clears the rail's keys and nothing else.
    fireEvent.click(rail().getByRole('button', { name: 'Reset' }));
    expect(url(router)).toBe('/?sort=rating&dir=asc');
    expect(screen.queryByRole('button', { name: /Remove filter/ })).toBeNull();
    // A late answer is behind the fold; the chip spells it the rail's way.
    fireEvent.click(rail().getByRole('button', { name: '+ Show 5 more' }));
    fireEvent.click(group('Vibe').getByRole('checkbox', { name: /^kid-friendly/ }));
    expect(screen.getByRole('button', { name: 'Remove filter kid-friendly' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(url(router)).toBe('/?sort=rating&dir=asc');
  });

  it('sorting writes both halves', async () => {
    api.places.mockResolvedValue(PAGE);
    const { router } = renderDesk('/?page=3');
    await screen.findByText('cafe-a');
    const sort = screen.getByRole('combobox', { name: 'Sort by' });
    expect(sort.value).toBe('created_at:desc');
    fireEvent.change(sort, { target: { value: 'rating_count:asc' } });
    expect(url(router)).toBe('/?sort=rating_count&dir=asc');
  });

  it('a long group shows six and offers the rest; a chosen answer is never folded away', async () => {
    api.places.mockResolvedValue(PAGE);
    const { unmount } = renderDesk('/');
    await screen.findByText('cafe-a');
    expect(group('Category').getAllByRole('checkbox')).toHaveLength(6);
    expect(group('Status').getAllByRole('checkbox')).toHaveLength(3);
    fireEvent.click(rail().getByRole('button', { name: '+ Show 3 more' }));
    expect(group('Category').getAllByRole('checkbox')).toHaveLength(9);
    fireEvent.click(rail().getByRole('button', { name: 'Show less' }));
    expect(group('Category').getAllByRole('checkbox')).toHaveLength(6);
    expect(group('Vibe').getAllByRole('checkbox')).toHaveLength(6);
    expect(rail().getByRole('button', { name: '+ Show 5 more' })).toBeTruthy();
    // Folding the section keeps only the row that is doing something.
    const head = rail().getByRole('button', { name: 'Status' });
    expect(head.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(head);
    expect(group('Status').queryAllByRole('checkbox')).toHaveLength(0);
    fireEvent.click(head);
    expect(group('Status').getAllByRole('checkbox')).toHaveLength(3);
    unmount();
    renderDesk('/?category=fun&status=flagged');
    await screen.findByText('cafe-a');
    // 'fun' is the ninth: the whole group opens and the offer is gone.
    expect(group('Category').getAllByRole('checkbox')).toHaveLength(9);
    expect(rail().queryByRole('button', { name: /Show 3 more/ })).toBeNull();
    fireEvent.click(rail().getByRole('button', { name: 'Status' }));
    expect(group('Status').getAllByRole('checkbox')).toHaveLength(1);
    expect(group('Status').getByRole('checkbox', { name: /^Flagged/ }).getAttribute('aria-checked')).toBe('true');
  });

  it('the city is asked with a box: accent-blind, Enter takes a single match, the chip clears to all', async () => {
    api.places.mockResolvedValue(PAGE);
    api.cityCounts.mockResolvedValue({ hcmc: 30, hanoi: 12 });
    renderDesk('/', { city: 'hcmc' });
    await screen.findByText('cafe-a');
    const box = screen.getByRole('combobox', { name: 'Search cities' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.focus(box);
    const options = within(screen.getByRole('listbox', { name: 'Cities' })).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['All cities42', 'TP.HCM30', 'Hà Nội12', 'Đà Nẵng0']);
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('TP.HCM', { selector: '.citychip' })).toBeTruthy();
    fireEvent.change(box, { target: { value: 'da' } });
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Đà Nẵng0']);
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(localStorage.getItem('citycrew.dashboard.city')).toBe('danang');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box.value).toBe('');
    expect(screen.getByText('Đà Nẵng', { selector: '.citychip' })).toBeTruthy();
    await waitFor(() => expect(lastPlacesCall()).toEqual({ city: 'danang' }));
    // Nothing by that name; Escape closes and clears; Enter on many does nothing.
    fireEvent.change(box, { target: { value: 'zzz' } });
    expect(screen.getByText('No city by that name.')).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box.value).toBe('');
    fireEvent.change(box, { target: { value: 'h' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(localStorage.getItem('citycrew.dashboard.city')).toBe('danang');
    // The chevron opens and shuts it; a press elsewhere shuts it.
    fireEvent.keyDown(box, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Show cities' }));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hide cities' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show cities' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
    // Clearing the chip is all cities, which is this filter's off.
    fireEvent.click(screen.getByRole('button', { name: 'Clear Đà Nẵng' }));
    expect(localStorage.getItem('citycrew.dashboard.city')).toBe('all');
    expect(screen.queryByText('All cities', { selector: '.citychip' })).toBeNull();
    await waitFor(() => expect(lastPlacesCall()).toEqual({ city: undefined }));
    // The heading folds this group too.
    fireEvent.click(rail().getByRole('button', { name: 'City' }));
    expect(screen.queryByRole('combobox', { name: 'Search cities' })).toBeNull();
  });

  it('a city switch drops the page, and a failed counts read leaves the rows pressable', async () => {
    api.places.mockResolvedValue(PAGE);
    api.cityCounts.mockRejectedValue(new Error('rls'));
    const { router } = renderDesk('/?page=2', { city: 'hcmc' });
    await screen.findByText('cafe-a');
    fireEvent.focus(screen.getByRole('combobox', { name: 'Search cities' }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Hà Nội/ }));
    await waitFor(() => expect(url(router)).toBe('/'));
    expect(lastPlacesCall()).toEqual({ city: 'hanoi' });
  });

  it('a batch: select, select all, approve, and the selection resets with the results', async () => {
    api.places.mockResolvedValue(PAGE);
    api.approvePlaces.mockResolvedValue({ ok: true, approved: 2 });
    renderDesk('/');
    await screen.findByText('cafe-a');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select cafe-a' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select bar-b' }));
    expect(screen.getByText('2 selected')).toBeTruthy();
    // Selecting did not follow the row's link.
    expect(screen.getByRole('heading', { name: 'Places' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Select cafe-a' }).checked).toBe(true);
    expect(document.querySelector('.worktop').className).toContain('pinned');
    fireEvent.click(screen.getByRole('button', { name: 'Select all 3 on page' }));
    expect(screen.getByText('3 selected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Deselect all' }));
    expect(screen.queryByText(/selected/)).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select cafe-a' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select cafe-a' }));
    expect(screen.queryByText(/selected/)).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select cafe-a' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select park-c' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/selected/)).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select cafe-a' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select park-c' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve 2' }));
    expect(api.approvePlaces).toHaveBeenCalledWith(['cafe-a', 'park-c']);
    expect((await findToast()).textContent).toBe('Approved 2 places');
    await waitFor(() => expect(document.querySelector('.resultscount')).toBeNull());
    // Read once on arrival, once when the city resolved, once for the batch.
    await waitFor(() => expect(api.places).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(api.progress).toHaveBeenCalledTimes(2));
  });

  it('approving what is already approved says so, and a failure says why', async () => {
    api.places.mockResolvedValue(PAGE);
    api.approvePlaces.mockResolvedValueOnce({ ok: true, approved: 0 });
    renderDesk('/');
    await screen.findByText('cafe-a');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select bar-b' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve 1' }));
    expect((await findToast()).textContent).toBe('Nothing to approve — everything selected already was');
    api.approvePlaces.mockRejectedValueOnce(new Error('rls'));
    await waitFor(() => expect(document.querySelector('.resultscount')).toBeNull());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select bar-b' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve 1' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Approve failed: rls'));
    expect(screen.getByText('1 selected')).toBeTruthy();
  });

  it('deleting asks, then reports what went and what the bucket kept', async () => {
    api.places.mockResolvedValue(PAGE);
    api.deletePlaces.mockResolvedValue({ ok: true, deleted: 2, removed_uploads: 1, left: ['a.jpg'] });
    const { router } = renderDesk('/?page=2');
    await screen.findByText('cafe-a');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select cafe-a' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select bar-b' }));
    window.confirm.mockReturnValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Delete 2 places permanently?'));
    expect(api.deletePlaces).not.toHaveBeenCalled();
    expect(screen.getByText('2 selected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete 2' }));
    expect(api.deletePlaces).toHaveBeenCalledWith(['cafe-a', 'bar-b']);
    expect((await findToast()).textContent).toBe('Deleted 2 places — 1 photo file could not be removed from Storage and is now orphaned');
    await waitFor(() => expect(url(router)).toBe('/'));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    await waitFor(() => expect(screen.queryByText(/selected/)).toBeNull());
  });

  it('a delete that fails keeps the selection and says why', async () => {
    api.places.mockResolvedValue(PAGE);
    api.deletePlaces.mockRejectedValue(new Error('rls'));
    renderDesk('/');
    await screen.findByText('cafe-a');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select cafe-a' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1' }));
    expect((await findToast()).textContent).toBe('Delete failed: rls');
    expect(screen.getByText('1 selected')).toBeTruthy();
  });

  it('pages, and the page lives in the address', async () => {
    api.places.mockResolvedValue({ rows: ROWS, total: 50, pageSize: 24 });
    const { router } = renderDesk('/?status=pending');
    await screen.findByText('cafe-a');
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous page' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(url(router)).toBe('/?status=pending&page=2');
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    await waitFor(() => expect(lastPlacesCall()).toEqual({ status: 'pending', page: '2', city: 'hcmc' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Page 3 of 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next page' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(url(router)).toBe('/?status=pending');
  });

  it('says when nothing matched, and when the list could not be read', async () => {
    api.places.mockResolvedValue({ rows: [], total: 0, pageSize: 24 });
    renderDesk('/?status=flagged');
    expect(await screen.findByText(/No places match these filters/)).toBeTruthy();
    expect(screen.getByText('0 places')).toBeTruthy();
    api.places.mockRejectedValueOnce(new Error('jwt expired'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter Flagged' }));
    expect(await screen.findByText(/Couldn't load places: jwt expired/)).toBeTruthy();
    api.places.mockResolvedValue(PAGE);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('cafe-a')).toBeTruthy();
  });

  it('on a phone the rail is a sheet: opened by the button, shut by Escape, the backdrop, its cross, or width', async () => {
    api.places.mockResolvedValue(PAGE);
    let onChange;
    const mq = { matches: false, addEventListener: (_e, fn) => { onChange = fn; }, removeEventListener: vi.fn() };
    window.matchMedia = vi.fn(() => mq);
    renderDesk('/');
    await screen.findByText('cafe-a');
    const aside = screen.getByRole('complementary', { name: 'Filters' });
    const open = () => fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    open();
    expect(aside.className).toContain('open');
    expect(screen.getByRole('button', { name: /Filters/ }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(aside.className).not.toContain('open');
    open();
    fireEvent.click(document.querySelector('.sheetback'));
    expect(aside.className).not.toContain('open');
    open();
    fireEvent.click(rail().getByRole('button', { name: 'Close filters' }));
    expect(aside.className).not.toContain('open');
    open();
    mq.matches = true;
    act(() => onChange());
    expect(aside.className).not.toContain('open');
  });

  it('publishes the toolbar\'s height while it is on the page, and takes it back when it goes', async () => {
    api.places.mockResolvedValue(PAGE);
    const { router } = renderDesk('/');
    await screen.findByText('cafe-a');
    expect(document.documentElement.style.getPropertyValue('--worktop-h')).toBe('0px');
    await act(async () => { router.navigate('/reports'); });
    await screen.findByRole('heading', { name: 'Reports' });
    expect(document.documentElement.style.getPropertyValue('--worktop-h')).toBe('');
  });
});
