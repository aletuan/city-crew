import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabaseUrl: 'https://project.example',
  supabaseAnonKey: 'anon-key',
}));

import { fetchSignUpNeedsConfirm, parseNeedsConfirm, signUpTotal } from './signup';

describe('parseNeedsConfirm', () => {
  // The flip is the whole trap: `mailer_autoconfirm: true` is the server
  // saying it needs nothing from the reader — so no code screen.
  it('reads autoconfirm on as "no code needed"', () => {
    expect(parseNeedsConfirm({ mailer_autoconfirm: true })).toBe(false);
  });

  it('reads autoconfirm off as "a code will be asked for"', () => {
    expect(parseNeedsConfirm({ mailer_autoconfirm: false })).toBe(true);
  });

  // The docstring's promise: only an actual boolean counts. A reshaped
  // response after a GoTrue release must land on "unknown", not on a
  // confident wrong answer.
  it('reads anything else as unknown', () => {
    expect(parseNeedsConfirm({})).toBeNull();
    expect(parseNeedsConfirm({ mailer_autoconfirm: 'true' })).toBeNull();
    expect(parseNeedsConfirm({ mailer_autoconfirm: 1 })).toBeNull();
    expect(parseNeedsConfirm(null)).toBeNull();
    expect(parseNeedsConfirm(undefined)).toBeNull();
    expect(parseNeedsConfirm('mailer_autoconfirm')).toBeNull();
  });
});

describe('signUpTotal', () => {
  it('promises the third mark only for a definite yes', () => {
    expect(signUpTotal(true)).toBe(3);
    expect(signUpTotal(false)).toBe(2);
    // Unknown is the default, not a guess: a bar that grows late merely
    // corrects itself; one that promised a step nobody reaches lied.
    expect(signUpTotal(null)).toBe(2);
  });
});

describe('fetchSignUpNeedsConfirm', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const respond = (impl: () => Promise<unknown> | unknown) => {
    vi.stubGlobal('fetch', vi.fn(async () => impl()));
  };

  it('asks the settings endpoint with the anon key, and reads the flag', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ mailer_autoconfirm: false }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await fetchSignUpNeedsConfirm()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://project.example/auth/v1/settings',
      { headers: { apikey: 'anon-key' } },
    );
  });

  it('answers unknown for a refused request', async () => {
    respond(() => ({ ok: false, json: async () => ({}) }));
    expect(await fetchSignUpNeedsConfirm()).toBeNull();
  });

  it('answers unknown for a body that is not JSON', async () => {
    respond(() => ({ ok: true, json: async () => { throw new Error('not json'); } }));
    expect(await fetchSignUpNeedsConfirm()).toBeNull();
  });

  it('answers unknown offline, and never throws', async () => {
    respond(() => { throw new Error('Network request failed'); });
    await expect(fetchSignUpNeedsConfirm()).resolves.toBeNull();
  });
});
