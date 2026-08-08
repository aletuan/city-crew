// Auth: email + password sessions in the app.
//
// Confirmation and recovery emails normally carry links, which can't
// deep-link back into Expo Go — so where Supabase demands verification
// the flows fall back to 6-digit codes (verifyOtp), which work anywhere
// as long as the email templates include {{ .Token }}. The session
// persists in AsyncStorage and refreshes while the app is foregrounded.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Profile = {
  full_name: string;
  location: string;
  bio: string;
  interests: string;
};

type Auth = {
  /** False until the persisted session has been read once. */
  ready: boolean;
  session: Session | null;
  email: string | null;
  /** Editable fields, stored in user metadata. */
  profile: Profile;
  /** Account creation, as a Date — for "Member since". */
  memberSince: Date | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** True result = confirmation required; verify with confirmSignUp. */
  signUp: (name: string, email: string, password: string) => Promise<{ needsConfirm: boolean }>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  requestReset: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  signOut: () => Promise<void>;
};

const EMPTY_PROFILE: Profile = { full_name: '', location: '', bio: '', interests: '' };

const Ctx = createContext<Auth>({
  ready: false, session: null, email: null, profile: EMPTY_PROFILE, memberSince: null,
  signIn: async () => {}, signUp: async () => ({ needsConfirm: false }),
  confirmSignUp: async () => {}, requestReset: async () => {}, resetPassword: async () => {},
  updateProfile: async () => {}, signOut: async () => {},
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

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw new Error(error.message);
    return { needsConfirm: !data.session };
  }, []);

  const confirmSignUp = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    if (error) throw new Error(error.message);
  }, []);

  const requestReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (error) throw new Error(error.message);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw new Error(updateError.message);
  }, []);

  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    const { error } = await supabase.auth.updateUser({ data: patch });
    if (error) throw new Error(error.message);
    // onAuthStateChange fires USER_UPDATED with the fresh metadata.
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo<Auth>(() => {
    const meta = (session?.user?.user_metadata ?? {}) as Partial<Profile>;
    return {
      ready,
      session,
      email: session?.user?.email ?? null,
      profile: {
        full_name: meta.full_name ?? '',
        location: meta.location ?? '',
        bio: meta.bio ?? '',
        interests: meta.interests ?? '',
      },
      memberSince: session?.user?.created_at ? new Date(session.user.created_at) : null,
      signIn, signUp, confirmSignUp, requestReset, resetPassword, updateProfile, signOut,
    };
  }, [ready, session, signIn, signUp, confirmSignUp, requestReset, resetPassword, updateProfile, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
