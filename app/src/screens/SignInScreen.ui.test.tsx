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

  // What `lib/auth` throws is a name, not a sentence — `credentials` rather
  // than "Invalid login credentials" — and this screen is where it becomes
  // words. The mocked `t` returns the English variant, which is why the
  // expectation reads in English on a rule that exists for Vietnamese.
  it('says a named failure in the reader’s own language', async () => {
    // `…Once`, and the count asserted below, because one press is one
    // attempt: an implementation left rejecting past the call it was written
    // for says nothing about the screen and everything about the mock.
    signIn.mockImplementationOnce(async () => { throw new Error('credentials'); });
    const navigation = nav();
    render(<SignInScreen navigation={navigation} />);

    fill('reader@example.com', 'wrong');
    submit();

    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy();
    expect(signIn).toHaveBeenCalledOnce();
    expect(navigation.popToTop).not.toHaveBeenCalled();
  });

  // The rule the old version of this test was written to hold, kept: a
  // wrong password is a different problem from an unconfirmed address, and
  // a screen that flattened both into one sentence would leave the second
  // person waiting for an email they already have. Their password was
  // right; nothing about the form is what needs fixing.
  it('does not tell an unconfirmed address it typed the wrong password', async () => {
    signIn.mockImplementationOnce(async () => { throw new Error('unconfirmed'); });
    render(<SignInScreen navigation={nav()} />);

    fill('reader@example.com', 'hunter2');
    submit();

    expect(await screen.findByText(/confirmed/i)).toBeTruthy();
    expect(screen.queryByText('Email or password is incorrect.')).toBeNull();
  });

  // The other half of naming failures one at a time: anything unnamed
  // still reaches the reader, in the server's own words. A screen that
  // swallowed those into "Something went wrong" would be worse than the
  // English it replaced.
  it('shows a failure nothing has named yet exactly as it came', async () => {
    signIn.mockImplementationOnce(async () => { throw new Error('Signups not allowed for this instance'); });
    render(<SignInScreen navigation={nav()} />);

    fill('reader@example.com', 'hunter2');
    submit();

    expect(await screen.findByText('Signups not allowed for this instance')).toBeTruthy();
  });

  it('clears the last failure before trying again', async () => {
    signIn.mockImplementationOnce(async () => { throw new Error('credentials'); });
    render(<SignInScreen navigation={nav()} />);

    fill('reader@example.com', 'wrong');
    submit();
    expect(await screen.findByText('Email or password is incorrect.')).toBeTruthy();

    signIn.mockResolvedValue(undefined);

    // ── the state the second press depends on, asserted before it ──
    //
    // This wait timed out a third time (5124ms, in CI, green on the two
    // other passes of the same run), and the two earlier repairs both
    // read it as "not enough time". Five seconds for a mocked promise is
    // not a time problem, and no reproduction came out of twelve local
    // runs, so the mechanism is still unknown.
    //
    // What can be done meanwhile is stop the next failure being mute.
    // The screen's handler returns early on an empty field and the button
    // does nothing at all while `busy`; both are silent, and both look
    // exactly like "the press produced no call". Asserted here, the next
    // occurrence names its own cause on the failing line instead of
    // leaving it to be guessed at a fourth time.
    expect((screen.getByPlaceholderText('Enter your email') as HTMLInputElement).value)
      .toBe('reader@example.com');
    expect((screen.getByPlaceholderText('Enter your password') as HTMLInputElement).value)
      .toBe('wrong');
    // Busy swaps the label for a spinner, so finding the label is the
    // observable proof the button is pressable again — a different fact
    // from the error sentence above, which is all the test waited on
    // before.
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();

    submit();
    // Two waits, deliberately, each with a patient clock. The default
    // 1s wait timed out twice under full-suite parallel load (once on a
    // loaded laptop, once in CI) while passing every isolated run — and
    // a single combined wait cannot say which half was late. The first
    // proves the second press reached the handler at all; the second
    // that it swept the old failure. If this ever fails again, the
    // failing line names the culprit.
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(2), { timeout: 5000 });
    await waitFor(
      () => expect(screen.queryByText('Email or password is incorrect.')).toBeNull(),
      { timeout: 5000 },
    );
    // ── and the clock the two of them run inside ──
    //
    // Vitest's own default is 5000, which is what each wait above was
    // raised to — so the test could never actually spend either one. It
    // died at its own limit first, and the failure named this `it` rather
    // than the late line, which is the one thing the note above says must
    // not happen. Seen once under full-suite load and green on the rerun,
    // which is exactly how a limit set too low presents.
    //
    // 20s is not a budget to spend. Nothing here waits on anything real,
    // so a passing run finishes in milliseconds; the number only has to be
    // further out than 1s + 5s + 5s can reach.
  }, 20_000);

  // The whole reason these are checked here: the server answers an empty
  // form with "missing email or phone" — English, lower case, and naming
  // a field this app does not have. No mapping after the fact could put
  // that in the reader's language, so the request is never made.
  it('asks for a missing email itself instead of asking the server', async () => {
    render(<SignInScreen navigation={nav()} />);

    submit();

    expect(await screen.findByText('Enter your email address.')).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('asks for a missing password the same way', async () => {
    render(<SignInScreen navigation={nav()} />);

    fill('reader@example.com', '');
    submit();

    expect(await screen.findByText('Enter your password.')).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  // An address of nothing but spaces is an empty one; the password is
  // never trimmed, so a space in it is a character and a valid attempt.
  it('does not count a spaces-only address as an address', async () => {
    render(<SignInScreen navigation={nav()} />);

    fill('   ', 'hunter2');
    submit();

    expect(await screen.findByText('Enter your email address.')).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('says nothing about an error before one has happened', () => {
    render(<SignInScreen navigation={nav()} />);
    expect(screen.queryByText(/incorrect/i)).toBeNull();
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
