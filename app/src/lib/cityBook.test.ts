import { describe, expect, it } from 'vitest';
import { cityBook, MAX_RECENT_CITIES, parseCityRecents, rememberCity } from './cityBook';

// The ten cities live on 21 Oct 2026, by their Vietnamese short names.
type C = { id: string; vi: string; en: string; ja: string };
const city = (id: string, vi: string, en = vi, ja = vi): C => ({ id, vi, en, ja });
const CITIES: C[] = [
  city('hcmc', 'Sài Gòn', 'Saigon', 'サイゴン'),
  city('hanoi', 'Hà Nội', 'Hanoi', 'ハノイ'),
  city('danang', 'Đà Nẵng', 'Da Nang', 'ダナン'),
  city('dalat', 'Đà Lạt', 'Da Lat', 'ダラット'),
  city('hue', 'Huế', 'Hue', 'フエ'),
  city('vungtau', 'Vũng Tàu', 'Vung Tau', 'ブンタウ'),
  city('haiphong', 'Hải Phòng', 'Hai Phong', 'ハイフォン'),
  city('melbourne', 'Melbourne', 'Melbourne', 'メルボルン'),
  city('hoian', 'Hội An', 'Hoi An', 'ホイアン'),
  city('ninhbinh', 'Ninh Bình', 'Ninh Binh', 'ニンビン'),
];
const vi = (o: { recent?: string[]; query?: string; folded?: boolean } = {}) => cityBook(CITIES, {
  recent: o.recent ?? [], query: o.query ?? '', label: (c) => c.vi,
  names: (c) => [c.vi, c.en, c.ja], folded: o.folded ?? true,
});
const ids = (cs: readonly C[]) => cs.map((c) => c.id);

describe('parseCityRecents', () => {
  it('reads back what was stored', () => {
    expect(parseCityRecents('["hue","dalat"]')).toEqual(['hue', 'dalat']);
  });

  it('reads anything else as nothing', () => {
    for (const raw of [null, '', 'not json', '{"a":1}', '"hue"']) {
      expect(parseCityRecents(raw), String(raw)).toEqual([]);
    }
  });

  it('keeps only ids, and no more than the cap', () => {
    expect(parseCityRecents('["a", 2, "", null, "b", "c", "d"]')).toEqual(['a', 'b', 'c']);
    expect(MAX_RECENT_CITIES).toBe(3);
  });
});

describe('rememberCity', () => {
  it('puts the city in front, once', () => {
    expect(rememberCity(['hue', 'dalat'], 'hcmc')).toEqual(['hcmc', 'hue', 'dalat']);
    expect(rememberCity(['hue', 'dalat', 'hcmc'], 'dalat')).toEqual(['dalat', 'hue', 'hcmc']);
  });

  it('drops the oldest past the cap', () => {
    expect(rememberCity(['a', 'b', 'c'], 'd')).toEqual(['d', 'a', 'b']);
  });

  // So the provider can tell nothing changed, and write nothing.
  it('hands back the same list when the city already leads', () => {
    const list = ['hue', 'dalat'];
    expect(rememberCity(list, 'hue')).toBe(list);
  });
});

describe('cityBook', () => {
  // Đà Lạt and Đà Nẵng with the Ds, and Hà Nội before Hải Phòng: "ha noi"
  // sorts before "hai phong" on the space.
  it('lists every city A to Z by the name on screen, folded, when none is recent', () => {
    expect(ids(vi().others)).toEqual([
      'dalat', 'danang', 'hanoi', 'haiphong', 'hoian', 'hue', 'melbourne', 'ninhbinh', 'hcmc', 'vungtau',
    ]);
  });

  // Two cities can share a short name (a Saint-something in two
  // countries); they keep the order the desk gave them.
  it('keeps two cities of one name in the order they came', () => {
    const twins = [city('b', 'San Jose'), city('a', 'San Jose')];
    expect(ids(cityBook(twins, { recent: [], query: '', label: (c) => c.vi, names: (c) => [c.vi], folded: true }).others))
      .toEqual(['b', 'a']);
  });

  // Katakana unfolded: folded, ブンタウ would sort ahead of フエ.
  it('sorts kana whole', () => {
    const { others } = cityBook(CITIES, { recent: [], query: '', label: (c) => c.ja, names: (c) => [c.ja], folded: false });
    expect(others.map((c) => c.ja)).toEqual([...CITIES.map((c) => c.ja)].sort());
    expect(others.map((c) => c.ja).indexOf('フエ')).toBeLessThan(others.map((c) => c.ja).indexOf('ブンタウ'));
  });

  it('lists the recent cities newest first, dropping one that has gone', () => {
    expect(ids(vi({ recent: ['hue', 'retired', 'dalat'] }).recent)).toEqual(['hue', 'dalat']);
  });

  // Drawn once: a recent city is not repeated in the list under it.
  it('leaves the recent cities out of the others', () => {
    const { recent, others } = vi({ recent: ['hanoi', 'haiphong', 'dalat'] });
    expect(ids(recent)).toEqual(['hanoi', 'haiphong', 'dalat']);
    expect(ids(others)).toEqual(['danang', 'hoian', 'hue', 'melbourne', 'ninhbinh', 'hcmc', 'vungtau']);
  });

  // One recent city is no section, so nothing is taken out of the list.
  it('keeps every city in the list when the recent section is not drawn', () => {
    expect(vi({ recent: ['hue'] }).others).toHaveLength(CITIES.length);
  });

  // The city on screen alone is no list: the section waits for a second.
  it('draws no recent section for one city, or none', () => {
    expect(vi({ recent: ['hue'] }).recent).toEqual([]);
    expect(vi({ recent: ['hue', 'retired'] }).recent).toEqual([]);
    expect(vi().recent).toEqual([]);
  });

  it('answers a search with the matches alone, in the same order, by any name', () => {
    const found = vi({ query: 'ha', recent: ['hue', 'dalat'] });
    expect(found.recent).toEqual([]);
    expect(ids(found.others)).toEqual(['hanoi', 'haiphong']);
    // Without marks, and in a language the row is not showing.
    expect(ids(vi({ query: 'da lat' }).others)).toEqual(['dalat']);
    expect(ids(vi({ query: 'saigon' }).others)).toEqual(['hcmc']);
    expect(ids(vi({ query: '  hue  ' }).others)).toEqual(['hue']);
    expect(vi({ query: 'zzz' }).others).toEqual([]);
  });

  it('leaves the cities it was given as they were', () => {
    const before = ids(CITIES);
    vi();
    expect(ids(CITIES)).toEqual(before);
  });
});
