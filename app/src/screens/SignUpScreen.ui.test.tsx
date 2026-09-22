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

// The settings probe would otherwise fire a real fetch at the project
// from inside jsdom. Unknown is the default — also the bar's own — and
// the tests about the other answer flip it.
const needsCode = vi.hoisted(() => ({ value: null as boolean | null }));
vi.mock('../lib/signup', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  fetchSignUpNeedsConfirm: async () => needsCode.value,
}));

import SignUpScreen from './SignUpScreen';

// Two routes under this one, so `leaveAuth` pops rather than replaces —
// the same shape `ForgotPasswordScreen`'s test hands over.
const nav = () => ({
  navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(),
  getState: () => ({ routes: [{ name: 'r0' }, { name: 'r1' }] }),
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

// How many marks the bar promises is the server's to say — `lib/signup`
// holds that logic; these pin the wiring and the one late-growth case.
describe('the step bar', () => {
  beforeEach(() => {
    auth.state.session = null;
    signUp.mockClear();
    isHandleFree.mockResolvedValue(true);
    needsCode.value = null;
  });

  it('promises two steps while the server has not said otherwise', () => {
    render(<SignUpScreen navigation={nav()} />);
    expect(screen.getByLabelText('Step 1 of 2')).toBeTruthy();
  });

  it('promises three from the first frame when sign-up will ask for a code', async () => {
    needsCode.value = true;
    render(<SignUpScreen navigation={nav()} />);
    expect(await screen.findByLabelText('Step 1 of 3')).toBeTruthy();
  });

  // The ask failed (or lied), and `signUp` demanded a code anyway. The
  // bar grows on the screen that proves it must — and the docstring's
  // deal is that this is the only direction it can be wrong in.
  it('grows to three on the code screen even when the ask had said two', async () => {
    signUp.mockImplementationOnce(async () => ({ needsConfirm: true }));
    render(<SignUpScreen navigation={nav()} />);
    fillForm();
    fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }));

    expect(await screen.findByText('Check your email')).toBeTruthy();
    expect(screen.getByLabelText('Step 3 of 3')).toBeTruthy();
  });
});

// ── the form, checked in the order the fields are in ──
//
// Six checks before anything leaves the phone, and the order is the
// screen's order: a form with an empty name and a short password names
// the name. Each sentence below is pinned to the field it is about, and
// to the fact that nothing was asked of the server to produce it.

const field = {
  name: () => screen.getByPlaceholderText('Enter your full name'),
  handle: () => screen.getByPlaceholderText('yourname'),
  email: () => screen.getByPlaceholderText("We'll never share your email."),
  password: () => screen.getByPlaceholderText('Use at least 8 characters'),
  confirm: () => screen.getByPlaceholderText('Type your password again'),
};
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));

describe('the form, checked in field order', () => {
  beforeEach(() => {
    auth.state.session = null;
    signUp.mockClear();
    isHandleFree.mockClear();
    isHandleFree.mockResolvedValue(true);
  });

  it('asks for a name first, with everything else empty too', async () => {
    render(<SignUpScreen navigation={nav()} />);
    submit();

    expect(await screen.findByText('Tell us what to call you.')).toBeTruthy();
    expect(isHandleFree).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  });

  // The username's shape, named at submit on the field itself rather than
  // in the banner — the field is where the fix goes. Nothing is asked of
  // the server about a handle the shape rules already reject.
  it('names a username the display name could not suggest', async () => {
    // A name with no Latin letters leaves `suggestHandle` nothing to
    // work with, so the field stays empty and the empty case is the
    // handle's own sentence rather than `need_name`.
    render(<SignUpScreen navigation={nav()} />);
    type(field.name(), '日本 太郎');
    expect((field.handle() as HTMLInputElement).value).toBe('');
    submit();

    expect(await screen.findByText('Choose a username.')).toBeTruthy();
    expect(isHandleFree).not.toHaveBeenCalled();
  });

  it('names a username that is too short', async () => {
    render(<SignUpScreen navigation={nav()} />);
    type(field.name(), 'Trang');
    type(field.handle(), 'ab');
    submit();

    expect(await screen.findByText('At least 3 characters.')).toBeTruthy();
    expect(isHandleFree).not.toHaveBeenCalled();
  });

  it('names a username that is too long', async () => {
    // `maxLength` stops the keyboard at twenty; a paste, or a change
    // event in this runner, does not go through the keyboard.
    render(<SignUpScreen navigation={nav()} />);
    type(field.name(), 'Trang');
    type(field.handle(), 'a'.repeat(21));
    submit();

    expect(await screen.findByText('20 characters at most.')).toBeTruthy();
  });

  it('names a username with a character the database refuses', async () => {
    render(<SignUpScreen navigation={nav()} />);
    type(field.name(), 'Trang');
    type(field.handle(), 'tr-ang');
    submit();

    expect(await screen.findByText('Letters, numbers and _ only.')).toBeTruthy();
    expect(isHandleFree).not.toHaveBeenCalled();
  });

  it('asks for an address once the name and username are in', async () => {
    render(<SignUpScreen navigation={nav()} />);
    type(field.name(), 'Trang');
    type(field.password(), 'short');
    submit();

    // Not the password: the address sits above it.
    expect(await screen.findByText('Enter your email address.')).toBeTruthy();
    expect(screen.queryByText('Password must be at least 8 characters.')).toBeNull();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('refuses a short password before comparing it with the confirmation', async () => {
    render(<SignUpScreen navigation={nav()} />);
    type(field.name(), 'Trang');
    type(field.email(), 'a@b.co');
    type(field.password(), 'short');
    type(field.confirm(), 'different');
    submit();

    expect(await screen.findByText('Password must be at least 8 characters.')).toBeTruthy();
    expect(screen.queryByText("Passwords don't match.")).toBeNull();
    expect(screen.queryByText('What are you into?')).toBeNull();
  });

  it('refuses a confirmation that does not match', async () => {
    render(<SignUpScreen navigation={nav()} />);
    type(field.name(), 'Trang');
    type(field.email(), 'a@b.co');
    type(field.password(), 'password1');
    type(field.confirm(), 'password2');
    submit();

    expect(await screen.findByText("Passwords don't match.")).toBeTruthy();
    expect(screen.queryByText('What are you into?')).toBeNull();
    expect(signUp).not.toHaveBeenCalled();
  });

  // The suggestion stops the moment the field is edited: a suggestion
  // that keeps overwriting what you typed is worse than none.
  it('suggests the username from the name, until the username is edited', () => {
    render(<SignUpScreen navigation={nav()} />);
    type(field.name(), 'Nguyễn Văn A');
    expect((field.handle() as HTMLInputElement).value).toBe('nguyenvana');

    type(field.handle(), '@Mine');
    expect((field.handle() as HTMLInputElement).value).toBe('mine');
    type(field.name(), 'Somebody Else');
    expect((field.handle() as HTMLInputElement).value).toBe('mine');
  });
});

// ── the code step ──
//
// With confirmation on, `signUp` lands no session: the account exists
// but cannot be used until the emailed code is entered, and the taste
// picked one screen earlier has been waiting for a session to belong to.

describe('the code step', () => {
  beforeEach(() => {
    auth.state.session = null;
    signUp.mockClear();
    auth.confirmSignUp.mockClear();
    auth.confirmSignUp.mockImplementation(async () => { auth.state.session = { user: { id: 'u1' } }; });
    savePreferences.mockClear();
    isHandleFree.mockResolvedValue(true);
    needsCode.value = null;
  });

  const codeField = () => screen.getByPlaceholderText('Paste the code from the email') as HTMLInputElement;
  const verify = () => fireEvent.click(screen.getByRole('button', { name: 'Verify & continue' }));

  /** Through the form and the taste step, on a server that wants a code. */
  const reachCode = async (pick: string[] = []) => {
    signUp.mockImplementationOnce(async () => ({ needsConfirm: true }));
    render(<SignUpScreen navigation={nav()} />);
    fillForm();
    await screen.findByText('What are you into?');
    for (const chip of pick) fireEvent.click(screen.getByText(chip));
    fireEvent.click(screen.getByRole('button', { name: pick.length ? 'Continue' : 'Skip for now' }));
    await screen.findByText('Check your email');
  };

  it('says which address the code went to', async () => {
    await reachCode();
    expect(screen.getByText(/We sent a confirmation code to a@b\.co\./)).toBeTruthy();
  });

  it('asks for the code before asking the server anything', async () => {
    await reachCode();
    verify();

    expect(await screen.findByText('Enter the code from the email.')).toBeTruthy();
    expect(auth.confirmSignUp).not.toHaveBeenCalled();
  });

  it('keeps only the digits of what was pasted', async () => {
    await reachCode();
    type(codeField(), '12 34 56');
    expect(codeField().value).toBe('123456');
  });

  it('confirms with the address and the code, then arrives', async () => {
    await reachCode();
    type(codeField(), '123456');
    verify();

    await waitFor(() => expect(auth.confirmSignUp).toHaveBeenCalledWith('a@b.co', '123456'));
    expect(await screen.findByText('Welcome, Trang')).toBeTruthy();
  });

  it('shows a refused code in place, and stays on the step', async () => {
    auth.confirmSignUp.mockImplementationOnce(async () => { throw new Error('Token has expired or is invalid'); });
    await reachCode();
    type(codeField(), '123456');
    verify();

    // Not a name `useFailText` knows, so the server's own words, as a
    // sentence — and the field is still there to try again in.
    expect(await screen.findByText('Token has expired or is invalid')).toBeTruthy();
    expect(screen.getByText('Check your email')).toBeTruthy();
    expect(screen.queryByText('Welcome, Trang')).toBeNull();
  });

  // The whole reason the taste is held rather than written at the tap:
  // there is no session to write it under until the code lands.
  it('writes the taste only once the code has landed a session', async () => {
    await reachCode(['Cafés']);
    expect(savePreferences).not.toHaveBeenCalled();

    type(codeField(), '123456');
    verify();

    await waitFor(() => expect(savePreferences).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ categories: ['cafes'] }),
    ));
    expect(savePreferences).toHaveBeenCalledTimes(1);
  });

  // The bar grew to three on this screen, and going back to fix the
  // address must not shrink it again: three is now known to be the truth.
  it('goes back to the form, which now promises three steps too', async () => {
    await reachCode();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('button', { name: 'Sign up' })).toBeTruthy();
    expect(screen.getByLabelText('Step 1 of 3')).toBeTruthy();
    expect((field.email() as HTMLInputElement).value).toBe('a@b.co');
  });
});

// ── whose account the taste is written to ──
//
// The write fires on whichever session is present, so it has to know
// the session that was there *before* `signUp` — a screen reached while
// already signed in must not write this taste onto that account.

describe('a reader who was already signed in', () => {
  beforeEach(() => {
    auth.state.session = { user: { id: 'u0' } };
    signUp.mockClear();
    auth.confirmSignUp.mockClear();
    auth.confirmSignUp.mockImplementation(async () => { auth.state.session = { user: { id: 'u1' } }; });
    savePreferences.mockClear();
    isHandleFree.mockResolvedValue(true);
    needsCode.value = null;
  });

  it('writes the taste to the new account, never to the old one', async () => {
    render(<SignUpScreen navigation={nav()} />);
    fillForm();
    await screen.findByText('What are you into?');
    fireEvent.click(screen.getByText('Cafés'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(savePreferences).toHaveBeenCalledWith('u1', expect.anything()));
    expect(savePreferences).not.toHaveBeenCalledWith('u0', expect.anything());
  });

  it('writes nothing while the old session is still the only one', async () => {
    // Confirmation on: `signUp` lands no session, so the session present
    // is still the old account's — and the taste stays held.
    signUp.mockImplementationOnce(async () => ({ needsConfirm: true }));
    render(<SignUpScreen navigation={nav()} />);
    fillForm();
    await screen.findByText('What are you into?');
    fireEvent.click(screen.getByText('Cafés'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Check your email');

    expect(savePreferences).not.toHaveBeenCalled();
  });
});

// ── the ways out ──

describe('the ways out', () => {
  beforeEach(() => {
    auth.state.session = null;
    signUp.mockClear();
    signUp.mockImplementation(async () => { auth.state.session = { user: { id: 'u1' } }; return { needsConfirm: false }; });
    isHandleFree.mockResolvedValue(true);
  });

  it('leaves the form through the header, by the stack', () => {
    const navigation = nav();
    render(<SignUpScreen navigation={navigation} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('swaps itself for Sign in rather than stacking on it', () => {
    const navigation = nav();
    render(<SignUpScreen navigation={navigation} />);
    fireEvent.click(screen.getByText('Sign in'));
    expect(navigation.replace).toHaveBeenCalledWith('SignIn');
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  // The taste step used to refuse a back control — "the form is spent
  // and the account is made". Neither is true any more.
  it('lets the taste step go back to a form that is still filled in', async () => {
    const navigation = nav();
    render(<SignUpScreen navigation={navigation} />);
    fillForm();
    await screen.findByText('What are you into?');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('button', { name: 'Sign up' })).toBeTruthy();
    expect((field.email() as HTMLInputElement).value).toBe('a@b.co');
    // Its own step, not the stack's.
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('starts exploring by leaving the auth stack behind', async () => {
    const navigation = nav();
    render(<SignUpScreen navigation={navigation} />);
    fillForm();
    fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }));
    fireEvent.click(await screen.findByRole('button', { name: /Start exploring/ }));

    // Two routes under this one, so `leaveAuth` pops to the tab root.
    expect(navigation.popToTop).toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
