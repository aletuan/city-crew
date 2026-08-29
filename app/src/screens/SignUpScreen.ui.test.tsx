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
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav } from '../nav';

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ signUp: vi.fn(), confirmSignUp: vi.fn() }),
  isHandleFree: vi.fn(async () => true),
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
