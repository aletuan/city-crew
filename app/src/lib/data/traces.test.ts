// The two trace inserts: which table each row goes to, and that a refusal
// comes back as a reply for the reporter to read rather than as a throw.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});

import { insertDeckTrace, insertStartupTrace } from './traces';

const fake = () => h.fake!;
beforeEach(() => fake().reset());

const startup = { platform: 'ios', os_version: '18.1', is_dev: false, total_ms: 812, marks: [{ name: 'js', ms: 120 }] };
const deck = {
  platform: 'ios', os_version: '18.1', is_dev: false, channel: 'preview',
  options: 3, span: 2, still: true, total_ms: 940, events: [],
};

describe.each([
  ['startup_traces', () => insertStartupTrace(startup), startup],
  ['deck_traces', () => insertDeckTrace(deck), deck],
] as const)('%s', (table, send, row) => {
  it('inserts the row into its own table, as given', async () => {
    await send();
    expect(fake().log).toEqual([{ table, op: 'insert', payload: row, filters: [] }]);
  });

  it('hands a refusal back rather than throwing it', async () => {
    fake().replies({ error: { message: 'new row violates row-level security policy' } });
    expect(await send()).toEqual({ error: { message: 'new row violates row-level security policy' } });
  });
});
