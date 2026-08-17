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

import { findSpots } from './findplace';

const fake = () => h.fake!;

const row = (over: Partial<import('./spots').SpotRow> = {}) => ({
  name: 'Chùa Một Cột', street: '', city: 'Hà Nội', county: '', state: '',
  country: 'Việt Nam', lat: 21.0359, lng: 105.8336, ...over,
});

beforeEach(() => fake().reset());

describe('findSpots', () => {
  it('asks find-address for the query, biased towards a point', async () => {
    fake().replies({ data: { rows: [row()] } });
    const out = await findSpots('chua mot cot', { lat: 21, lng: 105.8 });

    expect(fake().log).toEqual([{
      fn: 'find-address', op: 'invoke', filters: [],
      payload: { query: 'chua mot cot', at: { lat: 21, lng: 105.8 } },
    }]);
    expect(out).toEqual([{ name: 'Chùa Một Cột', label: 'Hà Nội', lat: 21.0359, lng: 105.8336 }]);
  });

  it('sends the trimmed query, not what the field happens to hold', async () => {
    fake().replies({ data: { rows: [] } });
    await findSpots('  hoan kiem \n', null);
    expect((fake().log[0].payload as { query: string }).query).toBe('hoan kiem');
  });

  // An empty box has not asked anything. Sending it would spend a round
  // trip to be told so.
  it('does not call at all for a blank query', async () => {
    expect(await findSpots('   ', { lat: 21, lng: 105.8 })).toEqual([]);
    expect(fake().log).toEqual([]);
  });

  // The three ways this can fail all mean one sentence to the reader — "we
  // could not put that on the map" — so they have to arrive as one value,
  // not as two empty states and a crash.
  //
  // Worth being straight about the first of them: deleting `if (error)
  // return []` from the source does not fail this test, and cannot. When
  // supabase-js reports an error it sends no data, so the line below it
  // already returns `[]` on its own. The guard says what it means rather
  // than leaving it to fall out of the next expression, and a test that
  // queued rows *and* an error to catch it would be asserting against a
  // reply the client never sends.
  it('answers nothing when the function refuses', async () => {
    fake().replies({ error: { message: 'boom' } });
    expect(await findSpots('anywhere', null)).toEqual([]);
  });

  it('answers nothing when the call itself throws', async () => {
    fake().replies({ throws: new TypeError('Network request failed') });
    expect(await findSpots('anywhere', null)).toEqual([]);
  });

  it('answers nothing when the body is not the shape we expect', async () => {
    fake().replies({ data: { rows: 'nope' } });
    expect(await findSpots('anywhere', null)).toEqual([]);
    fake().replies({ data: null });
    expect(await findSpots('anywhere', null)).toEqual([]);
  });

  // The de-duplication is `toSpots`' own and tested there; what is being
  // checked here is that the rows are actually passed through it rather
  // than handed to the screen raw.
  it('puts the rows through toSpots on the way out', async () => {
    fake().replies({ data: { rows: [row(), row({ name: 'Mot Cot Pagoda' })] } });
    expect(await findSpots('chua mot cot', null)).toHaveLength(1);
  });
});
