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
    expect(subtitleBeside(splitName('Cafe Slow - Thảo Điền'), 'Thảo Điền', null)).toBeNull();
    expect(subtitleBeside(splitName('Cafe Slow - Thảo Điền'), 'Thao Dien', null)).toBeNull();
  });

  it('keeps a qualifier that says something else', () => {
    expect(subtitleBeside(splitName('Bold Brew - Cafe & Work Date Huỳnh Thúc Kháng'), 'Giảng Võ', null))
      .toBe('Cafe & Work Date Huỳnh Thúc Kháng');
    expect(subtitleBeside(splitName('Every Half Coffee Roasters - Đồng Khởi'), null, null)).toBe('Đồng Khởi');
  });

  it('is null when there was nothing to print', () => {
    expect(subtitleBeside(splitName('Mellow Coffee'), 'Hoàn Kiếm', null)).toBeNull();
  });

  // ── the address rule ──
  //
  // The commoner half: 128 of the catalog's 250 subtitles name the street
  // the address row prints a few lines further down. Containment rather
  // than equality, because the street is a fragment of the address and
  // never the whole of it — which is exactly what the neighbourhood test
  // above cannot express.
  it('drops a qualifier the address row already prints', () => {
    expect(subtitleBeside(
      splitName('Bold Brew - Huỳnh Thúc Kháng'),
      'Giảng Võ',
      '27/16 Ng. 18 Huỳnh Thúc Kháng, Giảng Võ',
    )).toBeNull();
    expect(subtitleBeside(
      splitName("Pizza 4P's - Saigon Pearl"),
      'Thạnh Mỹ Tây',
      'Ruby Home 1, 92 Nguyễn Hữu Cảnh, Saigon Pearl, Thạnh Mỹ Tây',
    )).toBeNull();
  });

  // Folded on both sides, which is one real row in the catalog: the name
  // is written "Yên Hoà" and the address "Yên Hòa".
  it('drops one whose diacritics are merely typed differently', () => {
    expect(subtitleBeside(
      splitName('CTQ Texas BBQ - Yên Hoà'),
      'Yên Hòa',
      'Chung Cư 17T8, P. Hoàng Đạo Thúy, Trung Hòa Nhân Chính, Yên Hòa',
    )).toBeNull();
  });

  // The 122 that survive, and why the rule has to be this narrow. A
  // qualifier that describes the place is not in the address and must
  // not be inferred to be.
  it('keeps a qualifier the address does not carry', () => {
    expect(subtitleBeside(
      splitName('Hèm Hội An - Cocktail Bar'),
      'Hội An',
      '317 Nguyễn Duy Hiệu, Hội An',
    )).toBe('Cocktail Bar');
    expect(subtitleBeside(
      splitName('Yoshiya - Omurice & Ramen'),
      'Hoàn Kiếm',
      '34 P. Bát Sứ, Phố cổ Hà Nội, Hoàn Kiếm',
    )).toBe('Omurice & Ramen');
  });

  // Sixteen Thảo Điền places now carry an address that says "An Khánh",
  // the ward renamed under them — and the neighbourhood was renamed with
  // it, so neither test reaches the branch name. Which is right: it is
  // the only thing left on the card that says where the reader is.
  it('keeps a branch name whose ward was renamed under it', () => {
    expect(subtitleBeside(
      splitName('Cẩm Thị - Thảo Điền'),
      'An Khánh',
      '24 Tống Hữu Định, An Khánh',
    )).toBe('Thảo Điền');
  });

  // One of the sixteen stands on a street named Thảo Điền, so its address
  // does print the word and the rule drops it. Pinned because it looks
  // like a counterexample to the test above and is not one — the rule is
  // "what the card already says", and here the card says it.
  it('drops that same branch name when the street is what it is named for', () => {
    expect(subtitleBeside(
      splitName('Every Half Coffee Roasters - Thảo Điền'),
      'An Khánh',
      '1F 16 Thảo Điền, An Khánh',
    )).toBeNull();
  });

  // The address given here is the one the card prints — `shortAddress`'s
  // output, city and country already gone. Handed the raw column instead,
  // this subtitle would match the city segment and vanish, and the reader
  // would lose the only word telling one Magicha from another.
  it('is judged against the printed address, not the raw one', () => {
    const split = splitName('Magicha.zenbar - Hội An');
    expect(subtitleBeside(split, 'Hội An Tây', '11A Tuệ Tĩnh, Hội An Tây')).toBeNull();
    expect(subtitleBeside(split, 'Cẩm Phô', '11A Tuệ Tĩnh, Cẩm Phô')).toBe('Hội An');
  });

  it('has no address to judge against and says so by keeping the qualifier', () => {
    expect(subtitleBeside(splitName('Bao La - Hidden Bar'), 'Thuận Hóa', null)).toBe('Hidden Bar');
    expect(subtitleBeside(splitName('Bao La - Hidden Bar'), 'Thuận Hóa', undefined)).toBe('Hidden Bar');
  });
});
