// @vitest-environment jsdom
//
// The sign-in flow, rendered.
//
// Every branch here is a thing the reader is told: that it is working,
// that it failed and why, and that they have arrived. None of it is
// reachable from a test of a pure function, and all of it is reachable by
// typing into two fields and pressing one button — which is what this does.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav } from '../nav';

const signIn = vi.hoisted(() => vi.fn());
vi.mock('../lib/auth', () => ({ useAuth: () => ({ signIn }) }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import SignInScreen from './SignInScreen';

const nav = () => ({
  navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(),
}) as unknown as Nav & {
  navigate: ReturnType<typeof vi.fn>; goBack: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>; popToTop: ReturnType<typeof vi.fn>;
};

// "Sign in" is on the screen twice — the header names it and the button
// does it. The button is the one with a role.
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: password } });
};

beforeEach(() => signIn.mockReset());

describe('signing in', () => {
  it('sends what was typed', async () => {
    signIn.mockResolvedValue(undefined);
    const navigation = nav();
    render(<SignInScreen navigation={navigation} />);

    fill('reader@example.com', 'hunter2');
    submit();

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('reader@example.com', 'hunter2'));
  });

  // A keyboard puts a space after an address as readily as it capitalises
  // one, and an address with a trailing space is not a typo the person can
  // see. The password is never trimmed: a space in it is a character.
  it('trims the address and leaves the password exactly as typed', async () => {
    signIn.mockResolvedValue(undefined);
    render(<SignInScreen navigation={nav()} />);

    fill('  reader@example.com  ', ' hunter2 ');
    submit();

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('reader@example.com', ' hunter2 '));
  });

  it('leaves the stack it was pushed onto once it worked', async () => {
    signIn.mockResolvedValue(undefined);
    const navigation = nav();
    render(<SignInScreen navigation={navigation} />);

    fill('reader@example.com', 'hunter2');
    submit();

    await waitFor(() => expect(navigation.popToTop).toHaveBeenCalled());
  });

  // The message is the server's, shown as it came: "Invalid login
  // credentials" is a different problem from "Email not confirmed", and a
  // screen that flattened both into "Something went wrong" would leave the
  // second person waiting for an email they already have.
  it('shows the reason it failed, in the server’s own words', async () => {
    // `…Once`, and the count asserted below, because one press is one
    // attempt: an implementation left rejecting past the call it was written
    // for says nothing about the screen and everything about the mock.
    signIn.mockImplementationOnce(async () => { throw new Error('Invalid login credentials'); });
    const navigation = nav();
    render(<SignInScreen navigation={navigation} />);

    fill('reader@example.com', 'wrong');
    submit();

    expect(await screen.findByText('Invalid login credentials')).toBeTruthy();
    expect(signIn).toHaveBeenCalledOnce();
    expect(navigation.popToTop).not.toHaveBeenCalled();
  });

  it('clears the last failure before trying again', async () => {
    signIn.mockImplementationOnce(async () => { throw new Error('Invalid login credentials'); });
    render(<SignInScreen navigation={nav()} />);

    fill('reader@example.com', 'wrong');
    submit();
    expect(await screen.findByText('Invalid login credentials')).toBeTruthy();

    signIn.mockResolvedValue(undefined);
    submit();
    await waitFor(() => expect(screen.queryByText('Invalid login credentials')).toBeNull());
  });

  it('says nothing about an error before one has happened', () => {
    render(<SignInScreen navigation={nav()} />);
    expect(screen.queryByText(/credentials/i)).toBeNull();
  });
});

describe('the ways out of this screen', () => {
  it('offers the password reset', () => {
    const navigation = nav();
    render(<SignInScreen navigation={navigation} />);
    fireEvent.click(screen.getByText('Forgot password?'));
    expect(navigation.navigate).toHaveBeenCalledWith('ForgotPassword');
  });

  // `replace`, not `navigate`: somebody who came here and meant to register
  // should not have sign-in waiting behind the back button.
  it('replaces itself with sign-up rather than stacking on top of it', () => {
    const navigation = nav();
    render(<SignInScreen navigation={navigation} />);
    fireEvent.click(screen.getByText('Sign up'));
    expect(navigation.replace).toHaveBeenCalledWith('SignUp');
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('goes back the way it came', () => {
    const navigation = nav();
    render(<SignInScreen navigation={navigation} />);
    fireEvent.click(screen.getByLabelText(/back/i));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
