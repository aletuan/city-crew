// @vitest-environment jsdom
//
// The tip that says a list can be put in order by holding a card. What is
// pinned: it waits for storage before it draws, it is shown once and then
// never again, and each way of retiring it keeps its promise, whether the
// reader closes it or makes a move.

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '../uitest/render';

vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'vi', setLang: () => {}, t: (_en: string, vi: string) => vi }),
}));

import ReorderTip, { REORDER_TIP_KEY } from './ReorderTip';

const TIP = 'Giữ một địa điểm rồi kéo để đổi thứ tự. Thay đổi được lưu tự động.';
/** Let storage answer. */
const settle = () => act(async () => {});

beforeEach(async () => {
  vi.mocked(AsyncStorage.getItem).mockClear();
  vi.mocked(AsyncStorage.setItem).mockClear();
  await AsyncStorage.removeItem(REORDER_TIP_KEY);
});

describe('the first time', () => {
  it('shows, once storage has said it has not been seen', async () => {
    render(<ReorderTip show used={false} />);
    // Not before: a tip drawn and then withdrawn is a flash at everyone
    // who had already closed it.
    expect(screen.queryByText(TIP)).toBeNull();
    await settle();
    expect(screen.getByText(TIP)).toBeTruthy();
    expect(screen.getByText(/^Mẹo/)).toBeTruthy();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(REORDER_TIP_KEY);
  });

  it('shows nothing on a list that cannot be arranged', async () => {
    render(<ReorderTip show={false} used={false} />);
    await settle();
    expect(screen.queryByText(TIP)).toBeNull();
  });
});

describe('retiring', () => {
  it('goes at once when closed, and remembers', async () => {
    render(<ReorderTip show used={false} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mẹo' }));
    expect(screen.queryByText(TIP)).toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(REORDER_TIP_KEY, '1');
  });

  // Retired for the next visit, not this one: pulling it out from under
  // the finger that just dropped a card would shift every card up.
  it('stays through the visit a move was made on, and is gone the next time', async () => {
    const view = render(<ReorderTip show used={false} />);
    await settle();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    view.rerender(<ReorderTip show used />);
    await settle();
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(REORDER_TIP_KEY, '1');
    expect(screen.getByText(TIP)).toBeTruthy();
    view.unmount();

    render(<ReorderTip show used={false} />);
    await settle();
    expect(screen.queryByText(TIP)).toBeNull();
  });

  it('writes nothing for a move made before storage has answered', async () => {
    render(<ReorderTip show used />);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    await settle();
    // Once it has: the move retires it, as it would have.
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(REORDER_TIP_KEY, '1');
  });
});

describe('when storage misbehaves', () => {
  // A store that cannot be read cannot be written either, so a tip shown
  // here could never be dismissed for good.
  it('counts a failed read as seen', async () => {
    vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
    render(<ReorderTip show used={false} />);
    await settle();
    expect(screen.queryByText(TIP)).toBeNull();
  });

  it('closes even when the write fails', async () => {
    vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk'));
    render(<ReorderTip show used={false} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mẹo' }));
    await settle();
    expect(screen.queryByText(TIP)).toBeNull();
  });

  it('ignores an answer that arrives after it has gone', async () => {
    let answer!: (v: string | null) => void;
    vi.mocked(AsyncStorage.getItem).mockImplementationOnce(() => new Promise((r) => { answer = r; }));
    const view = render(<ReorderTip show used={false} />);
    view.unmount();
    await act(async () => { answer(null); });
    expect(screen.queryByText(TIP)).toBeNull();
  });

  it('ignores a failure that arrives after it has gone', async () => {
    let fail!: (e: Error) => void;
    vi.mocked(AsyncStorage.getItem).mockImplementationOnce(() => new Promise((_r, j) => { fail = j; }));
    const view = render(<ReorderTip show used={false} />);
    view.unmount();
    await act(async () => { fail(new Error('late')); });
    expect(screen.queryByText(TIP)).toBeNull();
  });
});
