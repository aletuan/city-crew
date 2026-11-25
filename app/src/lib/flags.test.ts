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

  it('ships with check-in hidden: the row in the table is what shows it', () => {
    expect(FLAG_DEFAULTS.place_checkin).toBe(false);
    expect(flagsStore().get('place_checkin')).toBe(false);
  });

  it('ships with the city sheet\u2019s place counts hidden', () => {
    expect(FLAG_DEFAULTS.city_place_counts).toBe(false);
    expect(flagsStore().get('city_place_counts')).toBe(false);
  });

  // Comments are built behind this over eleven merges, and are people's
  // words to each other: off until the release that carries them has
  // been reviewed (`docs/comments-plan.md`).
  it('ships comments off', () => {
    expect(FLAG_DEFAULTS.comments).toBe(false);
    expect(flagsStore().get('comments')).toBe(false);
  });

  // Every default at once, written out. A default is what every phone
  // runs before `app_flags` answers, and what it keeps when the read
  // fails, so flipping one in code ships it to everyone on the next EAS
  // Update. `place_price` had no pin of its own: turning it on survived
  // every test (mutation sample, 22 Nov 2026). Exact, so a new flag fails
  // here until someone writes down what it ships as.
  it('ships every flag at the default written here', () => {
    expect(FLAG_DEFAULTS).toEqual({
      photo_attribution: true,
      place_price: false,
      place_checkin: false,
      city_place_counts: false,
      comments: false,
      checkin_photos: false,
    });
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

  // On for one account (`app_flag_testers`, 18 Nov 2026).
  describe('the switches that are on for the reader alone', () => {
    const flagsOff = { data: [{ key: 'comments', enabled: false }] };

    it('are not asked about for nobody', async () => {
      const fake = fakeSupabase();
      fake.replies(flagsOff);
      const s = flagsStore();
      await s.load(client(fake));
      expect(fake.log.map((q) => q.table)).toEqual(['app_flags']);
      expect(s.get('comments')).toBe(false);
    });

    it('turn a switch on for somebody signed in, whatever the table says', async () => {
      const fake = fakeSupabase();
      fake.replies(flagsOff, { data: [{ key: 'comments' }] });
      const s = flagsStore();
      await s.load(client(fake), true);
      expect(fake.log.map((q) => [q.table, q.payload])).toEqual([['app_flags', 'key, enabled'], ['app_flag_testers', 'key']]);
      expect(s.get('comments')).toBe(true);
      // And nothing else moved.
      expect(s.get('place_checkin')).toBe(false);
      expect(s.get('photo_attribution')).toBe(true);
    });

    it('never turn one off: a tester sees what the public sees, and more', async () => {
      const fake = fakeSupabase();
      fake.replies({ data: [{ key: 'photo_attribution', enabled: true }] }, { data: [] });
      const s = flagsStore();
      await s.load(client(fake), true);
      expect(s.get('photo_attribution')).toBe(true);
    });

    it('ignore a key the app does not know, and a row that is not one', async () => {
      const fake = fakeSupabase();
      fake.replies(flagsOff, { data: [{ key: 'something_newer' }, { key: 7 }, {}] });
      const s = flagsStore();
      await s.load(client(fake), true);
      expect(s.get('comments')).toBe(false);
    });

    it('leave the table\'s answer standing when they cannot be read', async () => {
      const s = flagsStore();
      const refused = fakeSupabase();
      refused.replies({ data: [{ key: 'place_checkin', enabled: true }] }, { error: { message: 'permission denied' } });
      await s.load(client(refused), true);
      expect(s.get('place_checkin')).toBe(true);
      expect(s.get('comments')).toBe(false);

      const odd = fakeSupabase();
      odd.replies({ data: [{ key: 'place_checkin', enabled: true }] }, { data: { key: 'comments' } });
      await s.load(client(odd), true);
      expect(s.get('comments')).toBe(false);
    });

    it('go when the reader signs out: the next read puts the switch where the table has it', async () => {
      const s = flagsStore();
      const inn = fakeSupabase();
      inn.replies(flagsOff, { data: [{ key: 'comments' }] });
      await s.load(client(inn), true);
      expect(s.get('comments')).toBe(true);
      const out = fakeSupabase();
      out.replies(flagsOff);
      await s.load(client(out));
      expect(s.get('comments')).toBe(false);
    });

    it('put a switch back to its default when its row has gone from the table', async () => {
      const s = flagsStore();
      const first = fakeSupabase();
      first.replies({ data: [{ key: 'place_checkin', enabled: true }] });
      await s.load(client(first));
      expect(s.get('place_checkin')).toBe(true);
      const second = fakeSupabase();
      second.replies({ data: [] });
      await s.load(client(second));
      expect(s.get('place_checkin')).toBe(false);
    });

    // The launch reads as nobody; the session restores and reads again.
    // Whichever lands last, the later ask is the answer.
    it('apply the later of two reads in flight, whichever lands last', async () => {
      const s = flagsStore();
      let landFirst: (v: unknown) => void = () => {};
      const slow: FlagsClient = { from: () => ({ select: () => new Promise((res) => { landFirst = res; }) as never }) };
      const asNobody = s.load(slow);
      const fast = fakeSupabase();
      fast.replies(flagsOff, { data: [{ key: 'comments' }] });
      await s.load(client(fast), true);
      expect(s.get('comments')).toBe(true);
      landFirst({ data: [{ key: 'comments', enabled: false }], error: null });
      await asNobody;
      expect(s.get('comments')).toBe(true);
    });
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

  // ── the last launch's answer (owner, 25 Nov 2026) ──

  it('says whether its answer was applied', async () => {
    const s = flagsStore();
    const ok = fakeSupabase();
    ok.replies({ data: [] });
    expect(await s.load(client(ok))).toBe(true);
    const refused = fakeSupabase();
    refused.replies({ error: { message: 'no' } });
    expect(await s.load(client(refused))).toBe(false);
    const broken = fakeSupabase();
    broken.replies({ throws: new Error('offline') });
    expect(await s.load(client(broken))).toBe(false);
  });

  it('says an answer that a later ask overtook was not applied', async () => {
    const s = flagsStore();
    const slow = fakeSupabase();
    let land!: () => void;
    slow.replies({ data: [] });
    const gate = new Promise<void>((r) => { land = r; });
    const later = client(slow);
    const slowClient: FlagsClient = { from: (t) => ({ select: (c) => gate.then(() => later.from(t).select(c)) }) };
    const first = s.load(slowClient);
    const fast = fakeSupabase();
    fast.replies({ data: [] });
    expect(await s.load(client(fast))).toBe(true);
    land();
    expect(await first).toBe(false);
  });

  it('is not an answer until one is put back or read', async () => {
    const s = flagsStore();
    expect(s.ready()).toBe(false);
    // Nothing kept — a first launch — is not one.
    s.restore(null);
    s.restore('nonsense');
    expect(s.ready()).toBe(false);
    const f = vi.fn();
    s.subscribe(f);
    s.restore({});
    expect(s.ready()).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    s.restore({});
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('puts back what was kept, known keys and booleans alone', () => {
    const s = flagsStore();
    s.restore({ checkin_photos: true, place_checkin: 'yes', something_newer: true, photo_attribution: false });
    expect(s.get('checkin_photos')).toBe(true);
    expect(s.get('place_checkin')).toBe(false);
    expect(s.get('photo_attribution')).toBe(false);
    expect(s.snapshot()).toEqual({ ...FLAG_DEFAULTS, checkin_photos: true, photo_attribution: false });
  });

  it('never puts back an old answer over one already read', async () => {
    const s = flagsStore();
    const fake = fakeSupabase();
    fake.replies({ data: [{ key: 'checkin_photos', enabled: false }] });
    await s.load(client(fake));
    expect(s.ready()).toBe(true);
    s.restore({ checkin_photos: true });
    expect(s.get('checkin_photos')).toBe(false);
  });

  it('reads the table over what was put back', async () => {
    const s = flagsStore();
    s.restore({ checkin_photos: true });
    const fake = fakeSupabase();
    fake.replies({ data: [{ key: 'checkin_photos', enabled: false }] });
    await s.load(client(fake));
    expect(s.get('checkin_photos')).toBe(false);
  });

  it('forgets on a reset that it ever knew, or ever read', async () => {
    const s = flagsStore();
    const fake = fakeSupabase();
    fake.replies({ data: [] });
    await s.load(client(fake));
    s.reset();
    expect(s.ready()).toBe(false);
    s.restore({ checkin_photos: true });
    expect(s.get('checkin_photos')).toBe(true);
  });
});
