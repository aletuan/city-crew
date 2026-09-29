// @vitest-environment jsdom
//
// The tip box under a collection's title. What is pinned: it waits for
// storage before it draws, shows one tip a visit and the next one on the
// next visit, never shows a tip that has stopped being true, and each way
// of retiring a tip keeps its promise. Which tip is due is `lib/tips`'s
// rule and has its own suite; these visits check the box follows it.

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';
import { LEGACY_REORDER_KEY, TIPS_KEY, type TipId } from '../lib/tips';

const state = vi.hoisted(() => ({ lang: 'vi' as 'en' | 'vi' | 'ja' }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({
    lang: state.lang,
    setLang: () => {},
    t: (en: string, vi: string, ja: string) => ({ en, vi, ja })[state.lang],
  }),
}));

import TipBox from './TipBox';

const OWNER: TipId[] = ['reorder', 'publish', 'edit', 'add'];
/** Let storage answer. */
const settle = () => act(async () => {});
/** Which tip is on screen, by its testID; null for none. */
const showing = () => document.querySelector('[data-testid^="tip-"]')?.getAttribute('data-testid')?.slice(4) ?? null;
/** One visit: open the screen, let it choose, and leave. */
const visit = async (eligible: TipId[] = OWNER, done: TipId[] = []) => {
  const view = render(<TipBox eligible={eligible} done={done} />);
  await settle();
  const tip = showing();
  view.unmount();
  return tip;
};
const stored = async () => JSON.parse((await AsyncStorage.getItem(TIPS_KEY))!);

beforeEach(async () => {
  state.lang = 'vi';
  await AsyncStorage.removeItem(TIPS_KEY);
  await AsyncStorage.removeItem(LEGACY_REORDER_KEY);
  vi.mocked(AsyncStorage.getItem).mockClear();
  vi.mocked(AsyncStorage.setItem).mockClear();
});

describe('one tip a visit', () => {
  it('waits for storage, then shows the first tip that applies', async () => {
    render(<TipBox eligible={OWNER} done={[]} />);
    // Not before: a tip drawn and then swapped is a flash.
    expect(showing()).toBeNull();
    await settle();
    expect(showing()).toBe('reorder');
    expect(screen.getByText(/^Mẹo/)).toBeTruthy();
    expect(screen.getByText('Giữ một địa điểm rồi kéo để đổi thứ tự. Thay đổi được lưu tự động.')).toBeTruthy();
  });

  it('shows the next tip on the next visit, and comes round again', async () => {
    const seen = [];
    for (let i = 0; i < 5; i++) seen.push(await visit());
    expect(seen).toEqual(['reorder', 'publish', 'edit', 'add', 'reorder']);
  });

  it('writes down what it showed, so the next visit knows', async () => {
    await visit();
    expect(await stored()).toEqual({ seq: 1, last: { reorder: 0 }, retired: [] });
  });

  // Each tip says what it is about, in the reader's language.
  it.each([
    ['publish', 'Bộ sưu tập này đang riêng tư. Bấm nút ba chấm (⋯) ở góc trên bên phải rồi chọn Công khai để ai cũng xem được.'],
    ['edit', 'Muốn đổi tên hay mô tả? Bấm nút ba chấm (⋯) ở góc trên bên phải rồi chọn Sửa bộ sưu tập.'],
    ['add', 'Bấm dấu trang trên thẻ địa điểm ở bất kỳ đâu để lưu vào đây, hoặc bấm nút ba chấm (⋯) ở góc trên bên phải rồi chọn Thêm địa điểm.'],
    ['copy', 'Thích danh sách này? Bấm nút ba chấm (⋯) ở góc trên bên phải rồi chọn Lưu bản sao để có một bản của riêng bạn và chỉnh theo ý mình.'],
  ] as const)('says the %s tip in words', async (id, text) => {
    render(<TipBox eligible={[id]} done={[]} />);
    await settle();
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('speaks English and Japanese too', async () => {
    state.lang = 'en';
    const view = render(<TipBox eligible={['edit']} done={[]} />);
    await settle();
    expect(screen.getByText('To rename it or change the description, tap the three-dot button (⋯) at the top right and choose Edit collection.')).toBeTruthy();
    expect(screen.getByText(/^Tip/)).toBeTruthy();
    view.unmount();
    state.lang = 'ja';
    render(<TipBox eligible={['copy']} done={[]} />);
    await settle();
    expect(screen.getByText(/^ヒント/)).toBeTruthy();
  });

  // The screen's list often arrives after storage has answered.
  it('waits for something to apply before choosing', async () => {
    const view = render(<TipBox eligible={[]} done={[]} />);
    await settle();
    expect(showing()).toBeNull();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    view.rerender(<TipBox eligible={['edit', 'add']} done={[]} />);
    await settle();
    expect(showing()).toBe('edit');
  });

  // Chosen once: a tip swapped while it is being read cannot be read.
  it('keeps its tip for the whole visit', async () => {
    const view = render(<TipBox eligible={OWNER} done={[]} />);
    await settle();
    view.rerender(<TipBox eligible={['publish', 'edit', 'reorder']} done={[]} />);
    await settle();
    expect(showing()).toBe('reorder');
    expect((await stored()).seq).toBe(1);
  });

  // The list it said was private has just been made public.
  it('goes when its tip stops being true, and shows nothing in its place', async () => {
    const view = render(<TipBox eligible={['publish', 'edit']} done={[]} />);
    await settle();
    expect(showing()).toBe('publish');
    view.rerender(<TipBox eligible={['edit']} done={[]} />);
    await settle();
    expect(showing()).toBeNull();
  });
});

describe('retiring', () => {
  it('goes at once when closed, and is never shown again', async () => {
    render(<TipBox eligible={OWNER} done={[]} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mẹo' }));
    expect(showing()).toBeNull();
    expect((await stored()).retired).toEqual(['reorder']);
    const seen = [];
    for (let i = 0; i < 4; i++) seen.push(await visit());
    expect(seen).not.toContain('reorder');
  });

  // Closing one tip is not closing the box: the others carry on.
  it('carries on with the others after one is closed', async () => {
    render(<TipBox eligible={OWNER} done={[]} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mẹo' }));
    expect(await visit()).toBe('publish');
  });

  // Retired for the next visit, not this one: pulling it out from under
  // the finger that just did it would shift every card up.
  it('retires a tip whose move was made, but keeps it on screen for this visit', async () => {
    const view = render(<TipBox eligible={OWNER} done={[]} />);
    await settle();
    view.rerender(<TipBox eligible={OWNER} done={['reorder']} />);
    await settle();
    expect(showing()).toBe('reorder');
    expect((await stored()).retired).toEqual(['reorder']);
    view.unmount();
    expect(await visit()).toBe('publish');
  });

  it('retires a move made while another tip is showing', async () => {
    const view = render(<TipBox eligible={OWNER} done={[]} />);
    await settle();
    view.rerender(<TipBox eligible={OWNER} done={['edit', 'add']} />);
    await settle();
    expect((await stored()).retired).toEqual(['edit', 'add']);
    view.unmount();
    expect([await visit(), await visit()]).toEqual(['publish', 'reorder']);
  });

  it('applies a move made before storage answered', async () => {
    render(<TipBox eligible={OWNER} done={['reorder']} />);
    await settle();
    expect((await stored()).retired).toEqual(['reorder']);
  });

  it('shows nothing once every tip that applies has retired', async () => {
    await AsyncStorage.setItem(TIPS_KEY, JSON.stringify({ seq: 0, last: {}, retired: OWNER }));
    expect(await visit()).toBeNull();
  });

  // The reorder tip kept its own flag before there was more than one tip.
  it('remembers a reorder tip retired under the old key', async () => {
    await AsyncStorage.setItem(LEGACY_REORDER_KEY, '1');
    expect(await visit()).toBe('publish');
  });
});

describe('when storage misbehaves', () => {
  // A tip whose ✕ cannot be remembered would come back after every close.
  it('shows nothing when the record cannot be read', async () => {
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
    expect(await visit()).toBeNull();
  });

  it('still closes when the write fails', async () => {
    vi.mocked(AsyncStorage.setItem).mockRejectedValue(new Error('disk'));
    render(<TipBox eligible={OWNER} done={[]} />);
    await settle();
    expect(showing()).toBe('reorder');
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mẹo' }));
    await settle();
    expect(showing()).toBeNull();
    vi.mocked(AsyncStorage.setItem).mockReset();
  });

  it('ignores an answer, or a failure, that arrives after it has gone', async () => {
    let answer!: (v: string | null) => void;
    vi.mocked(AsyncStorage.getItem).mockImplementationOnce(() => new Promise((r) => { answer = r; }));
    const first = render(<TipBox eligible={OWNER} done={[]} />);
    first.unmount();
    await act(async () => { answer(null); });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    let fail!: (e: Error) => void;
    vi.mocked(AsyncStorage.getItem).mockImplementationOnce(() => new Promise((_r, j) => { fail = j; }));
    const second = render(<TipBox eligible={OWNER} done={[]} />);
    second.unmount();
    await act(async () => { fail(new Error('late')); });
    expect(showing()).toBeNull();
  });
});
