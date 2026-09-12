import { describe, expect, it } from 'vitest';
import { ctaMode, fromCandidates, spotLabel } from './spots';
import type { Candidate } from './suggest';

const cand = (over: Partial<Candidate> = {}): Candidate => ({
  place_id: 'ChIJ-somewhere',
  name: 'Somewhere',
  address: '',
  lat: 21.0287,
  lng: 105.8546,
  rating: null,
  rating_count: null,
  ...over,
});

describe('spotLabel', () => {
  it('keeps the address as Google wrote it, minus the country', () => {
    expect(spotLabel({ name: 'Chả Cá Thăng Long', address: '6B Đường Thành, Hoàn Kiếm, Hà Nội, Vietnam' }))
      .toBe('6B Đường Thành, Hoàn Kiếm, Hà Nội');
  });

  // Google spells the country in the language it was asked in, so all
  // three the app speaks have to be recognised as the same last segment.
  it('drops the country in any of the three languages', () => {
    expect(spotLabel({ name: 'A', address: 'Ba Đình, Hà Nội, Việt Nam' })).toBe('Ba Đình, Hà Nội');
    expect(spotLabel({ name: 'A', address: 'Ba Đình, Hà Nội, ベトナム' })).toBe('Ba Đình, Hà Nội');
  });

  // The case that made this a function rather than a split. A result for
  // a ward carries its own name as the first part of its address, so the
  // naive version read "Hoàn Kiếm · Hoàn Kiếm, Hà Nội" and told the reader
  // nothing they had not read once already.
  it('drops a part that repeats the name', () => {
    expect(spotLabel({ name: 'Hoàn Kiếm', address: 'Hoàn Kiếm, Hà Nội, Vietnam' })).toBe('Hà Nội');
  });

  it('ignores case and padding when deciding what repeats', () => {
    expect(spotLabel({ name: 'Quý Lộc', address: '  quý lộc , Yên Định, Thanh Hóa, Vietnam' }))
      .toBe('Yên Định, Thanh Hóa');
  });

  // Unlike the place detail screen, the city stays: this search may
  // leave the city on purpose, and the segment that says which province
  // a result is in is the one that tells two same-named communes apart.
  it('keeps the city and province', () => {
    expect(spotLabel({ name: 'UBND xã Quý Lộc', address: 'Quý Lộc, Yên Định, Thanh Hóa, Vietnam' }))
      .toBe('Quý Lộc, Yên Định, Thanh Hóa');
  });

  it('is empty when the address says nothing the name did not', () => {
    expect(spotLabel({ name: 'Vietnam', address: 'Vietnam' })).toBe('');
    expect(spotLabel({ name: 'Hà Nội', address: 'Hà Nội, Vietnam' })).toBe('');
    expect(spotLabel({ name: 'A', address: '' })).toBe('');
  });

  it('skips blank parts rather than leaving gaps between commas', () => {
    expect(spotLabel({ name: 'A', address: 'Ba Đình, , Hà Nội' })).toBe('Ba Đình, Hà Nội');
  });
});

describe('fromCandidates', () => {
  it('labels each candidate', () => {
    expect(fromCandidates([cand({ name: 'Chả Cá Thăng Long', address: 'Hoàn Kiếm, Hà Nội, Vietnam' })]))
      .toEqual([{ name: 'Chả Cá Thăng Long', label: 'Hoàn Kiếm, Hà Nội', lat: 21.0287, lng: 105.8546 }]);
  });

  // Identity is Google's place id, so the same business under two
  // spellings is one row — and the first spelling is the one kept.
  it('keeps the first of two candidates with one place id', () => {
    const out = fromCandidates([
      cand({ name: 'Ủy ban nhân dân xã Quý Lộc' }),
      cand({ name: 'UBND xã Quý Lộc' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Ủy ban nhân dân xã Quý Lộc');
  });

  it('keeps two candidates with different ids at the same point', () => {
    expect(fromCandidates([
      cand({ place_id: 'a', name: 'A' }),
      cand({ place_id: 'b', name: 'B' }),
    ])).toHaveLength(2);
  });

  // A function deployed before its field mask asked for ids would answer
  // none; the position then stands in, as it did for OSM.
  it('falls back to the position when there is no id', () => {
    expect(fromCandidates([
      cand({ place_id: '', name: 'A' }),
      cand({ place_id: '', name: 'B' }),
    ])).toHaveLength(1);
  });

  it('drops a candidate with no name, which would be a pin with no label', () => {
    expect(fromCandidates([cand({ name: '   ' })])).toEqual([]);
  });

  it('drops a candidate that cannot be put on a map', () => {
    expect(fromCandidates([
      cand({ name: 'no lat', lat: null }),
      cand({ name: 'no lng', lng: null }),
      cand({ name: 'bad lat', lat: NaN }),
    ])).toEqual([]);
  });

  it('trims the name it shows', () => {
    expect(fromCandidates([cand({ name: '  Hồ Tây  ' })])[0].name).toBe('Hồ Tây');
  });

  // The reply is JSON from a function that may be older or newer than this
  // client, so the two strings the type promises are still treated as
  // optional: a missing name is a nameless pin and goes, a missing address
  // is an empty label and stays.
  it('survives a reply with the strings missing', () => {
    const bare = { ...cand(), name: undefined, address: undefined } as unknown as Candidate;
    expect(fromCandidates([bare])).toEqual([]);
    const noAddr = { ...cand({ name: 'Hồ Tây' }), address: undefined } as unknown as Candidate;
    expect(fromCandidates([noAddr])).toEqual([{ name: 'Hồ Tây', label: '', lat: 21.0287, lng: 105.8546 }]);
  });

  it('has nothing to say about nothing', () => {
    expect(fromCandidates([])).toEqual([]);
  });
});

describe('ctaMode', () => {
  // The reported trap: "cau giay" typed, Ba Đình chosen, and the biggest
  // button on the screen silently starts the day in Ba Đình.
  it('offers to search text that has never been searched', () => {
    expect(ctaMode('cau giay', '')).toBe('search');
  });

  it('commits once that same text has been searched', () => {
    expect(ctaMode('cau giay', 'cau giay')).toBe('commit');
  });

  // Picking a result writes its name back into the field, so a plain
  // has-searched flag would leave the button saying "Search" over text
  // that is already the answer.
  it('commits over the name of a result just taken', () => {
    expect(ctaMode('Cầu Giấy, Hà Nội', 'Cầu Giấy, Hà Nội')).toBe('commit');
  });

  // And editing after a search makes it unresolved again — which is why
  // this compares strings rather than counting searches.
  it('offers to search again once the text is edited', () => {
    expect(ctaMode('cau giay 2', 'cau giay')).toBe('search');
  });

  it('commits on an empty field, which asks nothing', () => {
    expect(ctaMode('', '')).toBe('commit');
    expect(ctaMode('   ', '')).toBe('commit');
    expect(ctaMode('', 'cau giay')).toBe('commit');
  });

  // Whitespace the reader cannot see must not hold the button on "Search"
  // over text that has already been answered.
  it('ignores padding on either side of the comparison', () => {
    expect(ctaMode('  cau giay  ', 'cau giay')).toBe('commit');
    expect(ctaMode('cau giay', '  cau giay  ')).toBe('commit');
  });

  // A search that found nothing still counts as asked: the reader has had
  // their answer and may now want the pin they already have.
  it('commits after a search that came back empty', () => {
    expect(ctaMode('nowhere at all', 'nowhere at all')).toBe('commit');
  });
});