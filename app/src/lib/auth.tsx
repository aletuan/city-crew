// Auth: email + password sessions in the app.
//
// Confirmation and recovery emails normally carry links, which can't
// deep-link back into Expo Go — so where Supabase demands verification
// the flows fall back to 6-digit codes (verifyOtp), which work anywhere
// as long as the email templates include {{ .Token }}. The session
// persists in AsyncStorage and refreshes while the app is foregrounded.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthError, Session } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { authFail } from './authfail';
import { cacheKey, packCache, unpackCache } from './data/cache';
import { supabase } from './supabase';
import { normalizeHandle } from './handle';

/**
 * Postgres constraint violations, as something a screen can branch on.
 *
 * The raw messages are legible to a developer and to nobody else — a
 * unique-index violation names the index. These two are the ones a person
 * can act on, so they get names; everything else passes through.
 */
export type AuthFail = 'handle_taken' | 'handle_reserved';

function asFail(e: { code?: string; message: string }): string {
  if (e.code === '23505') return 'handle_taken';
  if (e.message.includes('handle_reserved')) return 'handle_reserved';
  return e.message;
}

/**
 * The same trick on the auth side: Supabase's failure, as a name a screen
 * can translate.
 *
 * The name rides in the `Error`'s message, exactly as `handle_taken` does
 * above, which is what keeps the `Auth` contract below unchanged — a
 * screen still catches an `Error` and reads `.message`. It has to travel
 * that way rather than as a finished sentence, because `t()` is a hook
 * and lives on the screen; see `useFailText` in `components/authUi`.
 *
 * A failure `authFail` has no name for keeps the server's own words. That
 * is the deliberate half: "Invalid login credentials" is a different
 * problem from "Email not confirmed", and English that says which one
 * beats Vietnamese that does not.
 */
function asAuthFail(e: AuthError): Error {
  return new Error(authFail(e.code, e.message) ?? e.message);
}

/**
 * Whether a handle is free. UX only — two people can both be told yes in
 * the same instant. The unique index is what actually decides, which is
 * why the write path has to handle losing anyway.
 */
export async function isHandleFree(input: string): Promise<boolean> {
  const handle = normalizeHandle(input);
  if (!handle) return false;
  const [taken, reserved] = await Promise.all([
    supabase.from('profiles').select('id').ilike('handle', handle).maybeSingle(),
    supabase.from('reserved_handles').select('handle').eq('handle', handle).maybeSingle(),
  ]);
  return !taken.data && !reserved.data;
}

export type Profile = {
  /** Unique, lower case, URL-safe. Set at sign-up; changeable later. */
  handle: string;
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
 *
 * `step` is one of `FormFail`'s names rather than a phrase, for the reason
 * every failure here travels as a name: this module cannot call `t`, and
 * the sentence it used to build was English on a screen the reader may
 * have set to Vietnamese. The seconds went with it — a reader does nothing
 * differently at 20 than at 45, and which step stalled was always the part
 * that carried information.
 */
function withTimeout<T>(work: Promise<T>, ms: number, step: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(step)), ms)),
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
  signUp: (name: string, handle: string, email: string, password: string) => Promise<{ needsConfirm: boolean }>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  requestReset: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  /** Compress, upload and save in one step — the avatar is its own object,
   *  not a field of the edit form. */
  setAvatar: (localUri: string) => Promise<void>;
  clearAvatar: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Delete the account and everything personal under it. The server
   *  deletes exactly the account the token proves — see the
   *  delete-account function — and the local session is cleared after,
   *  best-effort, since the server has already invalidated it. */
  deleteAccount: () => Promise<void>;
};

const EMPTY_PROFILE: Profile = { handle: '', full_name: '', location: '', bio: '', interests: '', avatar_url: '' };

const Ctx = createContext<Auth>({
  ready: false, session: null, email: null, profile: EMPTY_PROFILE, memberSince: null,
  signIn: async () => {}, signUp: async () => ({ needsConfirm: false }),
  confirmSignUp: async () => {}, requestReset: async () => {}, resetPassword: async () => {},
  updateProfile: async () => {}, setAvatar: async () => {}, clearAvatar: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
});

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // The profile is a row now, not a claim inside the token, so it has to
  // be fetched — and refetched whenever the account changes. Signing out
  // clears it rather than leaving the last person's name on screen while
  // the next one loads.
  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) { setProfile(EMPTY_PROFILE); return; }
    // The last launch's answer first. Every open used to start on the
    // empty profile and wait a network round-trip for the row, and the
    // reader watched their own face fade in a second late — the launch
    // cache the catalog and the crew already use, applied to the one row
    // the header wears. Only onto the empty profile: if the fetch below
    // (or a profile edit) has already written, a stale stash must not
    // undo it. Keyed by uid, so another account is a miss, never a wrong
    // hit; a cache is a convenience, so its failures are swallowed.
    try {
      const hit = unpackCache<Profile[]>(
        await AsyncStorage.getItem(cacheKey('profile', 'all', uid)), Date.now(),
      );
      const kept = hit?.data[0];
      if (kept) setProfile((p) => (p === EMPTY_PROFILE ? kept : p));
    } catch { /* nothing worth surfacing: the fetch below is the truth */ }
    const { data } = await supabase
      .from('profiles')
      .select('handle, full_name, bio, location, interests, avatar_url')
      .eq('id', uid)
      .maybeSingle();
    // A miss leaves the empty profile in place. The row is made by a
    // trigger on sign-up, so the only way to miss is to read before that
    // commits; the next auth event refetches.
    if (data) setProfile(data as Profile);
  }, []);

  useEffect(() => { void loadProfile(session?.user?.id); }, [session?.user?.id, loadProfile]);

  // Keep the stash in step with every way the profile changes — the
  // fetch above, an edit, an avatar set or cleared — by watching the one
  // state they all write. The empty profile is never stashed: it is the
  // signed-out state, not an answer.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || profile === EMPTY_PROFILE) return;
    AsyncStorage
      .setItem(cacheKey('profile', 'all', uid), packCache([profile], Date.now()))
      .catch(() => {});
  }, [profile, session?.user?.id]);

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
    if (error) throw asAuthFail(error);
  }, []);

  // The handle rides in the metadata for the `handle_new_user` trigger to
  // read. It is a request rather than a reservation: if it was taken in
  // the moment between the check and this call, the trigger falls back to
  // a generated one rather than failing the account into existence.
  const signUp = useCallback(async (name: string, handle: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, handle: handle.toLowerCase() } },
    });
    if (error) throw asAuthFail(error);
    return { needsConfirm: !data.session };
  }, []);

  const confirmSignUp = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    if (error) throw asAuthFail(error);
  }, []);

  const requestReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw asAuthFail(error);
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (error) throw asAuthFail(error);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw asAuthFail(updateError);
  }, []);

  // Writes the row and keeps the copy in memory in step. There is no auth
  // event behind a table write, so nothing else will do it.
  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    const uid = session?.user?.id;
    if (!uid) throw new Error('not_signed_in');
    const clean = patch.handle === undefined ? patch : { ...patch, handle: patch.handle.toLowerCase().trim() };
    const { error } = await supabase.from('profiles').update(clean).eq('id', uid);
    if (error) throw new Error(asFail(error));
    setProfile((p) => ({ ...p, ...clean }));
  }, [session]);

  // `not_signed_in` and `bad_image` below are names, not sentences, for
  // `asAuthFail`'s reason: `t` is a hook and this module is not a
  // component. `useFailText` has the words.
  const setAvatar = useCallback(async (localUri: string) => {
    // The id comes from the session already in memory. getUser() would go
    // to the network for something we hold, and every extra auth call takes
    // the client's auth lock — the surest way to make an upload appear to
    // hang forever is to queue it behind a token refresh that stalled.
    const uid = session?.user?.id;
    if (!uid) throw new Error('not_signed_in');

    const shrunk = await withTimeout(
      manipulateAsync(
        localUri,
        [{ resize: { width: AVATAR_PX } }],
        { compress: AVATAR_QUALITY, format: SaveFormat.JPEG, base64: true },
      ),
      20_000,
      'slow_prepare',
    );
    if (!shrunk.base64) throw new Error('bad_image');

    // One object per person, overwritten. Nothing accumulates, so nothing
    // needs sweeping up — at the cost of a stable URL, handled below.
    const path = `${uid}/avatar.jpg`;
    const { error } = await withTimeout(
      supabase.storage
        .from('avatars')
        .upload(path, decode(shrunk.base64), { contentType: 'image/jpeg', upsert: true }),
      45_000,
      'slow_upload',
    );
    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    // The path never changes, so a plain URL would show the old face from
    // cache long after the new one is stored. The stamp is what makes the
    // change visible.
    const url = `${data.publicUrl}?v=${Date.now()}`;
    // Wrapped in a real Promise: PostgREST's builder is thenable but not
    // one, and withTimeout races a Promise.
    const { error: saveError } = await withTimeout(
      Promise.resolve(supabase.from('profiles').update({ avatar_url: url }).eq('id', uid)),
      20_000,
      'slow_save',
    );
    if (saveError) throw new Error(saveError.message);
    setProfile((p) => ({ ...p, avatar_url: url }));
  }, [session]);

  const clearAvatar = useCallback(async () => {
    const uid = session?.user?.id;
    if (uid) await supabase.storage.from('avatars').remove([`${uid}/avatar.jpg`]);
    // Clearing the pointer is what removes the avatar; a failed delete
    // leaves an orphan object nobody can reach, not a visible avatar.
    const { error } = await supabase.from('profiles').update({ avatar_url: '' }).eq('id', uid);
    if (error) throw new Error(error.message);
    setProfile((p) => ({ ...p, avatar_url: '' }));
  }, [session]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const deleteAccount = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
    // Through `authFail` like every other failure in this file, though
    // this one is a `FunctionsError` and carries no code. The message is
    // all there is, and it is the one case `authFail` reads a message
    // for: a phone that lost signal mid-delete said "Network request
    // failed", in English, on a screen the reader had set to Vietnamese.
    if (error) throw new Error(authFail(undefined, error.message) ?? error.message);
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    // The account is gone server-side; the local sign-out only clears
    // this device's stored session, and failing at that must not make a
    // completed deletion look like it did not happen.
    await supabase.auth.signOut().catch(() => {});
  }, []);

  const value = useMemo<Auth>(() => {
    return {
      ready,
      session,
      email: session?.user?.email ?? null,
      profile,
      memberSince: session?.user?.created_at ? new Date(session.user.created_at) : null,
      signIn, signUp, confirmSignUp, requestReset, resetPassword, updateProfile,
      setAvatar, clearAvatar, signOut, deleteAccount,
    };
  }, [ready, session, profile, signIn, signUp, confirmSignUp, requestReset, resetPassword,
      updateProfile, setAvatar, clearAvatar, signOut, deleteAccount]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
