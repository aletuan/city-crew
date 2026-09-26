// Contributors: the leaderboard, the cards and the chart, all folds over
// the same rows (contributors.js, tested as functions).
//
// What is pinned here is the screen around those folds: that the board
// follows the desk's city, that the guide checkbox ticks before the write
// and unticks if the write is refused, and that the chart's hover finds a
// line and says whose it is.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { api } from '../src/api.js';
import { renderDesk } from './_ui/desk.jsx';

const today = new Date();
const daysAgo = (n) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - n, 12);
  return d.toISOString();
};

const ROWS = [
  { added_by: 'u1', city_id: 'hcmc', created_at: daysAgo(0) },
  { added_by: 'u1', city_id: 'hcmc', created_at: daysAgo(3) },
  { added_by: 'u1', city_id: 'hanoi', created_at: daysAgo(1) },
  { added_by: 'u2', city_id: 'hcmc', created_at: daysAgo(10) },
];
const PROFILES = { u1: { handle: 'minh', full_name: 'Minh Anh' } };

const boardRows = () => [...document.querySelectorAll('.boardrow')];
const guideBox = (handle) => within(boardRows().find((r) => r.textContent.includes(`@${handle}`))).getByRole('checkbox');

describe('Contributors', () => {
  it('loads, then says what it could not', async () => {
    let finish;
    api.contributors.mockReturnValue(new Promise((r) => { finish = r; }));
    renderDesk('/analytics/contributors');
    expect(await screen.findByText('Loading contributors…')).toBeTruthy();
    finish({ rows: ROWS, profiles: PROFILES });
    expect(await screen.findByText('@minh')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Contributors' })).toBeTruthy();
  });

  it('a failed read offers Retry, and Retry re-reads both the board and the guides', async () => {
    api.contributors.mockRejectedValueOnce(new Error('offline'));
    api.contributors.mockResolvedValue({ rows: ROWS, profiles: PROFILES });
    renderDesk('/analytics/contributors');
    expect(await screen.findByText(/Couldn’t load contributors: offline/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('@minh')).toBeTruthy();
    expect(api.contributors).toHaveBeenCalledTimes(2);
    // "@minh" is the board's; the guides are their own read and can trail it.
    await waitFor(() => expect(api.localGuides).toHaveBeenCalledTimes(2));
  });

  it('cards for every city, and a board ranked within the desk\'s city', async () => {
    api.contributors.mockResolvedValue({ rows: ROWS, profiles: PROFILES });
    renderDesk('/analytics/contributors', { city: 'hcmc' });
    await screen.findByText('@minh');
    const cards = [...document.querySelectorAll('.contribcard')];
    expect(cards.map((c) => c.textContent)).toEqual([
      'All cities · Total42 contributors',
      'TP.HCM32 contributors',
      'Hà Nội11 contributor',
      'Đà Nẵng00 contributors',
    ]);
    expect(screen.getByText(/the top 10 within TP. Hồ Chí Minh/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Top 2 · TP. Hồ Chí Minh' })).toBeTruthy();
    expect(screen.getByText('3 of 3 · 100%')).toBeTruthy();
    // Ranked by the city's count; the breakdown rides on the handle's title;
    // a missing profile shows the id's front.
    const rows = boardRows();
    expect(rows.map((r) => r.querySelector('.boardhandle').textContent)).toEqual(['@minh', '@u2']);
    expect(rows.map((r) => r.querySelector('.boardtotal').textContent)).toEqual(['2', '1']);
    expect(rows[0].querySelector('.boardhandle').getAttribute('title')).toBe('hcm 2');
    expect(rows[0].getAttribute('title')).toBe('Minh Anh');
  });

  it('on all cities the board is everyone, and the picker re-ranks it', async () => {
    api.contributors.mockResolvedValue({ rows: ROWS, profiles: PROFILES });
    renderDesk('/analytics/contributors', { city: 'all' });
    await screen.findByText('@minh');
    expect(screen.getByText(/all cities combined/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Top 2 · all cities' })).toBeTruthy();
    expect(boardRows()[0].querySelector('.boardhandle').getAttribute('title')).toBe('hcm 2 · hn 1');
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'hanoi' } });
    expect(await screen.findByRole('heading', { name: 'Top 1 · Hà Nội' })).toBeTruthy();
    expect(boardRows()).toHaveLength(1);
  });

  it('a scope with nothing in it says so instead of drawing a chart', async () => {
    api.contributors.mockResolvedValue({ rows: ROWS, profiles: PROFILES });
    renderDesk('/analytics/contributors', { city: 'danang' });
    expect(await screen.findByText(/Nothing from the app reached approved · published in Đà Nẵng these 30 days/)).toBeTruthy();
    expect(screen.getByText('No contributors yet.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Top 10 · Đà Nẵng' })).toBeTruthy();
    expect(document.querySelector('.contribchart')).toBeNull();
  });

  it('the guide box ticks before the write, and unticks if the write is refused', async () => {
    api.contributors.mockResolvedValue({ rows: ROWS, profiles: PROFILES });
    api.localGuides.mockResolvedValue(new Map([['u2', new Set(['hanoi'])]]));
    let finish;
    api.setLocalGuide.mockReturnValueOnce(new Promise((r) => { finish = r; }));
    renderDesk('/analytics/contributors', { city: 'hcmc' });
    await screen.findByText('@minh');
    await waitFor(() => expect(guideBox('minh').disabled).toBe(false));
    // A guide of Hanoi is not a guide here.
    expect(guideBox('u2').checked).toBe(false);
    expect(guideBox('minh').closest('label').getAttribute('title')).toBe('Let @minh add photos to places they imported in TP. Hồ Chí Minh');
    fireEvent.click(guideBox('minh'));
    expect(guideBox('minh').checked).toBe(true);
    expect(guideBox('minh').disabled).toBe(true);
    expect(api.setLocalGuide).toHaveBeenCalledWith('u1', true, 'hcmc');
    finish(true);
    await waitFor(() => expect(guideBox('minh').disabled).toBe(false));
    expect(guideBox('minh').closest('label').getAttribute('title')).toBe('@minh may add photos to places they imported in TP. Hồ Chí Minh');
    // Unticking is refused: the box unticks at once, then goes back to
    // ticked — the database still says guide — and the reason is shown.
    api.setLocalGuide.mockRejectedValueOnce(new Error('not an editor'));
    fireEvent.click(guideBox('minh'));
    expect(guideBox('minh').checked).toBe(false);
    expect(api.setLocalGuide).toHaveBeenLastCalledWith('u1', false, 'hcmc');
    expect(await screen.findByText(/not an editor/)).toBeTruthy();
    await waitFor(() => expect(guideBox('minh').checked).toBe(true));
  });

  it('on all cities the grant is for everywhere, and a guide everywhere is locked on one city', async () => {
    api.contributors.mockResolvedValue({ rows: ROWS, profiles: PROFILES });
    api.localGuides.mockResolvedValue(new Map([['u1', new Set([null])]]));
    renderDesk('/analytics/contributors', { city: 'all' });
    await screen.findByText('@minh');
    await waitFor(() => expect(guideBox('u2').disabled).toBe(false));
    expect(guideBox('minh').checked).toBe(true);
    expect(guideBox('minh').disabled).toBe(false);
    expect(guideBox('u2').closest('label').getAttribute('title')).toBe('Let @u2 add photos to places they imported in every city');
    fireEvent.click(guideBox('u2'));
    expect(api.setLocalGuide).toHaveBeenCalledWith('u2', true, null);
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'hcmc' } });
    await screen.findByRole('heading', { name: 'Top 2 · TP. Hồ Chí Minh' });
    expect(guideBox('minh').checked).toBe(true);
    expect(guideBox('minh').disabled).toBe(true);
    expect(guideBox('minh').closest('label').getAttribute('title')).toBe('@minh is a guide in every city — switch to All cities to change it');
  });

  it('the boxes wait for the grants, and a grants read that fails leaves them empty', async () => {
    api.contributors.mockResolvedValue({ rows: ROWS, profiles: PROFILES });
    api.localGuides.mockRejectedValue(new Error('rls'));
    renderDesk('/analytics/contributors');
    await screen.findByText('@minh');
    await waitFor(() => expect(guideBox('minh').disabled).toBe(false));
    expect(guideBox('minh').checked).toBe(false);
  });

  it('the chart names the line under the cursor, and the board row lights it', async () => {
    api.contributors.mockResolvedValue({ rows: ROWS, profiles: PROFILES });
    renderDesk('/analytics/contributors', { city: 'hcmc' });
    await screen.findByText('@minh');
    const svg = document.querySelector('.contribchart');
    expect(svg.getAttribute('aria-label')).toContain('top 2 contributors and the 2-contributor total');
    expect(screen.getByText(/all 2 contributors · right axis/)).toBeTruthy();
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 760, height: 380 });
    // The right edge is today; the bottom of the plot is where the smaller
    // line ends (1 place on a 3-place axis), the top is where the total is.
    fireEvent.mouseMove(svg, { clientX: 759, clientY: 350 });
    let tip = document.querySelector('.contribtip');
    expect(tip.textContent).toContain('@u2 · 1');
    expect(tip.textContent).toContain('all · 3');
    expect(tip.style.transform).toContain('-100%');
    fireEvent.mouseMove(svg, { clientX: 759, clientY: 30 });
    tip = document.querySelector('.contribtip');
    expect(tip.querySelector('.tiprow:not(.tipall)')).toBeNull();
    // Off the chart, the tooltip goes.
    fireEvent.mouseLeave(svg.parentElement);
    expect(document.querySelector('.contribtip')).toBeNull();
    // Far left is the window's first day, and the tip sits to the right.
    fireEvent.mouseMove(svg, { clientX: 1, clientY: 350 });
    expect(document.querySelector('.contribtip').style.transform).toContain('8px');
    // Hovering a board row lights it and dims the others' lines.
    fireEvent.mouseLeave(svg.parentElement);
    fireEvent.mouseEnter(boardRows()[1]);
    expect(boardRows()[1].className).toContain('hot');
    expect(document.querySelector('.contribtip')).toBeNull();
    fireEvent.mouseLeave(boardRows()[1]);
    expect(boardRows()[1].className).not.toContain('hot');
  });
});
