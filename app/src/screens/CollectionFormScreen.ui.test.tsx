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
import { act, cleanup, fireEvent, render, screen, viewStyleOf, waitFor } from '../uitest/render';
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
// The catalog's public lists — a separate copy from `mine`, and the one
// the Community tab and Explore draw a public list from.
const colsReload = vi.hoisted(() => vi.fn());
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
// The rest of the catalog's photographs, as `usePlacePhotos` answers, and
// what it was asked for.
const photos = vi.hoisted(() => ({ data: {} as Record<string, unknown[]>, asked: [] as (string[] | null)[] }));
// The owner's shares, as `useMyListShares` answers, and whose it was asked for.
const shares = vi.hoisted(() => ({ data: [] as unknown[], asked: [] as (string | null | undefined)[] }));

vi.mock('../lib/auth', () => {
  const m = {
    useAuth: () => ({ session: who.session }),
  };
  const all = () => (m as { useAuth: () => object }).useAuth();
  return { ...m, useSession: all, useProfile: all, useAuthActions: all, useAuthEvent: () => {} };
});
vi.mock('../lib/city', () => {
  const m = {
    useCity: () => ({ city: who.city }),
  };
  const all = () => (m as { useCity: () => object }).useCity();
  return { ...m, useCurrentCity: all, useCityList: all };
});
const lang = vi.hoisted(() => ({ now: 'en' as 'en' | 'vi' }));
vi.mock('../lib/i18n', () => ({
  useI18n: () => ({ lang: lang.now, setLang: () => {}, t: (en: string, vi?: string) => (lang.now === 'vi' ? vi ?? en : en) }),
}));
vi.mock('../lib/catalog', () => ({
  usePlaces: () => catalog,
  useCollections: () => ({ data: [], reload: colsReload }),
}));
vi.mock('../lib/save', () => {
  const useSave = () => ({ mine: { data: saved.data, reload } });
  return { useSave, useMyLists: () => (useSave() as { mine?: unknown }).mine, useSaveActions: () => useSave() };
});
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
  usePlacePhotos: (slugs: string[] | null) => { photos.asked.push(slugs); return { data: photos.data }; },
  useMyListShares: (owner: string | null | undefined) => { shares.asked.push(owner); return { data: shares.data }; },
}));
// `goTo` reaches for the container ref, which no test mounts; the rest of
// `nav` — `leaveAuth`, the types — stays real.
vi.mock('../nav', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  goTo,
}));

import CollectionFormScreen from './CollectionFormScreen';
import { colors } from '../theme';
import { CHIP_SLOP } from '../components/ui';

type BeforeRemove = (e: { preventDefault: () => void; data: { action: unknown } }) => void;
/** A navigator that, like the real one, asks every `beforeRemove`
 *  listener before the screen goes. `leave` says whether one held it. */
const listeners = new Set<BeforeRemove>();
const leave = () => {
  let held = false;
  for (const fn of [...listeners]) fn({ preventDefault: () => { held = true; }, data: { action: { type: 'GO_BACK' } } });
  return held;
};
// Opened over the list's page, as a rename always is: `leaveForm` hands
// the page what the sheet was told by the route under the form.
const nav = () => ({
  navigate: vi.fn(), goBack: vi.fn(), replace: vi.fn(), popToTop: vi.fn(), dispatch: vi.fn(),
  getState: vi.fn(() => ({ index: 1, routes: [{ name: 'CollectionDetail', key: 'page-1' }, { name: 'CollectionForm', key: 'form-1' }] })),
  addListener: vi.fn((name: string, fn: BeforeRemove) => {
    if (name !== 'beforeRemove') return () => {};
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }),
}) as unknown as Nav;

const routeWith = (params?: object) => ({ params }) as RootRoute<'CollectionForm'>;

/** The line at the form's head, pressed, and an answer in the sheet it
 *  opens. The sheet's row runs its press after the sheet has gone
 *  (`SheetRows`), hence the wait. */
/** The props React committed for the first element `pick` accepts —
 *  for a press's reach, which react-native-web does not draw. */
const propsWhere = (match: (p: Record<string, unknown>) => boolean): Record<string, unknown> => {
  type Fiber = { child: Fiber | null; sibling: Fiber | null; memoizedProps: Record<string, unknown> | null };
  const host = document.body.firstElementChild as unknown as Record<string, { stateNode: { current: Fiber } }>;
  const key = Object.keys(host).find((k) => k.startsWith('__reactContainer'))!;
  const stack: Fiber[] = [host[key].stateNode.current];
  while (stack.length) {
    const f = stack.pop()!;
    const p = f.memoizedProps;
    if (p && typeof p === 'object' && match(p)) return p;
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  throw new Error('no matching element in the committed tree');
};

const pick = async (v: 'public' | 'friends' | 'private') => {
  fireEvent.click(screen.getByTestId('collection-form-seen'));
  fireEvent.click(screen.getByTestId(`sheet-action-${v}`));
  const word = { public: 'Public', friends: 'Friends', private: 'Private' }[v];
  await waitFor(() => expect(screen.getByTestId('collection-form-seen').textContent!.startsWith(word)).toBe(true), { timeout: 3000 });
  // The sheet changes audience from a timer, outside fireEvent's act.
  // waitFor can see the committed words before react-native-web's
  // usePressEvents effect has reconfigured Save from disabled to enabled.
  // Flush that effect before the next press; waiting longer AFTER a
  // dropped press cannot deliver it (CI 44797970177, and local before it).
  await act(async () => {});
};

const create = (title: string) => {
  fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: title } });
  fireEvent.click(screen.getByRole('button', { name: 'Create collection' }));
};

beforeEach(() => {
  listeners.clear();
  photos.data = {};
  photos.asked = [];
  shares.data = [];
  shares.asked = [];
  createCollection.mockClear();
  addPlaceToCollection.mockClear();
  updateCollection.mockClear();
  copyCollection.mockClear();
  goTo.mockClear();
  note.mockClear();
  reload.mockClear();
  colsReload.mockClear();
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

  // Public unless changed, and the catalog's copy is asked again so the
  // list reaches Community once it has a place (owner, 20 Nov 2026).
  it('makes a new list public by default, and refreshes the catalog for it', async () => {
    const navigation = nav();
    render(<CollectionFormScreen navigation={navigation} route={routeWith({ addPlaceSlug: 'pho-10' })} />);
    create('Weekend list');
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(createCollection).toHaveBeenCalledWith(expect.objectContaining({ title: 'Weekend list', isPublic: true }));
    expect(colsReload).toHaveBeenCalled();
    expect(goTo).not.toHaveBeenCalled();
  });

  it('makes a list private when told, with no catalog refresh and nowhere else to go', async () => {
    const navigation = nav();
    render(<CollectionFormScreen navigation={navigation} route={routeWith()} />);
    await pick('private');
    create('Mine alone');
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(createCollection).toHaveBeenCalledWith(expect.objectContaining({ isPublic: false }));
    expect(colsReload).not.toHaveBeenCalled();
    expect(goTo).not.toHaveBeenCalled();
  });

  // Friends is choosing which: the list is made private, and opens with
  // the picker up — it becomes Friends when somebody is ticked there.
  it('makes a list for friends private and opens it to choose them', async () => {
    const navigation = nav();
    render(<CollectionFormScreen navigation={navigation} route={routeWith({ addPlaceSlug: 'pho-10' })} />);
    await pick('friends');
    create('For the crew');
    await waitFor(() => expect(goTo).toHaveBeenCalled());
    expect(createCollection).toHaveBeenCalledWith(expect.objectContaining({ isPublic: false }));
    expect(navigation.goBack).toHaveBeenCalled();
    expect(goTo).toHaveBeenCalledWith('Collections', { screen: 'CollectionDetail', initial: false, params: { slug: 'new-list', seen: 'friends' } });
    // A list just made is no rename: nothing is set on the route under.
    expect(navigation.dispatch).not.toHaveBeenCalled();
    // Into the list it just made, the place it was made for included.
    expect(addPlaceToCollection).toHaveBeenCalledWith('new-list', 'pho-10', 0);
    expect(colsReload).not.toHaveBeenCalled();
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

// ── the places a rename starts from ──
//
// The cover picker that stood here moved to the list's page on 22 Nov
// 2026 (`CollectionHero.ui.test`); the helpers stay, for the renames.

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

// ── the two guards, and the third verb ──
//
// The bookmark path above is one of three ways out of `submit`. Rename
// and copy were the other two, and neither had a test: the write each
// one makes and where the screen goes afterwards. The refusals — an empty
// name, no session, the daily cap, the server saying no — were untested
// on all three.

const alerted = () => vi.mocked(Alert.alert).mock.calls.map(([title, body]) => [title, body]);

describe('what stops a submit before it writes', () => {
  // Dimmed, not a button that answers with an error: the header's Create
  // stays inert until there is a name, spaces not counting.
  it('dims Create until there is a name, and writes nothing', async () => {
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    const button = () => screen.getByRole('button', { name: 'Create collection' });
    expect(button().getAttribute('aria-disabled')).toBe('true');
    create('   ');
    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(createCollection).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Rooftops' } });
    expect(button().getAttribute('aria-disabled')).not.toBe('true');
  });

  // Up in the header, so the cover grid can never push it off screen:
  // the short word on screen, the long one for VoiceOver, and nothing
  // left at the foot of the form, the old privacy footnote included.
  it('puts the submit in the header, with nothing after the form', () => {
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    const button = screen.getByRole('button', { name: 'Create collection' });
    expect(button.querySelector('[data-icon="checkmark"]')).toBeTruthy();
    expect(screen.getByTestId('collection-submit').querySelector('[data-icon="checkmark"]')).toBeTruthy();
    expect(screen.getByText('New collection').parentElement).toBe(button.parentElement);
    expect(screen.queryByText(/Private until you say so/)).toBeNull();
  });

  // A list of your own being made starts Public, and says so in the line
  // at the form's head, which opens the plane's sheet (owner, 20 Nov
  // 2026). No "Send a link": there is no list to send yet.
  it('starts a new list Public, in a line that opens the Share sheet', () => {
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    const line = screen.getByRole('button', { name: 'Public, Everyone can see it' });
    expect(line.getAttribute('data-testid')).toBe('collection-form-seen');
    // A pill (owner, 20 Nov 2026): the answer's name alone, the chevron
    // against it rather than at the row's far end, in the chip's shape,
    // as wide as its answer.
    expect(line.textContent).toBe('Public');
    const face = line.firstElementChild!;
    expect([...face.children].map((c) => c.getAttribute('data-icon') ?? c.textContent)).toEqual(['globe-outline', 'Public', 'chevron-down']);
    expect(viewStyleOf(face)).toMatchObject({ borderRadius: 999, minHeight: 32, backgroundColor: colors.surfaceGlass });
    expect(viewStyleOf(line).alignSelf).toBe('flex-start');
    // 32 drawn, 44 to the thumb, as every chip.
    expect(propsWhere((p) => p.testID === 'collection-form-seen' && 'hitSlop' in p).hitSlop).toEqual(CHIP_SLOP);
    expect(screen.queryByText('Who can see your list?')).toBeNull();
    fireEvent.click(line);
    expect(screen.getByText('Who can see your list?')).toBeTruthy();
    expect(['public', 'friends', 'private'].map((k) => screen.getByTestId(`sheet-action-${k}`).getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(screen.getByTestId('sheet-action-friends').textContent).toBe('FriendsOnce it is made, you choose who');
    expect(screen.getByTestId('sheet-action-public').textContent).toBe('PublicShown in Explore and in search');
    expect(screen.queryByTestId('collection-send-link')).toBeNull();
    // A list not yet made has no shares to read.
    expect(shares.asked.at(-1)).toBeNull();
  });

  it('moves the line to the answer chosen, and the sheet’s tick with it', async () => {
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    await pick('friends');
    expect(screen.getByTestId('collection-form-seen').textContent).toBe('Friends');
    expect(screen.getByTestId('collection-form-seen').querySelector('[data-icon="people-outline"]')).toBeTruthy();
    fireEvent.click(screen.getByTestId('collection-form-seen'));
    expect(screen.getByTestId('sheet-action-friends').getAttribute('aria-selected')).toBe('true');
  });

  // Chosen and not saved, it is a change like a name: leaving asks.
  it('asks before a new list’s answer is thrown away', async () => {
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    expect(leave()).toBe(false);
    await pick('private');
    // The guard is registered again by an effect, which may land a beat
    // after the line has redrawn: under CI's load it once had not (#1496).
    await waitFor(() => expect(leave()).toBe(true));
  });

  // The fields on the page itself (owner, 16 Nov 2026): small labels, no
  // glyph column, no boxes, a hairline over, between and under them.
  it('lays the name and the description on the page, between hairlines, with no glyphs', () => {
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    expect(screen.getByText('Collection name')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
    for (const icon of ['bookmark-outline', 'text-outline']) expect(document.querySelector(`[data-icon="${icon}"]`)).toBeNull();
    const rules = screen.getAllByTestId('collection-form-rule');
    expect(rules).toHaveLength(4);
    // In order down the page: a rule, the name, a rule, the description, a
    // rule, who sees it (owner, 22 Nov 2026: it stood over the fields), a
    // rule.
    const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const name = screen.getByPlaceholderText('Weekend coffee');
    const words = screen.getByPlaceholderText('What ties these together?');
    const order = [rules[0], name, rules[1], words, rules[2], screen.getByTestId('collection-form-seen'), rules[3]];
    order.slice(1).forEach((el, i) => expect([i, before(order[i], el)]).toEqual([i, true]));
    // No box: the row has no padding of its own, and no border.
    const row = name.parentElement!.parentElement as HTMLElement;
    expect([getComputedStyle(row).paddingLeft, getComputedStyle(row).borderTopWidth]).toEqual(['0px', '0px']);
    // Air: 22 over, 20 under (owner, 22 Nov 2026), from none.
    expect([getComputedStyle(row).paddingTop, getComputedStyle(row).paddingBottom]).toEqual(['22px', '20px']);
  });

  it('asks who can see it in a row under the fields: its name and question over the answer', () => {
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    const name = screen.getByText('Access');
    const ask = screen.getByText('Who can see this collection?');
    const answer = screen.getByTestId('collection-form-seen');
    const words = screen.getByPlaceholderText('What ties these together?');
    const after = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect([after(words, name), after(name, ask), after(ask, answer)]).toEqual([true, true, true]);
    // One row: the answer is beside the name, not a line of its own.
    expect(name.parentElement!.parentElement).toBe(answer.parentElement);
  });

  it('keeps the row when the answer cannot be changed, with the answer as words', () => {
    render(<CollectionFormScreen navigation={nav()} route={routeWith({ copyFrom: {
      sourceId: 'c-src', title: 'Theirs', desc: '', cityId: 'hanoi', placeSlugs: ['heim'],
    } })} />);
    expect(screen.getByText('Access')).toBeTruthy();
    expect(screen.getByTestId('collection-form-seen').getAttribute('role')).not.toBe('button');
  });

  // A plain new list is told nothing more than who can see it.
  it('adds no sentence to a plain new list', () => {
    render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
    expect(screen.queryByText(/nothing is copied until/)).toBeNull();
    expect(screen.queryByText(/goes in first/)).toBeNull();
  });

  // The one sentence each of the other two ways in still needs, about
  // what Save will do, under the line that says the list will be private.
  it('keeps the sentence a copy and a save-from-a-place need, under the line', () => {
    catalog.data = [HEIM];
    const { unmount } = render(<CollectionFormScreen navigation={nav()} route={routeWith({ copyFrom: {
      sourceId: 'c-src', title: 'Theirs', desc: '', cityId: 'hanoi', placeSlugs: ['heim'],
    } })} />);
    expect(screen.getByTestId('collection-form-seen').textContent).toBe('Private · Only you can see it');
    expect(screen.getByText('Make it yours before it saves — nothing is copied until you do.')).toBeTruthy();
    expect(screen.queryByText(/goes in first/)).toBeNull();
    unmount();
    render(<CollectionFormScreen navigation={nav()} route={routeWith({ addPlaceSlug: 'heim' })} />);
    // A list made from a place's save is one of your own: Public, and
    // the line can be pressed.
    expect(screen.getByRole('button', { name: 'Public, Everyone can see it' })).toBeTruthy();
    expect(screen.getByText('Name it, and the place you just saved goes in first.')).toBeTruthy();
    expect(screen.queryByText(/nothing is copied until/)).toBeNull();
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

  // UX-13: the form said "danh sách" one tap after a tab and a button
  // that said "Bộ sưu tập"; it is named in the tab's word now.
  it('is named in the word the Collections tab uses, new and edited alike', () => {
    lang.now = 'vi';
    try {
      render(<CollectionFormScreen navigation={nav()} route={routeWith()} />);
      expect(screen.getByText('Bộ sưu tập mới')).toBeTruthy();
      cleanup();
      openRename([HEIM, SAM]);
      expect(screen.getByText('Sửa bộ sưu tập')).toBeTruthy();
      expect(screen.queryByText(/danh sách/i)).toBeNull();
    } finally {
      lang.now = 'en';
    }
  });

  it('opens on the list’s own words', () => {
    openRename([HEIM, SAM]);
    expect(screen.getByText('Edit collection')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  });

  // The line under the title says what the list is now. It promised
  // "only you can see this one" on every rename, public lists included.
  // The list as it stands, in the page's own three answers. The sentence
  // this replaces knew two: a list shared with chosen friends was told
  // "Only you can see this list".
  describe('who can see it, in a line', () => {
    const seenAs = (over: object) => {
      catalog.data = [HEIM];
      saved.data = [{ ...(listOf([HEIM]) as object), ...over }];
      render(<CollectionFormScreen navigation={nav()} route={routeWith({ slug: 'night-bar' })} />);
      return screen.getByTestId('collection-form-seen');
    };
    const shared = (list: string) => [{ collection_id: list, user_id: 'friend-1', created_at: '2026-11-14T00:00:00Z' }];

    it('says a public list is public, to everyone', () => {
      const line = seenAs({ is_public: true });
      expect(line.textContent).toBe('Public');
      expect(line.querySelector('[data-icon="globe-outline"]')).toBeTruthy();
      expect(screen.queryByText(/will show to everyone/)).toBeNull();
      // The owner's shares, asked for by the owner's id.
      expect(shares.asked.at(-1)).toBe('u1');
    });

    it('says a private list is private', () => {
      const line = seenAs({ is_public: false });
      expect(line.textContent).toBe('Private');
      expect(line.querySelector('[data-icon="lock-closed-outline"]')).toBeTruthy();
    });

    it('says a list shared with friends is the friends’', () => {
      shares.data = shared('c1');
      const line = seenAs({ is_public: false });
      expect(line.textContent).toBe('Friends');
      expect(line.querySelector('[data-icon="people-outline"]')).toBeTruthy();
    });

    // Public wins over the shares, as on the page: the policies read it so.
    it('says public of a public list that is also shared, and private of one whose shares are another list’s', () => {
      shares.data = shared('c1');
      expect(seenAs({ is_public: true }).textContent).toBe('Public');
      cleanup();
      shares.data = shared('some-other-list');
      expect(seenAs({ is_public: false }).textContent).toBe('Private');
    });

    it('speaks the reader’s language', () => {
      lang.now = 'vi';
      try {
        expect(seenAs({ is_public: true }).textContent).toBe('Công khai');
      } finally {
        lang.now = 'en';
      }
    });

    it('adds no sentence to a rename', () => {
      seenAs({ is_public: true });
      expect(screen.queryByText(/nothing is copied until/)).toBeNull();
      expect(screen.queryByText(/goes in first/)).toBeNull();
    });

    // Pressed, the line opens the plane's sheet, as on the list's page —
    // "Send a link" included (owner, 20 Nov 2026).
    it('opens the Share sheet from the line, ticked where the list stands', () => {
      fireEvent.click(seenAs({ is_public: false }));
      expect(screen.getByText('Who can see your list?')).toBeTruthy();
      expect(['public', 'friends', 'private'].map((k) => screen.getByTestId(`sheet-action-${k}`).getAttribute('aria-selected'))).toEqual(['false', 'false', 'true']);
      expect(screen.getByTestId('sheet-action-friends').textContent).toBe('FriendsOnly the friends you choose');
      expect(screen.getByTestId('collection-send-link')).toBeTruthy();
    });

    const renameOver = (isPublic: boolean) => {
      const navigation = nav();
      catalog.data = [HEIM];
      saved.data = [{ ...(listOf([HEIM]) as object), is_public: isPublic }];
      render(<CollectionFormScreen navigation={navigation} route={routeWith({ slug: 'night-bar', title: 'Night bar' })} />);
      return navigation;
    };
    const saveButton = () => screen.getByRole('button', { name: 'Save changes' });
    // pick waits for both the audience and the press responder's effects.

    // Kept for Save like the name: the ✓ lights for it, and Save hands
    // it to the page under the form, which does it by its own sheet's
    // hands (`CollectionDetail`'s `seen`).
    it('keeps the answer for Save, then hands it to the list’s page', async () => {
      const navigation = renameOver(false);
      expect(saveButton().getAttribute('aria-disabled')).toBe('true');
      await pick('public');
      expect(saveButton().getAttribute('aria-disabled')).not.toBe('true');
      fireEvent.click(saveButton());
      await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
      expect(navigation.dispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'SET_PARAMS', payload: { params: { seen: 'public' } }, source: 'page-1',
      }));
      // Set before the page is uncovered, so it arrives already told.
      expect(vi.mocked(navigation.dispatch).mock.invocationCallOrder[0])
        .toBeLessThan(vi.mocked(navigation.goBack).mock.invocationCallOrder[0]);
      expect(goTo).not.toHaveBeenCalled();
    });

    it('hands the page nothing when the answer is where it was', async () => {
      const navigation = renameOver(true);
      await pick('private');
      await pick('public');
      expect(saveButton().getAttribute('aria-disabled')).toBe('true');
      fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Night bars' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
      expect(navigation.dispatch).not.toHaveBeenCalled();
    });

    // Friends on a rename is the page's picker, as on a new list.
    it('hands Friends to the page under it, which opens the picker', async () => {
      const navigation = renameOver(false);
      await pick('friends');
      fireEvent.click(saveButton());
      await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
      expect(navigation.dispatch).toHaveBeenCalledWith(expect.objectContaining({ payload: { params: { seen: 'friends' } } }));
      expect(goTo).not.toHaveBeenCalled();
    });
  });

  // Only the name stops a save, so the description's label says what it
  // is and nothing more — the "(optional)" rider came off on 10 Oct 2026.
  it('labels the description without calling it optional', () => {
    openRename([HEIM, SAM]);
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.queryByText(/optional/i)).toBeNull();
  });

  it('writes the name and the description, and no cover', async () => {
    openRename([HEIM, SAM]);
    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: ' Late bars ' } });
    fireEvent.change(screen.getByPlaceholderText('What ties these together?'), { target: { value: 'After midnight' } });
    save();

    // Trimmed: the name is what was typed, not the spaces around it. No
    // cover in it: that is the page's camera now, and a rename that sent
    // one would write over what the camera chose.
    await waitFor(() => expect(updateCollection).toHaveBeenCalledWith('night-bar', {
      title: 'Late bars', desc: 'After midnight',
    }));
    expect(createCollection).not.toHaveBeenCalled();
  });




  it('opens with no picker when the list is not among mine', () => {
    // A slug the saved lists do not know — a row deleted on another
    // device since the menu was opened — is a rename of nothing: the
    // form still stands, with no members to draw covers from.
    catalog.data = [HEIM, SAM];
    saved.data = [listOf([HEIM, SAM])];
    render(<CollectionFormScreen navigation={nav()} route={routeWith({ slug: 'someone-elses', title: 'Theirs' })} />);
    expect(screen.getByText('Edit collection')).toBeTruthy();
    expect(screen.queryByText('COVER')).toBeNull();
  });




  it('refreshes the shared list and goes back once saved', async () => {
    const navigation = nav();
    catalog.data = [HEIM];
    saved.data = [listOf([HEIM])];
    // The name rides in on the route, the way `CollectionDetail` sends it.
    render(<CollectionFormScreen navigation={navigation} route={routeWith({ slug: 'night-bar', title: 'Night bar' })} />);
    // An untouched rename has nothing to save; see `changed`.
    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Night bar, late' } });
    save();

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(reload).toHaveBeenCalled();
    expect(goTo).not.toHaveBeenCalled();
  });

  // A public list's cover, name and words are drawn from the catalog's
  // copy everywhere but "Yours"; saving left that copy as it was, so a new
  // cover stayed unseen on the Community tab until a pull (5 Nov 2026).
  describe('the public catalog', () => {
    const edit = (isPublic: boolean) => {
      const navigation = nav();
      catalog.data = [HEIM, SAM];
      saved.data = [{ ...(listOf([HEIM, SAM]) as object), is_public: isPublic }];
      render(<CollectionFormScreen navigation={navigation} route={routeWith({ slug: 'night-bar', title: 'Night bar' })} />);
      fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Late bars' } });
      return navigation;
    };

    it('is refetched once a public list’s rename is saved, and not before', async () => {
      let done!: () => void;
      updateCollection.mockImplementationOnce(() => new Promise<void>((r) => { done = r; }));
      const navigation = edit(true);
      save();
      await waitFor(() => expect(updateCollection).toHaveBeenCalled());
      expect(colsReload).not.toHaveBeenCalled();
      done();
      await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
      expect(colsReload).toHaveBeenCalledTimes(1);
      expect(reload).toHaveBeenCalled();
    });

    it('is left alone for a private list, which it does not hold', async () => {
      const navigation = edit(false);
      save();
      await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
      expect(reload).toHaveBeenCalled();
      expect(colsReload).not.toHaveBeenCalled();
    });

    it('is left alone when the save failed', async () => {
      updateCollection.mockRejectedValueOnce(new Error('row is locked'));
      edit(true);
      save();
      await screen.findByText('Row is locked');
      expect(colsReload).not.toHaveBeenCalled();
    });
  });

  // Lit only when the rename would write something new — and dim again
  // once the words are put back.
  it('lights ✓ only once the rename says something new', () => {
    catalog.data = [HEIM];
    saved.data = [listOf([HEIM])];
    render(<CollectionFormScreen navigation={nav()} route={routeWith({ slug: 'night-bar', title: 'Night bar' })} />);
    const button = () => screen.getByRole('button', { name: 'Save changes' });
    expect(button().getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(screen.getByPlaceholderText('What ties these together?'), { target: { value: 'After midnight' } });
    expect(button().getAttribute('aria-disabled')).not.toBe('true');
    fireEvent.change(screen.getByPlaceholderText('What ties these together?'), { target: { value: '' } });
    expect(button().getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Late bars' } });
    expect(button().getAttribute('aria-disabled')).not.toBe('true');
  });

  // Back, or the swipe, with something unsaved asks first; with nothing,
  // or once saved, it just goes.
  it('asks before discarding changes, and only then', async () => {
    catalog.data = [HEIM];
    saved.data = [listOf([HEIM])];
    const navigation = nav();
    render(<CollectionFormScreen navigation={navigation} route={routeWith({ slug: 'night-bar', title: 'Night bar' })} />);
    expect(leave()).toBe(false);
    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Night bar, late' } });
    expect(leave()).toBe(true);
    const [title, , buttons] = vi.mocked(Alert.alert).mock.calls[0];
    expect(title).toBe('Discard your changes?');
    buttons!.find((b) => b.text === 'Discard')!.onPress!();
    expect(navigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
    save();
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(leave()).toBe(false);
  });



  it('names the failure as a rename, in place and in a dialog', async () => {
    updateCollection.mockRejectedValueOnce(new Error('row is locked'));
    const navigation = nav();
    catalog.data = [HEIM];
    saved.data = [listOf([HEIM])];
    // The name rides in on the route, the way `CollectionDetail` sends it.
    render(<CollectionFormScreen navigation={navigation} route={routeWith({ slug: 'night-bar', title: 'Night bar' })} />);
    // An untouched rename has nothing to save; see `changed`.
    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Night bar, late' } });
    save();

    const message = await screen.findByText('Row is locked');
    // Above the fields, beside the Save that raised it, not under the
    // cover grid.
    const name = screen.getByPlaceholderText('Weekend coffee');
    expect(message.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(alerted()).toEqual([['Could not save the changes', 'row is locked']]);
    expect(navigation.goBack).not.toHaveBeenCalled();
    // And the button is a button again, for another go.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  });
});

describe('saving a copy of somebody else’s list', () => {
  const SOURCE = { sourceId: 'c-src', title: 'Hanoi by night', desc: 'By @linh', cityId: 'hanoi', placeSlugs: ['sam', 'heim'] };
  const openCopy = (navigation = nav()) => {
    catalog.data = [HEIM, SAM];
    render(<CollectionFormScreen navigation={navigation} route={routeWith({ copyFrom: SOURCE })} />);
    return navigation;
  };
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save the copy' }));

  // A copy is made private and does not ask (owner, 20 Nov 2026): somebody
  // else's choices under your name should not be one press away.
  it('offers no choice of who sees a copy, and says it is private', () => {
    openCopy();
    const line = screen.getByTestId('collection-form-seen');
    expect(line.textContent).toBe('Private · Only you can see it');
    expect(line.getAttribute('role')).toBeNull();
    expect(line.querySelector('[data-icon="chevron-down"]')).toBeNull();
    fireEvent.click(line);
    expect(screen.queryByText('Who can see your list?')).toBeNull();
  });

  // Edited and saved, the copy leaves without a discard question: the
  // changes went with it.
  it('leaves without asking once the copy is saved', async () => {
    const navigation = openCopy();
    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Late Hanoi' } });
    expect(leave()).toBe(true);
    save();
    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(leave()).toBe(false);
  });

  // Born on submit, so its prefilled suggestion is worth saving as it is.
  it('lights ✓ for an untouched copy', () => {
    openCopy();
    expect(screen.getByRole('button', { name: 'Save the copy' }).getAttribute('aria-disabled')).not.toBe('true');
  });


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


  it('is born on save, and lands on itself in the Collections tab', async () => {
    const navigation = openCopy();
    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Mine now' } });
    save();

    await waitFor(() => expect(copyCollection).toHaveBeenCalledWith({
      ownerId: 'u1', cityId: 'hanoi', title: 'Mine now', desc: 'By @linh', placeSlugs: ['sam', 'heim'],
      copiedFrom: 'c-src',
      // And not a word about chips: a copy's are its places'.
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

// No chips in the form (owner, 16 Nov 2026). From 15 Oct it showed every
// kind the list's places carry, each a toggle that hid it from the list's
// page; the kinds are worked out from the places now and the form has
// nothing to say about them — see `lib/collectionKinds`.
describe('the categories', () => {
  const typed = (p: Place, ...categories: string[]) => ({ ...(p as object), categories }) as unknown as Place;
  const CAFE = typed(HEIM, 'cafes');
  const BAR = typed(SAM, 'nightlife', 'cafes');
  const rename = (over: object = {}) => {
    catalog.data = [CAFE, BAR];
    saved.data = [{ ...(listOf([CAFE, BAR]) as object), ...over }];
    render(<CollectionFormScreen navigation={nav()} route={routeWith({ slug: 'night-bar', title: 'Night bar' })} />);
  };

  it('are not in the form, whatever the places carry', () => {
    rename();
    expect(screen.queryByTestId('collection-kinds-field')).toBeNull();
    expect(screen.queryByText('CATEGORIES')).toBeNull();
    expect(screen.queryByText('Cafés')).toBeNull();
    expect(screen.queryByText('Nightlife')).toBeNull();
    // Nor the cover picker, which moved to the list's page (22 Nov 2026):
    // not a heading, and not a tile, though both places hold photographs.
    expect(screen.queryByText('COVER')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Heim/ })).toBeNull();
  });

  // A row that still holds a kind hidden on an older build is saved
  // without a word about it: this form neither clears it nor repeats it.
  it('are not in what a rename saves, on a row that still holds one hidden', async () => {
    rename({ kinds_hidden: ['nightlife'] });
    expect(screen.getByRole('button', { name: 'Save changes' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(screen.getByPlaceholderText('Weekend coffee'), { target: { value: 'Late bars' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateCollection).toHaveBeenCalled());
    expect(updateCollection.mock.calls[0]).toEqual(['night-bar', { title: 'Late bars', desc: '' }]);
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
