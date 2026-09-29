// The shield around the system share sheet. What is pinned: it is up from
// the moment a share opens until a grace after it settles, however it
// settles; two shares in flight cannot lower each other's; and a declined
// share is never an unhandled rejection. See the note at the top of
// `share.ts` for the tap it exists to catch.

import { Share } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isShielded, SHIELD_GRACE_MS, shareSafely, subscribeShield } from './share';

/** Every sheet a test opened, so the next test starts with none open:
 *  the shield is one count for the whole module. */
const open: (() => void)[] = [];
/** A share whose sheet closes when the test says so. */
const pending = () => {
  let close!: () => void;
  let fail!: (e: Error) => void;
  const share = vi.fn(() => new Promise<unknown>((res, rej) => {
    close = () => res({});
    fail = rej;
    open.push(close);
  }));
  return { share, close: () => close(), fail: (e: Error) => fail(e) };
};
/** Let the promise chain run. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => { vi.useFakeTimers(); });
afterEach(async () => {
  open.splice(0).forEach((close) => close());
  await vi.runAllTimersAsync();
  vi.useRealTimers();
});

describe('the shield', () => {
  it('is down when nothing is being shared', () => {
    expect(isShielded()).toBe(false);
  });

  it('goes up as the sheet opens and stays while it is open', async () => {
    const s = pending();
    void shareSafely({ message: 'hi' }, s.share);
    expect(isShielded()).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(isShielded()).toBe(true);
  });

  // The finger that closed the sheet may still be lifting when it settles.
  it('stays for the grace after the sheet closes, and not after', async () => {
    const s = pending();
    void shareSafely({ message: 'hi' }, s.share);
    s.close();
    await settle();
    await vi.advanceTimersByTimeAsync(SHIELD_GRACE_MS - 1);
    expect(isShielded()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(isShielded()).toBe(false);
  });

  it('comes down after a share that fails, too', async () => {
    const s = pending();
    const done = shareSafely({ message: 'hi' }, s.share);
    s.fail(new Error('dismissed'));
    await expect(done).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(SHIELD_GRACE_MS);
    expect(isShielded()).toBe(false);
  });

  it('is not lowered by one share while another is still open', async () => {
    const a = pending();
    const b = pending();
    void shareSafely({ message: 'a' }, a.share);
    void shareSafely({ message: 'b' }, b.share);
    a.close();
    await settle();
    await vi.advanceTimersByTimeAsync(SHIELD_GRACE_MS);
    expect(isShielded()).toBe(true);
    b.close();
    await settle();
    await vi.advanceTimersByTimeAsync(SHIELD_GRACE_MS);
    expect(isShielded()).toBe(false);
  });

  it('tells its subscribers each time it moves, until they leave', async () => {
    const heard = vi.fn();
    const leave = subscribeShield(heard);
    const s = pending();
    void shareSafely({ message: 'hi' }, s.share);
    expect(heard).toHaveBeenCalledTimes(1);
    s.close();
    await settle();
    await vi.advanceTimersByTimeAsync(SHIELD_GRACE_MS);
    expect(heard).toHaveBeenCalledTimes(2);
    leave();
    void shareSafely({ message: 'hi' }, pending().share);
    expect(heard).toHaveBeenCalledTimes(2);
  });
});

describe('the share', () => {
  it('hands the system sheet what it was given', () => {
    const s = pending();
    void shareSafely({ message: 'City Crew 1.0.4' }, s.share);
    expect(s.share).toHaveBeenCalledWith({ message: 'City Crew 1.0.4' });
  });

  it('is React Native’s own sheet unless told otherwise', () => {
    const spy = vi.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' });
    void shareSafely({ message: 'hi' });
    expect(spy).toHaveBeenCalledWith({ message: 'hi' });
    spy.mockRestore();
  });

  // Asked of the promise: a declined share resolves, so nothing escapes
  // as an unhandled rejection whoever called it.
  it('resolves when the sheet is declined', async () => {
    const s = pending();
    const done = shareSafely({ message: 'hi' }, s.share);
    s.fail(new Error('dismissed'));
    await expect(done).resolves.toBeUndefined();
  });
});
