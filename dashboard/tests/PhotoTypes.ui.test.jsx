// The photo-type round: a photograph, four answers, and one line to paste.
//
// Pinned here: an answer moves on and is kept across a reload, Back
// returns to change one, a deleted photograph still takes an answer, the
// rule's own guess is nowhere on the page, and the line is copied — or
// selected where the clipboard is refused.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { api } from '../src/api.js';
import { SAMPLE, SAMPLE_1B } from '../src/photoTypes.js';
import { findToast, renderDesk } from './_ui/desk.jsx';

const KEY = 'citycrew.dashboard.photoTypes.r1';
const uris = Object.fromEntries(SAMPLE.map((id, i) => [id, `https://x/${i}.jpg`]));
const kinds = () => within(screen.getByRole('group', { name: 'What is this photograph?' }));

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('PhotoTypes', () => {
  it('shows the first photograph, its place in the round, and four answers', async () => {
    api.photoUris.mockResolvedValue(uris);
    renderDesk('/photo-types');
    expect(screen.getByText('Loading…')).toBeTruthy();
    const photo = await screen.findByRole('img', { name: 'Photograph 1' });
    expect(photo.getAttribute('src')).toBe('https://x/0.jpg');
    expect(screen.getByText('1 / 100')).toBeTruthy();
    expect(kinds().getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Món ănFood', 'Địa điểmPlace', 'Phong cảnhScenery', 'Không rõNot sure',
    ]);
    expect(api.photoUris).toHaveBeenCalledWith(SAMPLE);
    // The next one is already on its way.
    expect(document.querySelector('.pt-preload').getAttribute('src')).toBe('https://x/1.jpg');
    expect(screen.getByRole('button', { name: '‹ Back' }).disabled).toBe(true);
  });

  it('moves on with an answer, keeps it across a reload, and goes back to change it', async () => {
    api.photoUris.mockResolvedValue(uris);
    const first = renderDesk('/photo-types');
    await screen.findByRole('img', { name: 'Photograph 1' });
    fireEvent.click(kinds().getByRole('button', { name: /Món ăn/ }));
    expect(screen.getByText('2 / 100')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ [SAMPLE[0]]: 'F' });
    first.unmount();

    // A reload picks up at the first unanswered one.
    renderDesk('/photo-types');
    expect(await screen.findByText('2 / 100')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '‹ Back' }));
    expect(screen.getByText('1 / 100')).toBeTruthy();
    expect(kinds().getByRole('button', { name: /Món ăn/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(kinds().getByRole('button', { name: /Phong cảnh/ }));
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ [SAMPLE[0]]: 'S' });
  });

  it('asks for "Not sure" on a photograph deleted since the sample was drawn', async () => {
    api.photoUris.mockResolvedValue({});
    renderDesk('/photo-types');
    expect(await screen.findByText(/This photograph has been deleted/)).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Photograph 1' })).toBeNull();
  });

  // The page never shows what the rule said: an answer beside a guess
  // leans toward it.
  it('shows no guess of its own', async () => {
    api.photoUris.mockResolvedValue(uris);
    renderDesk('/photo-types');
    await screen.findByRole('img', { name: 'Photograph 1' });
    expect(document.querySelectorAll('.pt-btn.on')).toHaveLength(0);
  });

  it('starts over when the kept answers cannot be read', async () => {
    localStorage.setItem(KEY, '{not json');
    api.photoUris.mockResolvedValue(uris);
    renderDesk('/photo-types');
    expect(await screen.findByText('1 / 100')).toBeTruthy();
  });

  it('says so when the photos cannot be loaded', async () => {
    api.photoUris.mockRejectedValue(new Error('offline'));
    renderDesk('/photo-types');
    expect((await findToast()).textContent).toContain("Couldn't load the photos: offline");
  });

  it('ends on the line of answers, and copies it', async () => {
    localStorage.setItem(KEY, JSON.stringify({ [SAMPLE[0]]: 'F', [SAMPLE[1]]: 'U' }));
    api.photoUris.mockResolvedValue(uris);
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderDesk('/photo-types');
    await screen.findByText('3 / 100');
    fireEvent.click(screen.getByRole('button', { name: 'Answers ›' }));
    expect(screen.getByText('2 / 100 answered')).toBeTruthy();
    const line = screen.getByLabelText('Answers');
    expect(line.value).toBe(`FU${'-'.repeat(98)}`);
    fireEvent.click(screen.getByRole('button', { name: 'Copy answers' }));
    expect((await findToast()).textContent).toContain('Copied');
    expect(writeText).toHaveBeenCalledWith(line.value);
    // Back from the answers is the last photograph.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('100 / 100')).toBeTruthy();
    expect(document.querySelector('.pt-preload')).toBeNull();
  });

  it('selects the line where the clipboard is refused', async () => {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(SAMPLE.map((id) => [id, 'P']))));
    api.photoUris.mockResolvedValue(uris);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true });
    renderDesk('/photo-types');
    const line = await screen.findByLabelText('Answers');
    const select = vi.spyOn(line, 'select');
    fireEvent.click(screen.getByRole('button', { name: 'Copy answers' }));
    expect((await findToast()).textContent).toContain('use Copy');
    expect(select).toHaveBeenCalled();
  });

  it('shows no definitions on round 1', async () => {
    api.photoUris.mockResolvedValue(uris);
    renderDesk('/photo-types');
    await screen.findByRole('img', { name: 'Photograph 1' });
    expect(screen.queryByRole('list', { name: 'Definitions' })).toBeNull();
  });

  // Round 1b: the place-or-scenery half again, under the definitions,
  // with answers kept apart from round 1's.
  it('asks round 1b under the definitions, and keeps its answers apart', async () => {
    localStorage.setItem(KEY, JSON.stringify({ [SAMPLE[0]]: 'F' }));
    api.photoUris.mockResolvedValue(uris);
    renderDesk('/photo-types-1b');
    const photo = await screen.findByRole('img', { name: 'Photograph 1' });
    expect(photo.getAttribute('src')).toBe(uris[SAMPLE_1B[0]]);
    expect(screen.getByText('1 / 57')).toBeTruthy();
    expect(api.photoUris).toHaveBeenCalledWith(SAMPLE_1B);
    const guide = screen.getByRole('list', { name: 'Definitions' });
    expect(guide.textContent).toContain('Nhà thờ hay mặt tiền dưới trời xanh vẫn là Địa điểm');
    expect(screen.getByRole('heading', { name: 'Photo types · 1b' })).toBeTruthy();
    fireEvent.click(kinds().getByRole('button', { name: /Phong cảnh/ }));
    expect(JSON.parse(localStorage.getItem('citycrew.dashboard.photoTypes.r1b'))).toEqual({ [SAMPLE_1B[0]]: 'S' });
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ [SAMPLE[0]]: 'F' });
    fireEvent.click(screen.getByRole('button', { name: 'Answers ›' }));
    expect(screen.getByLabelText('Answers').value).toBe(`S${'-'.repeat(56)}`);
    expect(screen.getByText(/Round 1b\./)).toBeTruthy();
  });

  it('carries its own name in the page head', async () => {
    api.photoUris.mockResolvedValue(uris);
    renderDesk('/photo-types');
    expect(await screen.findByRole('heading', { name: 'Photo types' })).toBeTruthy();
  });
});
