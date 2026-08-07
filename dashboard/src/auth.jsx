// Magic-link sign-in gate. The whole dashboard renders behind this: no
// session → login screen. Note that a session alone grants nothing — writes
// only work for accounts on the public.editors allow-list (RLS).

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

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="empty">Loading…</div>;
  if (!session) return <Login />;
  return children;
}
