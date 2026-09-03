import { describe, expect, it } from 'vitest';
import { brandKey } from './brand';

describe('brandKey', () => {
  it('strips a branch suffix after " - "', () => {
    expect(brandKey('OKKIO Caffe - Lê Lợi')).toBe('okkio caffe');
    expect(brandKey('OKKIO Caffe - Tự Do')).toBe('okkio caffe');
  });

  it('strips a parenthetical after " ("', () => {
    expect(brandKey('Blank Lounge (Landmark 81)')).toBe('blank lounge');
  });

  it('leaves a plain name whole, lowered', () => {
    expect(brandKey('Broma: Not A Bar')).toBe('broma: not a bar');
  });

  // The separator is space-dash-space. A bare hyphen is part of a name —
  // splitting on it would merge half the Vietnamese catalog into one
  // imaginary chain.
  it('does not split on a hyphen inside a word', () => {
    expect(brandKey('Cai-Mam Eatery')).toBe('cai-mam eatery');
  });

  // Callers must read '' as "no brand to judge by", never as a brand —
  // or every unnamed place becomes one giant chain.
  it('answers no-name with the empty string', () => {
    expect(brandKey(null)).toBe('');
    expect(brandKey(undefined)).toBe('');
    expect(brandKey('   ')).toBe('');
  });
});
