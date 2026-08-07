// Auth: real Supabase sessions in the app.
//
// Sign-in is email OTP (6-digit code) rather than magic links — links
// would deep-link back into Expo Go, codes work anywhere. The session
// persists in AsyncStorage and refreshes while the app is foregrounded.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type Auth = {
  /** Null until the persisted session has been read once. */
  ready: boolean;
  session: Session | null;
  email: string | null;
  /** Send a 6-digit code to this address. Throws with a readable message. */
  requestCode: (email: string) => Promise<void>;
  /** Exchange the emailed code for a session. */
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Auth>({
  ready: false, session: null, email: null,
  requestCode: async () => {}, verifyCode: async () => {}, signOut: async () => {},
});

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Token refresh runs on a timer; only keep it running while the app is
  // in the foreground (the supabase-js guidance for React Native).
  useEffect(() => {
    supabase.auth.startAutoRefresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      sub.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  const requestCode = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw new Error(error.message);
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo<Auth>(() => ({
    ready,
    session,
    email: session?.user?.email ?? null,
    requestCode,
    verifyCode,
    signOut,
  }), [ready, session, requestCode, verifyCode, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
