// GoTrue's settings read: the address, the key, and the response handed
// back untouched — what it is worth is `lib/signup`'s to decide.

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({
  supabaseUrl: 'https://project.example',
  supabaseAnonKey: 'anon-key',
}));

import { fetchAuthSettings } from './signup';

afterEach(() => { vi.unstubAllGlobals(); });

describe('fetchAuthSettings', () => {
  it('asks the project’s settings endpoint with the publishable key', async () => {
    const res = new Response('{}', { status: 200 });
    const fetch = vi.fn(async () => res);
    vi.stubGlobal('fetch', fetch);
    expect(await fetchAuthSettings()).toBe(res);
    expect(fetch).toHaveBeenCalledWith('https://project.example/auth/v1/settings', {
      headers: { apikey: 'anon-key' },
    });
  });

  it('lets a failed request reject', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Network request failed'); }));
    await expect(fetchAuthSettings()).rejects.toThrow('Network request failed');
  });
});
