// Round 4: two photographs, three answers, and one line to paste.
//
// Pinned here: the pair is shown as A and B under the kind's question,
// an answer moves on and is kept across a reload, Back returns to change
// one, a deleted photograph still takes an answer, no judge's pick is on
// the page, and the line is copied — or selected where the clipboard is
// refused.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { api } from '../src/api.js';
import { PAIRS_4 } from '../src/pairRound.js';
import { findToast, renderDesk } from './_ui/desk.jsx';

const KEY = 'citycrew.dashboard.photoPairs.r4';
const IDS = PAIRS_4.flatMap((p) => [p.a, p.b]);
const uris = Object.fromEntries(IDS.map((id, i) => [id, `https://x/${i}.jpg`]));
const choices = () => within(screen.getByRole('group', { name: 'Which is the better photograph?' }));

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('PhotoPairs', () => {
  it('shows the first pair as A and B, under its kind, with three answers', async () => {
    api.photoUris.mockResolvedValue(uris);
    renderDesk('/photo-pairs-4');
    expect(screen.getByText('Loading…')).toBeTruthy();
    const a = await screen.findByRole('img', { name: 'Pair 1, photograph A' });
    expect(a.getAttribute('src')).toBe('https://x/0.jpg');
    expect(screen.getByRole('img', { name: 'Pair 1, photograph B' }).getAttribute('src')).toBe('https://x/1.jpg');
    expect(screen.getByRole('heading', { name: 'Mặt tiền: ảnh nào đẹp hơn?' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Photo pairs · 4' })).toBeTruthy();
    expect(screen.getByText('1 / 60')).toBeTruthy();
    expect(choices().getAllByRole('button').map((b) => b.textContent)).toEqual(['A đẹp hơn', 'Ngang nhau', 'B đẹp hơn']);
    expect(api.photoUris).toHaveBeenCalledWith(IDS);
    // The next pair is already on its way.
    expect([...document.querySelectorAll('.pt-preload')].map((i) => i.getAttribute('src'))).toEqual(['https://x/2.jpg', 'https://x/3.jpg']);
    expect(screen.getByRole('button', { name: '‹ Back' }).disabled).toBe(true);
    // No judge's pick: nothing is chosen before the owner chooses.
    expect(document.querySelectorAll('.pt-btn.on')).toHaveLength(0);
  });

  it('moves on with an answer, keeps it across a reload, and goes back to change it', async () => {
    api.photoUris.mockResolvedValue(uris);
    const first = renderDesk('/photo-pairs-4');
    await screen.findByRole('img', { name: 'Pair 1, photograph A' });
    fireEvent.click(choices().getByRole('button', { name: 'B đẹp hơn' }));
    expect(screen.getByText('2 / 60')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Đồ ăn & uống: ảnh nào đẹp hơn?' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ 0: 'B' });
    first.unmount();

    // A reload picks up at the first unanswered pair.
    renderDesk('/photo-pairs-4');
    expect(await screen.findByText('2 / 60')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '‹ Back' }));
    expect(choices().getByRole('button', { name: 'B đẹp hơn' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(choices().getByRole('button', { name: 'Ngang nhau' }));
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ 0: '=' });
  });

  it('asks for "Ngang nhau" where a photograph has been deleted since the draw', async () => {
    api.photoUris.mockResolvedValue({ [PAIRS_4[0].a]: 'https://x/0.jpg' });
    renderDesk('/photo-pairs-4');
    expect(await screen.findByText(/This photograph has been deleted/)).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Pair 1, photograph B' })).toBeNull();
    // Nothing to fetch ahead for a pair whose files are gone.
    expect(document.querySelectorAll('.pt-preload')).toHaveLength(0);
  });

  it('starts over when the kept answers cannot be read', async () => {
    localStorage.setItem(KEY, '{not json');
    api.photoUris.mockResolvedValue(uris);
    renderDesk('/photo-pairs-4');
    expect(await screen.findByText('1 / 60')).toBeTruthy();
  });

  it('says so when the photos cannot be loaded', async () => {
    api.photoUris.mockRejectedValue(new Error('offline'));
    renderDesk('/photo-pairs-4');
    expect((await findToast()).textContent).toContain("Couldn't load the photos: offline");
  });

  it('ends on the line of answers, and copies it', async () => {
    localStorage.setItem(KEY, JSON.stringify({ 0: 'A', 1: '=' }));
    api.photoUris.mockResolvedValue(uris);
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderDesk('/photo-pairs-4');
    await screen.findByText('3 / 60');
    fireEvent.click(screen.getByRole('button', { name: 'Answers ›' }));
    expect(screen.getByText('2 / 60 answered')).toBeTruthy();
    const line = screen.getByLabelText('Answers');
    expect(line.value).toBe(`A=${'-'.repeat(58)}`);
    fireEvent.click(screen.getByRole('button', { name: 'Copy answers' }));
    expect((await findToast()).textContent).toContain('Copied');
    expect(writeText).toHaveBeenCalledWith(line.value);
    // Back from the answers is the last pair, with nothing after it.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('60 / 60')).toBeTruthy();
    expect(document.querySelectorAll('.pt-preload')).toHaveLength(0);
  });

  it('selects the line where the clipboard is refused', async () => {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(PAIRS_4.map((_, i) => [i, 'A']))));
    api.photoUris.mockResolvedValue(uris);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true });
    renderDesk('/photo-pairs-4');
    const line = await screen.findByLabelText('Answers');
    expect(line.value).toBe('A'.repeat(60));
    const select = vi.spyOn(line, 'select');
    fireEvent.click(screen.getByRole('button', { name: 'Copy answers' }));
    expect((await findToast()).textContent).toContain('use Copy');
    expect(select).toHaveBeenCalled();
  });
});
