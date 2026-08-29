// @vitest-environment jsdom
//
// The one promise the legal sheet makes to the form underneath it.
//
// Reading the terms in the middle of signing up must cost nothing: the
// documents open over the screen rather than instead of it, so the name,
// the handle and the email a reader has already typed are still there
// when the sheet closes. That is a property of *where* the sheet is
// mounted, not of anything visible, and the day somebody reaches for
// `navigation.navigate` instead it breaks silently — the screen would
// still render, the document would still open, and the form would simply
// be empty on the way back.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav } from '../nav';

const signUp = vi.hoisted(() => vi.fn(async () => ({ needsConfirm: false })));
const savePreferences = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({ signUp, confirmSignUp: vi.fn(), session: { user: { id: 'u1' } } }),
  isHandleFree: vi.fn(async () => true),
}));
// Only the write is swapped; everything else in the barrel stays real.
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  savePreferences,
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));

import SignUpScreen from './SignUpScreen';

const nav = () => ({
  navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(),
}) as unknown as Nav;

describe('the legal sheet over the form', () => {
  it('opens the terms without touching the form or the navigator', async () => {
    const navigation = nav();
    render(<SignUpScreen navigation={navigation} />);

    const email = screen.getByPlaceholderText("We'll never share your email.");
    fireEvent.change(email, { target: { value: 'reader@example.com' } });

    fireEvent.click(screen.getByText('Terms of Service'));
    // The document's own heading, which exists nowhere on the form.
    expect(await screen.findByText('What you may post, and what you may not')).toBeTruthy();

    // Nothing navigated: the sheet is a Modal inside this screen, and if
    // it ever stops being one this is the line that says so.
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect((email as HTMLInputElement).value).toBe('reader@example.com');
  });

  it('gives the privacy policy the same door', async () => {
    render(<SignUpScreen navigation={nav()} />);
    fireEvent.click(screen.getByText('Privacy Policy'));
    expect(await screen.findByText('What we do not collect')).toBeTruthy();
  });

  // What survives the round trip, which is the whole reason the sheet is
  // mounted here rather than pushed onto the stack.
  it('hands the form back exactly as it was', async () => {
    render(<SignUpScreen navigation={nav()} />);
    const name = screen.getByPlaceholderText('Enter your full name');
    fireEvent.change(name, { target: { value: 'Nguyễn Văn A' } });

    fireEvent.click(screen.getByText('Terms of Service'));
    await screen.findByText('Your account');
    fireEvent.click(screen.getAllByLabelText('Close')[0]);

    await waitFor(() => expect((name as HTMLInputElement).value).toBe('Nguyễn Văn A'));
  });
});

// ── the step after the account exists ────────────────────────────────
//
// It is the last thing sign-up asks and the first thing it is willing to
// be told nothing about. Both halves of that are pinned here, because
// both are easy to lose: a required-feeling step on the screen an account
// is lost on, or a "skip" that quietly writes an empty row anyway.

const fillForm = () => {
  fireEvent.change(screen.getByPlaceholderText('Enter your full name'), { target: { value: 'Trang' } });
  fireEvent.change(screen.getByPlaceholderText("We'll never share your email."), { target: { value: 'a@b.co' } });
  fireEvent.change(screen.getByPlaceholderText('Use at least 8 characters'), { target: { value: 'password1' } });
  fireEvent.change(screen.getByPlaceholderText('Type your password again'), { target: { value: 'password1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
};

describe('the taste step', () => {
  beforeEach(() => {
    signUp.mockClear();
    savePreferences.mockClear();
  });

  it('comes after the account is made, not before', async () => {
    render(<SignUpScreen navigation={nav()} />);
    fillForm();
    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(await screen.findByText('What are you into?')).toBeTruthy();
  });

  // The promise that makes it safe to ask at all. Nothing is written, and
  // the account is untouched — `taste.ts` has three other signals and
  // will understand this reader from what they do instead.
  it('writes nothing at all when it is skipped', async () => {
    const navigation = nav();
    render(<SignUpScreen navigation={navigation} />);
    fillForm();
    fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }));

    await waitFor(() => expect(navigation.popToTop).toHaveBeenCalled());
    expect(savePreferences).not.toHaveBeenCalled();
  });

  it('stores exactly the chips that were tapped', async () => {
    render(<SignUpScreen navigation={nav()} />);
    fillForm();
    await screen.findByText('What are you into?');
    fireEvent.click(screen.getByText('Cafés'));
    fireEvent.click(screen.getByText('Nature'));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(savePreferences).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ categories: ['cafes', 'nature'] }),
    ));
  });

  // The button says which of the two it is, so a reader who has tapped
  // nothing is never looking at a "Done" that means "no".
  it('renames itself the moment there is something to save', async () => {
    render(<SignUpScreen navigation={nav()} />);
    fillForm();
    await screen.findByText('What are you into?');
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeTruthy();
    fireEvent.click(screen.getByText('Cafés'));
    expect(await screen.findByRole('button', { name: 'Done' })).toBeTruthy();
  });
});
