// @vitest-environment jsdom
//
// The grid notice's two memories, the phone's and the account's — see the
// header of `gridNotice.tsx`.

import React, { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '../uitest/render';
import { useGridNotice, type NoticeState } from './gridNotice';

const account = vi.hoisted(() => ({
  closed: vi.fn(async (_id: string): Promise<boolean> => false),
  close: vi.fn(async (_id: string) => {}),
}));
vi.mock('./data', () => ({ fetchGridNoticeClosed: account.closed, closeGridNotice: account.close }));

const PHONE = 'citycrew.collection.gridNotice.v2';
const MINE = `${PHONE}:u1`;

const seen = {} as { state: NoticeState; close: () => void };
function Probe({ reader }: { reader: string | null | undefined }) {
  const notice = useGridNotice(reader);
  useEffect(() => { seen.state = notice.state; seen.close = notice.close; });
  return null;
}
/** Every read and answer in. */
const settle = () => act(async () => {});

beforeEach(() => {
  vi.clearAllMocks();
  account.closed.mockImplementation(async () => false);
  account.close.mockImplementation(async () => {});
});
afterEach(async () => {
  for (const k of [PHONE, MINE, `${PHONE}:u2`]) await AsyncStorage.removeItem(k);
});

describe('nobody signed in', () => {
  it('is the phone’s alone: open until closed, and the account never asked', async () => {
    render(<Probe reader={null} />);
    await settle();
    expect(seen.state).toBe('open');
    act(() => seen.close());
    expect(seen.state).toBe('closed');
    expect(await AsyncStorage.getItem(PHONE)).toBe('seen');
    expect(account.closed).not.toHaveBeenCalled();
    expect(account.close).not.toHaveBeenCalled();
  });

  it('stays closed on a phone that closed it', async () => {
    await AsyncStorage.setItem(PHONE, 'seen');
    render(<Probe reader={null} />);
    await settle();
    expect(seen.state).toBe('closed');
  });
});

describe('before it is known who is reading', () => {
  it('says nothing and asks nobody', async () => {
    render(<Probe reader={undefined} />);
    await settle();
    expect(seen.state).toBe('unknown');
    expect(account.closed).not.toHaveBeenCalled();
  });
});

describe('signed in', () => {
  // Not open on the phone's word alone: another phone may have closed it.
  it('waits for the account before saying open', async () => {
    let answer: (closed: boolean) => void = () => {};
    account.closed.mockImplementation(() => new Promise((r) => { answer = r; }));
    render(<Probe reader="u1" />);
    await settle();
    expect(seen.state).toBe('unknown');
    await act(async () => { answer(false); });
    expect(seen.state).toBe('open');
    expect(account.closed).toHaveBeenCalledWith('u1');
  });

  it('is closed when another phone closed it, and this phone remembers so', async () => {
    account.closed.mockImplementation(async () => true);
    render(<Probe reader="u1" />);
    await settle();
    expect(seen.state).toBe('closed');
    expect(await AsyncStorage.getItem(MINE)).toBe('seen');
  });

  // Closed here offline, or before the account kept it: the account is
  // told once both have answered, so the other phones hear of it.
  it('tells the account of an × only this phone has', async () => {
    await AsyncStorage.setItem(MINE, 'seen');
    render(<Probe reader="u1" />);
    await settle();
    expect(seen.state).toBe('closed');
    expect(account.close).toHaveBeenCalledWith('u1');
  });

  it('leaves both alone when they agree', async () => {
    await AsyncStorage.setItem(MINE, 'seen');
    account.closed.mockImplementation(async () => true);
    render(<Probe reader="u1" />);
    await settle();
    expect(seen.state).toBe('closed');
    expect(account.close).not.toHaveBeenCalled();
  });

  // Offline: a notice shown once more beats one that never shows.
  it('takes the phone’s word when the account cannot be read', async () => {
    account.closed.mockImplementation(async () => { throw new Error('offline'); });
    render(<Probe reader="u1" />);
    await settle();
    expect(seen.state).toBe('open');
  });

  it('closes on both with its ×, and tells the account once', async () => {
    render(<Probe reader="u1" />);
    await settle();
    act(() => seen.close());
    await settle();
    expect(seen.state).toBe('closed');
    expect(await AsyncStorage.getItem(MINE)).toBe('seen');
    expect(account.close).toHaveBeenCalledTimes(1);
    expect(account.close).toHaveBeenCalledWith('u1');
  });

  it('keeps the phone’s × when the account will not take it', async () => {
    account.close.mockImplementation(async () => { throw new Error('offline'); });
    render(<Probe reader="u1" />);
    await settle();
    act(() => seen.close());
    await settle();
    expect(seen.state).toBe('closed');
  });

  // One reader's answer is not the next reader's.
  it('asks again for somebody else, and says nothing until they are answered', async () => {
    account.closed.mockImplementation(async () => true);
    const view = render(<Probe reader="u1" />);
    await settle();
    expect(seen.state).toBe('closed');
    let answer: (closed: boolean) => void = () => {};
    account.closed.mockImplementation(() => new Promise((r) => { answer = r; }));
    view.rerender(<Probe reader="u2" />);
    await settle();
    expect(seen.state).toBe('unknown');
    await act(async () => { answer(false); });
    expect(seen.state).toBe('open');
  });

  it('says nothing after the screen has gone, answered or not', async () => {
    let answer: (closed: boolean) => void = () => {};
    let fail: (e: Error) => void = () => {};
    account.closed
      .mockImplementationOnce(() => new Promise((r) => { answer = r; }))
      .mockImplementationOnce(() => new Promise((_r, j) => { fail = j; }));
    render(<Probe reader="u1" />).unmount();
    render(<Probe reader="u2" />).unmount();
    await act(async () => { answer(true); fail(new Error('late')); });
    expect(await AsyncStorage.getItem(MINE)).toBeNull();
  });
});
