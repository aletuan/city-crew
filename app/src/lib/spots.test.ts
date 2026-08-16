import { describe, expect, it } from 'vitest';
import { ctaMode, spotLabel, toSpots, type SpotRow } from './spots';

const row = (over: Partial<SpotRow> = {}): SpotRow => ({
  name: 'Somewhere',
  street: '',
  city: '',
  county: '',
  state: '',
  country: '',
  lat: 21.0287,
  lng: 105.8546,
  ...over,
});

describe('spotLabel', () => {
  it('runs the parts outward', () => {
    expect(spotLabel(row({
      street: '12 Hàng Bông', city: 'Hoàn Kiếm', county: 'Hà Nội', state: 'Hanoi',
    }))).toBe('12 Hàng Bông, Hoàn Kiếm, Hà Nội, Hanoi');
  });

  // The case that made this a function rather than a join. An OSM row for
  // a commune office carries the commune as the name *and* the city, so
  // the naive version read "Ủy ban nhân dân xã Quý Lộc · Quý Lộc, Quý Lộc"
  // and told the reader nothing about which result to pick.
  it('drops a part that repeats the name', () => {
    expect(spotLabel(row({ name: 'Quý Lộc', city: 'Quý Lộc', county: 'Yên Định' })))
      .toBe('Yên Định');
  });

  it('drops a part that repeats an earlier part', () => {
    expect(spotLabel(row({ city: 'Hà Nội', county: 'Hà Nội', state: 'Hà Nội' })))
      .toBe('Hà Nội');
  });

  it('ignores case and padding when deciding what repeats', () => {
    expect(spotLabel(row({ name: 'Quý Lộc', city: '  quý lộc  ' }))).toBe('');
  });

  it('leaves out the country, which never tells two results apart', () => {
    expect(spotLabel(row({ city: 'Hoàn Kiếm', country: 'Vietnam' }))).toBe('Hoàn Kiếm');
  });

  it('is empty when there is nothing but a name', () => {
    expect(spotLabel(row())).toBe('');
  });

  it('skips blank parts rather than leaving gaps between commas', () => {
    expect(spotLabel(row({ street: '', city: 'Ba Đình', county: '   ', state: 'Hanoi' })))
      .toBe('Ba Đình, Hanoi');
  });
});

describe('toSpots', () => {
  it('labels each row', () => {
    expect(toSpots([row({ name: 'Chả Cá Thăng Long', city: 'Hoàn Kiếm' })])).toEqual([
      { name: 'Chả Cá Thăng Long', label: 'Hoàn Kiếm', lat: 21.0287, lng: 105.8546 },
    ]);
  });

  // Two providers over one dataset, so the same doorway arrives twice
  // under two spellings. Identity is the position, not the text.
  it('keeps the first of two rows at the same point', () => {
    const out = toSpots([
      row({ name: 'Ủy ban nhân dân xã Quý Lộc' }),
      row({ name: 'UBND xã Quý Lộc' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Ủy ban nhân dân xã Quý Lộc');
  });

  // Four decimals is about 11 m. Two shops side by side must stay two.
  it('keeps two rows a street apart', () => {
    expect(toSpots([
      row({ name: 'A', lat: 21.0287, lng: 105.8546 }),
      row({ name: 'B', lat: 21.0295, lng: 105.8551 }),
    ])).toHaveLength(2);
  });

  it('drops a row with no name, which would be a pin with no label', () => {
    expect(toSpots([row({ name: '   ' })])).toEqual([]);
  });

  it('drops a row that cannot be put on a map', () => {
    expect(toSpots([
      row({ name: 'no lat', lat: NaN }),
      row({ name: 'no lng', lng: Infinity, lat: 21.5 }),
    ])).toEqual([]);
  });

  it('trims the name it shows', () => {
    expect(toSpots([row({ name: '  Hồ Tây  ' })])[0].name).toBe('Hồ Tây');
  });

  it('has nothing to say about nothing', () => {
    expect(toSpots([])).toEqual([]);
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