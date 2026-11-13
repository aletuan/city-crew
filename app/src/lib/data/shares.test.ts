// The owner's share rows: one read and one write.
//
// The read is asserted for its scope, as the export's are: RLS lets the
// friend a list names see that share too, so a read without the owner
// filter would hand an owner the lists shared *with* them as their own.
// The write is asserted for the shape of its two statements — one upsert
// that ignores duplicates, then one delete, each pinned to the list — and
// for the refusal it names rather than relays.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ fake: null as ReturnType<typeof import('../testing').fakeSupabase> | null }));
vi.mock('../supabase', async () => {
  const { fakeSupabase } = await import('../testing');
  h.fake = fakeSupabase();
  return { supabase: h.fake.client };
});
const fake = () => h.fake!;

import { fetchMyListShares, isNotShareable, NOT_SHAREABLE, setShares } from './shares';
import { PAGE_ROWS } from './pages';

beforeEach(() => fake().reset());

describe('fetchMyListShares', () => {
  it('asks for the shares on this owner\'s lists, scoped through the list, oldest first', async () => {
    fake().replies({ data: [] });
    await fetchMyListShares('u-1');
    const [q] = fake().log;
    expect(q).toMatchObject({
      table: 'collection_shares', op: 'select',
      filters: [['collections.owner_id', 'u-1']],
      order: ['created_at', { ascending: true }],
    });
    expect(q.payload).toBe('collection_id, user_id, created_at, collections!inner(owner_id)');
    // The whole key breaks a tie, so a page boundary drops nothing.
    expect(q.orders).toEqual([
      ['created_at', { ascending: true }],
      ['collection_id', { ascending: true }],
      ['user_id', { ascending: true }],
    ]);
  });

  it('hands back the share alone, without the list it was scoped through', async () => {
    fake().replies({ data: [{ collection_id: 'c1', user_id: 'lan', created_at: 'x', collections: { owner_id: 'u-1' } }] });
    expect(await fetchMyListShares('u-1')).toEqual([{ collection_id: 'c1', user_id: 'lan', created_at: 'x' }]);
  });

  it('reads past a full page', async () => {
    const row = { collection_id: 'c', user_id: 'u', created_at: 'x', collections: null };
    fake().replies({ data: Array.from({ length: PAGE_ROWS }, () => row) }, { data: [row] });
    expect(await fetchMyListShares('u-1')).toHaveLength(PAGE_ROWS + 1);
    expect(fake().log.map((q) => q.range)).toEqual([[0, PAGE_ROWS - 1], [PAGE_ROWS, 2 * PAGE_ROWS - 1]]);
  });

  it('throws what the server said', async () => {
    fake().replies({ error: { message: 'timeout' } });
    await expect(fetchMyListShares('u-1')).rejects.toThrow('timeout');
  });
});

describe('setShares', () => {
  it('adds everyone in one statement that ignores a share already there, then takes off the rest', async () => {
    await setShares('c1', ['lan', 'ha'], ['minh']);
    const [ins, del] = fake().log;
    expect(ins).toMatchObject({
      table: 'collection_shares', op: 'insert', upsert: true,
      onConflict: 'collection_id,user_id', ignoreDuplicates: true,
      payload: [{ collection_id: 'c1', user_id: 'lan' }, { collection_id: 'c1', user_id: 'ha' }],
    });
    expect(del).toMatchObject({
      table: 'collection_shares', op: 'delete',
      filters: [['collection_id', 'c1'], ['user_id', ['minh']]],
    });
    expect(fake().log).toHaveLength(2);
  });

  it('asks nothing for nothing', async () => {
    await setShares('c1', [], []);
    expect(fake().log).toEqual([]);
  });

  it('only removes when nobody is added, and only adds when nobody is removed', async () => {
    await setShares('c1', [], ['lan']);
    expect(fake().log.map((q) => q.op)).toEqual(['delete']);
    fake().reset();
    await setShares('c1', ['lan'], []);
    expect(fake().log.map((q) => q.op)).toEqual(['insert']);
  });

  // The crew moved on another phone: a name, so the screen can say so in
  // words, and nothing removed after it.
  it('names a policy\'s refusal, and stops before the removal', async () => {
    fake().replies({ error: { message: 'new row violates row-level security policy', code: '42501' } });
    const e = await setShares('c1', ['lan'], ['minh']).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).message).toBe(NOT_SHAREABLE);
    expect(isNotShareable(e)).toBe(true);
    expect(fake().log).toHaveLength(1);
  });

  it('throws any other failure as the server said it', async () => {
    fake().replies({ error: { message: 'offline' } });
    await expect(setShares('c1', ['lan'], [])).rejects.toThrow('offline');
    fake().replies({ error: { message: 'gone' } });
    await expect(setShares('c1', [], ['lan'])).rejects.toThrow('gone');
  });
});

describe('isNotShareable', () => {
  it('is the name and nothing else', () => {
    expect(isNotShareable(new Error(NOT_SHAREABLE))).toBe(true);
    expect(isNotShareable(new Error('offline'))).toBe(false);
    expect(isNotShareable(NOT_SHAREABLE)).toBe(false);
  });
});
