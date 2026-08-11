// Magic-link sign-in gate. The whole dashboard renders behind this.
//
// Two gates, not one. A session gets you past the first; the second asks
// public.is_editor(), because the desk is for admins and everyone else who
// holds an account holds it for the mobile app. Letting a non-editor
// through would hand them a desk where every button fails on save — RLS
// would stop the damage, but only after the UI promised otherwise.

import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';

export const signOut = () => supabase.auth.signOut();

function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState(null);

  const send = async (e) => {
    e.preventDefault();
    setState('sending');
    // Redirect back to exactly where the app is served (works for GitHub
    // Pages subpaths and local dev alike). Must be allow-listed in
    // Supabase Auth → URL Configuration.
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (err) {
      setError(err.message);
      setState('error');
    } else {
      setState('sent');
    }
  };

  return (
    <div className="login">
      <img className="loginlogo" src="logo.png" alt="cityCrew" />
      <h1>Data desk</h1>
      <p className="loginsub">Sign in to curate places from anywhere.</p>
      {state === 'sent' ? (
        <p className="loginsent">
          Check <b>{email}</b> — tap the sign-in link in the email to continue.
        </p>
      ) : (
        <form onSubmit={send}>
          <input
            type="email"
            required
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email address"
          />
          <button type="submit" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </button>
          {state === 'error' && <p className="loginerror">{error}</p>}
        </form>
      )}
    </div>
  );
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

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [editor, setEditor] = useState(undefined); // undefined = unknown yet

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
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
  if (editor === undefined) return <div className="empty">Checking access…</div>;
  if (!editor) return <NotAnEditor email={session.user?.email} />;
  return children;
}
