import { describe, expect, it } from 'vitest';
import { brandKey } from './brand';

describe('brandKey', () => {
  it('strips a branch suffix after " - "', () => {
    expect(brandKey('OKKIO Caffe - Lê Lợi')).toBe('okkio caffe');
    expect(brandKey('OKKIO Caffe - Tự Do')).toBe('okkio caffe');
  });

  // The catalog's own separator. Every branch suffix the desk has
  // imported is an en dash; a key that only knew the hyphen grouped none.
  it('strips a branch suffix after an en or em dash', () => {
    expect(brandKey("Pizza 4P's – Bảo Khánh")).toBe("pizza 4p's");
    expect(brandKey("Pizza 4P's – Tràng Tiền")).toBe("pizza 4p's");
    expect(brandKey('Hadu Sushi — Tây Hồ')).toBe('hadu sushi');
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
    expect(brandKey('Bún chả–Hàng Mành')).toBe('bún chả–hàng mành');
  });

  // Callers must read '' as "no brand to judge by", never as a brand —
  // or every unnamed place becomes one giant chain.
  it('answers no-name with the empty string', () => {
    expect(brandKey(null)).toBe('');
    expect(brandKey(undefined)).toBe('');
    expect(brandKey('   ')).toBe('');
  });
});
