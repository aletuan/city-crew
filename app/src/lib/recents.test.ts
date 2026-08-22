import { describe, expect, it } from 'vitest';
import {
  parseRecents, RECENTS_KEPT, RECENTS_SHOWN, rememberSearch,
} from './recents';

describe('rememberSearch', () => {
  it('puts the newest search first', () => {
    expect(rememberSearch(['pho'], 'bánh mì')).toEqual(['bánh mì', 'pho']);
  });

  it('trims what travels', () => {
    expect(rememberSearch([], '  rooftop  ')).toEqual(['rooftop']);
  });

  it('one memory per folded form — the retype wins and moves up', () => {
    // "Banh mi" without diacritics is the same memory as "Bánh mì" with
    // them; the surviving spelling is the newest one.
    expect(rememberSearch(['Bánh mì', 'pho'], 'banh mi')).toEqual(['banh mi', 'pho']);
  });

  it('caps the list at RECENTS_KEPT, oldest falling off', () => {
    const full = Array.from({ length: RECENTS_KEPT }, (_, i) => `q${i}`);
    const out = rememberSearch(full, 'new');
    expect(out).toHaveLength(RECENTS_KEPT);
    expect(out[0]).toBe('new');
    expect(out).not.toContain(`q${RECENTS_KEPT - 1}`);
  });

  it('a blank term changes nothing — the very same list back', () => {
    const list = ['pho'];
    expect(rememberSearch(list, '   ')).toBe(list);
  });
});

describe('parseRecents', () => {
  it('nothing stored is an empty list', () => {
    expect(parseRecents(null)).toEqual([]);
    expect(parseRecents(undefined)).toEqual([]);
    expect(parseRecents('')).toEqual([]);
  });

  it('round-trips what rememberSearch wrote', () => {
    const list = rememberSearch(['pho'], 'bánh mì');
    expect(parseRecents(JSON.stringify(list))).toEqual(list);
  });

  it('shrugs at garbage instead of throwing', () => {
    expect(parseRecents('not json {')).toEqual([]);
    expect(parseRecents('"a string"')).toEqual([]);
    expect(parseRecents('{"a":1}')).toEqual([]);
  });

  it('keeps only usable strings, trimmed', () => {
    expect(parseRecents(JSON.stringify(['  pho ', 3, null, '', '  ', 'bún chả'])))
      .toEqual(['pho', 'bún chả']);
  });

  it('caps an oversized stored list', () => {
    const big = Array.from({ length: RECENTS_KEPT + 5 }, (_, i) => `q${i}`);
    expect(parseRecents(JSON.stringify(big))).toHaveLength(RECENTS_KEPT);
  });
});

describe('the two caps', () => {
  it('shows fewer than it keeps, so a dedupe cannot visibly shorten the list', () => {
    expect(RECENTS_SHOWN).toBeLessThan(RECENTS_KEPT);
  });
});
