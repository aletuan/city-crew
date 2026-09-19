// Tested here rather than beside the module, for the reason
// `ward.test.ts` gives: the module runs in a Deno Edge Function and the
// test runner lives in the app. Every case below is a real row from the
// 13–18 Sep 2026 import audit unless it says otherwise.

import { describe, expect, it } from 'vitest';

import { cleanName } from '../../../supabase/functions/_shared/place-name';

const name = (s: string) => cleanName(s).name;

describe('cleanName — trademark marks', () => {
  it('drops a mark stuck to the name', () => {
    expect(name('Chidori Crepe® - Võ Trường Toản')).toBe('Chidori Crepe - Võ Trường Toản');
  });

  it('drops a leading mark, which sorted the row above the alphabet', () => {
    expect(name('® XOCOATI - Artisan Cocoa Drinks')).toBe('XOCOATI - Artisan Cocoa Drinks');
  });

  it('drops ™, © and ℠ too', () => {
    expect(name('Bún Chả™')).toBe('Bún Chả');
    expect(name('Roastery©')).toBe('Roastery');
    expect(name('Atelier℠')).toBe('Atelier');
  });
});

describe('cleanName — operational suffixes', () => {
  it('cuts the hours the row already has a column for', () => {
    expect(name('Cà Zone - Nguyễn Gia Trí - Open 24h')).toBe('Cà Zone - Nguyễn Gia Trí');
  });

  it('cuts the Vietnamese phrasing as well', () => {
    expect(name('Quán Nhỏ - Mở cửa 24/24')).toBe('Quán Nhỏ');
  });

  it('keeps hours that are the name rather than a suffix', () => {
    // A real row: the shop is called this. No separator, so nothing to cut.
    expect(name('COFFEE 24/24')).toBe('COFFEE 24/24');
  });

  it('cuts one suffix, not a stack — the middle of a name is never touched', () => {
    expect(name('Kafe - 24h - Nguyễn Huệ')).toBe('Kafe - 24h - Nguyễn Huệ');
  });

  it('never cuts the only segment there is', () => {
    expect(name('Open 24h')).toBe('Open 24h');
  });
});

describe('cleanName — script name_en has no reader for', () => {
  it('drops a Korean tail, whole tokens at a time', () => {
    // Token-wise, not character-wise: stripping only the Hangul from
    // `2군` would leave a stray `2` behind.
    expect(name('Kakinoki 호치민 2군 일식 이탈리안')).toBe('Kakinoki');
  });

  it('drops a Korean segment', () => {
    expect(name('Pacho Pocha Express - 파초포차')).toBe('Pacho Pocha Express');
  });

  it('drops Han that is as likely Chinese as anything', () => {
    expect(name('Meili 美丽 - Mì Bò Đài Loan Bình Thạnh'))
      .toBe('Meili - Mì Bò Đài Loan Bình Thạnh');
  });

  it('keeps a name that is entirely in another script', () => {
    // Blank is worse than unreadable, and the desk can still see what it is.
    expect(name('隠れ家バー')).toBe('隠れ家バー');
  });

  it('leaves Vietnamese alone — Latin with marks is Latin', () => {
    expect(name('Tiệm cà phê Xứ Nam Kỳ')).toBe('Tiệm cà phê Xứ Nam Kỳ');
    expect(name('Đông Đô')).toBe('Đông Đô');
  });
});

describe('cleanName — the Japanese half of a bilingual sign', () => {
  it('moves kana to name_ja instead of throwing it away', () => {
    expect(cleanName('To - Hidden Cocktails Bar ト - 隠れ家バー')).toEqual({
      name: 'To - Hidden Cocktails Bar',
      ja: 'ト - 隠れ家バー',
    });
  });

  it('claims nothing for Han with no kana in it — that could be Chinese', () => {
    expect(cleanName('Meili 美丽').ja).toBeNull();
  });

  it('claims nothing when nothing was dropped', () => {
    expect(cleanName('Cà Kê Café').ja).toBeNull();
  });

  it('claims nothing for a name that is entirely Japanese', () => {
    // The name is kept whole, so there is no second string to file.
    expect(cleanName('隠れ家バー')).toEqual({ name: '隠れ家バー', ja: null });
  });
});

describe('cleanName — the first letter', () => {
  it('lifts a lower-case opening', () => {
    expect(name('donau the cafe')).toBe('Donau the cafe');
    expect(name('nhà tạo cafe')).toBe('Nhà tạo cafe');
  });

  it('lifts đ, which Unicode already knows how to case', () => {
    expect(name('đông đô')).toBe('Đông đô');
  });

  it('leaves the rest of the words to the desk', () => {
    // Title Case is not mechanical in a half-Vietnamese catalog — see the
    // note at the top of place-name.ts.
    expect(name('TRỐN để dừng chân')).toBe('TRỐN để dừng chân');
    expect(name('Em có cafe')).toBe('Em có cafe');
  });

  it('leaves a name that opens with a digit or a quote', () => {
    expect(name('1/2 Circle Coffee')).toBe('1/2 Circle Coffee');
    expect(name("'Round Midnight")).toBe("'Round Midnight");
  });
});

describe('cleanName — whitespace and empties', () => {
  it('collapses the space a stripped mark leaves behind', () => {
    expect(name('Chidori  Crepe ®  - Võ Trường Toản')).toBe('Chidori Crepe - Võ Trường Toản');
  });

  it('normalises the separator Google sent', () => {
    expect(name('Kafe – Quận 1')).toBe('Kafe - Quận 1');
    expect(name('Kafe — Quận 1')).toBe('Kafe - Quận 1');
  });

  it('answers empty for empty, so the caller can fall back', () => {
    expect(cleanName('')).toEqual({ name: '', ja: null });
    expect(cleanName('   ')).toEqual({ name: '', ja: null });
    expect(cleanName('®')).toEqual({ name: '', ja: null });
  });
});
