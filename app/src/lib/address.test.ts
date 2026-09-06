import { describe, expect, it } from 'vitest';
import { shortAddress } from './address';

describe('shortAddress', () => {
  it('drops the country, the postal code and the city, keeps street and ward', () => {
    expect(shortAddress('10 Ng. Thọ Xương, Hoàn Kiếm, Hà Nội 100000, Vietnam')).toBe('10 Ng. Thọ Xương, Hoàn Kiếm');
    expect(shortAddress('74 Hai Bà Trưng, Sài Gòn, Hồ Chí Minh 700000, Vietnam')).toBe('74 Hai Bà Trưng, Sài Gòn');
    expect(shortAddress('12 Hàng Gai, Hoàn Kiếm, Hà Nội, Việt Nam')).toBe('12 Hàng Gai, Hoàn Kiếm');
  });

  // A floor, a building or a business name in front of the street is
  // part of how to find the door; it stays.
  it('keeps every street-side segment', () => {
    expect(shortAddress('Tầng 1, 151 Đồng Khởi, Sài Gòn, Hồ Chí Minh, Vietnam')).toBe('Tầng 1, 151 Đồng Khởi, Sài Gòn');
    expect(shortAddress('Coffee Corner, 151 Đồng Khởi, Hồ Chí Minh, Vietnam')).toBe('Coffee Corner, 151 Đồng Khởi');
  });

  // Too short for the anatomy: the second segment is only the city when
  // it names one we know, or one the caller says the catalog knows.
  it('a two-part address loses its city only when the city is recognised', () => {
    expect(shortAddress('151 Đồng Khởi, Hồ Chí Minh, Vietnam')).toBe('151 Đồng Khởi');
    expect(shortAddress('151 Đồng Khởi, Thành phố Hồ Chí Minh')).toBe('151 Đồng Khởi');
    expect(shortAddress('12 Hàng Gai, Hanoi 100000')).toBe('12 Hàng Gai');
    expect(shortAddress('5 Đường A, Phường 7')).toBe('5 Đường A, Phường 7');
    expect(shortAddress('5 Đường A, Quy Nhơn', ['Quy Nhơn', 'Quy Nhon'])).toBe('5 Đường A');
  });

  it('never cuts below one segment', () => {
    expect(shortAddress('Hồ Chí Minh, Vietnam')).toBe('Hồ Chí Minh');
    expect(shortAddress('Vietnam')).toBe('Vietnam');
    expect(shortAddress('Hà Nội')).toBe('Hà Nội');
  });

  it('is null for nothing, and untouched for an address it cannot read', () => {
    expect(shortAddress(null)).toBeNull();
    expect(shortAddress(undefined)).toBeNull();
    expect(shortAddress('')).toBeNull();
    expect(shortAddress('Somewhere without commas')).toBe('Somewhere without commas');
    // Nothing but separators: no segment survives the split, and the
    // card must still print something for a row whose address is truthy.
    expect(shortAddress(', ,')).toBe(', ,');
  });
});
