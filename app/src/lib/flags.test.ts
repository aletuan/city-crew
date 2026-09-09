import { describe, expect, it, vi } from 'vitest';
import { fakeSupabase } from './testing';

// The fake answers any chain; what `load` needs of it is the one shape
// `FlagsClient` names.
const client = (f: ReturnType<typeof fakeSupabase>) => f.client as unknown as FlagsClient;
import { FLAG_DEFAULTS, type FlagsClient, flagsStore } from './flags';

describe('flagsStore', () => {
  it('ships with the credit shown', () => {
    expect(FLAG_DEFAULTS.photo_attribution).toBe(true);
    expect(flagsStore().get('photo_attribution')).toBe(true);
  });

  it('takes a row from the table over the default', async () => {
    const fake = fakeSupabase();
    fake.replies({ data: [{ key: 'photo_attribution', enabled: false }] });
    const s = flagsStore();
    await s.load(client(fake));
    expect(s.get('photo_attribution')).toBe(false);
    expect(fake.log[0]).toMatchObject({ table: 'app_flags', op: 'select' });
  });

  it('ignores a key it does not know and a value that is not a boolean', async () => {
    const fake = fakeSupabase();
    fake.replies({ data: [
      { key: 'something_newer', enabled: false },
      { key: 'photo_attribution', enabled: 'no' },
      { key: 42, enabled: false },
    ] });
    const s = flagsStore();
    await s.load(client(fake));
    expect(s.get('photo_attribution')).toBe(true);
  });

  it('stays as shipped when the table cannot be read', async () => {
    const refused = fakeSupabase();
    refused.replies({ error: { message: 'relation "app_flags" does not exist' } });
    const s = flagsStore();
    await s.load(client(refused));
    expect(s.get('photo_attribution')).toBe(true);

    const broken = fakeSupabase();
    broken.replies({ throws: new Error('Network request failed') });
    await s.load(client(broken));
    expect(s.get('photo_attribution')).toBe(true);

    const odd = fakeSupabase();
    odd.replies({ data: { key: 'photo_attribution', enabled: false } });
    await s.load(client(odd));
    expect(s.get('photo_attribution')).toBe(true);
  });

  it('tells a subscriber once per change, and not about a repeat', () => {
    const s = flagsStore();
    const f = vi.fn();
    const off = s.subscribe(f);
    s.set('photo_attribution', false);
    s.set('photo_attribution', false);
    expect(f).toHaveBeenCalledTimes(1);
    off();
    s.set('photo_attribution', true);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('can be put back for the next test', () => {
    const s = flagsStore();
    s.set('photo_attribution', false);
    s.reset();
    expect(s.get('photo_attribution')).toBe(true);
  });
});
