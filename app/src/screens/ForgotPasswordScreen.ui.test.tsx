// @vitest-environment jsdom
//
// Password recovery, rendered — and specifically the address it is asked
// for.
//
// This form is the quietest place in the app to get an address wrong. The
// step after it announces that a code was sent and starts a sixty-second
// countdown, so an address the server never reached is indistinguishable
// from one it did: the reader waits out the timer, presses Resend, and
// waits again. Nothing here is reachable from a test of a pure function —
// `emailShapeOk` knows the shape, but only the screen knows whether it is
// consulted before the request or after it.

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav } from '../nav';

const requestReset = vi.hoisted(() => vi.fn());
const resetPassword = vi.hoisted(() => vi.fn());
vi.mock('../lib/auth', () => ({ useAuth: () => ({ requestReset, resetPassword }) }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import ForgotPasswordScreen from './ForgotPasswordScreen';

const nav = () => ({
  navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(),
  getState: () => ({ routes: [{ name: 'r0' }, { name: 'r1' }] }),
}) as unknown as Nav;

const type = (address: string) =>
  fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: address } });

const send = () => fireEvent.click(screen.getByRole('button', { name: 'Send recovery code' }));

beforeEach(() => {
  requestReset.mockReset();
  resetPassword.mockReset();
});
afterEach(() => { vi.useRealTimers(); });

describe('the address recovery is asked for', () => {
  it('sends what was typed', async () => {
    requestReset.mockResolvedValue(undefined);
    render(<ForgotPasswordScreen navigation={nav()} />);

    type('reader@example.com');
    send();

    await waitFor(() => expect(requestReset).toHaveBeenCalledWith('reader@example.com'));
  });

  // The incident `lib/email` was written for, on the third of the three
  // forms that has an address field.
  it('strips the space the keyboard slips in after the @', () => {
    render(<ForgotPasswordScreen navigation={nav()} />);
    const email = screen.getByPlaceholderText('Enter your email');
    fireEvent.change(email, { target: { value: 'ngotiennam@ gmail.com' } });
    expect((email as HTMLInputElement).value).toBe('ngotiennam@gmail.com');
  });

  it('asks for an address before asking the server for a mail', async () => {
    render(<ForgotPasswordScreen navigation={nav()} />);

    send();

    expect(await screen.findByText('Enter your email address.')).toBeTruthy();
    expect(requestReset).not.toHaveBeenCalled();
  });

  // The one that matters most here: a malformed address must not reach
  // the step that says a code is on its way.
  it('names a malformed address instead of promising a code for it', async () => {
    render(<ForgotPasswordScreen navigation={nav()} />);

    type('reader@example');
    send();

    expect(await screen.findByText("That email address doesn't look right.")).toBeTruthy();
    expect(requestReset).not.toHaveBeenCalled();
    // Still on the first step: no countdown, no Resend, nothing to wait for.
    expect(screen.queryByText(/Resend code/)).toBeNull();
  });

  it('leaves through the header, by the stack', () => {
    const navigation = nav();
    render(<ForgotPasswordScreen navigation={navigation} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('moves on to the code once the address is one', async () => {
    requestReset.mockResolvedValue(undefined);
    render(<ForgotPasswordScreen navigation={nav()} />);

    type('reader@example.com');
    send();

    expect(await screen.findByText('Set a new password')).toBeTruthy();
  });
});

// ── the second step: the code and the new password ──
//
// Everything above stops at the door of this step; nothing had ever
// walked through it. The countdown, the resend, the two checks that run
// before `resetPassword` is asked anything, and the way out afterwards
// were all untested — the whole of the flow that actually changes a
// password.

/** Through the first step, on an address the server accepted. */
const reachReset = async (navigation = nav()) => {
  requestReset.mockResolvedValue(undefined);
  render(<ForgotPasswordScreen navigation={navigation} />);
  type('reader@example.com');
  send();
  await screen.findByText('Set a new password');
  // The step's text lands before its effects run: the countdown's
  // interval is registered by a passive effect, which React flushes after
  // the paint `findByText` was watching for. One drained `act` and the
  // interval exists — see #529 for why this waits on work, not a clock.
  await act(async () => {});
  return navigation;
};

const typeCode = (code: string) =>
  fireEvent.change(screen.getByPlaceholderText('Paste the code from the email'), { target: { value: code } });
const typePassword = (pw: string) =>
  fireEvent.change(screen.getByPlaceholderText('Use at least 8 characters'), { target: { value: pw } });
const resetNow = () => fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

/** Ticks the cooldown forward under fake timers, inside `act`. */
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('the code and the new password', () => {
  it('says which address the code went to', async () => {
    await reachReset();
    expect(screen.getByText(/We sent a recovery code to reader@example\.com/)).toBeTruthy();
  });

  // In field order: the code sits above the password, so an empty code is
  // the first thing named even when the password is wrong too.
  it('asks for the code before anything else', async () => {
    await reachReset();
    typePassword('short');
    resetNow();

    expect(await screen.findByText('Enter the code from the email.')).toBeTruthy();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('keeps only the digits of what was pasted, and no more than ten', async () => {
    // The email spaces the digits apart; a copy may bring the spaces
    // along, and a code that fails on an invisible space is not
    // distinguishable from a wrong one. See `lib/otp`.
    await reachReset();
    const field = screen.getByPlaceholderText('Paste the code from the email') as HTMLInputElement;
    fireEvent.change(field, { target: { value: '12 34 56 78 90 12' } });
    expect(field.value).toBe('1234567890');
  });

  it('refuses a short password on the screen, before the server sees it', async () => {
    await reachReset();
    typeCode('123456');
    typePassword('short');
    resetNow();

    expect(await screen.findByText('Password must be at least 8 characters.')).toBeTruthy();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('resets with the address, the cleaned code and the password, then leaves', async () => {
    resetPassword.mockResolvedValue(undefined);
    const navigation = await reachReset();
    typeCode('123456');
    typePassword('longenough1');
    resetNow();

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('reader@example.com', '123456', 'longenough1'));
    // Two routes under this one, so `leaveAuth` pops rather than replaces.
    await waitFor(() => expect(navigation.popToTop).toHaveBeenCalled());
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('shows the server’s refusal in place, and stays on the step', async () => {
    resetPassword.mockRejectedValue(new Error('Token has expired or is invalid'));
    const navigation = await reachReset();
    typeCode('123456');
    typePassword('longenough1');
    resetNow();

    // Not in the table `useFailText` holds, so it reaches the reader in
    // the server's own words, sentence-cased.
    expect(await screen.findByText('Token has expired or is invalid')).toBeTruthy();
    expect(navigation.popToTop).not.toHaveBeenCalled();
    expect(screen.getByText('Set a new password')).toBeTruthy();
  });

  it('goes back to the address step from the header, keeping the address', async () => {
    const navigation = await reachReset();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByText('Forgot password')).toBeTruthy();
    expect((screen.getByPlaceholderText('Enter your email') as HTMLInputElement).value).toBe('reader@example.com');
    // Its own step, not the stack's: the screen is still the same screen.
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});

// ── resending ──
//
// Supabase allows one recovery mail per address per minute. A Resend that
// ignored that would spend its taps on rejections, so the control waits
// out the minute — visibly, counting down, rather than vanishing.

describe('resending the code', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });

  it('starts a sixty-second wait the moment the first code goes out', async () => {
    await reachReset();
    const resend = screen.getByRole('button', { name: /Resend code/ });
    expect(resend.textContent).toBe('Resend code in 60s');
    expect(resend.getAttribute('aria-disabled')).toBe('true');

    // Disabled means disabled: a tap during the wait asks for nothing.
    fireEvent.click(resend);
    expect(requestReset).toHaveBeenCalledTimes(1);
  });

  it('counts the wait down a second at a time, and offers the control at zero', async () => {
    await reachReset();
    tick(1000);
    expect(screen.getByText('Resend code in 59s')).toBeTruthy();

    tick(58_000);
    expect(screen.getByText('Resend code in 1s')).toBeTruthy();

    tick(1000);
    const resend = screen.getByRole('button', { name: "Didn't get it? Resend code" });
    expect(resend.getAttribute('aria-disabled')).not.toBe('true');
    // The clock stops at zero: another minute changes nothing.
    tick(60_000);
    expect(screen.getByText("Didn't get it? Resend code")).toBeTruthy();
  });

  it('asks for a new code, clears the old one, and says why', async () => {
    await reachReset();
    typeCode('123456');
    tick(60_000);

    fireEvent.click(screen.getByRole('button', { name: "Didn't get it? Resend code" }));

    // The note is the last thing the resend sets, so its arrival is the
    // signal that the whole of it has landed — the field and the wait
    // are asserted after it rather than after the call alone, which
    // returns before either is written.
    expect(await screen.findByText('A new code is on its way. The previous one no longer works.')).toBeTruthy();
    expect(requestReset).toHaveBeenCalledTimes(2);
    expect(requestReset).toHaveBeenLastCalledWith('reader@example.com');
    // The old code died the moment the new one was issued; a field still
    // holding it would be holding something the server now refuses.
    expect((screen.getByPlaceholderText('Paste the code from the email') as HTMLInputElement).value).toBe('');
    // And the wait starts over.
    expect(screen.getByText('Resend code in 60s')).toBeTruthy();
  });

  it('drops the note once the second wait is over', async () => {
    await reachReset();
    tick(60_000);
    fireEvent.click(screen.getByRole('button', { name: "Didn't get it? Resend code" }));
    await screen.findByText('A new code is on its way. The previous one no longer works.');
    // The second countdown's interval is registered by the same passive
    // effect as the first — see `reachReset` — and the note's arrival
    // does not wait for it. Drained before the clock is moved.
    await act(async () => {});

    tick(60_000);
    expect(screen.queryByText('A new code is on its way. The previous one no longer works.')).toBeNull();
  });

  it('shows a refused resend in place', async () => {
    await reachReset();
    tick(60_000);
    requestReset.mockRejectedValueOnce(new Error('rate_limit'));

    fireEvent.click(screen.getByRole('button', { name: "Didn't get it? Resend code" }));

    expect(await screen.findByText('Too many attempts. Wait a moment and try again.')).toBeTruthy();
    // No new wait for a mail that was not sent.
    expect(screen.getByText("Didn't get it? Resend code")).toBeTruthy();
  });
});
