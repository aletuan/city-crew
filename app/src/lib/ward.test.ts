// Tested from here for the reason classify.test.ts states: the module
// runs in an Edge Function but is plain TypeScript with no imports and
// no Deno APIs, and this is where the test runner lives. Like
// `classify.ts`, it sits knowingly outside the coverage gate — the gate
// cannot re-root across the repository — and these tests are what holds
// it instead.

import { describe, expect, it } from 'vitest';
import { shortWard, wardFromAddress } from '../../../supabase/functions/_shared/ward';

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

// The city's name off the end of a merged ward's. Đà Lạt's four wards
// carry it since the 2025 mergers, and under a chip that already says
// Đà Lạt the card was saying it twice.
describe('shortWard', () => {
  const DALAT = ['Da Lat', 'Đà Lạt', 'Da Lat', 'Đà Lạt'];

  it('takes the city’s own name off the end, however it was written', () => {
    expect(shortWard('Xuân Hương - Đà Lạt', DALAT)).toBe('Xuân Hương');
    // The marks are not restored: that row's "Lam Vien" was fixed by hand.
    expect(shortWard('Lam Vien - Da Lat', DALAT)).toBe('Lam Vien');
    expect(shortWard('Cam Ly – Đà Lạt', DALAT)).toBe('Cam Ly');
    expect(shortWard('Xuân Trường — Đà Lạt', DALAT)).toBe('Xuân Trường');
  });

  // Two wards' names joined are not a ward and a city: which half to
  // keep is the owner's call, made by hand, not this function's.
  it('leaves a merged name alone when the suffix is not the city', () => {
    expect(shortWard('Văn Miếu - Quốc Tử Giám', ['Hanoi', 'Hà Nội'])).toBe('Văn Miếu - Quốc Tử Giám');
    expect(shortWard('Xuân Hương - Đà Lạt', ['Hanoi', 'Hà Nội'])).toBe('Xuân Hương - Đà Lạt');
  });

  it('passes a bare name, an empty name and an unknown city through', () => {
    expect(shortWard('Hoàn Kiếm', DALAT)).toBe('Hoàn Kiếm');
    expect(shortWard('Phường 7', [])).toBe('Phường 7');
    expect(shortWard(null, DALAT)).toBeNull();
    expect(shortWard('', DALAT)).toBeNull();
    expect(shortWard('Xuân Hương - Đà Lạt', [null, undefined])).toBe('Xuân Hương - Đà Lạt');
  });

  // The hyphen inside a name is not the city dash: it has no spaces.
  it('does not read a hyphenated name as a suffix', () => {
    expect(shortWard('Bà Rịa-Vũng Tàu', ['Vung Tau', 'Vũng Tàu'])).toBe('Bà Rịa-Vũng Tàu');
  });
});
