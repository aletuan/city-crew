import { describe, expect, it } from 'vitest';
import { stripMarks } from './text';

describe('stripMarks', () => {
  it('takes every Vietnamese mark off and keeps case', () => {
    expect(stripMarks('Đà Nẵng')).toBe('Da Nang');
    expect(stripMarks('Hồ Hoàn Kiếm, Phường Hàng Trống')).toBe('Ho Hoan Kiem, Phuong Hang Trong');
    expect(stripMarks('ỷ ữ ợ ấ ặ ể')).toBe('y u o a a e');
  });

  it('turns both cases of đ into d, keeping the case', () => {
    expect(stripMarks('đường Đồng Khởi')).toBe('duong Dong Khoi');
  });

  it('maps styled and fullwidth letters back to plain ones', () => {
    expect(stripMarks('𝐂𝐫𝐮𝐦𝐛𝐬')).toBe('Crumbs');
    expect(stripMarks('３Ｃ')).toBe('3C');
    expect(stripMarks('ﬁnest')).toBe('finest');
  });

  it('leaves what has no marks alone, including other scripts', () => {
    expect(stripMarks('Coffee 24/24 – Hàm Nghi')).toBe('Coffee 24/24 – Ham Nghi');
    expect(stripMarks('本屋')).toBe('本屋');
    expect(stripMarks('')).toBe('');
  });
});
