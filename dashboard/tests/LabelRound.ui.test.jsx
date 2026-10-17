// Round 3: a photograph, seven kinds, six criteria, Next, and one line to
// paste.
//
// Pinned here: Next waits for a kind, a criterion steps no → yes → can't
// tell, answers survive a reload, Back returns to change one, the page
// shows no answer of its own, and the line is copied — or selected where
// the clipboard is refused.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { api } from '../src/api.js';
import { SAMPLE_3, SAMPLE_3B } from '../src/labelRound.js';
import { findToast, renderDesk } from './_ui/desk.jsx';

const KEY = 'citycrew.dashboard.photoLabels.r3';
const uris = Object.fromEntries(SAMPLE_3.map((id, i) => [id, `https://z/${i}.jpg`]));
const kinds = () => within(screen.getByRole('group', { name: 'What is this photograph?' }));
const criteria = () => within(screen.getByRole('group', { name: 'Cover criteria' }));
const next = () => screen.getByRole('button', { name: 'Tiếp ›' });

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('LabelRound', () => {
  it('shows the first photograph, seven kinds, six criteria at no, and Next held', async () => {
    api.photoUris.mockResolvedValue(uris);
    renderDesk('/photo-types-3');
    expect(screen.getByText('Loading…')).toBeTruthy();
    const photo = await screen.findByRole('img', { name: 'Photograph 1' });
    expect(photo.getAttribute('src')).toBe('https://z/0.jpg');
    expect(screen.getByText('1 / 137')).toBeTruthy();
    expect(api.photoUris).toHaveBeenCalledWith(SAMPLE_3);
    expect(kinds().getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Đồ ănFood', 'Nội thấtInterior', 'Mặt tiềnExterior', 'Phong cảnhView', 'ChữText', 'KhácOther', 'Không chắcNot sure',
    ]);
    expect(criteria().getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Biển hiệu: Không', 'Thấy cả không gian: Không', 'Cây xanh: Không', 'Ánh sáng ngày: Không', 'Người: Không', 'Dàn dựng: Không',
    ]);
    expect(next().disabled).toBe(true);
    expect(document.querySelector('.pt-preload').getAttribute('src')).toBe('https://z/1.jpg');
    expect(screen.getByRole('heading', { name: 'Photo types · 3' })).toBeTruthy();
    // The page shows no answer of its own: nothing chosen, nothing yes.
    expect(document.querySelectorAll('.pt-btn.on, .lr-attr.s1, .lr-attr.sq')).toHaveLength(0);
  });

  it('steps a criterion through its three answers, and moves on only with a kind', async () => {
    api.photoUris.mockResolvedValue(uris);
    const first = renderDesk('/photo-types-3');
    await screen.findByRole('img', { name: 'Photograph 1' });
    fireEvent.click(criteria().getByRole('button', { name: 'Thấy cả không gian: Không' }));
    fireEvent.click(criteria().getByRole('button', { name: 'Ánh sáng ngày: Không' }));
    fireEvent.click(criteria().getByRole('button', { name: 'Ánh sáng ngày: Có' }));
    expect(criteria().getByRole('button', { name: 'Ánh sáng ngày: Không rõ' })).toBeTruthy();
    expect(next().disabled).toBe(true);
    fireEvent.click(kinds().getByRole('button', { name: /Nội thất/ }));
    expect(kinds().getByRole('button', { name: /Nội thất/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(next());
    expect(screen.getByText('2 / 137')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({
      [SAMPLE_3[0]]: { kind: 'I', attrs: { wide: '1', daylight: '?' } },
    });
    first.unmount();

    // A reload picks up at the first photograph without a kind, and Back
    // shows the answer as it was left.
    renderDesk('/photo-types-3');
    expect(await screen.findByText('2 / 137')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '‹ Back' }));
    expect(screen.getByText('1 / 137')).toBeTruthy();
    expect(criteria().getByRole('button', { name: 'Thấy cả không gian: Có' })).toBeTruthy();
    fireEvent.click(criteria().getByRole('button', { name: 'Ánh sáng ngày: Không rõ' }));
    expect(JSON.parse(localStorage.getItem(KEY))[SAMPLE_3[0]].attrs.daylight).toBe('0');
  });

  it('keeps the definitions folded under the photograph', async () => {
    api.photoUris.mockResolvedValue(uris);
    renderDesk('/photo-types-3');
    await screen.findByRole('img', { name: 'Photograph 1' });
    const guide = screen.getByRole('list', { name: 'Definitions', hidden: true });
    expect(guide.closest('details').open).toBe(false);
    expect(guide.textContent).toContain('Nhà thờ, bảo tàng dưới trời xanh vẫn là Mặt tiền');
    expect(guide.textContent).toContain('Dàn dựng:');
  });

  it('asks for "Không chắc" on a photograph deleted since the sample was drawn', async () => {
    api.photoUris.mockResolvedValue({});
    renderDesk('/photo-types-3');
    expect(await screen.findByText(/This photograph has been deleted/)).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Photograph 1' })).toBeNull();
  });

  it('starts over when the kept answers cannot be read', async () => {
    localStorage.setItem(KEY, '{not json');
    api.photoUris.mockResolvedValue(uris);
    renderDesk('/photo-types-3');
    expect(await screen.findByText('1 / 137')).toBeTruthy();
  });

  it('says so when the photos cannot be loaded', async () => {
    api.photoUris.mockRejectedValue(new Error('offline'));
    renderDesk('/photo-types-3');
    expect((await findToast()).textContent).toContain("Couldn't load the photos: offline");
  });

  it('ends on the line of answers, and copies it', async () => {
    localStorage.setItem(KEY, JSON.stringify({
      [SAMPLE_3[0]]: { kind: 'E', attrs: { brand: '1', wide: '1' } },
      [SAMPLE_3[1]]: { kind: 'U' },
    }));
    api.photoUris.mockResolvedValue(uris);
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderDesk('/photo-types-3');
    await screen.findByText('3 / 137');
    fireEvent.click(screen.getByRole('button', { name: 'Answers ›' }));
    expect(screen.getByText('2 / 137 answered')).toBeTruthy();
    expect(screen.getByText(/Round 3\./)).toBeTruthy();
    const line = screen.getByLabelText('Answers');
    expect(line.value).toBe(['E110000', 'U000000', ...Array(135).fill('-------')].join(' '));
    fireEvent.click(screen.getByRole('button', { name: 'Copy answers' }));
    expect((await findToast()).textContent).toContain('Copied');
    expect(writeText).toHaveBeenCalledWith(line.value);
    // Back from the answers is the last photograph, with nothing after it
    // to fetch.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('137 / 137')).toBeTruthy();
    expect(document.querySelector('.pt-preload')).toBeNull();
  });

  it('selects the line where the clipboard is refused', async () => {
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(SAMPLE_3.map((id) => [id, { kind: 'F' }]))));
    api.photoUris.mockResolvedValue(uris);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true });
    renderDesk('/photo-types-3');
    const line = await screen.findByLabelText('Answers');
    const select = vi.spyOn(line, 'select');
    fireEvent.click(screen.getByRole('button', { name: 'Copy answers' }));
    expect((await findToast()).textContent).toContain('use Copy');
    expect(select).toHaveBeenCalled();
  });

  // Round 3b: the criteria alone. No kinds to choose, so Next is open from
  // the start and is what marks a photograph answered; each chip carries
  // its definition, and the answers are kept apart from round 3's.
  it('asks round 3b the criteria alone, with their definitions, and keeps its answers apart', async () => {
    localStorage.setItem(KEY, JSON.stringify({ [SAMPLE_3[0]]: { kind: 'F' } }));
    api.photoUris.mockResolvedValue(Object.fromEntries(SAMPLE_3B.map((id, i) => [id, `https://b/${i}.jpg`])));
    renderDesk('/photo-types-3b');
    const photo = await screen.findByRole('img', { name: 'Photograph 1' });
    expect(photo.getAttribute('src')).toBe('https://b/0.jpg');
    expect(screen.getByText('1 / 40')).toBeTruthy();
    expect(api.photoUris).toHaveBeenCalledWith(SAMPLE_3B);
    expect(screen.getByRole('heading', { name: 'Photo types · 3b' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'What is this photograph?' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Definitions', hidden: true })).toBeNull();
    expect(criteria().getByRole('button', { name: 'Người: Không' }).textContent).toContain('Thấy bất kỳ người nào');
    expect(next().disabled).toBe(false);
    fireEvent.click(criteria().getByRole('button', { name: 'Người: Không' }));
    fireEvent.click(next());
    expect(screen.getByText('2 / 40')).toBeTruthy();
    fireEvent.click(next());
    expect(JSON.parse(localStorage.getItem('citycrew.dashboard.photoLabels.r3b'))).toEqual({
      [SAMPLE_3B[0]]: { attrs: { people: '1' }, seen: true },
      [SAMPLE_3B[1]]: { seen: true },
    });
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ [SAMPLE_3[0]]: { kind: 'F' } });
    fireEvent.click(screen.getByRole('button', { name: 'Answers ›' }));
    expect(screen.getByText('2 / 40 answered')).toBeTruthy();
    expect(screen.getByText(/Round 3b\./)).toBeTruthy();
    expect(screen.getByLabelText('Answers').value).toBe(['000010', '000000', ...Array(38).fill('------')].join(' '));
  });
});
