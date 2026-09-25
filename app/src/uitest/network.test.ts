// @vitest-environment jsdom
//
// The guard in `setup.tsx`, asserted rather than assumed.
//
// It stands the Supabase client in for every test, and it exists because
// for one day it did not: `SketchingScreen.ui.test.tsx` renders a screen
// that files a row when it leaves, the client was the real client, and
// every run of the suite — CI's included — inserted its fixtures into the
// production `deck_traces` table. Nothing failed. Nothing was going to.
//
// A guard whose whole value is that nothing happens cannot be noticed
// when it stops working, so this notices for it. Delete the mock in
// `setup.tsx` and this file says so.

import { describe, expect, it } from 'vitest';
import { supabase, supabaseUrl } from '../lib/supabase';

describe('the server, from a test', () => {
  it('is somewhere that does not exist', () => {
    expect(supabaseUrl).toBe('https://test.invalid');
  });

  it('answers a read without going anywhere', async () => {
    await expect(supabase.from('places').select('*')).resolves.toEqual({ data: null, error: null });
  });

  // The path that leaked. A write is the one that costs something when it
  // reaches a real server, and it is the one that did.
  it('accepts a write without going anywhere', async () => {
    await expect(supabase.from('deck_traces').insert({ platform: 'web' } as never))
      .resolves.toEqual({ data: null, error: null });
  });
});
