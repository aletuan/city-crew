import { describe, expect, it } from 'vitest';
import { splitName, subtitleBeside } from './name';

describe('splitName', () => {
  it('cuts a brand from its qualifier at the first spaced dash', () => {
    expect(splitName('Bold Brew - Cafe & Work Date Huỳnh Thúc Kháng'))
      .toEqual({ title: 'Bold Brew', subtitle: 'Cafe & Work Date Huỳnh Thúc Kháng' });
    expect(splitName('Every Half Coffee Roasters - Đồng Khởi'))
      .toEqual({ title: 'Every Half Coffee Roasters', subtitle: 'Đồng Khởi' });
    expect(splitName('Đệ Nhất Mì Kéo - Quận 2 (Chi nhánh 8)'))
      .toEqual({ title: 'Đệ Nhất Mì Kéo', subtitle: 'Quận 2 (Chi nhánh 8)' });
  });

  it('accepts an en dash or an em dash for the same job', () => {
    expect(splitName('béo. cafe — Thảo Điền')).toEqual({ title: 'béo. cafe', subtitle: 'Thảo Điền' });
    expect(splitName('Cẩm Thị – Thảo Điền')).toEqual({ title: 'Cẩm Thị', subtitle: 'Thảo Điền' });
  });

  // The space on both sides is the whole test: a hyphen inside a word or
  // a number is part of the name.
  it('leaves hyphenated words and numbers alone', () => {
    expect(splitName("Everything Coffee 'N Bagel-Đào Tấn"))
      .toEqual({ title: "Everything Coffee 'N Bagel-Đào Tấn", subtitle: null });
    expect(splitName('99/81 Coffee')).toEqual({ title: '99/81 Coffee', subtitle: null });
    expect(splitName('Cộng Cà Phê (Đồng Khởi)')).toEqual({ title: 'Cộng Cà Phê (Đồng Khởi)', subtitle: null });
  });

  it('cuts once, so a second dash stays in the qualifier', () => {
    expect(splitName('Harbour - Rooftop Eatery - Bar'))
      .toEqual({ title: 'Harbour', subtitle: 'Rooftop Eatery - Bar' });
  });

  it('a dash with nothing on one side is not a qualifier', () => {
    expect(splitName('- Hidden Bar')).toEqual({ title: '- Hidden Bar', subtitle: null });
    expect(splitName('Bao La - ')).toEqual({ title: 'Bao La -', subtitle: null });
    expect(splitName('  Mellow Coffee  ')).toEqual({ title: 'Mellow Coffee', subtitle: null });
  });
});

describe('subtitleBeside', () => {
  it('drops a branch name the neighbourhood line already carries', () => {
    expect(subtitleBeside(splitName('Cafe Slow - Thảo Điền'), 'Thảo Điền')).toBeNull();
    expect(subtitleBeside(splitName('Cafe Slow - Thảo Điền'), 'Thao Dien')).toBeNull();
  });

  it('keeps a qualifier that says something else', () => {
    expect(subtitleBeside(splitName('Bold Brew - Cafe & Work Date Huỳnh Thúc Kháng'), 'Giảng Võ'))
      .toBe('Cafe & Work Date Huỳnh Thúc Kháng');
    expect(subtitleBeside(splitName('Every Half Coffee Roasters - Đồng Khởi'), null)).toBe('Đồng Khởi');
  });

  it('is null when there was nothing to print', () => {
    expect(subtitleBeside(splitName('Mellow Coffee'), 'Hoàn Kiếm')).toBeNull();
  });
});
