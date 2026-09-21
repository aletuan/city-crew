// @vitest-environment jsdom
//
// The bookmark→new-collection path, which #315 found had no coverage of
// the save signal at all. It is the flow every account's FIRST save takes
// — the save sheet routes here precisely when there is no list yet — and
// for as long as `history_on` has defaulted on, an unrecorded first save
// has been a real hole in real users' taste profiles, not a latent one.

import React from 'react';
import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '../uitest/render';
import type { Nav, RootRoute } from '../nav';
import type { Collection, Place } from '../lib/types';
import { DAILY_LIMIT } from '../lib/quota';

const createCollection = vi.hoisted(() => vi.fn(async () => 'new-list'));
const addPlaceToCollection = vi.hoisted(() => vi.fn(async () => {}));
const updateCollection = vi.hoisted(() => vi.fn(async () => {}));
const copyCollection = vi.hoisted(() => vi.fn(async () => 'copied-list'));
const goTo = vi.hoisted(() => vi.fn());
const note = vi.hoisted(() => vi.fn());
const reload = vi.hoisted(() => vi.fn());
// Mutable so a test can take the session or the city away — the two
// guards `submit` runs before it writes anything.
const who = vi.hoisted(() => ({
  session: { user: { id: 'u1' } } as { user: { id: string } } | null,
  city: { id: 'hanoi' } as { id: string } | null,
}));
// Mutable so a test can give the screen a list with places in it; the
// bookmark tests below leave both empty, as they always were.
const catalog = vi.hoisted(() => ({ data: [] as unknown[] }));
const saved = vi.hoisted(() => ({ data: [] as unknown[] }));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ session: who.session }),
}));
vi.mock('../lib/city', () => ({
  useCity: () => ({ city: who.city }),
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
  updateCollection,
  copyCollection,
}));
// `goTo` reaches for the container ref, which no test mounts; the rest of
// `nav` — `leaveAuth`, the types — stays real.
vi.mock('../nav', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  goTo,
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
  updateCollection.mockClear();
  copyCollection.mockClear();
  goTo.mockClear();
  note.mockClear();
  reload.mockClear();
  catalog.data = [];
  saved.data = [];
  who.session = { user: { id: 'u1' } };
  who.city = { id: 'hanoi' };
  // See `setup.tsx`: the spy has to sit on the `Alert` the screen imports.
  vi.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

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

  it('offers every photograph of every place', () => {
    // Seven photographs between two places, and all seven on offer: the
    // best picture of a bar is often not the one the catalog marked as
    // that bar's cover, and one tile apiece hid it with no way through.
    openRename([HEIM, SAM]);

    expect(screen.getAllByRole('button', { name: /^Heim/ })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: /^SÂM Saigon/ })).toHaveLength(3);
  });

  it('numbers the tiles within a place, which a flat list of photos could not', () => {
    // Before this, every tile reached VoiceOver as an unnamed button —
    // a photograph out of a flat list of photographs has nothing to be
    // called. "Heim" four times over would be no better.
    openRename([HEIM, SAM]);
    expect(screen.getByRole('button', { name: 'SÂM Saigon, photo 1 of 3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Heim, photo 4 of 4' })).toBeTruthy();
  });

  it('names a lone photograph after its place, with no number to give', () => {
    openRename([withPhotos('solo', 'Solo', ['x1'])]);
    expect(screen.getByRole('button', { name: 'Solo' })).toBeTruthy();
  });

  it('starts on Auto when no cover has been picked', () => {
    openRename([HEIM, SAM]);
    expect(sel('Auto')).toBe('true');
    expect(sel('Heim, photo 1 of 4')).toBe('false');
  });

  it('rings the photograph that is the cover, not merely its place', () => {
    openRename([HEIM, SAM], photo('s2'));
    expect(sel('SÂM Saigon, photo 2 of 3')).toBe('true');
    expect(sel('SÂM Saigon, photo 1 of 3')).toBe('false');
    expect(sel('Auto')).toBe('false');
  });

  it("keeps a cover that is not the place's first photograph", () => {
    // What narrowing the choices put at risk, and what showing all of
    // them settles: a cover picked deep in one place's photographs is
    // simply on offer like any other, and the ring sits on it.
    openRename([HEIM, SAM], photo('h3'));

    expect(sel('Heim, photo 3 of 4')).toBe('true');
    expect(sel('Auto')).toBe('false');
  });

  it('moves the ring when a tile is tapped', () => {
    openRename([HEIM, SAM]);
    fireEvent.click(screen.getByRole('button', { name: 'SÂM Saigon, photo 3 of 3' }));

    expect(sel('SÂM Saigon, photo 3 of 3')).toBe('true');
    expect(sel('Auto')).toBe('false');
  });

  it('offers no picker at all for a brand-new list', () => {
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    expect(screen.queryByText('COVER')).toBeNull();
  });
});

// ── the two guards, and the third verb ──
//
// The bookmark path above is one of three ways out of `submit`. Rename
// and copy were the other two, and neither had a test: the write each
// one makes, what a chosen cover adds to it, and where the screen goes
// afterwards. The refusals — an empty name, no session, the daily cap,
// the server saying no — were untested on all three.

const alerted = () => vi.mocked(Alert.alert).mock.calls.map(([title, body]) => [title, body]);

describe('what stops a submit before it writes', () => {
  it('asks for a name, and writes nothing', async () => {
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    create('   ');

    expect(await screen.findByText('Give the collection a name.')).toBeTruthy();
    expect(createCollection).not.toHaveBeenCalled();
  });

  // Unreachable in practice — the screen lives behind a control only
  // signed-in readers see — and checked anyway so the failure is a
  // sentence and not a crash on `session.user`.
  it('asks for a sign-in when there is no session', async () => {
    who.session = null;
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    create('Weekend list');

    expect(await screen.findByText('Sign in first.')).toBeTruthy();
    expect(createCollection).not.toHaveBeenCalled();
  });

  it('backs out through the header without writing', () => {
    const navigation = nav();
    render(<CollectionFormScreen navigation={navigation} route={routeWith()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigation.goBack).toHaveBeenCalled();
    expect(createCollection).not.toHaveBeenCalled();
  });

  it('says the same when the city has not resolved', async () => {
    who.city = null;
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    create('Weekend list');

    expect(await screen.findByText('Sign in first.')).toBeTruthy();
    expect(createCollection).not.toHaveBeenCalled();
  });
});

describe('renaming a list', () => {
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  it('opens on the list’s own words', () => {
    openRename([HEIM, SAM]);
    expect(screen.getByText('Rename your list')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  });

  it('writes the name, the description and the cover that was picked', async () => {
    openRename([HEIM, SAM]);
    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: ' Late bars ' } });
    fireEvent.change(screen.getByPlaceholderText('What ties these together?'), { target: { value: 'After midnight' } });
    fireEvent.click(screen.getByRole('button', { name: 'SÂM Saigon, photo 2 of 3' }));
    save();

    // Trimmed: the name is what was typed, not the spaces around it.
    await waitFor(() => expect(updateCollection).toHaveBeenCalledWith('night-bar', {
      title: 'Late bars', desc: 'After midnight', coverPhotoId: 's2',
    }));
    expect(createCollection).not.toHaveBeenCalled();
  });

  it('sends the current cover back when nothing was picked', async () => {
    // Not `null`: a save that touched only the name must not silently
    // drop the cover the reader chose last week.
    openRename([HEIM, SAM], photo('h3'));
    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Night bar' } });
    save();

    await waitFor(() => expect(updateCollection).toHaveBeenCalledWith('night-bar', expect.objectContaining({ coverPhotoId: 'h3' })));
  });

  it('finds a cover the cache knew only by its picture', async () => {
    // A row hydrated from a launch cache written before covers carried
    // their id arrives with the uri alone; the ring still has to sit on
    // the real cover, and the save still has to name it.
    openRename([HEIM, SAM], { photo_uri: 'https://x/s3.jpg' });
    expect(screen.getByRole('button', { name: 'SÂM Saigon, photo 3 of 3' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Night bar' } });
    save();
    await waitFor(() => expect(updateCollection).toHaveBeenCalledWith('night-bar', expect.objectContaining({ coverPhotoId: 's3' })));
  });

  it('falls back to Auto for a cover whose picture no member holds any more', async () => {
    // The place that carried it left the list, or its photograph was
    // hidden: nothing on offer matches, so the ring sits on Auto and a
    // save writes no cover rather than an id it cannot know.
    openRename([HEIM, SAM], { photo_uri: 'https://x/gone.jpg' });
    expect(screen.getByRole('button', { name: 'Auto' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Night bar' } });
    save();
    await waitFor(() => expect(updateCollection).toHaveBeenCalledWith('night-bar', expect.objectContaining({ coverPhotoId: null })));
  });

  it('opens with no picker when the list is not among mine', () => {
    // A slug the saved lists do not know — a row deleted on another
    // device since the menu was opened — is a rename of nothing: the
    // form still stands, with no members to draw covers from.
    catalog.data = [HEIM, SAM];
    saved.data = [listOf([HEIM, SAM])];
    render(<CollectionFormScreen navigation={nav()} route={routeWith({ slug: 'someone-elses', title: 'Theirs' })} />);
    expect(screen.getByText('Rename your list')).toBeTruthy();
    expect(screen.queryByText('COVER')).toBeNull();
  });

  it('returns to Auto when the reader picks it back', async () => {
    openRename([HEIM, SAM], photo('h3'));
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Night bar' } });
    save();

    await waitFor(() => expect(updateCollection).toHaveBeenCalledWith('night-bar', expect.objectContaining({ coverPhotoId: null })));
  });

  it('refreshes the shared list and goes back once saved', async () => {
    const navigation = nav();
    catalog.data = [HEIM];
    saved.data = [listOf([HEIM])];
    // The name rides in on the route, the way `CollectionDetail` sends it.
    render(<CollectionFormScreen navigation={navigation} route={routeWith({ slug: 'night-bar', title: 'Night bar' })} />);
    save();

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(reload).toHaveBeenCalled();
    expect(goTo).not.toHaveBeenCalled();
  });

  it('shows the Auto tile as the picture Auto would use', () => {
    // The chip wears the first place's own cover, so "what is the cover
    // right now" has a visible answer before anything is picked.
    openRename([HEIM, SAM]);
    const auto = screen.getByRole('button', { name: 'Auto' });
    expect(auto.querySelector('img')?.getAttribute('src')).toBe('https://x/h1.jpg');
  });

  it('leaves the Auto tile bare when the first place has no photograph', () => {
    // Nothing to preview, so the glass chip and the word — and no
    // picker at all would be wrong: the second place's pictures are
    // still on offer.
    const bare = withPhotos('bare', 'Bare', []);
    openRename([bare, SAM]);
    const auto = screen.getByRole('button', { name: 'Auto' });
    expect(auto.querySelector('img')).toBeNull();
    expect(screen.getAllByRole('button', { name: /^SÂM Saigon/ })).toHaveLength(3);
  });

  it('names the failure as a rename, in place and in a dialog', async () => {
    updateCollection.mockRejectedValueOnce(new Error('row is locked'));
    const navigation = nav();
    catalog.data = [HEIM];
    saved.data = [listOf([HEIM])];
    // The name rides in on the route, the way `CollectionDetail` sends it.
    render(<CollectionFormScreen navigation={navigation} route={routeWith({ slug: 'night-bar', title: 'Night bar' })} />);
    save();

    expect(await screen.findByText('Row is locked')).toBeTruthy();
    expect(alerted()).toEqual([['Could not save the changes', 'row is locked']]);
    expect(navigation.goBack).not.toHaveBeenCalled();
    // And the button is a button again, for another go.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  });
});

describe('saving a copy of somebody else’s list', () => {
  const SOURCE = { title: 'Hanoi by night', desc: 'By @linh', cityId: 'hanoi', placeSlugs: ['sam', 'heim'] };
  const openCopy = (navigation = nav()) => {
    catalog.data = [HEIM, SAM];
    render(<CollectionFormScreen navigation={navigation} route={routeWith({ copyFrom: SOURCE })} />);
    return navigation;
  };
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save the copy' }));

  it('opens prefilled with its provenance, as a suggestion in an editable field', () => {
    openCopy();
    expect(screen.getByText('Save a copy')).toBeTruthy();
    expect((screen.getByPlaceholderText('Weekend coffee') as HTMLInputElement).value).toBe('Copy of Hanoi by night');
    expect((screen.getByPlaceholderText('What ties these together?') as HTMLInputElement).value).toBe('By @linh');
  });

  it('cuts a long prefilled title to what one row holds', () => {
    catalog.data = [];
    render(<CollectionFormScreen navigation={nav()} route={routeWith({
      copyFrom: { ...SOURCE, title: 'x'.repeat(80), placeSlugs: [] },
    })} />);
    expect((screen.getByPlaceholderText('Weekend coffee') as HTMLInputElement).value).toHaveLength(60);
  });

  it('offers the source’s places as covers, in the source’s order', () => {
    // The members come from the route's slugs against the catalog — the
    // source belongs to somebody else, so "mine" cannot know it — and
    // the first of them is what Auto shows.
    openCopy();
    expect(screen.getAllByRole('button', { name: /^SÂM Saigon/ })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: /^Heim/ })).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Auto' }).querySelector('img')?.getAttribute('src')).toBe('https://x/s1.jpg');
  });

  it('is born on save, and lands on itself in the Collections tab', async () => {
    const navigation = openCopy();
    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Mine now' } });
    save();

    await waitFor(() => expect(copyCollection).toHaveBeenCalledWith({
      ownerId: 'u1', cityId: 'hanoi', title: 'Mine now', desc: 'By @linh', placeSlugs: ['sam', 'heim'],
    }));
    // Auto, the common case, needs no second write.
    expect(updateCollection).not.toHaveBeenCalled();
    expect(createCollection).not.toHaveBeenCalled();
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(reload).toHaveBeenCalled();
    expect(goTo).toHaveBeenCalledWith('Collections', {
      screen: 'CollectionDetail', initial: false, params: { slug: 'copied-list' },
    });
  });

  it('writes a chosen cover onto the copy in a second step', async () => {
    openCopy();
    fireEvent.click(screen.getByRole('button', { name: 'Heim, photo 2 of 4' }));
    save();

    await waitFor(() => expect(updateCollection).toHaveBeenCalledWith('copied-list', {
      title: 'Copy of Hanoi by night', desc: 'By @linh', coverPhotoId: 'h2',
    }));
    // In that order: the row has to exist before a cover can be put on it.
    expect(copyCollection.mock.invocationCallOrder[0]).toBeLessThan(updateCollection.mock.invocationCallOrder[0]);
  });

  it('names the failure as a copy', async () => {
    copyCollection.mockRejectedValueOnce(new Error('offline'));
    const navigation = openCopy();
    save();

    expect(await screen.findByText('No connection. Check your network and try again.')).toBeTruthy();
    expect(alerted()).toEqual([['Could not save a copy', 'offline']]);
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(goTo).not.toHaveBeenCalled();
  });
});

describe('the daily cap', () => {
  // Twenty lists, three hundred saves. The one refusal that is nobody's
  // fault and nothing to fix, so it gets its own words rather than the
  // server's — and a dialog, because the reader is about to leave with
  // nothing saved and should hear why before they do.
  it('says how much a day allows, and that tomorrow is fine', async () => {
    createCollection.mockRejectedValueOnce(new Error(DAILY_LIMIT));
    const navigation = nav();
    render(<CollectionFormScreen navigation={navigation} route={routeWith()} />);
    create('Twenty-first');

    const words = 'You can make 20 lists and save 300 places a day. Come back tomorrow.';
    expect(await screen.findByText(words)).toBeTruthy();
    expect(alerted()).toEqual([['That is enough for today', words]]);
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('names any other refusal of a new list as a create', async () => {
    createCollection.mockRejectedValueOnce('nope');
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    create('Twenty-first');

    // Not an `Error`, so the message is whatever String() makes of it.
    expect(await screen.findByText('Nope')).toBeTruthy();
    expect(alerted()).toEqual([['Could not create the collection', 'nope']]);
  });
});
