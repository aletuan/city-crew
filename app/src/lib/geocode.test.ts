// The Edge Function's Geocoding parser, run in Node.
//
// It lives in `supabase/functions/fetch-place/geocode.ts` because that is
// where it is used, and it is tested from here because this is the only
// test runner the repository has that speaks TypeScript. The import
// reaches across that boundary on purpose; the alternative was leaving
// the half of the feature most likely to be wrong — somebody else's field
// names — with no test at all.
//
// The fixture is the shape Google documents for a reverse geocode with
// `result_type` set: one result per matching type, most specific first,
// each carrying its parents in `address_components`.

import { describe, expect, it } from 'vitest';
import { REVERSE_TYPES, reverseName } from '../../../supabase/functions/fetch-place/geocode';

const comp = (long_name: string, ...types: string[]) => ({ long_name, short_name: long_name, types });

const WARD = {
  types: ['political', 'sublocality', 'sublocality_level_1'],
  formatted_address: 'Hàng Trống, Hoàn Kiếm, Hà Nội, Vietnam',
  address_components: [
    comp('Hàng Trống', 'political', 'sublocality', 'sublocality_level_1'),
    comp('Hoàn Kiếm', 'administrative_area_level_2', 'political'),
    comp('Hà Nội', 'administrative_area_level_1', 'political'),
    comp('Vietnam', 'country', 'political'),
  ],
};
const DISTRICT = {
  types: ['administrative_area_level_2', 'political'],
  formatted_address: 'Hoàn Kiếm, Hà Nội, Vietnam',
  address_components: [
    comp('Hoàn Kiếm', 'administrative_area_level_2', 'political'),
    comp('Hà Nội', 'administrative_area_level_1', 'political'),
    comp('Vietnam', 'country', 'political'),
  ],
};
const PROVINCE = {
  types: ['administrative_area_level_1', 'political'],
  formatted_address: 'Hà Nội, Vietnam',
  address_components: [
    comp('Hà Nội', 'administrative_area_level_1', 'political'),
    comp('Vietnam', 'country', 'political'),
  ],
};

describe('reverseName', () => {
  it('names the ward when there is one', () => {
    expect(reverseName({ results: [WARD, DISTRICT, PROVINCE] })).toBe('Hàng Trống');
  });

  // The order is ours, not the reply's: a province listed first must not
  // win over the ward listed after it.
  it('prefers the most specific type whatever order Google sent', () => {
    expect(reverseName({ results: [PROVINCE, DISTRICT, WARD] })).toBe('Hàng Trống');
  });

  it('falls back outward when the point has no ward', () => {
    expect(reverseName({ results: [DISTRICT, PROVINCE] })).toBe('Hoàn Kiếm');
    expect(reverseName({ results: [PROVINCE] })).toBe('Hà Nội');
  });

  // The component of the result's own type, not its `formatted_address`,
  // which spells out every parent after it.
  it('reads the component rather than the formatted address', () => {
    expect(reverseName({ results: [DISTRICT] })).not.toContain(',');
  });

  it('skips a result whose components do not carry its own type', () => {
    const odd = { types: ['sublocality_level_1'], address_components: [comp('Hà Nội', 'administrative_area_level_1')] };
    expect(reverseName({ results: [odd, DISTRICT] })).toBe('Hoàn Kiếm');
  });

  it('is empty for an empty reply, a refusal, or nonsense', () => {
    expect(reverseName({ results: [], status: 'ZERO_RESULTS' })).toBe('');
    expect(reverseName({ error_message: 'denied', status: 'REQUEST_DENIED' })).toBe('');
    expect(reverseName(null)).toBe('');
    expect(reverseName('nope')).toBe('');
    expect(reverseName({ results: [{ types: ['locality'] }] })).toBe('');
  });

  // The filter sent to Google and the order walked here are the same
  // list, so the reply can never hold a type this cannot rank.
  it('asks Google for exactly the types it knows how to rank', () => {
    expect(REVERSE_TYPES).toEqual([
      'sublocality_level_1', 'sublocality', 'administrative_area_level_2', 'locality', 'administrative_area_level_1',
    ]);
  });
});
