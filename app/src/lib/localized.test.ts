// `localized`: one door for a row's languages, whether a language is a
// column or a key in the object. Pinned here is the order of the doors
// (object before column), that an empty string is nothing through either,
// and that the fallback is the provider's own and not a second one.

import { describe, expect, it } from 'vitest';
import { allLocalized, localized, localizedLang, slot } from './localized';

const PLACE = {
  name_en: 'Café A', name_vi: 'Quán A', name_ja: null,
  desc_en: 'A blurb', desc_vi: null, desc_ja: 'column ja',
  i18n: { ja: { desc: '川沿い。', machine: true }, ko: { name: '카페 A' } },
};

describe('slot', () => {
  it('reads the object before the column, and the column when the object has nothing', () => {
    expect(slot(PLACE, 'desc', 'ja')).toBe('川沿い。');
    expect(slot(PLACE, 'name', 'en')).toBe('Café A');
    expect(slot({ ...PLACE, i18n: {} }, 'desc', 'ja')).toBe('column ja');
    expect(slot({ ...PLACE, i18n: null }, 'desc', 'ja')).toBe('column ja');
    expect(slot({ ...PLACE, i18n: undefined }, 'desc', 'ja')).toBe('column ja');
  });

  it('treats an empty or blank string as nothing, through either door', () => {
    expect(slot({ name_en: '  ', i18n: { en: { name: '' } } }, 'name', 'en')).toBeNull();
    expect(slot({ i18n: { ja: { name: '' } }, name_ja: 'from column' }, 'name', 'ja')).toBe('from column');
    expect(slot({ i18n: { ja: null } }, 'name', 'ja')).toBeNull();
    expect(slot({ name_en: 7 as unknown as string }, 'name', 'en')).toBeNull();
  });
});

describe('localized', () => {
  // A Chinese name is one more key in the object: no column, no
  // migration. Without one the reader is handed English, then Vietnamese.
  it('reads Chinese from the object, and falls back to English without it', () => {
    const zh = { ...PLACE, i18n: { ...PLACE.i18n, zh: { name: '咖啡馆 A' } } };
    expect(localized(zh, 'name', 'zh')).toBe('咖啡馆 A');
    expect(localized(PLACE, 'name', 'zh')).toBe('Café A');
    expect(localized({ name_vi: 'Quán A' }, 'name', 'zh')).toBe('Quán A');
  });

  it('hands each reader their own language when the row has it', () => {
    expect(localized(PLACE, 'name', 'en')).toBe('Café A');
    expect(localized(PLACE, 'name', 'vi')).toBe('Quán A');
    expect(localized(PLACE, 'desc', 'ja')).toBe('川沿い。');
  });

  it('falls back in the provider’s order, and says which language it landed on', () => {
    // vi → en
    expect(localized(PLACE, 'desc', 'vi')).toBe('A blurb');
    expect(localizedLang(PLACE, 'desc', 'vi')).toBe('en');
    // ja → en → vi
    expect(localized(PLACE, 'name', 'ja')).toBe('Café A');
    expect(localizedLang({ name_vi: 'Chỉ Việt' }, 'name', 'ja')).toBe('vi');
    // en → vi
    expect(localized({ name_vi: 'Chỉ Việt' }, 'name', 'en')).toBe('Chỉ Việt');
  });

  it('gives an empty string, never undefined, when every slot is empty', () => {
    expect(localized({}, 'name', 'ja')).toBe('');
    expect(localizedLang({}, 'name', 'ja')).toBeNull();
    expect(localized({ i18n: { ja: { name: '' } }, name_en: '' }, 'name', 'ja')).toBe('');
  });
});

describe('allLocalized', () => {
  it('gathers every language of one field, columns and object alike, skipping blanks', () => {
    expect(allLocalized(PLACE, 'name')).toEqual(['Café A', 'Quán A', '카페 A']);
    expect(allLocalized(PLACE, 'desc')).toEqual(['A blurb', 'column ja', '川沿い。']);
  });

  it('matches the field exactly: name_en, not name_en_extra, and not names', () => {
    expect(allLocalized({ name_en: 'a', name_en_x: 'b', names_en: 'c', rename_en: 'd' }, 'name')).toEqual(['a']);
    expect(allLocalized({ i18n: { ja: null, ko: { desc: 'x', name: 3 as unknown as string } } }, 'name')).toEqual([]);
  });
});
