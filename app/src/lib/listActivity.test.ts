import { describe, expect, it } from 'vitest';
import type { Applause, Copy } from './friends';
import { actsOn } from './listActivity';

const like = (collection_id: string, liked_at: string, liker_handle: string | null = 'lan', liker_name: string | null = 'Lan'): Applause =>
  ({ collection_id, liked_at, liker_handle, liker_name });
const copy = (collection_id: string, copied_at: string, copier_handle: string | null = 'minh', copier_name: string | null = 'Minh'): Copy =>
  ({ collection_id, copied_at, copier_handle, copier_name });

describe('actsOn', () => {
  it('keeps this list’s likes and copies and no other list’s', () => {
    const acts = actsOn('c1',
      [like('c1', '2026-11-10T10:00:00Z'), like('c2', '2026-11-12T10:00:00Z')],
      [copy('c2', '2026-11-11T10:00:00Z'), copy('c1', '2026-11-09T10:00:00Z')]);
    expect(acts).toEqual([
      { kind: 'like', at: '2026-11-10T10:00:00Z', handle: 'lan', name: 'Lan' },
      { kind: 'copy', at: '2026-11-09T10:00:00Z', handle: 'minh', name: 'Minh' },
    ]);
  });

  it('puts the newest first across the two kinds', () => {
    const acts = actsOn('c1',
      [like('c1', '2026-11-01T10:00:00Z', 'a'), like('c1', '2026-11-05T10:00:00Z', 'b')],
      [copy('c1', '2026-11-03T10:00:00Z', 'c'), copy('c1', '2026-11-07T10:00:00Z', 'd')]);
    expect(acts.map((a) => a.handle)).toEqual(['d', 'b', 'c', 'a']);
  });

  // By the instant, not the string: the same moment written in two
  // offsets sorts as one moment, and an earlier one in a later-looking
  // string stays behind.
  it('orders by the instant, not by how the string is written', () => {
    const acts = actsOn('c1',
      [like('c1', '2026-11-10T09:00:00+07:00', 'east')],
      [copy('c1', '2026-11-10T03:00:00Z', 'west')]);
    // 09:00 in Hà Nội is 02:00 UTC, an hour before the copy — though as
    // strings "09" sorts after "03".
    expect(acts.map((a) => a.handle)).toEqual(['west', 'east']);
  });

  it('keeps one row per act: a person who liked and copied is there twice', () => {
    const acts = actsOn('c1', [like('c1', '2026-11-10T10:00:00Z', 'lan')], [copy('c1', '2026-11-11T10:00:00Z', 'lan')]);
    expect(acts.map((a) => [a.kind, a.handle])).toEqual([['copy', 'lan'], ['like', 'lan']]);
  });

  it('puts the copy first at one instant', () => {
    const at = '2026-11-10T10:00:00.000Z';
    expect(actsOn('c1', [like('c1', at)], [copy('c1', at)]).map((a) => a.kind)).toEqual(['copy', 'like']);
  });

  it('keeps the server’s order among acts of one kind at one instant', () => {
    const at = '2026-11-10T10:00:00Z';
    const order = actsOn('c1', [like('c1', at, 'z'), like('c1', at, 'a'), like('c1', at, 'm')], []).map((a) => a.handle);
    expect(order).toEqual(['z', 'a', 'm']);
  });

  it('carries a gone profile through as nulls, for the screen’s "Someone"', () => {
    expect(actsOn('c1', [like('c1', '2026-11-10T10:00:00Z', null, null)], [])).toEqual([
      { kind: 'like', at: '2026-11-10T10:00:00Z', handle: null, name: null },
    ]);
  });

  it('is empty for a list nobody acted on', () => {
    expect(actsOn('c9', [like('c1', '2026-11-10T10:00:00Z')], [copy('c1', '2026-11-10T10:00:00Z')])).toEqual([]);
  });
});
