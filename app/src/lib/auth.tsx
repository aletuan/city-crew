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
import { decode } from 'base64-arraybuffer';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';

export type Profile = {
  full_name: string;
  location: string;
  bio: string;
  interests: string;
  /** Public URL of the uploaded avatar, with a cache-busting stamp. */
  avatar_url: string;
};

/** The circle is 96pt at most; a 4MB camera original would be paid for on
 *  mobile data and thrown away by the renderer. */
const AVATAR_PX = 512;
const AVATAR_QUALITY = 0.8;

/**
 * A request that never settles is worse than one that fails: the spinner
 * spins forever and nobody learns anything. Each step names itself, so a
 * stall says which one stalled instead of just "loading".
 */
function withTimeout<T>(work: Promise<T>, ms: number, step: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${step} took longer than ${Math.round(ms / 1000)}s — check your connection and try again.`)), ms)),
  ]);
}

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
  /** Compress, upload and save in one step — the avatar is its own object,
   *  not a field of the edit form. */
  setAvatar: (localUri: string) => Promise<void>;
  clearAvatar: () => Promise<void>;
  signOut: () => Promise<void>;
};

const EMPTY_PROFILE: Profile = { full_name: '', location: '', bio: '', interests: '', avatar_url: '' };

const Ctx = createContext<Auth>({
  ready: false, session: null, email: null, profile: EMPTY_PROFILE, memberSince: null,
  signIn: async () => {}, signUp: async () => ({ needsConfirm: false }),
  confirmSignUp: async () => {}, requestReset: async () => {}, resetPassword: async () => {},
  updateProfile: async () => {}, setAvatar: async () => {}, clearAvatar: async () => {},
  signOut: async () => {},
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

  const setAvatar = useCallback(async (localUri: string) => {
    // The id comes from the session already in memory. getUser() would go
    // to the network for something we hold, and every extra auth call takes
    // the client's auth lock — the surest way to make an upload appear to
    // hang forever is to queue it behind a token refresh that stalled.
    const uid = session?.user?.id;
    if (!uid) throw new Error('Not signed in');

    const shrunk = await withTimeout(
      manipulateAsync(
        localUri,
        [{ resize: { width: AVATAR_PX } }],
        { compress: AVATAR_QUALITY, format: SaveFormat.JPEG, base64: true },
      ),
      20_000,
      'Preparing the photo',
    );
    if (!shrunk.base64) throw new Error('Could not read the picked image');

    // One object per person, overwritten. Nothing accumulates, so nothing
    // needs sweeping up — at the cost of a stable URL, handled below.
    const path = `${uid}/avatar.jpg`;
    const { error } = await withTimeout(
      supabase.storage
        .from('avatars')
        .upload(path, decode(shrunk.base64), { contentType: 'image/jpeg', upsert: true }),
      45_000,
      'Uploading the photo',
    );
    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    // The path never changes, so a plain URL would show the old face from
    // cache long after the new one is stored. The stamp is what makes the
    // change visible.
    await withTimeout(
      supabase.auth.updateUser({ data: { avatar_url: `${data.publicUrl}?v=${Date.now()}` } }),
      20_000,
      'Saving the photo',
    );
  }, [session]);

  const clearAvatar = useCallback(async () => {
    const uid = session?.user?.id;
    if (uid) await supabase.storage.from('avatars').remove([`${uid}/avatar.jpg`]);
    // Clearing the pointer is what removes the avatar; a failed delete
    // leaves an orphan object nobody can reach, not a visible avatar.
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: '' } });
    if (error) throw new Error(error.message);
  }, [session]);

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
        avatar_url: meta.avatar_url ?? '',
      },
      memberSince: session?.user?.created_at ? new Date(session.user.created_at) : null,
      signIn, signUp, confirmSignUp, requestReset, resetPassword, updateProfile,
      setAvatar, clearAvatar, signOut,
    };
  }, [ready, session, signIn, signUp, confirmSignUp, requestReset, resetPassword,
      updateProfile, setAvatar, clearAvatar, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
