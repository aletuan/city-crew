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
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
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

  it('moves on to the code once the address is one', async () => {
    requestReset.mockResolvedValue(undefined);
    render(<ForgotPasswordScreen navigation={nav()} />);

    type('reader@example.com');
    send();

    expect(await screen.findByText('Set a new password')).toBeTruthy();
  });
});
