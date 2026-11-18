import { describe, expect, it } from 'vitest';
import { coverAmong, listsBy, listsOn, seenOn } from './person';
import type { Collection } from './types';

const list = (slug: string, over: Partial<Collection> = {}): Collection => ({
  slug, title_en: slug, title_vi: slug, title_ja: null, desc_en: null, desc_vi: null, desc_ja: null,
  curator_handle: null, cover: null, collection_places: [], owner_id: 'lan', is_public: true, ...over,
} as Collection);

describe('listsBy', () => {
  it('keeps a person’s public lists, in the shelf’s order', () => {
    const shelf = [list('new'), list('theirs', { owner_id: 'minh' }), list('old')];
    expect(listsBy('lan', shelf).map((c) => c.slug)).toEqual(['new', 'old']);
  });

  // The page is one anybody can open.
  it('never shows a private list, even handed a library', () => {
    expect(listsBy('lan', [list('secret', { is_public: false }), list('open')]).map((c) => c.slug)).toEqual(['open']);
  });

  // The public query's rows are public whether or not they say so.
  it('takes a row that does not say, as the shelf’s rows may not', () => {
    expect(listsBy('lan', [list('unsaid', { is_public: undefined })])).toHaveLength(1);
  });

  // An editorial list has no owner: no id must not match "no owner".
  it('is nobody’s lists for no id', () => {
    const shelf = [list('desk', { owner_id: null }), list('older', { owner_id: undefined })];
    expect(listsBy(null, shelf)).toEqual([]);
    expect(listsBy(undefined, shelf)).toEqual([]);
    expect(listsBy('', shelf)).toEqual([]);
  });
});

describe('coverAmong', () => {
  const covers: Record<string, string> = { b: 'http://x/b.jpg', c: 'http://x/c.jpg' };
  const coverFor = (c: Collection) => covers[c.slug];

  it('is the newest list’s cover', () => {
    expect(coverAmong([list('b'), list('c')], coverFor)).toBe('http://x/b.jpg');
  });

  it('passes over a list with none for the next that has one', () => {
    expect(coverAmong([list('a'), list('c')], coverFor)).toBe('http://x/c.jpg');
  });

  it('is nothing when no list has one, or there are no lists', () => {
    expect(coverAmong([list('a')], coverFor)).toBeUndefined();
    expect(coverAmong([], coverFor)).toBeUndefined();
  });
});

describe('listsOn', () => {
  const none = { shelf: [], mine: [], shared: [] };

  it('is every list of your own on your own page, the private and the shared with the public', () => {
    const mine = [list('secret', { is_public: false }), list('open')];
    expect(listsOn('lan', 'lan', { ...none, shelf: [list('open')], mine }).map((c) => c.slug)).toEqual(['secret', 'open']);
  });

  // The library is the copy your edits write to: it leads, and is not
  // sorted again when the shelf adds nothing.
  it('leaves your library in its own order when the shelf adds nothing to it', () => {
    const mine = [list('b', { created_at: '2026-01-01T00:00:00Z' }), list('a', { created_at: '2026-06-01T00:00:00Z' })];
    expect(listsOn('lan', 'lan', { ...none, mine }).map((c) => c.slug)).toEqual(['b', 'a']);
  });

  it('draws your public lists from the shelf while the library has not arrived, and once only when both have one', () => {
    const shelf = [list('open', { created_at: '2026-03-01T00:00:00Z' }), list('other', { owner_id: 'minh' })];
    expect(listsOn('lan', 'lan', { ...none, shelf }).map((c) => c.slug)).toEqual(['open']);
    const mine = [list('newer', { is_public: false, created_at: '2026-05-01T00:00:00Z' }), list('older', { created_at: '2026-01-01T00:00:00Z' })];
    expect(listsOn('lan', 'lan', { ...none, shelf, mine }).map((c) => c.slug)).toEqual(['newer', 'open', 'older']);
  });

  // A library left in memory by the account signed in before.
  it('takes nothing from a library that is somebody else’s', () => {
    expect(listsOn('lan', 'lan', { ...none, mine: [list('minh-secret', { owner_id: 'minh', is_public: false })] })).toEqual([]);
  });

  it('is their public lists and the ones they shared with you, newest first, on somebody else’s page', () => {
    const shelf = [list('open', { created_at: '2026-03-01T00:00:00Z' }), list('old', { created_at: '2026-01-01T00:00:00Z' })];
    const shared = [
      list('lent', { is_public: false, created_at: '2026-02-01T00:00:00Z' }),
      list('minh-lent', { owner_id: 'minh', is_public: false }),
    ];
    expect(listsOn('lan', 'me', { ...none, shelf, shared }).map((c) => c.slug)).toEqual(['open', 'lent', 'old']);
  });

  it('sets a list that does not say when it was made after those that do', () => {
    const shelf = [list('undated'), list('dated', { created_at: '2026-03-01T00:00:00Z' })];
    const shared = [list('lent', { is_public: false, created_at: '2026-02-01T00:00:00Z' })];
    expect(listsOn('lan', 'me', { ...none, shelf, shared }).map((c) => c.slug)).toEqual(['dated', 'lent', 'undated']);
  });

  // The public row leads, so the card wears no mark.
  it('keeps the public row of a list that is both public and shared', () => {
    const open = list('both');
    const out = listsOn('lan', 'me', { ...none, shelf: [open], shared: [list('both')] });
    expect(out).toEqual([open]);
    expect(out[0]).toBe(open);
  });

  it('never puts your own library, or its private lists, on somebody else’s page', () => {
    const mine = [list('my-secret', { owner_id: 'me', is_public: false }), list('lan-row', { is_public: false })];
    expect(listsOn('lan', 'me', { ...none, mine })).toEqual([]);
  });

  it('is the public lists alone signed out, whatever else it is handed', () => {
    const shelf = [list('open')];
    const hidden = [list('secret', { is_public: false })];
    expect(listsOn('lan', null, { shelf, mine: hidden, shared: [] }).map((c) => c.slug)).toEqual(['open']);
  });

  it('is nobody’s lists for no id, signed in or out', () => {
    const rows = [list('desk', { owner_id: null }), list('unowned', { owner_id: undefined })];
    expect(listsOn(null, null, { shelf: rows, mine: rows, shared: rows })).toEqual([]);
    expect(listsOn(undefined, 'me', { shelf: rows, mine: rows, shared: rows })).toEqual([]);
  });
});

describe('seenOn', () => {
  // Every card is marked (owner, 18 Nov 2026): a public one wore nothing
  // for a day.
  it('says public for a public list, yours or not, said or unsaid, shared or not', () => {
    expect(seenOn(list('a'), true, 3)).toEqual({ kind: 'public' });
    expect(seenOn(list('a'), false, 0)).toEqual({ kind: 'public' });
    expect(seenOn(list('a', { is_public: undefined }), true, 0)).toEqual({ kind: 'public' });
  });

  it('says private for a list of yours nobody else has', () => {
    expect(seenOn(list('a', { is_public: false }), true, 0)).toEqual({ kind: 'private' });
  });

  it('says friends, and how many, for a list of yours that is shared', () => {
    expect(seenOn(list('a', { is_public: false }), true, 1)).toEqual({ kind: 'friends', n: 1 });
    expect(seenOn(list('a', { is_public: false }), true, 4)).toEqual({ kind: 'friends', n: 4 });
  });

  it('says lent for a list on somebody else’s page, however many have it', () => {
    expect(seenOn(list('a', { is_public: false }), false, 0)).toEqual({ kind: 'lent' });
    expect(seenOn(list('a', { is_public: false }), false, 2)).toEqual({ kind: 'lent' });
  });
});
