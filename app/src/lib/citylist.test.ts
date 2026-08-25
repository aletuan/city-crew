import { describe, expect, it } from 'vitest';
import { parseCachedCities } from './citylist';

// The smallest blob that is a real city row. Hero columns absent on
// purpose — a cache written before they existed must still be trusted.
const city = (id: string) => ({
  id, name_en: 'X', name_vi: 'X', short_en: 'x', short_vi: 'x',
  center_lat: 10.7, center_lng: 106.7, radius_km: 25,
});

describe('parseCachedCities', () => {
  it('hands back a list whose every row is renderable', () => {
    const raw = JSON.stringify([city('hcmc'), city('hanoi')]);
    expect(parseCachedCities(raw)?.map((c) => c.id)).toEqual(['hcmc', 'hanoi']);
  });

  it('a cache without the nullable hero columns is still a good cache', () => {
    expect(parseCachedCities(JSON.stringify([city('hcmc')]))).not.toBeNull();
  });

  it('no blob is no cache', () => {
    expect(parseCachedCities(null)).toBeNull();
  });

  it('a blob that does not parse is no cache', () => {
    expect(parseCachedCities('{half a json')).toBeNull();
  });

  it('a parse that is not a list is no cache', () => {
    expect(parseCachedCities(JSON.stringify({ id: 'hcmc' }))).toBeNull();
  });

  it('an empty list is no cache — it would pin the fallback row faster', () => {
    expect(parseCachedCities('[]')).toBeNull();
  });

  it('one malformed row spoils the blob', () => {
    const raw = JSON.stringify([city('hcmc'), { id: 'hanoi' }]);
    expect(parseCachedCities(raw)).toBeNull();
  });

  it('a row with the right keys but wrong types spoils it too', () => {
    const raw = JSON.stringify([{ ...city('hcmc'), center_lat: '10.7' }]);
    expect(parseCachedCities(raw)).toBeNull();
  });

  it('a null row spoils it — typeof null is "object"', () => {
    const raw = JSON.stringify([city('hcmc'), null]);
    expect(parseCachedCities(raw)).toBeNull();
  });
});
