import { describe, expect, it } from 'vitest';
import {
  agoOf, buildActivity, MIN_SUGGEST_CHARS, openSuggestions, REQUEST_DAILY_CAP,
  splitFriendships, standingWith, SUGGEST_LIMIT, suggestable, SUGGESTED_SHOWN, type Applause, type FriendshipRow,
  type Copy,
} from './friends';

const edge = (
  requester: string, addressee: string,
  status: 'pending' | 'accepted' = 'pending',
  created_at = '2026-08-20T10:00:00Z',
): FriendshipRow => ({ requester, addressee, status, created_at });

const like = (collection_id: string, liked_at: string, handle: string | null = null): Applause => ({
  collection_id, liked_at, liker_handle: handle, liker_name: handle && 'Some One',
});
const copy = (collection_id: string, copied_at: string, handle: string | null = null): Copy => ({
  collection_id, copied_at, copier_handle: handle, copier_name: handle && 'Some One',
});

describe('splitFriendships', () => {
  it('sorts every edge into the three piles, whichever side I am on', () => {
    const crew = splitFriendships([
      edge('me', 'an', 'accepted', '2026-08-01T00:00:00Z'),
      edge('binh', 'me', 'accepted', '2026-08-10T00:00:00Z'),
      edge('chi', 'me'),
      edge('me', 'dung'),
    ], 'me');
    // Newest friendship first.
    expect(crew.friends).toEqual(['binh', 'an']);
    expect(crew.incoming.map((r) => r.requester)).toEqual(['chi']);
    expect(crew.outgoing.map((r) => r.addressee)).toEqual(['dung']);
  });

  it('drops an edge that does not name me — impossible under RLS, routine in a test', () => {
    const crew = splitFriendships([edge('an', 'binh', 'accepted')], 'me');
    expect(crew).toEqual({ friends: [], incoming: [], outgoing: [] });
  });

  it('newest request first, so the banner names the latest asker', () => {
    const crew = splitFriendships([
      edge('an', 'me', 'pending', '2026-08-01T00:00:00Z'),
      edge('binh', 'me', 'pending', '2026-08-02T00:00:00Z'),
    ], 'me');
    expect(crew.incoming.map((r) => r.requester)).toEqual(['binh', 'an']);
  });
});

describe('standingWith', () => {
  const rows = [
    edge('me', 'friend', 'accepted'),
    edge('me', 'asked'),
    edge('asker', 'me'),
  ];
  it('names each state the add flow has a sentence for', () => {
    expect(standingWith(rows, 'me', 'friend')).toBe('friends');
    expect(standingWith(rows, 'me', 'asked')).toBe('asked');
    expect(standingWith(rows, 'me', 'asker')).toBe('asks_you');
    expect(standingWith(rows, 'me', 'stranger')).toBe('none');
    expect(standingWith(rows, 'me', 'me')).toBe('yourself');
  });
});

describe('buildActivity', () => {
  it('applause newest first', () => {
    const items = buildActivity([
      like('c1', '2026-08-22T10:00:00Z'),
      like('c2', '2026-08-23T09:00:00Z', 'lanphuong'),
    ], []);
    expect(items.map((i) => i.kind)).toEqual(['applause', 'applause']);
    expect(items[0]).toMatchObject({ collection_id: 'c2', liker_handle: 'lanphuong', liker_name: 'Some One' });
    expect(items[1]).toMatchObject({ collection_id: 'c1', liker_handle: null });
  });

  // A copy is the stronger compliment and the newer signal (7 Oct 2026);
  // it takes its place in the one timeline by when it happened, not in a
  // section of its own.
  it('weaves copies in with the applause, newest first, each in its own kind', () => {
    const items = buildActivity(
      [like('c1', '2026-08-22T10:00:00Z', 'anh'), like('c1', '2026-08-24T10:00:00Z', 'bao')],
      [copy('c1', '2026-08-23T10:00:00Z', 'cam'), copy('c2', '2026-08-21T10:00:00Z')],
    );
    expect(items.map((i) => [i.kind, i.at])).toEqual([
      ['applause', '2026-08-24T10:00:00Z'],
      ['copy', '2026-08-23T10:00:00Z'],
      ['applause', '2026-08-22T10:00:00Z'],
      ['copy', '2026-08-21T10:00:00Z'],
    ]);
    expect(items[1]).toMatchObject({ kind: 'copy', collection_id: 'c1', copier_handle: 'cam', copier_name: 'Some One' });
    expect(items[3]).toMatchObject({ kind: 'copy', collection_id: 'c2', copier_handle: null });
  });
});

describe('agoOf', () => {
  const now = Date.parse('2026-08-23T12:00:00Z');
  it('speaks in the largest honest unit', () => {
    expect(agoOf('2026-08-23T11:59:30Z', now)).toEqual({ unit: 'now' });
    expect(agoOf('2026-08-23T11:15:00Z', now)).toEqual({ unit: 'minutes', n: 45 });
    expect(agoOf('2026-08-23T09:00:00Z', now)).toEqual({ unit: 'hours', n: 3 });
    expect(agoOf('2026-08-20T09:00:00Z', now)).toEqual({ unit: 'days', n: 3 });
  });

  it('the future and the unreadable both clamp to now', () => {
    expect(agoOf('2026-08-23T13:00:00Z', now)).toEqual({ unit: 'now' });
    expect(agoOf('garbage', now)).toEqual({ unit: 'now' });
  });
});

describe('suggestable', () => {
  const person = (id: string) => ({ id });
  it('drops the reader and caps the list, keeping the order', () => {
    const found = ['me', 'a', 'b', 'c', 'd', 'e', 'f', 'g'].map(person);
    const out = suggestable(found, 'me');
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(out).toHaveLength(SUGGEST_LIMIT);
  });
  it('a list without the reader passes through short', () => {
    expect(suggestable([person('a')], 'me')).toEqual([person('a')]);
  });
  it('the blocked are not re-offered', () => {
    expect(suggestable([person('a'), person('b')], 'me', ['a'])).toEqual([person('b')]);
  });
});

describe('openSuggestions', () => {
  const rows = [
    { other: 'stranger', mutual: 6 },
    { other: 'friend', mutual: 4 },
    { other: 'asked', mutual: 3 },
    { other: 'asker', mutual: 2 },
    { other: 'blocked', mutual: 1 },
  ];
  const ships = [
    edge('me', 'friend', 'accepted'),
    edge('me', 'asked'),
    edge('asker', 'me'),
  ];

  it('keeps only the people nothing already stands between', () => {
    expect(openSuggestions(rows, 'me', ships, ['blocked']).map((r) => r.other))
      .toEqual(['stranger']);
  });

  it('an untouched list passes through in the order the server gave', () => {
    const fresh = [{ other: 'a', mutual: 9 }, { other: 'b', mutual: 2 }];
    expect(openSuggestions(fresh, 'me', [])).toEqual(fresh);
  });

  it('caps at SUGGESTED_SHOWN', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ other: `p${i}`, mutual: 9 - i }));
    expect(openSuggestions(many, 'me', [])).toHaveLength(SUGGESTED_SHOWN);
    expect(openSuggestions(many, 'me', [], [], 2)).toHaveLength(2);
  });

  it('a suggestion acted on this second is gone this second', () => {
    const one = [{ other: 'stranger', mutual: 3 }];
    expect(openSuggestions(one, 'me', [])).toHaveLength(1);
    // The Add tap lands: an outgoing edge now exists, and the row goes
    // without waiting for the server to be asked again.
    expect(openSuggestions(one, 'me', [edge('me', 'stranger')])).toEqual([]);
  });
});

describe('the caps', () => {
  it('mirror the policy and the field', () => {
    expect(REQUEST_DAILY_CAP).toBe(20);
    expect(MIN_SUGGEST_CHARS).toBe(2);
  });
});
