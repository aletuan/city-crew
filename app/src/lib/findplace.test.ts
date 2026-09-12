import { beforeEach, describe, expect, it, vi } from 'vitest';

// The client is replaced before `findplace` is loaded, so the real one —
// which reaches for React Native at import time — is never constructed.
// `vi.hoisted` is what makes the holder exist early enough to be assigned
// inside the factory; a plain `let` is still in its temporal dead zone when
// the hoisted mock runs.
const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('./testing').fakeSupabase> | null }));
vi.mock('./supabase', async () => {
  const { fakeSupabase } = await import('./testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import { findSpots, nameOf } from './findplace';
import type { Candidate } from './suggest';

const fake = () => h.fake!;

const cand = (over: Partial<Candidate> = {}): Candidate => ({
  place_id: 'ChIJ-one-pillar', name: 'Chùa Một Cột',
  address: 'Chùa Một Cột, Đội Cấn, Ba Đình, Hà Nội, Vietnam',
  lat: 21.0359, lng: 105.8336, rating: 4.5, rating_count: 1200, ...over,
});

beforeEach(() => fake().reset());

describe('findSpots', () => {
  it('asks fetch-place to search, biased towards a point, in the reader\'s language', async () => {
    fake().replies({ data: { candidates: [cand()] } });
    const out = await findSpots('chua mot cot', { lat: 21, lng: 105.8 }, 'hanoi', 'vi');

    expect(fake().log).toEqual([{
      fn: 'fetch-place', op: 'invoke', filters: [],
      payload: { action: 'search', query: 'chua mot cot', at: { lat: 21, lng: 105.8 }, city: 'hanoi', lang: 'vi' },
    }]);
    expect(out).toEqual([{
      name: 'Chùa Một Cột', label: 'Đội Cấn, Ba Đình, Hà Nội', lat: 21.0359, lng: 105.8336,
    }]);
  });

  // `city: undefined` rather than `city: null`: the function reads
  // `body.city ?? "hcmc"`, and JSON drops an undefined key while it keeps
  // a null one — which `String(null)` would turn into the city "null".
  it('leaves the city out when there is none to send', async () => {
    fake().replies({ data: { candidates: [] } });
    await findSpots('anywhere', null, null, 'en');
    const payload = fake().log[0].payload as Record<string, unknown>;
    expect('city' in payload ? payload.city : 'absent').toBeUndefined();
    expect(JSON.parse(JSON.stringify(payload))).toEqual({ action: 'search', query: 'anywhere', at: null, lang: 'en' });
  });

  it('sends the trimmed query, not what the field happens to hold', async () => {
    fake().replies({ data: { candidates: [] } });
    await findSpots('  hoan kiem \n', null, 'hanoi', 'en');
    expect((fake().log[0].payload as { query: string }).query).toBe('hoan kiem');
  });

  // An empty box has not asked anything. Sending it would spend a round
  // trip — and a billed Google call — to be told so.
  it('does not call at all for a blank query', async () => {
    expect(await findSpots('   ', { lat: 21, lng: 105.8 }, 'hanoi', 'en')).toEqual([]);
    expect(fake().log).toEqual([]);
  });

  // The three ways this can fail all mean one sentence to the reader — "we
  // could not put that on the map" — so they have to arrive as one value,
  // not as two empty states and a crash.
  it('answers nothing when the function refuses', async () => {
    fake().replies({ error: { message: 'boom' } });
    expect(await findSpots('anywhere', null, 'hanoi', 'en')).toEqual([]);
  });

  it('answers nothing when the call itself throws', async () => {
    fake().replies({ throws: new TypeError('Network request failed') });
    expect(await findSpots('anywhere', null, 'hanoi', 'en')).toEqual([]);
  });

  it('answers nothing when the body is not the shape we expect', async () => {
    fake().replies({ data: { candidates: 'nope' } });
    expect(await findSpots('anywhere', null, 'hanoi', 'en')).toEqual([]);
    fake().replies({ data: null });
    expect(await findSpots('anywhere', null, 'hanoi', 'en')).toEqual([]);
  });

  // The de-duplication is `fromCandidates`' own and tested there; what is
  // being checked here is that the rows are actually passed through it
  // rather than handed to the screen raw.
  it('puts the candidates through fromCandidates on the way out', async () => {
    fake().replies({ data: { candidates: [cand(), cand({ name: 'One Pillar Pagoda' })] } });
    expect(await findSpots('chua mot cot', null, 'hanoi', 'en')).toHaveLength(1);
  });
});

describe('nameOf', () => {
  it('asks fetch-place to name the point, in the reader\'s language', async () => {
    fake().replies({ data: { name: ' Ba Đình ' } });
    expect(await nameOf({ lat: 21.0359, lng: 105.8336 }, 'vi')).toBe('Ba Đình');
    expect(fake().log).toEqual([{
      fn: 'fetch-place', op: 'invoke', filters: [],
      payload: { action: 'reverse', at: { lat: 21.0359, lng: 105.8336 }, lang: 'vi' },
    }]);
  });

  // A caption is a courtesy. Every way of not having one is the same
  // empty string, so the sheet prints nothing rather than "undefined".
  it('answers an empty string for a refusal, a throw, or an odd body', async () => {
    fake().replies({ error: { message: 'boom' } });
    expect(await nameOf({ lat: 21, lng: 105.8 }, 'en')).toBe('');
    fake().replies({ throws: new TypeError('Network request failed') });
    expect(await nameOf({ lat: 21, lng: 105.8 }, 'en')).toBe('');
    fake().replies({ data: { name: 42 } });
    expect(await nameOf({ lat: 21, lng: 105.8 }, 'en')).toBe('');
    fake().replies({ data: null });
    expect(await nameOf({ lat: 21, lng: 105.8 }, 'en')).toBe('');
  });
});
