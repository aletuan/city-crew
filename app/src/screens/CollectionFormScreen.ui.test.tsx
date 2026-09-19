// @vitest-environment jsdom
//
// The bookmark→new-collection path, which #315 found had no coverage of
// the save signal at all. It is the flow every account's FIRST save takes
// — the save sheet routes here precisely when there is no list yet — and
// for as long as `history_on` has defaulted on, an unrecorded first save
// has been a real hole in real users' taste profiles, not a latent one.

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav, RootRoute } from '../nav';
import type { Collection, Place } from '../lib/types';

const createCollection = vi.hoisted(() => vi.fn(async () => 'new-list'));
const addPlaceToCollection = vi.hoisted(() => vi.fn(async () => {}));
const note = vi.hoisted(() => vi.fn());
const reload = vi.hoisted(() => vi.fn());
// Mutable so a test can give the screen a list with places in it; the
// bookmark tests below leave both empty, as they always were.
const catalog = vi.hoisted(() => ({ data: [] as unknown[] }));
const saved = vi.hoisted(() => ({ data: [] as unknown[] }));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } } }),
}));
vi.mock('../lib/city', () => ({
  useCity: () => ({ city: { id: 'hanoi' } }),
}));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: 'en', setLang: () => {}, t: (en: string) => en }),
}));
vi.mock('../lib/catalog', () => ({
  usePlaces: () => catalog,
}));
vi.mock('../lib/save', () => ({
  useSave: () => ({ mine: { data: saved.data, reload } }),
}));
// The seam under test: the screen must hand the saved place to the event
// hook. What the hook then does with consent and the network is pinned by
// `logPlaceEvent`'s own tests.
vi.mock('../lib/tasteProfile', () => ({ useNoteEvent: () => note }));
vi.mock('../lib/data', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  createCollection,
  addPlaceToCollection,
}));

import CollectionFormScreen from './CollectionFormScreen';

const nav = () => ({
  navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(),
}) as unknown as Nav;

const routeWith = (params?: object) => ({ params }) as RootRoute<'CollectionForm'>;

const create = (title: string) => {
  fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: title } });
  fireEvent.click(screen.getByRole('button', { name: 'Create collection' }));
};

beforeEach(() => {
  createCollection.mockClear();
  addPlaceToCollection.mockClear();
  note.mockClear();
  reload.mockClear();
  catalog.data = [];
  saved.data = [];
});

describe('creating a collection from a bookmark', () => {
  it('adds the place and records the save', async () => {
    render(<CollectionFormScreen navigation={nav()} route={routeWith({ addPlaceSlug: 'pho-10' })} />);
    create('Weekend list');

    await waitFor(() => expect(addPlaceToCollection).toHaveBeenCalledWith('new-list', 'pho-10', 0));
    // The whole of #315's first bug: this call did not exist, so the
    // first save an account ever made was the one save never recorded.
    expect(note).toHaveBeenCalledWith('pho-10', 'save');
  });

  it('records nothing when the add itself failed', async () => {
    addPlaceToCollection.mockRejectedValueOnce(new Error('offline'));
    render(<CollectionFormScreen navigation={nav()} route={routeWith({ addPlaceSlug: 'pho-10' })} />);
    create('Weekend list');

    await waitFor(() => expect(addPlaceToCollection).toHaveBeenCalled());
    // An event about a save that did not happen would be the same lie in
    // the other direction.
    expect(note).not.toHaveBeenCalled();
  });

  it('records no save for a plain new collection', async () => {
    const navigation = nav();
    render(<CollectionFormScreen navigation={navigation} route={routeWith()} />);
    create('Empty list');

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(addPlaceToCollection).not.toHaveBeenCalled();
    expect(note).not.toHaveBeenCalled();
  });
});

// ── the cover picker ──
//
// Four tiles to a line, one per place. The grid itself is geometry —
// `tile` off the window, `flexWrap` — and geometry is the one thing this
// runner cannot see: jsdom lays nothing out. What is testable is the
// rule that decides WHICH tiles exist, which is where the old behaviour
// was actually wrong.

const photo = (id: string, n = id) => ({ id, photo_uri: `https://x/${n}.jpg`, is_hidden: false });

const withPhotos = (slug: string, name: string, ids: string[]): Place => ({
  slug, name_en: name, name_vi: name, name_ja: null,
  place_photos: ids.map((id, i) => ({ ...photo(id), sort_order: i, is_cover: i === 0 })),
} as unknown as Place);

const listOf = (members: Place[], cover: object | null = null): Collection => ({
  id: 'c1', slug: 'night-bar', title_en: 'Night bar', title_vi: 'Night bar', title_ja: null,
  desc_en: null, desc_vi: null, desc_ja: null, curator_handle: null,
  cover, owner_id: 'u1', is_public: false, city_id: 'hanoi',
  collection_places: members.map((m, i) => ({ sort_order: i, places: { slug: m.slug } })),
} as unknown as Collection);

const openRename = (members: Place[], cover: object | null = null) => {
  catalog.data = members;
  saved.data = [listOf(members, cover)];
  render(<CollectionFormScreen navigation={nav()} route={routeWith({ slug: 'night-bar' })} />);
};

const HEIM = withPhotos('heim', 'Heim', ['h1', 'h2', 'h3', 'h4']);
const SAM = withPhotos('sam', 'SÂM Saigon', ['s1', 's2', 's3']);

describe('the cover picker', () => {
  const sel = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-selected');

  it('offers one tile per place, not one per photograph', () => {
    // Seven photographs between two places. The old rule drew seven
    // tiles and asked the reader to choose between four angles on the
    // same bar before they could choose between bars.
    openRename([HEIM, SAM]);

    expect(screen.getAllByRole('button', { name: 'Heim' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'SÂM Saigon' })).toHaveLength(1);
  });

  it('names each tile after its place, which a flat list of photos could not', () => {
    // Before this, every tile reached VoiceOver as an unnamed button —
    // a photograph out of a flat list of photographs has nothing to be
    // called.
    openRename([HEIM, SAM]);
    expect(screen.getByRole('button', { name: 'SÂM Saigon' })).toBeTruthy();
  });

  it('starts on Auto when no cover has been picked', () => {
    openRename([HEIM, SAM]);
    expect(sel('Auto')).toBe('true');
    expect(sel('Heim')).toBe('false');
  });

  it('rings the place whose photograph is the cover', () => {
    openRename([HEIM, SAM], photo('s1'));
    expect(sel('SÂM Saigon')).toBe('true');
    expect(sel('Auto')).toBe('false');
  });

  it("keeps a cover that is not the place's first photograph", () => {
    // The whole risk of narrowing the choices: somebody picked the third
    // photograph of Heim under the old rule. Drop its tile and the ring
    // sits on nothing, and a list that has a cover reads as having none.
    openRename([HEIM, SAM], photo('h3'));

    const tiles = screen.getAllByRole('button', { name: 'Heim' });
    expect(tiles).toHaveLength(2);
    expect(tiles.map((el) => el.getAttribute('aria-selected'))).toContain('true');
    expect(sel('Auto')).toBe('false');
  });

  it('moves the ring when a tile is tapped', () => {
    openRename([HEIM, SAM]);
    fireEvent.click(screen.getByRole('button', { name: 'SÂM Saigon' }));

    expect(sel('SÂM Saigon')).toBe('true');
    expect(sel('Auto')).toBe('false');
  });

  it('offers no picker at all for a brand-new list', () => {
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    expect(screen.queryByText('COVER')).toBeNull();
  });
});
