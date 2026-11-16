import { beforeEach, describe, expect, it, vi } from 'vitest';

// The phone's store, as a map — and a way to make one write fail.
const disk = vi.hoisted(() => ({ rows: new Map<string, string>(), failOn: null as string | null }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => disk.rows.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      if (k === disk.failOn) throw new Error('disk full');
      disk.rows.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => { disk.rows.delete(k); }),
  },
}));

import { CACHE_MAX_CHARS, CACHE_MAX_PARTS, packCache, packParts, partKey, partsOf, unpackCache } from './cache';
import { readCache, writeCache } from './cacheStore';

const KEY = 'citycrew.cache.collections.hanoi.anon';
/** An answer of about `chars` characters, with an emoji every so often. */
const answer = (chars: number) => packCache(Array.from({ length: Math.ceil(chars / 1000) }, (_, i) => `${i}☕😀`.padEnd(996, 'x')), 1_700_000_000_000);

beforeEach(() => { disk.rows.clear(); disk.failOn = null; });

describe('an answer that fits one row', () => {
  it('is written under its key, as it always was, and read back', async () => {
    const blob = packCache(['a', 'b'], 1);
    expect(await writeCache(KEY, blob)).toBe(1);
    expect([...disk.rows.keys()]).toEqual([KEY]);
    expect(disk.rows.get(KEY)).toBe(blob);
    expect(await readCache(KEY)).toBe(blob);
  });

  it('reads nothing where nothing was kept', async () => {
    expect(await readCache(KEY)).toBeNull();
  });
});

// The public shelf, since 16 Nov 2026: longer than Android will read
// back in one row, and until then not remembered at all.
describe('an answer longer than one row', () => {
  it('is kept in parts under a head, each a row Android can read, and read back whole', async () => {
    const blob = answer(CACHE_MAX_CHARS * 2.3);
    expect(await writeCache(KEY, blob)).toBe(3);
    expect(partsOf(disk.rows.get(KEY)!)).toEqual({ parts: 3, chars: blob.length });
    expect([...disk.rows.keys()].sort()).toEqual([KEY, partKey(KEY, 0), partKey(KEY, 1), partKey(KEY, 2)].sort());
    for (const [k, v] of disk.rows) if (k !== KEY) expect(v.length).toBeLessThanOrEqual(CACHE_MAX_CHARS);
    const back = await readCache(KEY);
    expect(back).toBe(blob);
    // And it is still the answer.
    expect(unpackCache<string[]>(back, 1_700_000_000_001)!.data[0]).toContain('☕😀');
  });

  // A write is several rows and a phone can stop between any two.
  it('is not trusted with a part missing, or with parts that are not the head’s', async () => {
    const blob = answer(CACHE_MAX_CHARS * 2.3);
    await writeCache(KEY, blob);
    const part1 = disk.rows.get(partKey(KEY, 1))!;
    disk.rows.delete(partKey(KEY, 1));
    expect(await readCache(KEY)).toBeNull();
    // A part from another write: there, and the wrong length.
    disk.rows.set(partKey(KEY, 1), part1.slice(1));
    expect(await readCache(KEY)).toBeNull();
    disk.rows.set(partKey(KEY, 1), part1);
    expect(await readCache(KEY)).toBe(blob);
  });

  // The head is written last: a write that stops before it leaves the
  // old head over new parts, and the length says they are not its own.
  it('leaves the last answer untrusted, not half-replaced, when a write stops before the head', async () => {
    await writeCache(KEY, answer(CACHE_MAX_CHARS * 2.3));
    disk.failOn = KEY;
    await expect(writeCache(KEY, answer(CACHE_MAX_CHARS * 2.6))).rejects.toThrow('disk full');
    expect(await readCache(KEY)).toBeNull();
  });

  it('leaves no rows behind when the answer is short again', async () => {
    await writeCache(KEY, answer(CACHE_MAX_CHARS * 3.5));
    expect(disk.rows.size).toBe(5);
    const short = packCache(['short'], 1);
    expect(await writeCache(KEY, short)).toBe(1);
    expect([...disk.rows.keys()]).toEqual([KEY]);
    expect(await readCache(KEY)).toBe(short);
  });

  it('drops the rows a shorter answer in parts no longer uses', async () => {
    await writeCache(KEY, answer(CACHE_MAX_CHARS * 3.5));
    const blob = answer(CACHE_MAX_CHARS * 1.5);
    expect(await writeCache(KEY, blob)).toBe(2);
    expect([...disk.rows.keys()].sort()).toEqual([KEY, partKey(KEY, 0), partKey(KEY, 1)].sort());
    expect(await readCache(KEY)).toBe(blob);
  });
});

describe('an answer too long to keep', () => {
  it('is not written, and takes the last answer with it, in one row or in parts', async () => {
    const giant = 'x'.repeat(CACHE_MAX_CHARS * CACHE_MAX_PARTS + 1);
    await writeCache(KEY, packCache(['old'], 1));
    expect(await writeCache(KEY, giant)).toBe(0);
    expect(disk.rows.size).toBe(0);
    await writeCache(KEY, answer(CACHE_MAX_CHARS * 2.3));
    expect(await writeCache(KEY, giant)).toBe(0);
    expect(disk.rows.size).toBe(0);
    expect(await readCache(KEY)).toBeNull();
  });
});

// A head with no rows under it — another build's, a cleared store.
describe('a head with nothing under it', () => {
  it('reads as nothing', async () => {
    disk.rows.set(KEY, packParts(2, 10));
    expect(await readCache(KEY)).toBeNull();
  });
});
