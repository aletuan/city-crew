// The gate in front of the whole dashboard.
//
// Two gates, not one. A session gets you past the first; the second asks
// public.is_editor(), because the desk is for admins and everyone else who
// holds an account holds it for the mobile app. Letting a non-editor
// through would hand them a desk where every button fails on save — RLS
// would stop the damage, but only after the UI promised otherwise.
//
// Password is the way in, and the link is the way back when the password
// is gone. It used to be the other way round, which meant *every* sign-in
// depended on email being deliverable — a dependency that has already
// broken once, when the SMTP credentials lapsed and `/recover` came back
// 535 for a day. A password only needs email on the day you forget it.
//
// The link stays, because it is the one thing that still works when you
// have lost the password and are standing at a machine that is not yours.

import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

export const signOut = () => supabase.auth.signOut();

/** Where an emailed link should land: exactly where this app is served, so
 *  it works on the Pages subpath and on localhost alike. Must be
 *  allow-listed under Auth → URL Configuration, or the mail arrives and the
 *  link returns you to this screen having done nothing. */
const redirectTo = () => window.location.origin + window.location.pathname;

function Login() {
  const [mode, setMode] = useState('password'); // password | link
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState('idle'); // idle | busy | sent | reset | error
  const [error, setError] = useState(null);

  const fail = (err) => { setError(err.message); setState('error'); };

  const signIn = async (e) => {
    e.preventDefault();
    setState('busy');
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    // No state on success: the auth listener swaps this whole screen out,
    // and setting state on an unmounting component is how you get a
    // warning for nothing.
    if (err) fail(err);
  };

  const sendLink = async (e) => {
    e.preventDefault();
    setState('busy');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo() },
    });
    if (err) fail(err); else setState('sent');
  };

  // Deliberately the same wording whether or not the address is known.
  // "No account with that email" is a free membership check for anyone who
  // wants to know who curates this catalog.
  const sendReset = async () => {
    if (!email.trim()) { setError('Enter your email first.'); setState('error'); return; }
    setState('busy');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectTo(),
    });
    if (err) fail(err); else setState('reset');
  };

  if (state === 'sent' || state === 'reset') {
    return (
      <div className="login">
        <img className="loginlogo" src="logo.png" alt="cityCrew" />
        <h1>Data desk</h1>
        <p className="loginsent">
          {state === 'sent'
            ? <>Check <b>{email}</b> — tap the sign-in link in the email to continue.</>
            : <>If <b>{email}</b> has an account, a password-reset link is on its way.</>}
        </p>
        <button className="syncbtn" style={{ marginTop: 18 }} onClick={() => setState('idle')}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="login">
      <img className="loginlogo" src="logo.png" alt="cityCrew" />
      <h1>Data desk</h1>
      <p className="loginsub">Sign in to curate places from anywhere.</p>

      <form onSubmit={mode === 'password' ? signIn : sendLink}>
        <input
          type="email"
          required
          autoFocus
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
        />
        {mode === 'password' && (
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Password"
          />
        )}
        <button type="submit" disabled={state === 'busy'}>
          {state === 'busy'
            ? 'Working…'
            : mode === 'password' ? 'Sign in' : 'Email me a sign-in link'}
        </button>
        {state === 'error' && <p className="loginerror">{error}</p>}
      </form>

      <div className="loginalt">
        {mode === 'password' ? (
          <>
            <button type="button" onClick={sendReset}>Forgot password?</button>
            <span>·</span>
            <button type="button" onClick={() => { setMode('link'); setState('idle'); }}>
              Email me a link instead
            </button>
          </>
        ) : (
          <button type="button" onClick={() => { setMode('password'); setState('idle'); }}>
            Use a password
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Arrived from a reset link, holding a session and no password worth
 * having.
 *
 * This has to intercept a *signed-in* state, which is why it cannot live
 * inside `Login`. A recovery link produces a real session, so without the
 * interception the desk would simply open and the reason the person
 * clicked would be forgotten.
 */
function SetPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [state, setState] = useState('idle');
  const [error, setError] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    setState('busy');
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setState('error'); return; }
    onDone();
  };

  return (
    <div className="login">
      <img className="loginlogo" src="logo.png" alt="cityCrew" />
      <h1>Set a new password</h1>
      <p className="loginsub">You are signed in — choose a password for next time.</p>
      <form onSubmit={save}>
        <input
          type="password"
          required
          autoFocus
          minLength={8}
          autoComplete="new-password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label="New password"
        />
        <button type="submit" disabled={state === 'busy'}>
          {state === 'busy' ? 'Saving…' : 'Save and continue'}
        </button>
        {state === 'error' && <p className="loginerror">{error}</p>}
      </form>
      <div className="loginalt">
        {/* A way past it. The session is already valid, so insisting on a
            new password here would be a lock with the door standing open. */}
        <button type="button" onClick={onDone}>Skip for now</button>
      </div>
    </div>
  );
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [editor, setEditor] = useState(undefined); // undefined = unknown yet
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Fired when the session came from a reset link rather than from
      // signing in. It is the only signal that says *why* this session
      // exists, and without acting on it the desk opens and the reset is
      // silently abandoned.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // is_editor() is a security-definer function: the editors table itself is
  // unreadable from the browser, so this is the only way to ask.
  useEffect(() => {
    if (!session) { setEditor(undefined); return; }
    let live = true;
    supabase.rpc('is_editor').then(({ data, error }) => {
      // A failed check is not a pass. Treat it as "not an editor" and let
      // the person sign out rather than showing a desk that cannot save.
      if (live) setEditor(error ? false : !!data);
    });
    return () => { live = false; };
  }, [session]);

  if (session === undefined) return <div className="empty">Loading…</div>;
  if (!session) return <Login />;
  // Before the editor check, deliberately. Someone resetting a password
  // should be able to finish doing so whether or not they curate anything.
  if (recovering) return <SetPassword onDone={() => setRecovering(false)} />;
  if (editor === undefined) return <div className="empty">Checking access…</div>;
  if (!editor) return <NotAnEditor email={session.user?.email} />;
  return children;
}

/** Signed in, but not on the allow-list. The only way out is a different
 *  account, so the one action offered is signing out. */
function NotAnEditor({ email }) {
  return (
    <div className="login">
      <img className="loginlogo" src="logo.png" alt="cityCrew" />
      <h1>Data desk</h1>
      <p className="loginsub">Editors only</p>
      <p className="loginsent">
        <b>{email}</b> is signed in, but isn't on the editor list. The desk is
        for curating the catalog; the mobile app is where accounts belong.
      </p>
      <button className="syncbtn" style={{ marginTop: 18 }} onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
