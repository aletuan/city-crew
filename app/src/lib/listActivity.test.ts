import { describe, expect, it } from 'vitest';
import type { Applause, Copy } from './friends';
import { actsOn, type ListAct, ofKind, shownKind, tallyOf, toggledKind } from './listActivity';

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
      { kind: 'like', at: '2026-11-10T10:00:00Z', handle: 'lan', name: 'Lan', id: null, avatar: null },
      { kind: 'copy', at: '2026-11-09T10:00:00Z', handle: 'minh', name: 'Minh', id: null, avatar: null },
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
      { kind: 'like', at: '2026-11-10T10:00:00Z', handle: null, name: null, id: null, avatar: null },
    ]);
  });

  // The id and the face ride the row (20261113150000), each from its own
  // column: a like's from the liker's, a copy's from the copier's.
  it('carries each actor’s id and face from their own kind’s columns', () => {
    const acts = actsOn('c1',
      [{ ...like('c1', '2026-11-10T10:00:00Z', 'lan'), liker_id: 'u-lan', liker_avatar_url: 'https://faces/lan.jpg' }],
      [{ ...copy('c1', '2026-11-11T10:00:00Z', 'minh'), copier_id: 'u-minh', copier_avatar_url: 'https://faces/minh.jpg' }]);
    expect(acts.map((a) => [a.handle, a.id, a.avatar])).toEqual([
      ['minh', 'u-minh', 'https://faces/minh.jpg'],
      ['lan', 'u-lan', 'https://faces/lan.jpg'],
    ]);
  });

  // A face the desk cleared is an empty string in the column: no face,
  // the blank disc, not an <img> with no address.
  it('reads an empty face as none, on both kinds', () => {
    const acts = actsOn('c1',
      [{ ...like('c1', '2026-11-10T10:00:00Z'), liker_id: 'u1', liker_avatar_url: '' }],
      [{ ...copy('c1', '2026-11-11T10:00:00Z'), copier_id: 'u2', copier_avatar_url: '' }]);
    expect(acts.map((a) => [a.id, a.avatar])).toEqual([['u2', null], ['u1', null]]);
  });

  // A gone profile, as the migration answers it: both columns null.
  it('reads null columns as no id and no face', () => {
    const acts = actsOn('c1',
      [{ ...like('c1', '2026-11-10T10:00:00Z', null, null), liker_id: null, liker_avatar_url: null }],
      [{ ...copy('c1', '2026-11-11T10:00:00Z', null, null), copier_id: null, copier_avatar_url: null }]);
    expect(acts.map((a) => [a.id, a.avatar])).toEqual([[null, null], [null, null]]);
  });

  it('is empty for a list nobody acted on', () => {
    expect(actsOn('c9', [like('c1', '2026-11-10T10:00:00Z')], [copy('c1', '2026-11-10T10:00:00Z')])).toEqual([]);
  });
});

const act = (kind: ListAct['kind'], handle: string): ListAct =>
  ({ kind, at: '2026-11-10T10:00:00Z', handle, name: null, id: null, avatar: null });

describe('the counts, and the list narrowed to one kind', () => {
  const acts = [act('copy', 'a'), act('like', 'b'), act('like', 'c'), act('copy', 'd'), act('like', 'e')];

  it('counts each kind', () => {
    expect(tallyOf(acts)).toEqual({ like: 3, copy: 2 });
    expect(tallyOf([])).toEqual({ like: 0, copy: 0 });
  });

  it('narrows to a kind in the order the acts came, and gives all for none', () => {
    expect(ofKind(acts, 'like').map((a) => a.handle)).toEqual(['b', 'c', 'e']);
    expect(ofKind(acts, 'copy').map((a) => a.handle)).toEqual(['a', 'd']);
    expect(ofKind(acts, null)).toBe(acts);
  });

  it('chooses a kind with one tap and widens again with the second', () => {
    expect(toggledKind(null, 'like')).toBe('like');
    expect(toggledKind('like', 'like')).toBeNull();
    // From one kind straight to the other.
    expect(toggledKind('like', 'copy')).toBe('copy');
  });

  it('keeps the chosen kind while there is any of it, and all once there is none', () => {
    expect(shownKind('copy', { like: 3, copy: 2 })).toBe('copy');
    expect(shownKind('copy', { like: 3, copy: 0 })).toBeNull();
    expect(shownKind(null, { like: 3, copy: 2 })).toBeNull();
  });
});
