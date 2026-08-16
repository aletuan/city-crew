// The Edge Function's provider parsers, run in Node.
//
// They live in `supabase/functions/find-address/osm.ts` because that is where
// they are used, and they are tested from here because this is the only
// test runner the repository has that speaks TypeScript. The import
// reaches across that boundary on purpose; the alternative was leaving
// the half of the feature most likely to be wrong — somebody else's field
// names — with no test at all.
//
// The fixtures are trimmed from real responses — both services were
// called for real while this was written, through the database rather
// than from here, because the sandbox's proxy blocks them and Postgres's
// `pg_net` does not. Every field name below is one a live row actually
// carried.
//
// They still pin the parsing rather than the coverage. Whether OSM knows
// a particular Vietnamese commune office is a question about the map, not
// about this code, and the answer varies: it has the committee for Vĩnh
// Lộc and not the one for Quý Lộc.

import { describe, expect, it } from 'vitest';
import { fromNominatim, fromPhoton, interleave } from '../../../supabase/functions/find-address/osm';

describe('fromPhoton', () => {
  const feature = (properties: Record<string, unknown>, coordinates: unknown = [105.8542, 21.0285]) =>
    ({ type: 'Feature', geometry: { type: 'Point', coordinates }, properties });

  it('reads a named place with a full address', () => {
    expect(fromPhoton({
      features: [feature({
        name: 'Chả Cá Thăng Long',
        housenumber: '19-21-31',
        street: 'Đường Thành',
        city: 'Hoàn Kiếm',
        county: 'Hà Nội',
        state: 'Hanoi',
        country: 'Vietnam',
      })],
    })).toEqual([{
      name: 'Chả Cá Thăng Long',
      street: '19-21-31 Đường Thành',
      city: 'Hoàn Kiếm',
      county: 'Hà Nội',
      state: 'Hanoi',
      country: 'Vietnam',
      lat: 21.0285,
      lng: 105.8542,
    }]);
  });

  // GeoJSON is [lon, lat], the reverse of every other pair in this
  // codebase. Getting it backwards puts Hanoi in the Indian Ocean — a
  // plausible-looking point rather than an error, which is exactly the
  // kind of wrong that ships.
  it('puts the coordinate pair back the right way round', () => {
    const [row] = fromPhoton({ features: [feature({ name: 'x' }, [105.8542, 21.0285]) ] });
    expect(row.lat).toBe(21.0285);
    expect(row.lng).toBe(105.8542);
  });

  it('falls back to the street, then the city, when a row has no name', () => {
    expect(fromPhoton({ features: [feature({ street: 'Hàng Bông', city: 'Hoàn Kiếm' })] })[0].name)
      .toBe('Hàng Bông');
    expect(fromPhoton({ features: [feature({ city: 'Hoàn Kiếm' })] })[0].name).toBe('Hoàn Kiếm');
  });

  it('drops a house number that has no street to sit in front of', () => {
    expect(fromPhoton({ features: [feature({ name: 'x', housenumber: '12' })] })[0].street).toBe('');
  });

  it('takes the district when there is no city', () => {
    expect(fromPhoton({ features: [feature({ name: 'x', district: 'Ba Đình' })] })[0].city)
      .toBe('Ba Đình');
  });

  it('skips a feature with no usable point', () => {
    expect(fromPhoton({ features: [
      feature({ name: 'no coords' }, null),
      feature({ name: 'short' }, [105.8]),
      feature({ name: 'not numbers' }, ['a', 'b']),
    ] })).toEqual([]);
  });

  it('treats a body that is not a feature collection as no answer', () => {
    expect(fromPhoton(null)).toEqual([]);
    expect(fromPhoton({})).toEqual([]);
    expect(fromPhoton({ features: 'nope' })).toEqual([]);
    expect(fromPhoton('<html>502</html>')).toEqual([]);
  });

  it('trims whatever it is given', () => {
    expect(fromPhoton({ features: [feature({ name: '  Hồ Tây  ' })] })[0].name).toBe('Hồ Tây');
  });
});

describe('fromNominatim', () => {
  const hit = (over: Record<string, unknown> = {}) => ({
    lat: '21.0285',
    lon: '105.8542',
    name: 'Ủy ban nhân dân xã Quý Lộc',
    display_name: 'Ủy ban nhân dân xã Quý Lộc, Quý Lộc, Yên Định, Thanh Hóa, Việt Nam',
    address: { village: 'Quý Lộc', county: 'Yên Định', state: 'Thanh Hóa', country: 'Việt Nam' },
    ...over,
  });

  // lat/lon arrive as strings here and as numbers from Photon. Without the
  // conversion every row is NaN and the whole provider silently returns
  // nothing.
  it('turns its string coordinates into numbers', () => {
    const [row] = fromNominatim([hit()]);
    expect(row.lat).toBe(21.0285);
    expect(row.lng).toBe(105.8542);
  });

  it('reads the administrative parts a reader would recognise', () => {
    expect(fromNominatim([hit()])[0]).toMatchObject({
      name: 'Ủy ban nhân dân xã Quý Lộc',
      city: 'Quý Lộc',
      county: 'Yên Định',
      state: 'Thanh Hóa',
    });
  });

  // A commune lands on a different key depending on the row, and they are
  // one slot to a reader.
  it('collapses city, town, village and suburb into one slot', () => {
    const at = (address: Record<string, unknown>) => fromNominatim([hit({ address })])[0].city;
    expect(at({ city: 'Hà Nội' })).toBe('Hà Nội');
    expect(at({ town: 'Sa Pa' })).toBe('Sa Pa');
    expect(at({ village: 'Quý Lộc' })).toBe('Quý Lộc');
    expect(at({ suburb: 'Nghĩa Đô' })).toBe('Nghĩa Đô');
  });

  it('takes the head of display_name when the row has no name', () => {
    expect(fromNominatim([hit({ name: '' })])[0].name).toBe('Ủy ban nhân dân xã Quý Lộc');
    expect(fromNominatim([hit({ name: undefined })])[0].name).toBe('Ủy ban nhân dân xã Quý Lộc');
  });

  it('is left with nothing when there is no name anywhere', () => {
    expect(fromNominatim([hit({ name: '', display_name: '' })])[0].name).toBe('');
  });

  it('joins a house number to its road', () => {
    expect(fromNominatim([hit({ address: { house_number: '12', road: 'Hàng Bông' } })])[0].street)
      .toBe('12 Hàng Bông');
  });

  it('skips a row whose coordinates do not parse', () => {
    expect(fromNominatim([hit({ lat: 'nowhere' }), hit({ lon: '' })])).toEqual([]);
  });

  it('survives a row with no address object at all', () => {
    expect(fromNominatim([hit({ address: undefined })])[0]).toMatchObject({ city: '', county: '' });
  });

  it('treats a body that is not a list as no answer', () => {
    expect(fromNominatim(null)).toEqual([]);
    expect(fromNominatim({ error: 'rate limited' })).toEqual([]);
    expect(fromNominatim('<html>429</html>')).toEqual([]);
  });
});

describe('interleave', () => {
  it('alternates, so each list\'s best guess is in the top two', () => {
    expect(interleave(['p1', 'p2', 'p3'], ['n1', 'n2', 'n3']))
      .toEqual(['p1', 'n1', 'p2', 'n2', 'p3', 'n3']);
  });

  // The measured case: Photon answers a commune-office query with four
  // confident wrong rows from other provinces. Appending would put
  // Nominatim's correct answer fifth, below a fold the reader never
  // reaches; alternating puts it second.
  it('keeps the shorter list from being buried', () => {
    expect(interleave(['bad1', 'bad2', 'bad3', 'bad4'], ['right']))
      .toEqual(['bad1', 'right', 'bad2', 'bad3', 'bad4']);
  });

  it('is the other list when one is empty', () => {
    expect(interleave([], ['a', 'b'])).toEqual(['a', 'b']);
    expect(interleave(['a', 'b'], [])).toEqual(['a', 'b']);
    expect(interleave([], [])).toEqual([]);
  });
});
