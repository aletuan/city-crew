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

const createCollection = vi.hoisted(() => vi.fn(async () => 'new-list'));
const addPlaceToCollection = vi.hoisted(() => vi.fn(async () => {}));
const note = vi.hoisted(() => vi.fn());
const reload = vi.hoisted(() => vi.fn());

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
  usePlaces: () => ({ data: [] }),
}));
vi.mock('../lib/save', () => ({
  useSave: () => ({ mine: { data: [], reload } }),
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
