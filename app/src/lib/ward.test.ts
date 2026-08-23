// Tested from here for the reason classify.test.ts states: the module
// runs in an Edge Function but is plain TypeScript with no imports and
// no Deno APIs, and this is where the test runner lives. Like
// `classify.ts`, it sits knowingly outside the coverage gate — the gate
// cannot re-root across the repository — and these tests are what holds
// it instead.

import { describe, expect, it } from 'vitest';
import { wardFromAddress } from '../../../supabase/functions/_shared/ward';

describe('wardFromAddress', () => {
  // The rows that motivated this: real Saigon imports whose Google
  // components carried no district tier while the address string did.
  it('reads the merged-ward names Saigon addresses carry', () => {
    expect(wardFromAddress('74 Hai Bà Trưng, Sài Gòn, Hồ Chí Minh 700000, Vietnam')).toBe('Sài Gòn');
    expect(wardFromAddress('120 - 122 Lê Lợi, Bến Thành, Hồ Chí Minh, Vietnam')).toBe('Bến Thành');
    expect(wardFromAddress('110 Xuân Thủy, An Khánh, Hồ Chí Minh, Vietnam')).toBe('An Khánh');
  });

  it('extra street segments do not shift the read', () => {
    expect(wardFromAddress('Tầng 1, 151 Đồng Khởi, Sài Gòn, Hồ Chí Minh, Vietnam')).toBe('Sài Gòn');
    expect(wardFromAddress('Alley 28 Thảo Điền, An Khánh, Hồ Chí Minh 713000, Vietnam')).toBe('An Khánh');
  });

  it('handles the country written in Vietnamese, or absent', () => {
    expect(wardFromAddress('12 Hàng Gai, Hoàn Kiếm, Hà Nội, Việt Nam')).toBe('Hoàn Kiếm');
    expect(wardFromAddress('12 Hàng Gai, Hoàn Kiếm, Hà Nội')).toBe('Hoàn Kiếm');
  });

  it('a numbered ward stays; a leading street number disqualifies', () => {
    // "Phường 7" has a digit but not first — a ward. A candidate that
    // *starts* with one is a street line, meaning the address never had
    // a ward tier at all.
    expect(wardFromAddress('5 Đường A, Phường 7, Hồ Chí Minh, Vietnam')).toBe('Phường 7');
    expect(wardFromAddress('Coffee Corner, 151 Đồng Khởi, Hồ Chí Minh, Vietnam')).toBeNull();
  });

  it('too short to hold a ward tier is null, not a guess', () => {
    expect(wardFromAddress('151 Đồng Khởi, Hồ Chí Minh, Vietnam')).toBeNull();
    expect(wardFromAddress('Hồ Chí Minh, Vietnam')).toBeNull();
    expect(wardFromAddress('Hồ Chí Minh')).toBeNull();
  });

  it('nothing in, nothing out', () => {
    expect(wardFromAddress(null)).toBeNull();
    expect(wardFromAddress(undefined)).toBeNull();
    expect(wardFromAddress('')).toBeNull();
  });
});
