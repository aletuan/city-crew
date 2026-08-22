import { describe, expect, it } from 'vitest';
import { NEWEST_SHOWN, newestPlaces } from './newest';

const at = (slug: string, created_at: string | null) => ({ slug, created_at });

describe('newestPlaces', () => {
  it('puts the latest arrival first', () => {
    const out = newestPlaces([
      at('old', '2026-01-01T00:00:00Z'),
      at('new', '2026-08-22T09:00:00Z'),
      at('mid', '2026-04-10T12:00:00Z'),
    ]);
    expect(out.map((p) => p.slug)).toEqual(['new', 'mid', 'old']);
  });

  it('shows at most the cap, and the cap is ten', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      at(`p${String(i).padStart(2, '0')}`, `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00Z`));
    expect(NEWEST_SHOWN).toBe(10);
    const out = newestPlaces(many);
    expect(out).toHaveLength(10);
    expect(out[0].slug).toBe('p14');
    expect(out[9].slug).toBe('p05');
  });

  it('takes a different cap when asked', () => {
    const out = newestPlaces([at('a', '2026-01-02T00:00:00Z'), at('b', '2026-01-01T00:00:00Z')], 1);
    expect(out.map((p) => p.slug)).toEqual(['a']);
  });

  // A place that cannot say when it arrived has no claim to a list
  // ordered by exactly that.
  it('drops rows with no timestamp rather than sorting them anywhere', () => {
    const out = newestPlaces([at('dated', '2026-01-01T00:00:00Z'), at('undated', null)]);
    expect(out.map((p) => p.slug)).toEqual(['dated']);
  });

  // The seeded rows share one timestamp to the second; without the slug
  // tie-break the section would reshuffle between two openings of the
  // same screen.
  it('breaks a shared timestamp on slug, so the list is stable', () => {
    const seeded = '2026-02-01T00:00:00Z';
    const out = newestPlaces([at('banh-mi', seeded), at('an-cafe', seeded), at('chua-mot-cot', seeded)]);
    expect(out.map((p) => p.slug)).toEqual(['an-cafe', 'banh-mi', 'chua-mot-cot']);
  });

  it('does not reorder the array it was handed', () => {
    const input = [at('b', '2026-01-01T00:00:00Z'), at('a', '2026-06-01T00:00:00Z')];
    newestPlaces(input);
    expect(input.map((p) => p.slug)).toEqual(['b', 'a']);
  });

  it('has an answer for an empty catalog', () => {
    expect(newestPlaces([])).toEqual([]);
  });
});
