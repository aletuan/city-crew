// @vitest-environment jsdom
//
// The account layer.
//
// Every screen reads `useAuth`, and every UI test in this repository mocks
// it — which is right for a test of a screen and means the provider itself
// had never run under a test. What it decides is mostly invisible when it
// works and costly when it does not: whose name is on the header while the
// next account loads, whether a wrong code still changes a password,
// whether a finished deletion is reported as a failure because the local
// sign-out after it tripped.
//
// It runs against `lib/testing`'s client, the same stand-in the query tests
// use, so what is pinned is which calls were made, with what, in what
// order — and which were not made at all.

import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '../uitest/render';
import { cacheKey, packCache } from './data/cache';
import type { fakeSupabase } from './testing';

const h = vi.hoisted(() => ({ fake: null as unknown as ReturnType<typeof fakeSupabase> }));
vi.mock('./supabase', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

const manipulateAsync = vi.hoisted(() => vi.fn());
vi.mock('expo-image-manipulator', () => ({
  manipulateAsync,
  SaveFormat: { JPEG: 'jpeg' },
}));

import { AuthProvider, isHandleFree, useAuth, type Profile } from './auth';

type Api = ReturnType<typeof useAuth>;
/** What the provider last handed its consumers. Written from an effect,
 *  not during render, so the probe stays a pure component. */
const seen = {} as { api: Api };
function Probe() {
  const auth = useAuth();
  useEffect(() => { seen.api = auth; });
  return null;
}

const session = (id = 'u1') => ({
  user: { id, email: `${id}@crew.test`, created_at: '2026-01-02T03:04:05Z' },
});

const row = (over: Partial<Profile> = {}): Profile => ({
  handle: 'ana', full_name: 'Ana', location: 'Hanoi', bio: '', interests: '', avatar_url: '', ...over,
});

const asked = (fn: string) => h.fake.log.filter((a) => a.fn === fn);
const profileKey = (uid: string) => cacheKey('profile', 'all', uid);

/**
 * Mount the provider and wait for it to settle. `signedIn` answers the
 * stored-session read; `fetched` is the profile row the fetch after it
 * finds, which is only asked for when somebody is signed in.
 */
async function mount({ signedIn = null as ReturnType<typeof session> | null, fetched = null as Profile | null } = {}) {
  h.fake.replies({ data: { session: signedIn } });
  if (signedIn) h.fake.replies({ data: fetched });
  const view = render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(seen.api.ready).toBe(true));
  if (signedIn) await waitFor(() => expect(h.fake.log.some((a) => a.table === 'profiles')).toBe(true));
  // The fetch is the last await on the way in; let its answer land.
  await act(async () => {});
  return view;
}

beforeEach(async () => {
  h.fake.reset();
  manipulateAsync.mockReset();
  vi.mocked(AsyncStorage.setItem).mockClear();
  for (const uid of ['u1', 'u2']) await AsyncStorage.removeItem(profileKey(uid));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the session', () => {
  it('is not ready until the stored session has been read', async () => {
    h.fake.replies({ data: { session: null } });
    render(<AuthProvider><Probe /></AuthProvider>);
    // The first frame, before the read resolves. A screen that trusted
    // `session === null` here would send a signed-in reader to sign in.
    expect(seen.api.ready).toBe(false);
    await waitFor(() => expect(seen.api.ready).toBe(true));
    expect(seen.api.session).toBeNull();
    expect(seen.api.email).toBeNull();
  });

  it('carries the stored session, its email and the account’s age', async () => {
    await mount({ signedIn: session('u1'), fetched: row() });
    expect(seen.api.session?.user.id).toBe('u1');
    expect(seen.api.email).toBe('u1@crew.test');
    expect(seen.api.memberSince?.toISOString()).toBe('2026-01-02T03:04:05.000Z');
  });

  it('follows sign-in and sign-out events, and stops listening on unmount', async () => {
    const view = await mount();
    h.fake.replies({ data: row() });
    await act(async () => { h.fake.fireAuth('SIGNED_IN', session('u2')); });
    expect(seen.api.session?.user.id).toBe('u2');
    await act(async () => { h.fake.fireAuth('SIGNED_OUT', null); });
    expect(seen.api.session).toBeNull();
    expect(h.fake.listening()).toBe(1);
    view.unmount();
    expect(h.fake.listening()).toBe(0);
  });
});

describe('the profile', () => {
  it('is read for the signed-in account, by id, forgivingly', async () => {
    await mount({ signedIn: session('u1'), fetched: row({ handle: 'ana' }) });
    const q = h.fake.log.find((a) => a.table === 'profiles')!;
    expect(q.op).toBe('select');
    expect(q.filters).toEqual([['id', 'u1']]);
    expect(q.maybe).toBe(true);
    expect(seen.api.profile.handle).toBe('ana');
  });

  it('shows the last launch’s profile when the fetch finds nothing yet', async () => {
    await AsyncStorage.setItem(profileKey('u1'), packCache([row({ full_name: 'Ana from last time' })], Date.now()));
    await mount({ signedIn: session('u1'), fetched: null });
    expect(seen.api.profile.full_name).toBe('Ana from last time');
  });

  it('lets the fetched row win over the launch cache', async () => {
    await AsyncStorage.setItem(profileKey('u1'), packCache([row({ full_name: 'Stale' })], Date.now()));
    await mount({ signedIn: session('u1'), fetched: row({ full_name: 'Fresh' }) });
    expect(seen.api.profile.full_name).toBe('Fresh');
  });

  it('never shows another account’s cached profile', async () => {
    await AsyncStorage.setItem(profileKey('u2'), packCache([row({ full_name: 'Somebody else' })], Date.now()));
    await mount({ signedIn: session('u1'), fetched: null });
    expect(seen.api.profile.full_name).toBe('');
  });

  it('clears on sign-out rather than keeping the last person’s name on screen', async () => {
    await mount({ signedIn: session('u1'), fetched: row({ full_name: 'Ana' }) });
    expect(seen.api.profile.full_name).toBe('Ana');
    await act(async () => { h.fake.fireAuth('SIGNED_OUT', null); });
    expect(seen.api.profile).toEqual(row({ handle: '', full_name: '', location: '' }));
  });

  it('stashes what it fetched under the account’s key, and never stashes the empty profile', async () => {
    await mount({ signedIn: session('u1'), fetched: row({ handle: 'ana' }) });
    const writes = vi.mocked(AsyncStorage.setItem).mock.calls;
    expect(writes.map(([k]) => k)).toEqual([profileKey('u1')]);
    expect(writes[0][1]).toContain('"handle":"ana"');

    vi.mocked(AsyncStorage.setItem).mockClear();
    await act(async () => { h.fake.fireAuth('SIGNED_OUT', null); });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

describe('failures, as names a screen can translate', () => {
  it('names a wrong password', async () => {
    await mount();
    h.fake.replies({ error: { message: 'Invalid login credentials', code: 'invalid_credentials' } });
    await expect(seen.api.signIn('ana@crew.test', 'nope')).rejects.toThrow('credentials');
    expect(asked('signInWithPassword')[0].payload).toEqual({ email: 'ana@crew.test', password: 'nope' });
  });

  it('names a lost connection, which arrives with no code', async () => {
    await mount();
    h.fake.replies({ error: { message: 'Network request failed' } });
    await expect(seen.api.signIn('ana@crew.test', 'pw')).rejects.toThrow('offline');
  });

  it('keeps the server’s own words for a failure it has no name for', async () => {
    await mount();
    h.fake.replies({ error: { message: 'Something new went wrong', code: 'brand_new_code' } });
    await expect(seen.api.signIn('ana@crew.test', 'pw')).rejects.toThrow('Something new went wrong');
  });

  it('reads a sign-up into a taken address as taken, though the server calls it a success', async () => {
    await mount();
    h.fake.replies({ data: { user: { identities: [] }, session: null } });
    await expect(seen.api.signUp('Ana', 'ana', 'taken@crew.test', 'pw')).rejects.toThrow('email_taken');
  });

  it('sends the name and the lower-cased handle for the sign-up trigger, and says whether a code is due', async () => {
    await mount();
    h.fake.replies({ data: { user: { identities: [{}] }, session: null } });
    await expect(seen.api.signUp('Ana', 'AnaB', 'ana@crew.test', 'pw')).resolves.toEqual({ needsConfirm: true });
    expect(asked('signUp')[0].payload).toEqual({
      email: 'ana@crew.test',
      password: 'pw',
      options: { data: { full_name: 'Ana', handle: 'anab' } },
    });

    h.fake.replies({ data: { user: { identities: [{}] }, session: session('u9') } });
    await expect(seen.api.signUp('Bo', 'bo', 'bo@crew.test', 'pw')).resolves.toEqual({ needsConfirm: false });
  });

  it('confirms a sign-up with the code, as a sign-up code', async () => {
    await mount();
    h.fake.replies({ error: { message: 'Token has expired or is invalid', code: 'otp_expired' } });
    await expect(seen.api.confirmSignUp('ana@crew.test', '123456')).rejects.toThrow('bad_code');
    expect(asked('verifyOtp')[0].payload).toEqual({ email: 'ana@crew.test', token: '123456', type: 'signup' });
  });

  it('names a refused reset request', async () => {
    await mount();
    h.fake.replies({ error: { message: 'Too many', code: 'over_email_send_rate_limit' } });
    await expect(seen.api.requestReset('ana@crew.test')).rejects.toThrow('rate_limit');
    expect(asked('resetPasswordForEmail')[0].payload).toBe('ana@crew.test');
  });
});

describe('the steps that must not run out of order', () => {
  it('does not change the password when the recovery code is wrong', async () => {
    await mount();
    h.fake.replies({ error: { message: 'Token has expired or is invalid', code: 'otp_expired' } });
    await expect(seen.api.resetPassword('ana@crew.test', '000000', 'new-pw')).rejects.toThrow('bad_code');
    expect(asked('updateUser')).toEqual([]);
  });

  it('verifies the recovery code, then sets the new password', async () => {
    await mount();
    h.fake.replies({ data: {} }, { data: {} });
    await seen.api.resetPassword('ana@crew.test', '123456', 'new-pw');
    expect(asked('verifyOtp')[0].payload).toEqual({ email: 'ana@crew.test', token: '123456', type: 'recovery' });
    expect(asked('updateUser')[0].payload).toEqual({ password: 'new-pw' });
  });

  it('names a new password the server refused after the code was accepted', async () => {
    await mount();
    h.fake.replies({ data: {} }, { error: { message: 'Same', code: 'same_password' } });
    await expect(seen.api.resetPassword('ana@crew.test', '123456', 'old-pw')).rejects.toThrow('same_password');
  });

  it('reports a finished deletion as finished even when the local sign-out after it fails', async () => {
    await mount({ signedIn: session('u1'), fetched: row() });
    h.fake.replies({ data: { ok: true } }, { throws: new Error('storage locked') });
    await expect(seen.api.deleteAccount()).resolves.toBeUndefined();
    const fns = h.fake.log.map((a) => a.fn).filter(Boolean);
    expect(fns.slice(-2)).toEqual(['delete-account', 'signOut']);
  });

  it('does not sign out when the server refused the deletion', async () => {
    await mount({ signedIn: session('u1'), fetched: row() });
    h.fake.replies({ data: { error: 'not_allowed' } });
    await expect(seen.api.deleteAccount()).rejects.toThrow('not_allowed');
    expect(asked('signOut')).toEqual([]);
  });

  it('names a deletion that never reached the server', async () => {
    await mount({ signedIn: session('u1'), fetched: row() });
    h.fake.replies({ error: { message: 'Network request failed' } });
    await expect(seen.api.deleteAccount()).rejects.toThrow('offline');
    expect(asked('signOut')).toEqual([]);
  });

  it('surfaces a sign-out the server refused', async () => {
    await mount({ signedIn: session('u1'), fetched: row() });
    h.fake.replies({ error: { message: 'Session not found' } });
    await expect(seen.api.signOut()).rejects.toThrow('Session not found');
  });
});

describe('profile edits', () => {
  it('refuses to write without an account, and asks nothing', async () => {
    await mount();
    await expect(seen.api.updateProfile({ bio: 'hi' })).rejects.toThrow('not_signed_in');
    expect(h.fake.log.filter((a) => a.table === 'profiles')).toEqual([]);
  });

  it('writes the patch to the account’s own row and keeps the copy in memory in step', async () => {
    await mount({ signedIn: session('u1'), fetched: row({ bio: '' }) });
    h.fake.replies({ data: null });
    await act(async () => { await seen.api.updateProfile({ bio: 'Pho first', handle: '  AnaB ' }); });
    const w = h.fake.log.filter((a) => a.table === 'profiles' && a.op === 'update')[0];
    expect(w.payload).toEqual({ bio: 'Pho first', handle: 'anab' });
    expect(w.filters).toEqual([['id', 'u1']]);
    expect(seen.api.profile.bio).toBe('Pho first');
    expect(seen.api.profile.handle).toBe('anab');
  });

  it('names a handle somebody else took, and leaves the profile as it was', async () => {
    await mount({ signedIn: session('u1'), fetched: row({ handle: 'ana' }) });
    h.fake.replies({ error: { message: 'duplicate key value violates unique constraint "profiles_handle_key"', code: '23505' } });
    // Inside `act`, so a state write the failed call made would have
    // rendered by the time the profile is read — outside it, the read sees
    // the last frame and passes whether or not the copy was touched.
    await act(async () => {
      await expect(seen.api.updateProfile({ handle: 'bo' })).rejects.toThrow('handle_taken');
    });
    expect(seen.api.profile.handle).toBe('ana');
  });

  it('passes any other write failure through in the database’s own words', async () => {
    await mount({ signedIn: session('u1'), fetched: row() });
    h.fake.replies({ error: { message: 'value too long for type character varying(160)', code: '22001' } });
    await expect(seen.api.updateProfile({ bio: 'x'.repeat(500) })).rejects.toThrow('value too long');
  });

  it('names a reserved handle', async () => {
    await mount({ signedIn: session('u1'), fetched: row() });
    h.fake.replies({ error: { message: 'handle_reserved', code: 'P0001' } });
    await expect(seen.api.updateProfile({ handle: 'admin' })).rejects.toThrow('handle_reserved');
  });
});

describe('the avatar', () => {
  const bucketCalls = () => h.fake.log.filter((a) => a.op === 'storage');

  it('uploads one resized JPEG per person and saves a URL that busts the cache', async () => {
    await mount({ signedIn: session('u1'), fetched: row() });
    manipulateAsync.mockResolvedValue({ base64: 'aGk=' });
    h.fake.replies({ data: {} }, { data: null });
    await act(async () => { await seen.api.setAvatar('file:///camera.jpg'); });

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file:///camera.jpg',
      [{ resize: { width: 512 } }],
      expect.objectContaining({ format: 'jpeg', base64: true }),
    );
    expect(bucketCalls()).toEqual([expect.objectContaining({
      table: 'avatars', fn: 'upload',
      payload: { path: 'u1/avatar.jpg', opts: { contentType: 'image/jpeg', upsert: true } },
    })]);
    const saved = h.fake.log.filter((a) => a.table === 'profiles' && a.op === 'update')[0];
    expect(saved.filters).toEqual([['id', 'u1']]);
    const url = (saved.payload as { avatar_url: string }).avatar_url;
    expect(url).toMatch(/^https:\/\/storage\.test\/avatars\/u1\/avatar\.jpg\?v=\d+$/);
    expect(seen.api.profile.avatar_url).toBe(url);
  });

  it('names a second face inside the cooldown, and saves nothing', async () => {
    await mount({ signedIn: session('u1'), fetched: row() });
    manipulateAsync.mockResolvedValue({ base64: 'aGk=' });
    h.fake.replies({ error: { message: 'new row violates row-level security policy', code: '42501' } });
    await expect(seen.api.setAvatar('file:///again.jpg')).rejects.toThrow('too_soon');
    expect(h.fake.log.filter((a) => a.table === 'profiles' && a.op === 'update')).toEqual([]);
  });

  it('names an image that could not be prepared, and uploads nothing', async () => {
    await mount({ signedIn: session('u1'), fetched: row() });
    manipulateAsync.mockResolvedValue({ base64: undefined });
    await expect(seen.api.setAvatar('file:///broken.heic')).rejects.toThrow('bad_image');
    expect(bucketCalls()).toEqual([]);
  });

  it('says which step stalled rather than spinning forever', async () => {
    await mount({ signedIn: session('u1'), fetched: row() });
    vi.useFakeTimers();
    manipulateAsync.mockReturnValue(new Promise(() => {}));
    const pending = seen.api.setAvatar('file:///huge.jpg');
    const verdict = expect(pending).rejects.toThrow('slow_prepare');
    await vi.advanceTimersByTimeAsync(20_000);
    await verdict;
  });

  it('refuses without an account', async () => {
    await mount();
    await expect(seen.api.setAvatar('file:///x.jpg')).rejects.toThrow('not_signed_in');
    expect(manipulateAsync).not.toHaveBeenCalled();
  });

  it('clears the pointer even when deleting the object failed', async () => {
    await mount({ signedIn: session('u1'), fetched: row({ avatar_url: 'https://old' }) });
    h.fake.replies({ error: { message: 'Object not found' } }, { data: null });
    await act(async () => { await seen.api.clearAvatar(); });
    expect(bucketCalls()[0]).toEqual(expect.objectContaining({ fn: 'remove', payload: ['u1/avatar.jpg'] }));
    const cleared = h.fake.log.filter((a) => a.table === 'profiles' && a.op === 'update')[0];
    expect(cleared.payload).toEqual({ avatar_url: '' });
    expect(seen.api.profile.avatar_url).toBe('');
  });
});

describe('isHandleFree', () => {
  it('asks nothing for an empty handle', async () => {
    await expect(isHandleFree('  @ ')).resolves.toBe(false);
    expect(h.fake.log).toEqual([]);
  });

  it('checks the normalised handle against both the accounts and the reserved list', async () => {
    h.fake.replies({ data: null }, { data: null });
    await expect(isHandleFree(' @AnaB ')).resolves.toBe(true);
    const [taken, reserved] = h.fake.log;
    expect(taken).toEqual(expect.objectContaining({ table: 'profiles', filters: [['handle~~*', 'anab']], maybe: true }));
    expect(reserved).toEqual(expect.objectContaining({ table: 'reserved_handles', filters: [['handle', 'anab']], maybe: true }));
  });

  it('is not free when an account has it, or when it is reserved', async () => {
    h.fake.replies({ data: { id: 'u2' } }, { data: null });
    await expect(isHandleFree('ana')).resolves.toBe(false);
    h.fake.replies({ data: null }, { data: { handle: 'admin' } });
    await expect(isHandleFree('admin')).resolves.toBe(false);
  });
});

describe('token refresh', () => {
  it('runs only while the app is in the foreground, and stops on unmount', async () => {
    const remove = vi.fn();
    let onChange: (s: string) => void = () => {};
    const spy = vi.spyOn(AppState, 'addEventListener').mockImplementation((_type, fn) => {
      onChange = fn as (s: string) => void;
      return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    const view = await mount();
    const timers = () => h.fake.log.map((a) => a.fn).filter((f) => f?.endsWith('AutoRefresh'));
    expect(timers()).toEqual(['startAutoRefresh']);

    onChange('background');
    onChange('active');
    expect(timers()).toEqual(['startAutoRefresh', 'stopAutoRefresh', 'startAutoRefresh']);

    view.unmount();
    expect(remove).toHaveBeenCalled();
    expect(timers().at(-1)).toBe('stopAutoRefresh');
    spy.mockRestore();
  });
});
