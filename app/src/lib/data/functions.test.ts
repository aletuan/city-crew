// The two Edge Function calls, pinned by name and by body — and by what
// they do *not* do: a refusal and a throw both reach the caller exactly as
// supabase-js gave them, because each caller reads them its own way (see
// the note at the top of `functions.ts`).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import { invokeFetchPlace, invokePlanAssist } from './functions';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

describe.each([
  ['fetch-place', invokeFetchPlace, { action: 'search', query: 'phở', city: 'hanoi' }],
  ['plan-assist', invokePlanAssist, { action: 'parse', text: 'cà phê sáng mai' }],
] as const)('%s', (name, call, body) => {
  it('calls that function with the body as given', async () => {
    fake().replies({ data: { ok: true } });
    expect(await call(body)).toEqual({ data: { ok: true } });
    expect(fake().log).toEqual([{ fn: name, op: 'invoke', payload: body, filters: [] }]);
  });

  // The 401 `searchPlaces` turns into a sign-in sheet is read off this
  // object; a wrapper that threw on it would leave nothing to read.
  it('hands a refusal back rather than throwing it', async () => {
    const error = { message: 'non-2xx', context: { status: 401 } };
    fake().replies({ error });
    expect(await call(body)).toEqual({ error });
  });

  it('lets a request that never left the phone reject', async () => {
    fake().replies({ throws: new Error('offline') });
    await expect(call(body)).rejects.toThrow('offline');
  });
});
