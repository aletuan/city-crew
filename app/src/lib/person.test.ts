import { describe, expect, it } from 'vitest';
import type { PersonCheckin } from './checkin';
import { actsOn, listsBy, listsOn, seenOn } from './person';
import type { Collection } from './types';

const one = [{ sort_order: 0, places: { slug: 'p0' } }] as unknown as Collection['collection_places'];
const list = (slug: string, over: Partial<Collection> = {}): Collection => ({
  slug, title_en: slug, title_vi: slug, title_ja: null, desc_en: null, desc_vi: null, desc_ja: null,
  // One place by default, the ordinary list: an empty public one is kept
  // off somebody else's page (`listsOn`), and the tests of that say so.
  curator_handle: null, cover: null, collection_places: one, owner_id: 'lan', is_public: true, ...over,
} as Collection);
const none_: Collection['collection_places'] = [];

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

describe('listsOn', () => {
  const none = { shelf: [], mine: [], shared: [] };

  // From 20 Nov 2026 a list can be public before it holds anything; on
  // another's page it waits for its first place, as on Community.
  it('leaves somebody else’s public list off their page until it has a place, and keeps your own', () => {
    const shelf = [list('empty', { collection_places: none_ }), list('full')];
    expect(listsOn('lan', 'minh', { ...none, shelf }).map((c) => c.slug)).toEqual(['full']);
    expect(listsOn('lan', null, { ...none, shelf }).map((c) => c.slug)).toEqual(['full']);
    expect(listsOn('lan', 'lan', { ...none, shelf, mine: shelf }).map((c) => c.slug)).toEqual(['empty', 'full']);
    // A list they shared with you is theirs to have lent empty.
    const lent = [list('lent', { is_public: false, collection_places: none_ })];
    expect(listsOn('lan', 'minh', { ...none, shared: lent }).map((c) => c.slug)).toEqual(['lent']);
  });

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

describe('actsOn', () => {
  const visit = (id: string, day: string): PersonCheckin => ({
    id, place_slug: id, place: { name_en: id, name_vi: id, cover: null, categories: [] },
    city_id: 'hanoi', day, note: null, audience: null, likes: 0, liked: false,
  });
  // Local noon, so the list's day is the same on any clock the suite runs on.
  const made = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();
  const keys = (acts: ReturnType<typeof actsOn>) => acts.map((a) => a.key);

  it('is the lists alone, in their order, with no visits, and the visits alone with no lists', () => {
    const lists = [list('new', { created_at: made(2026, 11, 20) }), list('old', { created_at: made(2026, 11, 1) })];
    expect(keys(actsOn(lists, []))).toEqual(['list:new', 'list:old']);
    expect(keys(actsOn([], [visit('k2', '2026-11-22'), visit('k1', '2026-11-02')]))).toEqual(['visit:k2', 'visit:k1']);
    expect(actsOn([], [])).toEqual([]);
  });

  it('puts the two in one column by day, newest first', () => {
    const lists = [list('new', { created_at: made(2026, 11, 20) }), list('old', { created_at: made(2026, 11, 1) })];
    const visits = [visit('k3', '2026-11-22'), visit('k2', '2026-11-10'), visit('k1', '2026-10-01')];
    expect(keys(actsOn(lists, visits))).toEqual(['visit:k3', 'list:new', 'visit:k2', 'list:old', 'visit:k1']);
  });

  it('stands the visits before the lists of the same day, each in the order it came', () => {
    const lists = [list('b', { created_at: made(2026, 11, 20) }), list('a', { created_at: made(2026, 11, 20) })];
    const visits = [visit('k2', '2026-11-20'), visit('k1', '2026-11-20')];
    expect(keys(actsOn(lists, visits))).toEqual(['visit:k2', 'visit:k1', 'list:b', 'list:a']);
  });

  it('leaves a list that does not say when it was made at the end', () => {
    const lists = [list('dated', { created_at: made(2026, 11, 20) }), list('undated', { created_at: undefined })];
    expect(keys(actsOn(lists, [visit('k1', '2020-01-01')]))).toEqual(['list:dated', 'visit:k1', 'list:undated']);
  });

  it('hands back the list and the visit themselves, and nothing it sorted by', () => {
    const c = list('a', { created_at: made(2026, 11, 20) });
    const v = visit('k1', '2026-11-21');
    expect(actsOn([c], [v])).toEqual([{ kind: 'visit', key: 'visit:k1', visit: v }, { kind: 'list', key: 'list:a', list: c }]);
  });
});
