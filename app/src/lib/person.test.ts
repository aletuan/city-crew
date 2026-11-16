import { describe, expect, it } from 'vitest';
import { coverAmong, listsBy } from './person';
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
