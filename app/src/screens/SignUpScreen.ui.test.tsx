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

// A session that does not exist until an account is made, which is what
// the screen now depends on: it holds the taste until one lands and
// refuses to write onto whatever session happened to be there before.
// The old mock handed out `u1` from the first render, which made that
// distinction untestable — and it is the distinction.
const auth = vi.hoisted(() => {
  const state: { session: { user: { id: string } } | null } = { session: null };
  const land = () => { state.session = { user: { id: 'u1' } }; };
  return {
    state,
    signUp: vi.fn(async () => { land(); return { needsConfirm: false }; }),
    confirmSignUp: vi.fn(async () => { land(); }),
  };
});
const savePreferences = vi.hoisted(() => vi.fn(async () => {}));
const isHandleFree = vi.hoisted(() => vi.fn(async () => true));
vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    signUp: auth.signUp, confirmSignUp: auth.confirmSignUp, session: auth.state.session,
  }),
  isHandleFree,
}));
const signUp = auth.signUp;
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

// ── the step that makes the account ──────────────────────────────────
//
// It used to be the step *after* the account was made, and the first
// assertion below has been turned over with it: the form now only checks
// itself, and nothing exists until this screen is finished. A form
// abandoned here leaves no row to collide with the address when the
// reader comes back.
//
// Two things stay pinned because both are easy to lose. Skipping is still
// a real answer — it makes the account and writes no preference, rather
// than quietly writing an empty row — and both answers are offered at
// once, rather than one button wearing two words and hiding whichever it
// is not currently saying.

const fillForm = () => {
  fireEvent.change(screen.getByPlaceholderText('Enter your full name'), { target: { value: 'Trang' } });
  fireEvent.change(screen.getByPlaceholderText("We'll never share your email."), { target: { value: 'a@b.co' } });
  fireEvent.change(screen.getByPlaceholderText('Use at least 8 characters'), { target: { value: 'password1' } });
  fireEvent.change(screen.getByPlaceholderText('Type your password again'), { target: { value: 'password1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
};

describe('the taste step', () => {
  beforeEach(() => {
    auth.state.session = null;
    signUp.mockClear();
    auth.confirmSignUp.mockClear();
    savePreferences.mockClear();
  });

  it('is where the account is made, and the form is not', async () => {
    render(<SignUpScreen navigation={nav()} />);
    fillForm();
    expect(await screen.findByText('What are you into?')).toBeTruthy();
    // The whole point of the reorder: the form checked itself and moved
    // on, and nothing has been created yet.
    expect(signUp).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(signUp).toHaveBeenCalled());
  });

  // The promise that makes it safe to ask at all. Skipping still makes
  // the account — it is the same step — and writes no preference:
  // `taste.ts` has three other signals and will understand this reader
  // from what they do instead.
  it('still makes the account when it is skipped, and writes nothing', async () => {
    render(<SignUpScreen navigation={nav()} />);
    fillForm();
    fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }));

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(await screen.findByText('Welcome, Trang')).toBeTruthy();
    // The arrival copy, pinned: three short clauses that end on the
    // button's own words, so the button reads as the sentence finishing
    // itself. A rewrite that breaks that echo should have to come here
    // and say so.
    expect(screen.getByText(
      'You’re all set. Save places you love, build collections, and find your next place to explore.',
    )).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start exploring/ })).toBeTruthy();
    expect(savePreferences).not.toHaveBeenCalled();
  });

  it('stores exactly the chips that were tapped', async () => {
    render(<SignUpScreen navigation={nav()} />);
    fillForm();
    await screen.findByText('What are you into?');
    fireEvent.click(screen.getByText('Cafés'));
    fireEvent.click(screen.getByText('Nature'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Written once a session exists rather than at the tap, since the
    // account is only being created by that same tap.
    await waitFor(() => expect(savePreferences).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ categories: ['cafes', 'nature'] }),
    ));
  });

  // Both answers, at the same time. The button used to carry both — "Bỏ
  // qua" until something was picked, then "Xong" — which meant the
  // largest, warmest control on the screen invited the reader to leave at
  // the moment they arrived, and hid the other answer whichever way it
  // was facing.
  it('offers continuing and skipping at once, and keeps doing so', async () => {
    render(<SignUpScreen navigation={nav()} />);
    fillForm();
    await screen.findByText('What are you into?');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeTruthy();

    fireEvent.click(screen.getByText('Cafés'));
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeTruthy();
  });
});

// ── the username, answered while it is being typed ──
//
// It used to be the sixth of six checks at submit, after both password
// fields, so the reader filled in everything and only then learned the
// name was taken. And the name is usually not theirs: `suggestHandle`
// proposes it from the display name, so the app was making a suggestion,
// taking the rest of the form, and then withdrawing its own suggestion.

describe('the username check', () => {
  beforeEach(() => {
    auth.state.session = null;
    isHandleFree.mockClear();
    isHandleFree.mockResolvedValue(true);
    signUp.mockClear();
  });

  const typeHandle = (v: string) =>
    fireEvent.change(screen.getByPlaceholderText('yourname'), { target: { value: v } });

  it('says a name is taken before a password has been typed', async () => {
    isHandleFree.mockResolvedValue(false);
    render(<SignUpScreen navigation={nav()} />);
    typeHandle('hoa');

    expect(await screen.findByText('@hoa is taken. Try another.', {}, { timeout: 2000 })).toBeTruthy();
    // The whole point: nothing below the username has been touched, and
    // nothing was submitted to find this out.
    expect((screen.getByPlaceholderText('Use at least 8 characters') as HTMLInputElement).value).toBe('');
    expect(signUp).not.toHaveBeenCalled();
  });

  it('takes the message back when the name changes', async () => {
    isHandleFree.mockResolvedValue(false);
    render(<SignUpScreen navigation={nav()} />);
    typeHandle('hoa');
    await screen.findByText('@hoa is taken. Try another.', {}, { timeout: 2000 });

    isHandleFree.mockResolvedValue(true);
    typeHandle('hoa2');

    // Immediately, not after the next answer: the sentence was about a
    // value that is no longer in the field.
    expect(screen.queryByText('@hoa is taken. Try another.')).toBeNull();
  });

  // No point asking the server about a handle the shape rules already
  // reject, and a sentence about length while somebody is on their second
  // letter is nagging. Both still surface at submit.
  it('asks nothing about a name that is too short to be one', async () => {
    render(<SignUpScreen navigation={nav()} />);
    typeHandle('ab');

    await new Promise((r) => setTimeout(r, 900));
    expect(isHandleFree).not.toHaveBeenCalled();
  });

  // The check can be outrun by somebody who types quickly, so submit still
  // asks. This is the backstop, and it is the behaviour that existed
  // before — kept, not replaced.
  it('still catches a name that was taken faster than the reader typed', async () => {
    render(<SignUpScreen navigation={nav()} />);
    isHandleFree.mockResolvedValue(false);
    fillForm();

    expect(await screen.findByText('@trang is taken. Try another.')).toBeTruthy();
    expect(screen.queryByText('What are you into?')).toBeNull();
  });
});

describe('the email field', () => {
  beforeEach(() => {
    auth.state.session = null;
    signUp.mockClear();
    isHandleFree.mockResolvedValue(true);
  });

  // The incident that earned `cleanEmail` its file: the iOS keyboard's
  // space after an autocomplete, in the middle of the address, past any
  // trim. The field refuses to hold it at all.
  it('strips the space the keyboard slips in', () => {
    render(<SignUpScreen navigation={nav()} />);
    const email = screen.getByPlaceholderText("We'll never share your email.");
    fireEvent.change(email, { target: { value: 'ngotiennam@ gmail.com' } });
    expect((email as HTMLInputElement).value).toBe('ngotiennam@gmail.com');
  });

  it('names a malformed address on the form, before anything is sent', async () => {
    render(<SignUpScreen navigation={nav()} />);
    fireEvent.change(screen.getByPlaceholderText('Enter your full name'), { target: { value: 'Trang' } });
    fireEvent.change(screen.getByPlaceholderText("We'll never share your email."), { target: { value: 'trang@gmail' } });
    fireEvent.change(screen.getByPlaceholderText('Use at least 8 characters'), { target: { value: 'password1' } });
    fireEvent.change(screen.getByPlaceholderText('Type your password again'), { target: { value: 'password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    // The same sentence the server's own refusal would arrive under —
    // said now, on the screen with the field, and nothing was sent.
    expect(await screen.findByText("That email address doesn't look right.")).toBeTruthy();
    expect(screen.queryByText('What are you into?')).toBeNull();
    expect(signUp).not.toHaveBeenCalled();
  });
});

// The request fires on the taste step, one screen after the fields it can
// complain about. These pin the walk back — and where it must not go.
describe('a failure the form can fix', () => {
  beforeEach(() => {
    auth.state.session = null;
    signUp.mockClear();
    isHandleFree.mockResolvedValue(true);
  });

  it('walks the reader back to the form when the email is taken', async () => {
    signUp.mockImplementationOnce(async () => { throw new Error('email_taken'); });
    render(<SignUpScreen navigation={nav()} />);
    fillForm();
    fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }));

    // Back on the form — its own button is showing — with the sentence
    // about the field beside it. Not the code screen: with confirmation
    // on, a taken address used to mean waiting for a mail GoTrue never
    // sent.
    expect(await screen.findByText('An account already uses this email. Sign in instead.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeTruthy();
    expect(screen.queryByText('What are you into?')).toBeNull();
  });

  it('stays on the taste step for a failure no field fixes', async () => {
    signUp.mockImplementationOnce(async () => { throw new Error('rate_limit'); });
    render(<SignUpScreen navigation={nav()} />);
    fillForm();
    fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }));

    // Beside the button worth pressing again, not a screen away from it.
    expect(await screen.findByText('Too many attempts. Wait a moment and try again.')).toBeTruthy();
    expect(screen.getByText('What are you into?')).toBeTruthy();
  });
});
