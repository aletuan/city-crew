import { describe, expect, it } from 'vitest';
import { buildSearchRows, type SearchRowsInput } from './searchRows';
import { RECENTS_SHOWN } from './recents';
import { fold } from './search';
import type { Collection, Place } from './types';
import type { Candidate } from './suggest';

const en = (e: string) => e;

const place = (slug: string, p: Partial<Place> = {}): Place => ({
  slug, name_en: slug, name_vi: slug, name_ja: null, category: 'out', is_featured: false,
  vibe_tags: [], neighborhood_en: null, neighborhood_vi: null, neighborhood_ja: null,
  address: null, lat: null, lng: null, rating: null, rating_count: null,
  price_display: null, price_vnd: null, duration_min: null, opening_hours: null,
  website: null, phone: null, place_photos: [], city_id: 'hn', ...p,
} as Place);

const collection = (slug: string, c: Partial<Collection> = {}): Collection => ({
  slug, title_en: slug, title_vi: slug, title_ja: null, desc_en: null, desc_vi: null,
  desc_ja: null, curator_handle: null, cover: null, collection_places: [], ...c,
});

const input = (over: Partial<SearchRowsInput> = {}): SearchRowsInput => ({
  terms: [], query: '', recents: [], cats: [], popular: [], latest: [],
  colMembers: [], places: [], cities: ['hn'], fresh: null, synonyms: {}, ...over,
});

const keys = (over: Partial<SearchRowsInput>) => buildSearchRows(input(over), en).map((r) => r.key);

describe('buildSearchRows — before a word is typed', () => {
  it('is empty when there is nothing to offer', () => {
    expect(keys({})).toEqual([]);
  });

  // No "Open right now" between the chips and Most popular: it was
  // Explore's open-now filter a second time (owner, 22 Oct 2026).
  it('lists the sections in their order, each under its own mark', () => {
    const a = place('a');
    const b = place('b');
    expect(keys({
      recents: ['pho'], cats: ['cafes'], popular: [b], latest: [a],
    })).toEqual(['z-recent', 'rc-pho', 'z-browse', 'z-chips', 'z-popular', 'mp-b', 'z-latest', 'la-a']);
  });

  it('shows only as many remembered searches as the box holds', () => {
    const recents = Array.from({ length: RECENTS_SHOWN + 2 }, (_, i) => `q${i}`);
    expect(keys({ recents }).filter((k) => k.startsWith('rc-'))).toHaveLength(RECENTS_SHOWN);
  });

  it('marks the recents as clearable, and nothing else', () => {
    const rows = buildSearchRows(input({ recents: ['x'], popular: [place('a')] }), en);
    expect(rows[0]).toEqual({ kind: 'eyebrow', key: 'z-recent', label: 'Recent', clear: true });
    expect(rows[2]).toEqual({ kind: 'eyebrow', key: 'z-popular', label: 'Most popular' });
  });

  // The terms decide, not the raw text: spaces typed are not a search.
  it('stays the zero-state for a query of only spaces', () => {
    expect(keys({ terms: [], query: '   ', recents: ['pho'] })).toEqual(['z-recent', 'rc-pho']);
  });

  // The zero-state never mixes with results, and results never with it.
  it('yields every section the moment a term exists', () => {
    expect(keys({ terms: ['zzz'], query: 'zzz', recents: ['pho'], cats: ['cafes'], popular: [place('b')] }))
      .toEqual([]);
  });
});

describe('buildSearchRows — results', () => {
  const mono = place('mono', { name_en: 'Mono Coffee' });
  const elsewhere = place('far', { name_en: 'Mono Far', city_id: 'sg' });

  it('lists the collections that match and touch this city, then the places', () => {
    const here = collection('here', { title_en: 'Mono run' });
    const away = collection('away', { title_en: 'Mono abroad' });
    const quiet = collection('quiet', { title_en: 'Nothing' });
    const rows = buildSearchRows(input({
      terms: ['mono'], query: 'mono', places: [mono],
      colMembers: [{ c: here, members: [mono] }, { c: away, members: [elsewhere] }, { c: quiet, members: [place('other')] }],
    }), en);
    expect(rows.map((r) => r.key)).toEqual(['h-col', 'c-here', 'h-place', 'p-mono']);
    expect(rows[0]).toEqual({ kind: 'header', key: 'h-col', label: 'Collections' });
    expect(rows[1]).toMatchObject({ kind: 'collection', collection: here, count: 1 });
  });

  // More than one city chosen (owner, 22 Oct 2026): a list answers when it
  // has a place in any of them, and under All any list with a place does.
  it('lists the collections that touch any chosen city, and every one under All', () => {
    const here = collection('here', { title_en: 'Mono run' });
    const away = collection('away', { title_en: 'Mono abroad' });
    const keysFor = (cities: readonly string[] | null) => buildSearchRows(input({
      terms: ['mono'], query: 'mono', cities,
      colMembers: [{ c: here, members: [mono] }, { c: away, members: [elsewhere] }, { c: collection('empty', { title_en: 'Mono none' }), members: [] }],
    }), en).filter((r) => r.kind === 'collection').map((r) => r.key);
    expect(keysFor(['sg'])).toEqual(['c-away']);
    expect(keysFor(['hn', 'sg'])).toEqual(['c-here', 'c-away']);
    expect(keysFor(null)).toEqual(['c-here', 'c-away']);
  });

  // `collectionMatches` holds a word typed with marks to them: "phở" is
  // not answered by a list whose blurb walks down a "phố".
  it('holds a list to the marks the reader typed', () => {
    const walk = collection('walk', { title_en: 'Lanes', desc_vi: 'những con phố nhỏ' });
    const keysFor = (query: string) => buildSearchRows(input({
      terms: [fold(query)], query, colMembers: [{ c: walk, members: [mono] }],
    }), en).filter((r) => r.kind === 'collection').map((r) => r.key);
    expect(keysFor('phở')).toEqual([]);
    expect(keysFor('phố')).toEqual(['c-walk']);
  });

  it('wears the collection’s cover, else its first place’s', () => {
    const shot = place('shot', { name_en: 'Shot', place_photos: [
      { photo_uri: 'first.jpg', is_cover: true, is_hidden: false, sort_order: 0, attribution_name: null },
    ] });
    const rows = buildSearchRows(input({
      terms: ['shot'], query: 'shot',
      colMembers: [
        { c: collection('chosen', { cover: { photo_uri: 'chosen.jpg' } }), members: [shot] },
        { c: collection('bare'), members: [shot] },
      ],
    }), en);
    expect(rows.filter((r) => r.kind === 'collection').map((r) => r.kind === 'collection' && r.cover))
      .toEqual(['chosen.jpg', 'first.jpg']);
  });

  // Synonyms fill a blank; they never dilute a real answer.
  it('offers related places only when nothing matched, under a heading that says so', () => {
    const cgv = place('cgv', { name_en: 'CGV', categories: ['fun'] });
    const synonyms = { fun: ['cinema'] };
    expect(keys({ terms: ['cinema'], query: 'cinema', places: [cgv], synonyms })).toEqual(['h-related', 'r-cgv']);
    expect(buildSearchRows(input({ terms: ['cinema'], query: 'cinema', places: [cgv], synonyms }), en)[0])
      .toMatchObject({ label: 'No exact match — related places' });
    expect(keys({ terms: ['cgv'], query: 'cgv', places: [cgv], synonyms })).toEqual(['h-place', 'p-cgv']);
  });

  // The places city by city in the chips' order, the reader's own first;
  // with no order the match's own ranking stands.
  it('lists the places, and the related ones, city by city in the chips’ order', () => {
    const sgMono = place('sgmono', { name_en: 'Mono', city_id: 'sg' });
    const hnMono = place('hnmono', { name_en: 'Mono Hanoi' });
    expect(keys({ terms: ['mono'], query: 'mono', places: [sgMono, hnMono], cities: null }))
      .toEqual(['h-place', 'p-sgmono', 'p-hnmono']);
    expect(keys({ terms: ['mono'], query: 'mono', places: [sgMono, hnMono], cities: null, cityOrder: ['hn', 'sg'] }))
      .toEqual(['h-place', 'p-hnmono', 'p-sgmono']);
    const synonyms = { fun: ['cinema'] };
    const sgCgv = place('sgcgv', { name_en: 'CGV', categories: ['fun'], city_id: 'sg' });
    const hnCgv = place('hncgv', { name_en: 'CGV', categories: ['fun'] });
    expect(keys({ terms: ['cinema'], query: 'cinema', places: [sgCgv, hnCgv], cities: null, cityOrder: ['hn', 'sg'], synonyms }))
      .toEqual(['h-related', 'r-hncgv', 'r-sgcgv']);
  });

  it('puts Google’s candidates last, under their own heading', () => {
    const candidate = { place_id: 'g1' } as Candidate;
    expect(keys({ terms: ['mono'], query: 'mono', places: [mono], fresh: [candidate] }))
      .toEqual(['h-place', 'p-mono', 'h-google', 'g-g1']);
    expect(keys({ terms: ['mono'], query: 'mono', places: [mono], fresh: [] })).toEqual(['h-place', 'p-mono']);
  });
});
