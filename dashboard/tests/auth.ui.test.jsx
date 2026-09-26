// The gate in front of the whole desk.
//
// `authGate.js` decides which view is showing and is tested as a function
// in auth.test.mjs. What that could not reach is everything around the
// decision: the two forms, which client call each button makes and with
// what, the recovery event that has to be intercepted before the desk
// opens, and the words — the reset message that reads the same whether
// or not the address is known, because a different one is a free
// membership check for anyone curious who curates this catalog.

import React from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuthGate from '../src/auth.jsx';
import { supabase } from '../src/lib/supabase.js';

const { auth } = supabase;
const SESSION = { user: { email: 'editor@example.com' } };
const gate = () => render(<AuthGate><div data-testid="desk">the desk</div></AuthGate>);

/** The listener AuthGate registered, so a test can fire an auth event. */
const listener = () => auth.onAuthStateChange.mock.calls[0][0];

const typeEmail = (v) => fireEvent.change(screen.getByLabelText('Email address'), { target: { value: v } });

describe('AuthGate', () => {
  it('is loading until the session is read, then signed out', async () => {
    let finish;
    auth.getSession.mockReturnValue(new Promise((r) => { finish = r; }));
    gate();
    expect(screen.getByText('Loading…')).toBeTruthy();
    finish({ data: { session: null } });
    expect(await screen.findByRole('heading', { name: 'Data desk' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(screen.queryByTestId('desk')).toBeNull();
  });

  it('signs in with the trimmed email and the password as typed', async () => {
    let finish;
    auth.signInWithPassword.mockReturnValue(new Promise((r) => { finish = r; }));
    gate();
    await screen.findByRole('button', { name: 'Sign in' });
    typeEmail('  editor@example.com ');
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: ' hunter2 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'editor@example.com', password: ' hunter2 ' });
    expect((await screen.findByRole('button', { name: 'Working…' })).disabled).toBe(true);
    // Success sets nothing: the listener swaps the screen. A wrong password
    // shows the reason and hands the form back.
    await act(async () => finish({ error: { message: 'Invalid login credentials' } }));
    expect(await screen.findByText('Invalid login credentials')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' }).disabled).toBe(false);
  });

  it('the link is the way back: sent to where the desk is served', async () => {
    gate();
    await screen.findByRole('button', { name: 'Sign in' });
    fireEvent.click(screen.getByRole('button', { name: 'Email me a link instead' }));
    expect(screen.queryByLabelText('Password')).toBeNull();
    typeEmail('editor@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'editor@example.com',
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
    });
    expect(await screen.findByText(/tap the sign-in link in the email/)).toBeTruthy();
    expect(screen.getByText('editor@example.com').tagName).toBe('B');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Email me a sign-in link' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use a password' }));
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });

  it('a link that could not be sent says why', async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { message: 'smtp 535' } });
    gate();
    await screen.findByRole('button', { name: 'Sign in' });
    fireEvent.click(screen.getByRole('button', { name: 'Email me a link instead' }));
    typeEmail('editor@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(await screen.findByText('smtp 535')).toBeTruthy();
  });

  it('a reset needs an address, and reads the same whether or not it is known', async () => {
    gate();
    await screen.findByRole('button', { name: 'Sign in' });
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(await screen.findByText('Enter your email first.')).toBeTruthy();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
    typeEmail('nobody@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('nobody@example.com', {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    expect(await screen.findByText(/has an account, a password-reset link is on its way/)).toBeTruthy();
  });

  it('a reset that failed says why', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'rate limited' } });
    gate();
    await screen.findByRole('button', { name: 'Sign in' });
    typeEmail('editor@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(await screen.findByText('rate limited')).toBeTruthy();
  });

  it('a session opens the desk only once is_editor says yes', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } });
    let finish;
    supabase.rpc.mockReturnValue(new Promise((r) => { finish = r; }));
    gate();
    expect(await screen.findByText('Checking access…')).toBeTruthy();
    expect(supabase.rpc).toHaveBeenCalledWith('is_editor');
    await act(async () => finish({ data: true, error: null }));
    expect(await screen.findByTestId('desk')).toBeTruthy();
  });

  it('an account that is not an editor is shown the door, and a failed check is not a pass', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } });
    supabase.rpc.mockResolvedValue({ data: false, error: null });
    const { unmount } = gate();
    expect(await screen.findByText('Editors only')).toBeTruthy();
    expect(screen.getByText('editor@example.com').tagName).toBe('B');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(auth.signOut).toHaveBeenCalled();
    unmount();
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    gate();
    expect(await screen.findByText('Editors only')).toBeTruthy();
    expect(screen.queryByTestId('desk')).toBeNull();
  });

  it('a recovery link is intercepted before the desk opens, and the new password saved', async () => {
    let finish;
    auth.updateUser.mockReturnValue(new Promise((r) => { finish = r; }));
    gate();
    await screen.findByRole('button', { name: 'Sign in' });
    await act(async () => { listener()('PASSWORD_RECOVERY', SESSION); });
    expect(await screen.findByRole('heading', { name: 'Set a new password' })).toBeTruthy();
    expect(supabase.rpc).toHaveBeenCalledWith('is_editor');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'correct horse' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'correct horse' });
    expect((await screen.findByRole('button', { name: 'Saving…' })).disabled).toBe(true);
    await act(async () => finish({ error: null }));
    expect(await screen.findByTestId('desk')).toBeTruthy();
  });

  it('a password that could not be saved says why; skipping opens the desk anyway', async () => {
    auth.updateUser.mockResolvedValue({ error: { message: 'too short' } });
    gate();
    await screen.findByRole('button', { name: 'Sign in' });
    await act(async () => { listener()('PASSWORD_RECOVERY', SESSION); });
    await screen.findByRole('heading', { name: 'Set a new password' });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText('too short')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(await screen.findByTestId('desk')).toBeTruthy();
  });

  it('signing out through the listener returns to the form, and unmounting unsubscribes', async () => {
    auth.getSession.mockResolvedValue({ data: { session: SESSION } });
    const unsubscribe = auth.onAuthStateChange.mock.results[0]?.value?.data?.subscription?.unsubscribe;
    const { unmount } = gate();
    await screen.findByTestId('desk');
    await act(async () => { listener()('SIGNED_OUT', null); });
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
    unmount();
    await waitFor(() => expect(unsubscribe ?? auth.onAuthStateChange.mock.results[0].value.data.subscription.unsubscribe).toHaveBeenCalled());
  });
});
