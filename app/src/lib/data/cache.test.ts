import { describe, expect, it } from 'vitest';
import {
  CACHE_MAX_AGE_MS, CACHE_MAX_CHARS, CACHE_MAX_PARTS, CACHE_VERSION, cacheKey, cacheKind, fitsCache, packCache,
  packParts, partKey, partsOf, splitCache, unpackCache,
} from './cache';

const NOW = 1_756_000_000_000;

describe('cacheKey', () => {
  it('scopes by kind, city and reader', () => {
    expect(cacheKey('places', 'hcmc', 'user-1')).toBe('citycrew.cache.places.hcmc.user-1');
  });

  it('a signed-out reader is one shared key, not a fresh one per launch', () => {
    expect(cacheKey('places', 'hcmc')).toBe('citycrew.cache.places.hcmc.anon');
    expect(cacheKey('places', 'hcmc', null)).toBe('citycrew.cache.places.hcmc.anon');
  });
});

describe('cacheKind', () => {
  it('reads back the kind a key was made from', () => {
    expect(cacheKind(cacheKey('places', 'hcmc', 'user-1'))).toBe('places');
    expect(cacheKind(cacheKey('mine', 'all'))).toBe('mine');
  });

  it('calls any other key other', () => {
    expect(cacheKind('hydrate-a')).toBe('other');
    expect(cacheKind('somebody.cache.places.hcmc')).toBe('other');
    expect(cacheKind('citycrew.prefs.places')).toBe('other');
    expect(cacheKind('citycrew.cache.')).toBe('other');
  });
});

describe('fitsCache', () => {
  // Android reads a stored value back through a 2 MB window; past the
  // bound a blob is not written at all (`usePersistedFetch`).
  it('stores a blob up to the bound and not a character past it', () => {
    expect(fitsCache('x'.repeat(CACHE_MAX_CHARS))).toBe(true);
    expect(fitsCache('x'.repeat(CACHE_MAX_CHARS + 1))).toBe(false);
  });

  it('keeps the bound inside the window at the densest text measured', () => {
    // 1.154 UTF-8 bytes a character, Hanoi's catalog on 30 Oct 2026.
    expect(CACHE_MAX_CHARS * 1.154).toBeLessThan(2 * 1024 * 1024);
  });
});

describe('pack and unpack', () => {
  it('round-trips the answer with its stamp', () => {
    const raw = packCache([{ slug: 'cafe-a' }], NOW - 5_000);
    expect(unpackCache(raw, NOW)).toEqual({ data: [{ slug: 'cafe-a' }], at: NOW - 5_000 });
  });

  it('no blob is no cache', () => {
    expect(unpackCache(null, NOW)).toBeNull();
  });

  it('a blob that does not parse is no cache', () => {
    expect(unpackCache('{half a json', NOW)).toBeNull();
  });

  it('a parse that is not an envelope is no cache', () => {
    expect(unpackCache('42', NOW)).toBeNull();
    expect(unpackCache('null', NOW)).toBeNull();
  });

  it('a foreign version is refused — that is the whole point of the stamp', () => {
    const raw = JSON.stringify({ v: CACHE_VERSION + 1, at: NOW - 5_000, data: [] });
    expect(unpackCache(raw, NOW)).toBeNull();
  });

  it('a stamp past the age bound is refused', () => {
    const raw = packCache([], NOW - CACHE_MAX_AGE_MS - 1);
    expect(unpackCache(raw, NOW)).toBeNull();
    // One millisecond inside the bound is still good.
    expect(unpackCache(packCache([], NOW - CACHE_MAX_AGE_MS), NOW)).not.toBeNull();
  });

  it('a custom age bound overrides the default', () => {
    const raw = packCache([], NOW - 10_000);
    expect(unpackCache(raw, NOW, 5_000)).toBeNull();
    expect(unpackCache(raw, NOW, 60_000)).not.toBeNull();
  });

  it('a stamp from the future is refused', () => {
    expect(unpackCache(packCache([], NOW + 1), NOW)).toBeNull();
  });

  it('a missing or non-numeric stamp is refused', () => {
    expect(unpackCache(JSON.stringify({ v: CACHE_VERSION, data: [] }), NOW)).toBeNull();
    expect(unpackCache(JSON.stringify({ v: CACHE_VERSION, at: 'now', data: [] }), NOW)).toBeNull();
  });

  it('a payload that is not a list is refused — both cached queries answer lists', () => {
    const raw = JSON.stringify({ v: CACHE_VERSION, at: NOW - 5_000, data: { slug: 'cafe-a' } });
    expect(unpackCache(raw, NOW)).toBeNull();
  });
});

// An answer longer than one row (owner, 16 Nov 2026): the public shelf
// outgrew `CACHE_MAX_CHARS` and stopped being remembered.
describe('splitCache', () => {
  it('leaves an answer that fits one row as it is', () => {
    expect(splitCache('abc')).toEqual(['abc']);
    expect(splitCache('x'.repeat(10), 10)).toEqual(['x'.repeat(10)]);
    expect(splitCache('')).toEqual(['']);
  });

  it('cuts a longer one into rows no longer than the bound, which join back to it', () => {
    const blob = 'abcdefghij'.repeat(5) + 'tail';
    const parts = splitCache(blob, 10)!;
    expect(parts).toHaveLength(6);
    expect(parts.every((p) => p.length <= 10)).toBe(true);
    expect(parts.join('')).toBe(blob);
  });

  // The bound a row is held to is the one it always was.
  it('cuts at the row bound by default', () => {
    const parts = splitCache('x'.repeat(CACHE_MAX_CHARS + 7))!;
    expect(parts.map((p) => p.length)).toEqual([CACHE_MAX_CHARS, 7]);
  });

  // Half an emoji in a row comes back as a replacement mark, and the
  // blob no longer parses.
  it('never cuts inside a surrogate pair', () => {
    const blob = 'abcd☕😀efgh😀ij';
    for (const size of [5, 6, 7, 8, 9]) {
      const parts = splitCache(blob, size)!;
      expect(parts.join('')).toBe(blob);
      for (const p of parts) {
        expect(p.length).toBeLessThanOrEqual(size);
        const last = p.charCodeAt(p.length - 1);
        expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
        // Each part is well-formed by itself: it survives a round trip
        // through UTF-8, as a row does.
        expect(new TextDecoder().decode(new TextEncoder().encode(p))).toBe(p);
      }
    }
    // A pair that ends the blob is not a cut.
    expect(splitCache('abc😀', 5)).toEqual(['abc😀']);
    expect(splitCache('abcde😀', 7)).toEqual(['abcde😀']);
  });

  it('refuses an answer past the most rows it will keep', () => {
    expect(splitCache('x'.repeat(10 * CACHE_MAX_PARTS), 10)).toHaveLength(CACHE_MAX_PARTS);
    expect(splitCache('x'.repeat(10 * CACHE_MAX_PARTS + 1), 10)).toBeNull();
  });
});

describe('partKey', () => {
  it('names a part under the answer’s key, where its kind still reads', () => {
    const key = cacheKey('collections', 'hanoi');
    expect(partKey(key, 0)).toBe(`${key}.part0`);
    expect(partKey(key, 3)).not.toBe(partKey(key, 0));
    expect(cacheKind(partKey(key, 3))).toBe('collections');
  });
});

describe('packParts and partsOf', () => {
  it('round-trips how many parts and how long', () => {
    expect(partsOf(packParts(3, 4_000_000))).toEqual({ parts: 3, chars: 4_000_000 });
  });

  // A build from before parts reads the head as no cache, not as rows.
  it('writes a head an older build reads as nothing', () => {
    expect(unpackCache(packParts(3, 4_000_000), Date.now())).toBeNull();
  });

  it('reads anything that is not a head as not one', () => {
    expect(partsOf(null)).toBeNull();
    expect(partsOf('')).toBeNull();
    // An answer in one row, short or long.
    expect(partsOf(packCache(['a'], Date.now()))).toBeNull();
    expect(partsOf(packCache(['x'.repeat(500)], Date.now()))).toBeNull();
    expect(partsOf('not json')).toBeNull();
    expect(partsOf('7')).toBeNull();
    expect(partsOf('null')).toBeNull();
    // Another version's head, or one missing a figure.
    expect(partsOf(JSON.stringify({ v: CACHE_VERSION + 1, parts: 2, chars: 9 }))).toBeNull();
    expect(partsOf(JSON.stringify({ v: CACHE_VERSION, parts: '2', chars: 9 }))).toBeNull();
    expect(partsOf(JSON.stringify({ v: CACHE_VERSION, parts: 2 }))).toBeNull();
    // A count no write makes.
    for (const parts of [1, 0, -2, 2.5, CACHE_MAX_PARTS + 1]) {
      expect(partsOf(JSON.stringify({ v: CACHE_VERSION, parts, chars: 9 }))).toBeNull();
    }
    expect(partsOf(JSON.stringify({ v: CACHE_VERSION, parts: CACHE_MAX_PARTS, chars: 9 }))).toEqual({ parts: CACHE_MAX_PARTS, chars: 9 });
  });
});
