import { describe, expect, it } from 'vitest';
import { CACHE_MAX_AGE_MS, CACHE_VERSION, cacheKey, packCache, unpackCache } from './cache';

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
